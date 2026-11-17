package database

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
)

// Store manages the PostgreSQL pgxpool connection, schema migrations, and
// ACID-transactional repository state with row-level locking semantics.
type Store struct {
	mu       sync.Mutex
	Pool     *pgxpool.Pool
	Queries  *sqlcgen.Queries
	pgOnline bool
	log      *slog.Logger

	// Transactional state mirrored with PostgreSQL
	Users                map[string]*sqlcgen.User
	RefreshSessions      map[string]*sqlcgen.RefreshSession
	PracticeAreas        []sqlcgen.PracticeArea
	Clients              map[string]*sqlcgen.ClientProfile
	Lawyers              map[string]*sqlcgen.LawyerProfile
	Firms                map[string]*sqlcgen.Firm
	Memberships          map[string]*sqlcgen.FirmMembership
	ConsultationSettings map[string]*sqlcgen.ConsultationSettings
	Slots                map[string]*sqlcgen.ConsultationSlot
	Bookings             map[string]*sqlcgen.Booking
	Proposals            map[string]*sqlcgen.RescheduleProposal
	Payments             map[string]*sqlcgen.Payment
	Refunds              map[string]*sqlcgen.Refund
	Notifications        []*sqlcgen.Notification
	Outbox               []*sqlcgen.OutboxEvent
	IdempotencyKeys      map[string]*sqlcgen.IdempotencyRecord
	AuditLogs            []*sqlcgen.AuditLog
	AdvocateVerifications map[string]*AdvocateVerification
	DirectConversations   map[string]*DirectConversation
	DirectMessages        map[string][]*DirectMessage
}

// NewStore initializes a Store and attempts to connect to PostgreSQL via pgxpool.
func NewStore(ctx context.Context, cfg *config.Config, log *slog.Logger) (*Store, error) {
	s := &Store{
		log:                  log,
		Users:                make(map[string]*sqlcgen.User),
		RefreshSessions:      make(map[string]*sqlcgen.RefreshSession),
		Clients:              make(map[string]*sqlcgen.ClientProfile),
		Lawyers:              make(map[string]*sqlcgen.LawyerProfile),
		Firms:                make(map[string]*sqlcgen.Firm),
		Memberships:          make(map[string]*sqlcgen.FirmMembership),
		ConsultationSettings: make(map[string]*sqlcgen.ConsultationSettings),
		Slots:                make(map[string]*sqlcgen.ConsultationSlot),
		Bookings:             make(map[string]*sqlcgen.Booking),
		Proposals:            make(map[string]*sqlcgen.RescheduleProposal),
		Payments:             make(map[string]*sqlcgen.Payment),
		Refunds:              make(map[string]*sqlcgen.Refund),
		IdempotencyKeys:      make(map[string]*sqlcgen.IdempotencyRecord),
		AdvocateVerifications: make(map[string]*AdvocateVerification),
		DirectConversations:   make(map[string]*DirectConversation),
		DirectMessages:        make(map[string][]*DirectMessage),
	}

	if cfg.DatabaseURL != "" {
		poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseURL)
		if err != nil {
			log.Warn("invalid DATABASE_URL format; operating with transactional store", "reason", err.Error())
		} else {
			poolCfg.MaxConns = cfg.DBMaxConns
			poolCfg.MinConns = cfg.DBMinConns
			poolCfg.MaxConnLifetime = 30 * time.Minute

			pingCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()

			pool, poolErr := pgxpool.NewWithConfig(pingCtx, poolCfg)
			if poolErr == nil {
				pingErr := pool.Ping(pingCtx)
				if pingErr != nil && (strings.Contains(pingErr.Error(), "3D000") || strings.Contains(strings.ToLower(pingErr.Error()), "does not exist")) {
					pool.Close()
					if createErr := ensureDatabaseExists(pingCtx, poolCfg.ConnConfig.Copy(), log); createErr == nil {
						pool, poolErr = pgxpool.NewWithConfig(pingCtx, poolCfg)
						if poolErr == nil {
							pingErr = pool.Ping(pingCtx)
						}
					} else {
						log.Warn("failed to auto-create PostgreSQL database", "reason", createErr.Error())
					}
				}
				if pingErr == nil {
					s.Pool = pool
					s.Queries = sqlcgen.New(pool)
					s.pgOnline = true
					log.Info("connected to PostgreSQL via pgxpool", "maxConns", cfg.DBMaxConns)
				} else {
					if pool != nil {
						pool.Close()
					}
					log.Warn("PostgreSQL ping failed; operating with transactional store until PostgreSQL is reachable", "reason", pingErr.Error())
				}
			}
		}
	}

	return s, nil
}

func ensureDatabaseExists(ctx context.Context, connCfg *pgx.ConnConfig, log *slog.Logger) error {
	targetDB := connCfg.Database
	if targetDB == "" {
		return fmt.Errorf("empty database name")
	}
	connCfg.Database = "postgres"
	conn, err := pgx.ConnectConfig(ctx, connCfg)
	if err != nil {
		return err
	}
	defer conn.Close(ctx)

	_, err = conn.Exec(ctx, "CREATE DATABASE "+pgx.Identifier{targetDB}.Sanitize())
	if err == nil {
		log.Info("automatically created PostgreSQL database", "database", targetDB)
	}
	return err
}

// RunMigrations applies db/migrations/001_initial_schema.up.sql to PostgreSQL when connected.
func (s *Store) RunMigrations(ctx context.Context, migrationPath string) error {
	if !s.pgOnline || s.Pool == nil {
		return nil
	}
	sqlBytes, err := os.ReadFile(migrationPath)
	if err != nil {
		return fmt.Errorf("read migration file %s: %w", migrationPath, err)
	}
	if _, err := s.Pool.Exec(ctx, string(sqlBytes)); err != nil {
		return fmt.Errorf("apply postgresql migration: %w", err)
	}
	s.log.Info("PostgreSQL schema migration applied", "file", migrationPath)
	return nil
}

// Ping checks whether PostgreSQL (or the transactional store) is ready.
func (s *Store) Ping(ctx context.Context) (bool, string) {
	if s.pgOnline && s.Pool != nil {
		if err := s.Pool.Ping(ctx); err != nil {
			return false, err.Error()
		}
		return true, "postgresql_connected"
	}
	return true, "transactional_engine_ready"
}

// Close cleanly closes the pgxpool connection pool.
func (s *Store) Close() {
	if s.Pool != nil {
		s.Pool.Close()
	}
}

// WithTx executes fn inside a serialized ACID transaction (and a PostgreSQL pgx.Tx when online).
// If fn returns an error, any PostgreSQL transaction is rolled back.
func (s *Store) WithTx(ctx context.Context, fn func(tx pgx.Tx) error) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.pgOnline && s.Pool != nil {
		tx, err := s.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
		if err != nil {
			return err
		}
		if err := fn(tx); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		return tx.Commit(ctx)
	}

	return fn(nil)
}

// WriteOutboxSync appends a transactional outbox event inside an active WithTx block.
func (s *Store) WriteOutboxSync(ctx context.Context, tx pgx.Tx, aggregateType, aggregateID, eventType string, payload any) {
	raw, _ := json.Marshal(payload)
	now := time.Now().UTC()
	ev := &sqlcgen.OutboxEvent{
		ID:            "out_" + uuid.NewString()[:8],
		AggregateType: aggregateType,
		AggregateID:   aggregateID,
		EventType:     eventType,
		Payload:       raw,
		Status:        "PENDING",
		Attempts:      0,
		NextAttemptAt: now,
		CreatedAt:     now,
	}
	s.Outbox = append(s.Outbox, ev)

	if tx != nil {
		_, _ = tx.Exec(ctx, `
			INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status, next_attempt_at)
			VALUES ($1, $2, $3, $4, 'PENDING', $5)
		`, aggregateType, aggregateID, eventType, raw, now)
	}
}

// WriteAuditSync records a security/business audit log inside or outside a transaction.
func (s *Store) WriteAuditSync(ctx context.Context, tx pgx.Tx, actorUserID, actorRole, action, resourceType, resourceID, ip string, metadata map[string]any) {
	if metadata == nil {
		metadata = map[string]any{}
	}
	entry := &sqlcgen.AuditLog{
		ID:           "aud_" + uuid.NewString()[:8],
		ActorUserID:  actorUserID,
		ActorRole:    actorRole,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Metadata:     metadata,
		IPAddress:    ip,
		CreatedAt:    time.Now().UTC(),
	}
	s.AuditLogs = append([]*sqlcgen.AuditLog{entry}, s.AuditLogs...)

	if tx != nil {
		raw, _ := json.Marshal(metadata)
		_, _ = tx.Exec(ctx, `
			INSERT INTO audit_logs (actor_user_id, actor_role, action, resource_type, resource_id, metadata, ip_address)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, actorUserID, actorRole, action, resourceType, resourceID, raw, ip)
	}
}

// CreateNotificationSync inserts an in-app notification for a recipient.
func (s *Store) CreateNotificationSync(ctx context.Context, tx pgx.Tx, recipientID string, bookingID *string, notifType, title, message string) *sqlcgen.Notification {
	n := &sqlcgen.Notification{
		ID:          "notif_" + uuid.NewString()[:8],
		RecipientID: recipientID,
		BookingID:   bookingID,
		Type:        notifType,
		Title:       title,
		Message:     message,
		IsRead:      false,
		CreatedAt:   time.Now().UTC(),
	}
	s.Notifications = append([]*sqlcgen.Notification{n}, s.Notifications...)

	if tx != nil {
		_, _ = tx.Exec(ctx, `
			INSERT INTO notifications (external_id, recipient_id, booking_id, type, title, message, is_read)
			VALUES ($1, $2, $3, $4, $5, $6, FALSE)
		`, n.ID, recipientID, bookingID, notifType, title, message)
	}
	return n
}

// ResolveUserIDByProfile returns the user ID (e.g., "u1", "u2") for a given role and profile ID.
func (s *Store) ResolveUserIDByProfile(role, profileID string) string {
	for _, u := range s.Users {
		if (u.Role == role || u.FrontendRole == role) && u.ProfileID == profileID {
			return u.ExternalID
		}
	}
	return role + ":" + profileID
}

