package bookings

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/modules/payments"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/shared"
)

// RefundRequester is the narrow interface Booking Service uses to request a refund
// from the Payment module without touching payment/refund records directly.
type RefundRequester interface {
	InitiateFullRefundInTx(ctx context.Context, tx pgx.Tx, bookingID, reason string) (*sqlcgen.Refund, error)
}

type Service struct {
	store      *database.Store
	paymentSvc *payments.Service
	cfg        *config.Config
}

func NewService(store *database.Store, paymentSvc *payments.Service, cfg *config.Config) *Service {
	return &Service{
		store:      store,
		paymentSvc: paymentSvc,
		cfg:        cfg,
	}
}

// EnrichBooking attaches lawyer summary, client summary, slot details, payment, refund, and latest proposal.
func (s *Service) EnrichBooking(b *sqlcgen.Booking) map[string]any {
	if b == nil {
		return nil
	}
	var lawyerDTO any
	if l, ok := s.store.Lawyers[b.LawyerID]; ok {
		lawyerDTO = shared.BuildLawyerSummary(s.store, l)
	}
	var clientDTO any
	if cl, ok := s.store.Clients[b.ClientID]; ok {
		clientDTO = map[string]any{
			"id":    cl.ID,
			"name":  cl.Name,
			"email": cl.Email,
			"city":  cl.City,
		}
	}
	var origSlot, finalSlot *sqlcgen.ConsultationSlot
	if sl, ok := s.store.Slots[b.OriginalSlotID]; ok {
		cp := *sl
		cp.Status = shared.FrontendSlotStatus(cp.BackendStatus)
		origSlot = &cp
	}
	if sl, ok := s.store.Slots[b.FinalSlotID]; ok {
		cp := *sl
		cp.Status = shared.FrontendSlotStatus(cp.BackendStatus)
		finalSlot = &cp
	} else {
		finalSlot = origSlot
	}

	var payObj *sqlcgen.Payment
	for _, p := range s.store.Payments {
		if p.BookingID == b.ID || (b.PaymentID != nil && p.ID == *b.PaymentID) {
			cp := *p
			payObj = &cp
			break
		}
	}
	var refObj *sqlcgen.Refund
	for _, r := range s.store.Refunds {
		if r.BookingID == b.ID {
			cp := *r
			refObj = &cp
			break
		}
	}
	var latestProp *sqlcgen.RescheduleProposal
	for _, pr := range s.store.Proposals {
		if pr.BookingID == b.ID {
			if latestProp == nil || pr.CreatedAt.After(latestProp.CreatedAt) {
				cp := *pr
				if ps, ok := s.store.Slots[cp.ProposedSlotID]; ok {
					psCopy := *ps
					psCopy.Status = shared.FrontendSlotStatus(psCopy.BackendStatus)
					cp.ProposedSlot = &psCopy
				}
				latestProp = &cp
			}
		}
	}

	return map[string]any{
		"id":               b.ID,
		"clientId":         b.ClientID,
		"lawyerId":         b.LawyerID,
		"firmId":           b.FirmID,
		"originalSlotId":   b.OriginalSlotID,
		"finalSlotId":      b.FinalSlotID,
		"mode":             b.Mode,
		"consultationFee":  b.ConsultationFee,
		"platformFee":      b.PlatformFee,
		"taxAmount":        b.TaxAmount,
		"totalAmount":      b.TotalAmount,
		"currency":         b.Currency,
		"bookingStatus":    b.BookingStatus,
		"paymentId":        b.PaymentID,
		"holdExpiresAt":    b.HoldExpiresAt,
		"responseDeadline": b.ResponseDeadline,
		"clientNotes":      b.ClientNotes,
		"declineReason":    b.DeclineReason,
		"meetingLink":      b.MeetingLink,
		"officeLocation":   b.OfficeLocation,
		"timeline":         b.Timeline,
		"createdAt":        b.CreatedAt,
		"updatedAt":        b.UpdatedAt,
		"lawyer":           lawyerDTO,
		"client":           clientDTO,
		"originalSlot":     origSlot,
		"finalSlot":        finalSlot,
		"payment":          payObj,
		"refund":           refObj,
		"proposal":         latestProp,
	}
}

func (s *Service) computeDeadline(window time.Duration, slot *sqlcgen.ConsultationSlot) time.Time {
	target := time.Now().UTC().Add(window)
	if slot != nil && slot.StartsAtUTC.After(time.Now().UTC()) && slot.StartsAtUTC.Before(target) {
		return slot.StartsAtUTC
	}
	return target
}

// ReleaseExpiredHoldsLocked releases any 10-minute payment holds whose reservedUntil has passed.
func (s *Service) ReleaseExpiredHoldsLocked(now time.Time) int {
	released := 0
	for _, slot := range s.store.Slots {
		if slot.BackendStatus == shared.SlotHeld && slot.ReservedUntil != nil && !slot.ReservedUntil.After(now) {
			slot.BackendStatus = shared.SlotAvailable
			slot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
			slot.ReservedUntil = nil
			if slot.BookingID != nil {
				if bk, ok := s.store.Bookings[*slot.BookingID]; ok && bk.BookingStatus == shared.BookingPaymentPending {
					bk.BookingStatus = shared.BookingExpired
					bk.HoldExpiresAt = nil
					bk.UpdatedAt = now
					bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
						Step:  "HOLD_EXPIRED",
						Label: "10-minute temporary slot reservation expired before payment completion",
						At:    now,
					})
				}
				slot.BookingID = nil
			}
			released++
		}
	}
	return released
}

type CreateHoldInput struct {
	ClientID         string `json:"-"`
	LawyerID         string `json:"lawyerId" binding:"required"`
	SlotID           string `json:"slotId" binding:"required"`
	ConsultationMode string `json:"consultationMode" binding:"required"`
	ClientNotes      string `json:"clientNotes"`
	IdempotencyKey   string `json:"idempotencyKey"`
}

// CreateBookingHold reserves a 1-hour slot for 10 minutes inside a serialized transaction.
func (s *Service) CreateBookingHold(ctx context.Context, in CreateHoldInput) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		now := time.Now().UTC()
		s.ReleaseExpiredHoldsLocked(now)

		if in.IdempotencyKey != "" {
			if rec, ok := s.store.IdempotencyKeys[in.IdempotencyKey]; ok && rec.UserID == in.ClientID && rec.ExpiresAt.After(now) {
				_ = json.Unmarshal(rec.ResponseBody, &out)
				return nil
			}
		}

		lawyer, ok := s.store.Lawyers[in.LawyerID]
		if !ok || !lawyer.IsActive {
			return shared.NewNotFound("Lawyer not found or inactive.")
		}
		cs := shared.ConsultationInfoForLawyer(s.store, in.LawyerID)
		mode := strings.ToUpper(strings.TrimSpace(in.ConsultationMode))
		modeAllowed := false
		for _, m := range cs.AvailableModes {
			if strings.EqualFold(m, mode) {
				modeAllowed = true
				break
			}
		}
		if !modeAllowed {
			return shared.NewBadRequest(fmt.Sprintf("This lawyer does not currently offer %s consultations.", mode))
		}

		slot, ok := s.store.Slots[in.SlotID]
		if !ok || slot.LawyerID != in.LawyerID {
			return shared.NewNotFound("Selected time slot does not exist for this lawyer.")
		}
		for _, bDate := range cs.BlockedDates {
			if bDate == slot.Date {
				return shared.NewConflict("This date is blocked by the lawyer.")
			}
		}
		if slot.BackendStatus != shared.SlotAvailable {
			return shared.NewConflict("This 1-hour slot is no longer available. Please choose another time slot.")
		}

		holdExp := now.Add(s.cfg.BookingHoldDuration)
		bkID := "bk_" + uuid.NewString()[:8]
		var firmID *string
		if mem := shared.ActiveMembershipForLawyer(s.store, in.LawyerID); mem != nil {
			fid := mem.FirmID
			firmID = &fid
		}

		// Lock slot for 10 minutes
		slot.BackendStatus = shared.SlotHeld
		slot.Status = shared.FrontendSlotStatus(shared.SlotHeld)
		slot.ReservedUntil = &holdExp
		slot.BookingID = &bkID

		// Server-side price calculation (never trusts client-submitted fee)
		fee := cs.Fee
		booking := &sqlcgen.Booking{
			UUID:            uuid.New(),
			ID:              bkID,
			ClientID:        in.ClientID,
			LawyerID:        in.LawyerID,
			FirmID:          firmID,
			OriginalSlotID:  slot.ID,
			FinalSlotID:     slot.ID,
			Mode:            mode,
			ConsultationFee: fee,
			PlatformFee:     0,
			TaxAmount:       0,
			TotalAmount:     fee,
			Currency:        cs.Currency,
			BookingStatus:   shared.BookingPaymentPending,
			HoldExpiresAt:   &holdExp,
			ClientNotes:     strings.TrimSpace(in.ClientNotes),
			OfficeLocation:  cs.OfficeLocation,
			Timeline: []sqlcgen.TimelineStep{
				{
					Step:  "SLOT_SELECTED",
					Label: fmt.Sprintf("1-Hour Slot Reserved (%s, %s–%s) — 10-min payment hold active", slot.Date, slot.StartTime, slot.EndTime),
					At:    now,
				},
			},
			CreatedAt: now,
			UpdatedAt: now,
		}
		s.store.Bookings[bkID] = booking

		// Also create the initial PENDING payment attempt so checkout is ready
		_, err := s.paymentSvc.CreatePaymentOrderInTx(ctx, tx, booking)
		if err != nil {
			return err
		}

		s.store.WriteOutboxSync(ctx, tx, "booking", bkID, "BOOKING_HOLD_CREATED", map[string]any{
			"bookingId":     bkID,
			"slotId":        slot.ID,
			"holdExpiresAt": holdExp,
		})

		out = s.EnrichBooking(booking)
		if in.IdempotencyKey != "" {
			raw, _ := json.Marshal(out)
			s.store.IdempotencyKeys[in.IdempotencyKey] = &sqlcgen.IdempotencyRecord{
				Key:            in.IdempotencyKey,
				UserID:         in.ClientID,
				Endpoint:       "POST /api/v1/booking-holds",
				ResponseStatus: 201,
				ResponseBody:   raw,
				ExpiresAt:      now.Add(24 * time.Hour),
				CreatedAt:      now,
			}
		}
		return nil
	})
	return out, err
}

// VerifyPaymentWebhook processes a verified payment webhook idempotently.
// Handles both normal payment verification ( -> AWAITING_LAWYER ) and late-payment after hold expiry ( -> REFUND_PENDING ).
func (s *Service) VerifyPaymentWebhook(ctx context.Context, bookingID, providerOrderID, providerPaymentID string, amount float64, currency string, forceExpiredHold bool) (map[string]any, error) {
	var result map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		pay, alreadyProcessed, err := s.paymentSvc.MarkPaymentPaidInTx(ctx, tx, bookingID, providerOrderID, providerPaymentID, amount, currency)
		if err != nil {
			return err
		}
		bk, ok := s.store.Bookings[pay.BookingID]
		if !ok {
			return shared.NewNotFound("Booking not found for payment.")
		}
		if alreadyProcessed {
			result = map[string]any{
				"idempotent":  true,
				"booking":     s.EnrichBooking(bk),
				"payment":     pay,
				"latePayment": bk.BookingStatus == shared.BookingRefundPending || bk.BookingStatus == shared.BookingRefunded,
			}
			return nil
		}

		now := time.Now().UTC()
		slot := s.store.Slots[bk.OriginalSlotID]
		holdExpired := forceExpiredHold ||
			bk.BookingStatus == shared.BookingExpired ||
			(bk.HoldExpiresAt != nil && !bk.HoldExpiresAt.After(now)) ||
			slot == nil ||
			(slot.BookingID != nil && *slot.BookingID != bk.ID)

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		lawyerUserID := s.store.ResolveUserIDByProfile("LAWYER", bk.LawyerID)

		if holdExpired {
			if slot != nil && slot.BookingID != nil && *slot.BookingID == bk.ID && slot.BackendStatus == shared.SlotHeld {
				slot.BackendStatus = shared.SlotAvailable
				slot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
				slot.ReservedUntil = nil
				slot.BookingID = nil
			}
			if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRefundPending); err != nil {
				return err
			}
			bk.BookingStatus = shared.BookingRefundPending
			bk.HoldExpiresAt = nil
			bk.UpdatedAt = now
			bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
				Step:  "LATE_PAYMENT_RECOVERY",
				Label: fmt.Sprintf("Payment (%s) arrived after temporary slot hold expired — automatic full refund initiated", *pay.TransactionReference),
				At:    now,
			})
			ref, err := s.paymentSvc.InitiateFullRefundInTx(ctx, tx, bk.ID, "Payment verification arrived after 10-minute slot hold expired. Automatic full refund initiated.")
			if err != nil {
				return err
			}
			bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
				Step:  "REFUND_INITIATED",
				Label: fmt.Sprintf("Full Refund Initiated (₹%.0f)", ref.Amount),
				At:    ref.InitiatedAt,
			})
			s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifRefundInitiated,
				"Slot Hold Expired — Full Refund Initiated",
				fmt.Sprintf("Your payment (%s) arrived after the 10-minute slot hold expired. A full refund of ₹%.0f has been initiated.", *pay.TransactionReference, ref.Amount))

			result = map[string]any{
				"booking":     s.EnrichBooking(bk),
				"payment":     pay,
				"refund":      ref,
				"latePayment": true,
			}
			return nil
		}

		// Normal verified payment -> AWAITING_LAWYER (never "Confirmed")
		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingAwaitingLawyer); err != nil {
			return err
		}
		deadline := s.computeDeadline(s.cfg.LawyerResponseWindow, slot)
		bk.BookingStatus = shared.BookingAwaitingLawyer
		bk.HoldExpiresAt = nil
		bk.ResponseDeadline = &deadline
		bk.UpdatedAt = now

		slot.BackendStatus = shared.SlotAwaitingLawyer
		slot.Status = shared.FrontendSlotStatus(shared.SlotAwaitingLawyer)
		slot.ReservedUntil = nil
		slot.BookingID = &bk.ID

		bk.Timeline = append(bk.Timeline,
			sqlcgen.TimelineStep{
				Step:  "PAYMENT_SUCCESS",
				Label: fmt.Sprintf("Payment Verified (₹%.0f · %s)", pay.Amount, *pay.TransactionReference),
				At:    now,
			},
			sqlcgen.TimelineStep{
				Step:  "AWAITING_LAWYER",
				Label: "Booking Request Submitted — Awaiting Lawyer Approval",
				At:    now,
			},
		)

		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifPaymentSuccess,
			"Payment Successful — Awaiting Lawyer Approval",
			fmt.Sprintf("Payment of ₹%.0f (%s) received for booking %s. Your request is awaiting lawyer approval.", pay.Amount, *pay.TransactionReference, bk.ID))
		s.store.CreateNotificationSync(ctx, tx, lawyerUserID, &bk.ID, shared.NotifNewBookingRequest,
			"New Consultation Request",
			fmt.Sprintf("Paid 1-hour consultation request (%s) on %s (%s–%s) is awaiting your decision.", bk.ID, slot.Date, slot.StartTime, slot.EndTime))
		s.store.WriteOutboxSync(ctx, tx, "booking", bk.ID, "PAYMENT_VERIFIED_AWAITING_LAWYER", map[string]any{"bookingId": bk.ID})

		result = map[string]any{
			"booking":     s.EnrichBooking(bk),
			"payment":     pay,
			"latePayment": false,
		}
		return nil
	})
	return result, err
}

// FailPaymentAndReleaseHold marks the payment attempt as FAILED and releases the temporary slot hold.
func (s *Service) FailPaymentAndReleaseHold(ctx context.Context, bookingID, reason string) (map[string]any, error) {
	var result map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		pay, err := s.paymentSvc.MarkPaymentFailedInTx(ctx, tx, bookingID, reason)
		if err != nil {
			return err
		}
		if slot, exists := s.store.Slots[bk.OriginalSlotID]; exists && slot.BookingID != nil && *slot.BookingID == bk.ID && slot.BackendStatus == shared.SlotHeld {
			slot.BackendStatus = shared.SlotAvailable
			slot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
			slot.ReservedUntil = nil
			slot.BookingID = nil
		}
		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingExpired); err != nil {
			return err
		}
		now := time.Now().UTC()
		bk.BookingStatus = shared.BookingExpired
		bk.HoldExpiresAt = nil
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "PAYMENT_FAILED",
			Label: fmt.Sprintf("%s — Temporary slot reservation released", reason),
			At:    now,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifPaymentFailed,
			"Payment Failed — Slot Hold Released",
			fmt.Sprintf("Payment for booking %s could not be completed (%s). Your temporary slot hold has been released.", bk.ID, reason))

		result = map[string]any{
			"booking": s.EnrichBooking(bk),
			"payment": pay,
		}
		return nil
	})
	return result, err
}

// AcceptBooking allows the assigned lawyer to confirm an AWAITING_LAWYER booking.
func (s *Service) AcceptBooking(ctx context.Context, bookingID, lawyerID string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking request not found.")
		}
		if bk.LawyerID != lawyerID {
			return shared.NewForbidden("Only the lawyer assigned to this booking can accept it.")
		}
		if bk.BookingStatus != shared.BookingAwaitingLawyer {
			return shared.NewConflict(fmt.Sprintf("Cannot accept a booking in %s status.", bk.BookingStatus))
		}
		now := time.Now().UTC()
		if bk.ResponseDeadline != nil && now.After(*bk.ResponseDeadline) {
			return shared.NewConflict("The lawyer response deadline for this booking has passed.")
		}
		slot, ok := s.store.Slots[bk.FinalSlotID]
		if !ok || (slot.BookingID != nil && *slot.BookingID != bk.ID) {
			return shared.NewConflict("The reserved time slot is no longer assigned to this booking.")
		}
		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingConfirmed); err != nil {
			return err
		}

		bk.BookingStatus = shared.BookingConfirmed
		bk.ResponseDeadline = nil
		bk.UpdatedAt = now
		if bk.Mode == "ONLINE" && bk.MeetingLink == nil {
			link := fmt.Sprintf("https://meet.legaleagle.example.com/session-%s", bk.ID)
			bk.MeetingLink = &link
		}

		slot.BackendStatus = shared.SlotConfirmed
		slot.Status = shared.FrontendSlotStatus(shared.SlotConfirmed)
		slot.BookingID = &bk.ID

		lawyerName := "Advocate"
		if l, exists := s.store.Lawyers[lawyerID]; exists {
			lawyerName = l.Name
		}
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "BOOKING_CONFIRMED",
			Label: fmt.Sprintf("Appointment Confirmed by %s for %s, %s–%s", lawyerName, slot.Date, slot.StartTime, slot.EndTime),
			At:    now,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifBookingConfirmed,
			"Consultation Confirmed",
			fmt.Sprintf("Your consultation with %s is confirmed for %s, %s–%s.", lawyerName, slot.Date, slot.StartTime, slot.EndTime))
		s.store.WriteOutboxSync(ctx, tx, "booking", bk.ID, "BOOKING_CONFIRMED", map[string]any{"bookingId": bk.ID})
		s.store.WriteAuditSync(ctx, tx, lawyerID, "LAWYER", "BOOKING_ACCEPTED", "booking", bk.ID, "", nil)

		out = s.EnrichBooking(bk)
		return nil
	})
	return out, err
}

// DeclineBooking allows the assigned lawyer to decline an AWAITING_LAWYER booking,
// releasing the slot and requesting a full refund from the Payment module.
func (s *Service) DeclineBooking(ctx context.Context, bookingID, lawyerID, reason string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking request not found.")
		}
		if bk.LawyerID != lawyerID {
			return shared.NewForbidden("Only the lawyer assigned to this booking can decline it.")
		}
		if bk.BookingStatus != shared.BookingAwaitingLawyer {
			return shared.NewConflict(fmt.Sprintf("Cannot decline a booking in %s status.", bk.BookingStatus))
		}

		if slot, exists := s.store.Slots[bk.OriginalSlotID]; exists && slot.BookingID != nil && *slot.BookingID == bk.ID {
			slot.BackendStatus = shared.SlotAvailable
			slot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
			slot.BookingID = nil
			slot.ReservedUntil = nil
		}

		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingDeclined); err != nil {
			return err
		}
		now := time.Now().UTC()
		bk.BookingStatus = shared.BookingDeclined
		bk.ResponseDeadline = nil
		bk.UpdatedAt = now
		cleanReason := strings.TrimSpace(reason)
		if cleanReason == "" {
			cleanReason = "Lawyer unavailable for the requested consultation window."
		}
		bk.DeclineReason = cleanReason
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "BOOKING_DECLINED",
			Label: fmt.Sprintf("Declined by Lawyer (%s)", cleanReason),
			At:    now,
		})

		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRefundPending); err != nil {
			return err
		}
		bk.BookingStatus = shared.BookingRefundPending

		ref, err := s.paymentSvc.InitiateFullRefundInTx(ctx, tx, bk.ID, "Lawyer declined booking request: "+cleanReason)
		if err != nil {
			return err
		}
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "REFUND_INITIATED",
			Label: fmt.Sprintf("Full Refund Initiated (₹%.0f)", ref.Amount),
			At:    ref.InitiatedAt,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifBookingDeclined,
			"Consultation Request Declined — Full Refund Initiated",
			fmt.Sprintf("Your lawyer was unable to accept booking %s. A full refund of ₹%.0f has been initiated.", bk.ID, ref.Amount))
		s.store.WriteAuditSync(ctx, tx, lawyerID, "LAWYER", "BOOKING_DECLINED", "booking", bk.ID, "", map[string]any{"reason": cleanReason})

		out = map[string]any{
			"booking": s.EnrichBooking(bk),
			"refund":  ref,
		}
		return nil
	})
	return out, err
}

// ProposeReschedule atomically locks the proposed 1-hour slot, releases the original pending slot,
// creates a RescheduleProposal, and sets booking status to RESCHEDULE_PROPOSED.
func (s *Service) ProposeReschedule(ctx context.Context, bookingID, lawyerID, proposedSlotID, reason string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking request not found.")
		}
		if bk.LawyerID != lawyerID {
			return shared.NewForbidden("Only the lawyer assigned to this booking can propose a reschedule.")
		}
		if bk.BookingStatus != shared.BookingAwaitingLawyer {
			return shared.NewConflict(fmt.Sprintf("Cannot propose a reschedule when booking is in %s status.", bk.BookingStatus))
		}
		if proposedSlotID == "" || proposedSlotID == bk.OriginalSlotID {
			return shared.NewBadRequest("Please choose a different available 1-hour slot to propose.")
		}

		propSlot, ok := s.store.Slots[proposedSlotID]
		if !ok || propSlot.LawyerID != lawyerID || propSlot.BackendStatus != shared.SlotAvailable {
			return shared.NewConflict("The selected alternative 1-hour slot is not available.")
		}
		origSlot := s.store.Slots[bk.OriginalSlotID]

		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRescheduleProposed); err != nil {
			return err
		}

		now := time.Now().UTC()
		expiresAt := s.computeDeadline(s.cfg.ClientResponseWindow, propSlot)

		// Reserve proposed slot and release original slot atomically
		propSlot.BackendStatus = shared.SlotProposed
		propSlot.Status = shared.FrontendSlotStatus(shared.SlotProposed)
		propSlot.BookingID = &bk.ID
		propSlot.ReservedUntil = &expiresAt

		if origSlot != nil && origSlot.BookingID != nil && *origSlot.BookingID == bk.ID {
			origSlot.BackendStatus = shared.SlotAvailable
			origSlot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
			origSlot.BookingID = nil
			origSlot.ReservedUntil = nil
		}

		cleanReason := strings.TrimSpace(reason)
		if cleanReason == "" {
			cleanReason = "Unfortunately, I am unavailable at the originally requested time. Please consider this alternative slot."
		}

		propID := "prop_" + uuid.NewString()[:8]
		proposal := &sqlcgen.RescheduleProposal{
			ID:             propID,
			BookingID:      bk.ID,
			LawyerID:       lawyerID,
			OriginalSlotID: bk.OriginalSlotID,
			ProposedSlotID: propSlot.ID,
			Reason:         cleanReason,
			Status:         "PENDING",
			ExpiresAt:      expiresAt,
			CreatedAt:      now,
		}
		s.store.Proposals[propID] = proposal

		bk.BookingStatus = shared.BookingRescheduleProposed
		bk.FinalSlotID = propSlot.ID
		bk.ResponseDeadline = &expiresAt
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "RESCHEDULE_PROPOSED",
			Label: fmt.Sprintf("Lawyer Proposed New Slot: %s, %s–%s", propSlot.Date, propSlot.StartTime, propSlot.EndTime),
			At:    now,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifRescheduleProposed,
			"Your lawyer has proposed a new consultation time",
			fmt.Sprintf("Proposed new slot: %s, %s–%s for booking %s. Accept the new time or reject it for a full refund.", propSlot.Date, propSlot.StartTime, propSlot.EndTime, bk.ID))
		s.store.WriteOutboxSync(ctx, tx, "booking", bk.ID, "RESCHEDULE_PROPOSED", map[string]any{"bookingId": bk.ID, "proposalId": propID})

		out = s.EnrichBooking(bk)
		return nil
	})
	return out, err
}

// AcceptRescheduleProposal allows the client to accept a pending reschedule proposal with no extra payment.
func (s *Service) AcceptRescheduleProposal(ctx context.Context, bookingID, proposalID, clientID string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		if bk.ClientID != clientID {
			return shared.NewForbidden("Only the client who created this booking can respond to the proposal.")
		}
		if bk.BookingStatus != shared.BookingRescheduleProposed {
			return shared.NewConflict(fmt.Sprintf("Cannot accept a reschedule proposal when booking status is %s.", bk.BookingStatus))
		}

		var proposal *sqlcgen.RescheduleProposal
		for _, p := range s.store.Proposals {
			if p.BookingID == bookingID && p.Status == "PENDING" && (proposalID == "" || proposalID == "latest" || p.ID == proposalID) {
				proposal = p
				break
			}
		}
		if proposal == nil {
			return shared.NewNotFound("Active reschedule proposal not found.")
		}
		now := time.Now().UTC()
		if now.After(proposal.ExpiresAt) {
			return shared.NewConflict("This reschedule proposal has expired.")
		}

		propSlot, ok := s.store.Slots[proposal.ProposedSlotID]
		if !ok || (propSlot.BookingID != nil && *propSlot.BookingID != bk.ID) {
			return shared.NewConflict("The proposed slot is no longer reserved for this booking.")
		}

		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingConfirmed); err != nil {
			return err
		}

		proposal.Status = "ACCEPTED"
		propSlot.BackendStatus = shared.SlotConfirmed
		propSlot.Status = shared.FrontendSlotStatus(shared.SlotConfirmed)
		propSlot.BookingID = &bk.ID
		propSlot.ReservedUntil = nil

		bk.FinalSlotID = propSlot.ID
		bk.BookingStatus = shared.BookingConfirmed
		bk.ResponseDeadline = nil
		bk.UpdatedAt = now
		if bk.Mode == "ONLINE" && bk.MeetingLink == nil {
			link := fmt.Sprintf("https://meet.legaleagle.example.com/session-%s", bk.ID)
			bk.MeetingLink = &link
		}

		bk.Timeline = append(bk.Timeline,
			sqlcgen.TimelineStep{
				Step:  "RESCHEDULE_ACCEPTED",
				Label: fmt.Sprintf("Client Accepted Proposed Time (%s, %s–%s)", propSlot.Date, propSlot.StartTime, propSlot.EndTime),
				At:    now,
			},
			sqlcgen.TimelineStep{
				Step:  "BOOKING_CONFIRMED",
				Label: "Rescheduled Consultation Confirmed (No additional payment required)",
				At:    now,
			},
		)

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		lawyerUserID := s.store.ResolveUserIDByProfile("LAWYER", bk.LawyerID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifBookingConfirmed,
			"Rescheduled Consultation Confirmed",
			fmt.Sprintf("Your consultation is confirmed for %s, %s–%s. No additional payment was charged.", propSlot.Date, propSlot.StartTime, propSlot.EndTime))
		s.store.CreateNotificationSync(ctx, tx, lawyerUserID, &bk.ID, shared.NotifRescheduleAccepted,
			"Client Accepted Rescheduled Time",
			fmt.Sprintf("Client accepted your proposed consultation slot on %s (%s–%s). The appointment is now confirmed.", propSlot.Date, propSlot.StartTime, propSlot.EndTime))

		out = s.EnrichBooking(bk)
		return nil
	})
	return out, err
}

// RejectRescheduleProposal allows the client to reject a proposed reschedule, releasing the slot
// and initiating a 100% full refund through the Payment module.
func (s *Service) RejectRescheduleProposal(ctx context.Context, bookingID, proposalID, clientID string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		if bk.ClientID != clientID {
			return shared.NewForbidden("Only the client who created this booking can reject the proposal.")
		}
		if bk.BookingStatus != shared.BookingRescheduleProposed {
			return shared.NewConflict(fmt.Sprintf("Cannot reject reschedule when booking status is %s.", bk.BookingStatus))
		}

		for _, p := range s.store.Proposals {
			if p.BookingID == bookingID && p.Status == "PENDING" && (proposalID == "" || proposalID == "latest" || p.ID == proposalID) {
				p.Status = "REJECTED"
				if propSlot, exists := s.store.Slots[p.ProposedSlotID]; exists && propSlot.BookingID != nil && *propSlot.BookingID == bk.ID {
					propSlot.BackendStatus = shared.SlotAvailable
					propSlot.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
					propSlot.BookingID = nil
					propSlot.ReservedUntil = nil
				}
				break
			}
		}

		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRefundPending); err != nil {
			return err
		}
		now := time.Now().UTC()
		bk.BookingStatus = shared.BookingRefundPending
		bk.ResponseDeadline = nil
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "RESCHEDULE_REJECTED",
			Label: "Client Rejected Proposed Time — Booking Closed & Full Refund Requested",
			At:    now,
		})

		ref, err := s.paymentSvc.InitiateFullRefundInTx(ctx, tx, bk.ID, "Client rejected lawyer-proposed reschedule time — full refund initiated with zero deduction.")
		if err != nil {
			return err
		}
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "REFUND_INITIATED",
			Label: fmt.Sprintf("Full Refund Initiated (₹%.0f)", ref.Amount),
			At:    ref.InitiatedAt,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		lawyerUserID := s.store.ResolveUserIDByProfile("LAWYER", bk.LawyerID)
		s.store.CreateNotificationSync(ctx, tx, lawyerUserID, &bk.ID, shared.NotifRescheduleRejected,
			"Proposed Reschedule Rejected by Client",
			fmt.Sprintf("Client declined the proposed reschedule time for booking %s. Full refund initiated.", bk.ID))
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifRefundInitiated,
			"Full Refund Initiated",
			fmt.Sprintf("You rejected the proposed consultation time for booking %s. A full refund of ₹%.0f has been initiated.", bk.ID, ref.Amount))

		out = map[string]any{
			"booking": s.EnrichBooking(bk),
			"refund":  ref,
		}
		return nil
	})
	return out, err
}

// ExpireBooking expires an unanswered request or hold and initiates a full refund if paid.
func (s *Service) ExpireBooking(ctx context.Context, bookingID, reason string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		if bk.BookingStatus != shared.BookingAwaitingLawyer &&
			bk.BookingStatus != shared.BookingRescheduleProposed &&
			bk.BookingStatus != shared.BookingPaymentPending {
			return shared.NewConflict(fmt.Sprintf("Booking in %s status cannot expire.", bk.BookingStatus))
		}

		for _, sl := range s.store.Slots {
			if sl.BookingID != nil && *sl.BookingID == bk.ID && sl.BackendStatus != shared.SlotConfirmed {
				sl.BackendStatus = shared.SlotAvailable
				sl.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
				sl.BookingID = nil
				sl.ReservedUntil = nil
			}
		}
		for _, p := range s.store.Proposals {
			if p.BookingID == bk.ID && p.Status == "PENDING" {
				p.Status = "EXPIRED"
			}
		}

		wasPaid := bk.BookingStatus != shared.BookingPaymentPending
		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingExpired); err != nil {
			return err
		}
		now := time.Now().UTC()
		bk.BookingStatus = shared.BookingExpired
		bk.ResponseDeadline = nil
		bk.HoldExpiresAt = nil
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "BOOKING_EXPIRED",
			Label: fmt.Sprintf("%s — Reserved slot released", reason),
			At:    now,
		})

		var ref *sqlcgen.Refund
		if wasPaid {
			if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRefundPending); err != nil {
				return err
			}
			bk.BookingStatus = shared.BookingRefundPending
			var err error
			ref, err = s.paymentSvc.InitiateFullRefundInTx(ctx, tx, bk.ID, fmt.Sprintf("Booking expired (%s) — automatic full refund initiated.", reason))
			if err != nil {
				return err
			}
			bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
				Step:  "REFUND_INITIATED",
				Label: fmt.Sprintf("Full Refund Initiated (₹%.0f)", ref.Amount),
				At:    ref.InitiatedAt,
			})
		}

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		lawyerUserID := s.store.ResolveUserIDByProfile("LAWYER", bk.LawyerID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifBookingExpired,
			"Consultation Request Expired",
			fmt.Sprintf("Booking %s expired because the response deadline passed.", bk.ID))
		s.store.CreateNotificationSync(ctx, tx, lawyerUserID, &bk.ID, shared.NotifBookingExpired,
			"Consultation Request Expired",
			fmt.Sprintf("Booking %s expired after the response deadline.", bk.ID))

		out = map[string]any{
			"booking": s.EnrichBooking(bk),
			"refund":  ref,
		}
		return nil
	})
	return out, err
}

// CompleteRefund finalizes a pending refund and marks the booking REFUNDED.
func (s *Service) CompleteRefund(ctx context.Context, refundOrBookingID string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(tx pgx.Tx) error {
		ref, err := s.paymentSvc.CompleteRefundInTx(ctx, tx, refundOrBookingID)
		if err != nil {
			return err
		}
		bk, ok := s.store.Bookings[ref.BookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		if bk.BookingStatus != shared.BookingRefunded {
			if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingRefunded); err != nil {
				return err
			}
			bk.BookingStatus = shared.BookingRefunded
		}
		now := time.Now().UTC()
		if ref.CompletedAt != nil {
			now = *ref.CompletedAt
		}
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "REFUND_COMPLETED",
			Label: fmt.Sprintf("Full Refund Completed (₹%.0f credited to original payment method)", ref.Amount),
			At:    now,
		})

		clientUserID := s.store.ResolveUserIDByProfile("CLIENT", bk.ClientID)
		s.store.CreateNotificationSync(ctx, tx, clientUserID, &bk.ID, shared.NotifRefundCompleted,
			"Full Refund Completed",
			fmt.Sprintf("Your full refund of ₹%.0f for booking %s has been completed.", ref.Amount, bk.ID))

		out = map[string]any{
			"booking": s.EnrichBooking(bk),
			"refund":  ref,
		}
		return nil
	})
	return out, err
}

// MarkBookingCompleted transitions a CONFIRMED consultation to COMPLETED.
func (s *Service) MarkBookingCompleted(ctx context.Context, bookingID, lawyerID string) (map[string]any, error) {
	var out map[string]any
	err := s.store.WithTx(ctx, func(_ pgx.Tx) error {
		bk, ok := s.store.Bookings[bookingID]
		if !ok {
			return shared.NewNotFound("Booking not found.")
		}
		if bk.LawyerID != lawyerID {
			return shared.NewForbidden("Only the assigned lawyer can mark this consultation completed.")
		}
		if err := shared.AssertBookingTransition(bk.BookingStatus, shared.BookingCompleted); err != nil {
			return err
		}
		now := time.Now().UTC()
		bk.BookingStatus = shared.BookingCompleted
		bk.UpdatedAt = now
		bk.Timeline = append(bk.Timeline, sqlcgen.TimelineStep{
			Step:  "COMPLETED",
			Label: "Consultation Completed",
			At:    now,
		})
		out = s.EnrichBooking(bk)
		return nil
	})
	return out, err
}

// ListBookingsForUser returns bookings for the authenticated client or lawyer, sorted newest first.
func (s *Service) ListBookingsForUser(role, profileID string) []map[string]any {
	var list []*sqlcgen.Booking
	for _, b := range s.store.Bookings {
		if role == "CLIENT" && b.ClientID == profileID {
			list = append(list, b)
		} else if role == "LAWYER" && b.LawyerID == profileID && b.BookingStatus != shared.BookingPaymentPending {
			list = append(list, b)
		}
	}
	sort.Slice(list, func(i, j int) bool {
		return list[i].CreatedAt.After(list[j].CreatedAt)
	})
	out := make([]map[string]any, 0, len(list))
	for _, b := range list {
		out = append(out, s.EnrichBooking(b))
	}
	return out
}

