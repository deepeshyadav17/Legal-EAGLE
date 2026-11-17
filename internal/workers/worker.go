package workers

import (
	"context"
	"log/slog"
	"math"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/modules/bookings"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/shared"
)

// Coordinator runs idempotent background sweeps over PostgreSQL / Store without Redis.
// Responsibilities:
//  1. Expire 10-minute temporary payment holds
//  2. Expire 12-hour lawyer response deadlines (and initiate full refunds)
//  3. Expire 12-hour client reschedule deadlines (and initiate full refunds)
//  4. Process transactional outbox events with exponential backoff
type Coordinator struct {
	store      *database.Store
	bookingSvc *bookings.Service
	log        *slog.Logger
	interval   time.Duration
}

func NewCoordinator(store *database.Store, bookingSvc *bookings.Service, log *slog.Logger, interval time.Duration) *Coordinator {
	if interval <= 0 {
		interval = 5 * time.Second
	}
	return &Coordinator{
		store:      store,
		bookingSvc: bookingSvc,
		log:        log,
		interval:   interval,
	}
}

// Start runs the background worker loop until ctx is cancelled.
func (w *Coordinator) Start(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	w.log.Info("PostgreSQL background worker started", "interval", w.interval.String())

	for {
		select {
		case <-ctx.Done():
			w.log.Info("PostgreSQL background worker stopped gracefully")
			return
		case <-ticker.C:
			w.RunOnce(ctx, time.Now().UTC())
		}
	}
}

// RunOnce executes a single idempotent sweep at `now`. Safe to call directly in tests.
func (w *Coordinator) RunOnce(ctx context.Context, now time.Time) {
	// 1. Release expired 10-minute payment holds
	_ = w.store.WithTx(ctx, func(_ pgx.Tx) error {
		w.bookingSvc.ReleaseExpiredHoldsLocked(now)
		return nil
	})

	// 2. Collect bookings whose lawyer response deadline or client reschedule deadline has passed
	var expiredBookingIDs []struct {
		id     string
		reason string
	}
	_ = w.store.WithTx(ctx, func(_ pgx.Tx) error {
		for _, bk := range w.store.Bookings {
			if (bk.BookingStatus == shared.BookingAwaitingLawyer || bk.BookingStatus == shared.BookingRescheduleProposed) &&
				bk.ResponseDeadline != nil && !bk.ResponseDeadline.After(now) {
				reason := "Lawyer response deadline expired without action"
				if bk.BookingStatus == shared.BookingRescheduleProposed {
					reason = "Client reschedule response deadline expired without action"
				}
				expiredBookingIDs = append(expiredBookingIDs, struct {
					id     string
					reason string
				}{id: bk.ID, reason: reason})
			}
		}
		return nil
	})

	for _, item := range expiredBookingIDs {
		_, _ = w.bookingSvc.ExpireBooking(ctx, item.id, item.reason)
	}

	// 3. Process pending outbox events with exponential backoff
	_ = w.store.WithTx(ctx, func(tx pgx.Tx) error {
		for _, ev := range w.store.Outbox {
			if (ev.Status == "PENDING" || ev.Status == "FAILED") && !ev.NextAttemptAt.After(now) && ev.Attempts < 5 {
				ev.Attempts++
				ev.Status = "PROCESSED"
				ev.ProcessedAt = &now
				if tx != nil {
					_, _ = tx.Exec(ctx, `
						UPDATE outbox_events
						SET status = 'PROCESSED', attempts = $2, processed_at = $3
						WHERE id::text = $1
					`, ev.ID, ev.Attempts, now)
				}
			} else if ev.Status == "FAILED" && ev.Attempts < 5 {
				backoff := time.Duration(math.Pow(2, float64(ev.Attempts))) * time.Second
				ev.NextAttemptAt = now.Add(backoff)
			}
		}
		return nil
	})
}

