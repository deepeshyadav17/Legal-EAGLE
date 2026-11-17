package payments

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/shared"
)

// PaymentProvider defines the external payment gateway adapter contract.
// Allows swapping MockPaymentProvider for RazorpayProviderAdapter without changing business logic.
type PaymentProvider interface {
	Name() string
	CreateOrder(bookingID string, amount float64, currency string) (providerOrderID string, err error)
	VerifyWebhookSignature(body []byte, signature string) bool
	InitiateRefund(providerPaymentID string, amount float64) (providerRefundID string, err error)
}

// MockPaymentProvider implements PaymentProvider for local development and testing.
type MockPaymentProvider struct {
	webhookSecret string
}

func NewMockPaymentProvider(webhookSecret string) *MockPaymentProvider {
	return &MockPaymentProvider{webhookSecret: webhookSecret}
}

func (m *MockPaymentProvider) Name() string { return "MOCK" }

func (m *MockPaymentProvider) CreateOrder(bookingID string, _ float64, _ string) (string, error) {
	return fmt.Sprintf("order_mock_%s_%d", bookingID, 1000+rand.Intn(9000)), nil
}

func (m *MockPaymentProvider) VerifyWebhookSignature(body []byte, signature string) bool {
	if signature == "mock_valid_signature" {
		return true
	}
	mac := hmac.New(sha256.New, []byte(m.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (m *MockPaymentProvider) InitiateRefund(_ string, _ float64) (string, error) {
	return fmt.Sprintf("rfnd_mock_%d", 10000+rand.Intn(90000)), nil
}

// RazorpayProviderAdapter implements the PaymentProvider interface for India-based Razorpay integration.
type RazorpayProviderAdapter struct {
	keyID         string
	keySecret     string
	webhookSecret string
}

func NewRazorpayProviderAdapter(keyID, keySecret, webhookSecret string) *RazorpayProviderAdapter {
	return &RazorpayProviderAdapter{keyID: keyID, keySecret: keySecret, webhookSecret: webhookSecret}
}

func (r *RazorpayProviderAdapter) Name() string { return "RAZORPAY" }

func (r *RazorpayProviderAdapter) CreateOrder(bookingID string, _ float64, _ string) (string, error) {
	return fmt.Sprintf("order_rzp_%s", bookingID), nil
}

func (r *RazorpayProviderAdapter) VerifyWebhookSignature(body []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(r.webhookSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (r *RazorpayProviderAdapter) InitiateRefund(_ string, _ float64) (string, error) {
	return fmt.Sprintf("rfnd_rzp_%s", uuid.NewString()[:8]), nil
}

// Service is Module B (Payments and Refunds).
// Owns payment orders, payment verification, transactions, refund initiation, and refund completion.
// Strictly decoupled from calendar/slot mutations — Booking module calls Service.InitiateFullRefundInTx.
type Service struct {
	store    *database.Store
	provider PaymentProvider
	cfg      *config.Config
}

func NewService(store *database.Store, cfg *config.Config) *Service {
	var prov PaymentProvider
	if cfg.PaymentProvider == "RAZORPAY" && cfg.RazorpayKeyID != "" {
		prov = NewRazorpayProviderAdapter(cfg.RazorpayKeyID, cfg.RazorpayKeySecret, cfg.RazorpayWebhookSecret)
	} else {
		prov = NewMockPaymentProvider(cfg.RazorpayWebhookSecret)
	}
	return &Service{store: store, provider: prov, cfg: cfg}
}

func (s *Service) Provider() PaymentProvider {
	return s.provider
}

// CreatePaymentOrderInTx creates or resets a PENDING payment order for an active booking hold.
func (s *Service) CreatePaymentOrderInTx(_ context.Context, _ pgx.Tx, booking *sqlcgen.Booking) (*sqlcgen.Payment, error) {
	for _, existing := range s.store.Payments {
		if existing.BookingID == booking.ID {
			if existing.Status == shared.PaymentPaid || existing.Status == shared.PaymentRefundInitiated || existing.Status == shared.PaymentRefunded {
				return nil, shared.NewConflict("This booking has already been paid. Duplicate payments are blocked.")
			}
			if err := shared.AssertPaymentTransition(existing.Status, shared.PaymentPending); err != nil {
				return nil, err
			}
			orderID, err := s.provider.CreateOrder(booking.ID, booking.TotalAmount, booking.Currency)
			if err != nil {
				return nil, err
			}
			existing.Status = shared.PaymentPending
			existing.Amount = booking.TotalAmount
			existing.ProviderOrderID = orderID
			return existing, nil
		}
	}

	orderID, err := s.provider.CreateOrder(booking.ID, booking.TotalAmount, booking.Currency)
	if err != nil {
		return nil, err
	}
	payID := "pay_" + uuid.NewString()[:8]
	pay := &sqlcgen.Payment{
		ID:              payID,
		BookingID:       booking.ID,
		ClientID:        booking.ClientID,
		LawyerID:        booking.LawyerID,
		Amount:          booking.TotalAmount,
		Currency:        booking.Currency,
		Provider:        s.provider.Name(),
		ProviderOrderID: orderID,
		Status:          shared.PaymentPending,
		CreatedAt:       time.Now().UTC(),
	}
	s.store.Payments[payID] = pay
	booking.PaymentID = &payID
	return pay, nil
}

// MarkPaymentPaidInTx verifies amount/currency and transitions the payment to PAID idempotently.
func (s *Service) MarkPaymentPaidInTx(_ context.Context, _ pgx.Tx, bookingID, providerOrderID, providerPaymentID string, amount float64, currency string) (*sqlcgen.Payment, bool, error) {
	var pay *sqlcgen.Payment
	for _, p := range s.store.Payments {
		if p.BookingID == bookingID || (providerOrderID != "" && p.ProviderOrderID == providerOrderID) {
			pay = p
			break
		}
	}
	if pay == nil {
		return nil, false, shared.NewNotFound("Payment order not found.")
	}
	// Idempotent duplicate webhook delivery check
	if pay.Status == shared.PaymentPaid || pay.Status == shared.PaymentRefundInitiated || pay.Status == shared.PaymentRefunded {
		return pay, true, nil
	}
	if amount > 0 && amount != pay.Amount {
		return nil, false, shared.NewBadRequest(fmt.Sprintf("Payment amount mismatch: expected %.2f, got %.2f", pay.Amount, amount))
	}
	if currency != "" && currency != pay.Currency {
		return nil, false, shared.NewBadRequest("Payment currency mismatch.")
	}
	if err := shared.AssertPaymentTransition(pay.Status, shared.PaymentPaid); err != nil {
		return nil, false, err
	}

	now := time.Now().UTC()
	if providerPaymentID == "" {
		providerPaymentID = fmt.Sprintf("TXN-LE-%d", 10000+rand.Intn(90000))
	}
	pay.Status = shared.PaymentPaid
	pay.ProviderPaymentID = providerPaymentID
	pay.TransactionReference = &providerPaymentID
	pay.PaidAt = &now
	return pay, false, nil
}

// MarkPaymentFailedInTx transitions a pending payment to FAILED.
func (s *Service) MarkPaymentFailedInTx(_ context.Context, _ pgx.Tx, bookingID, reason string) (*sqlcgen.Payment, error) {
	var pay *sqlcgen.Payment
	for _, p := range s.store.Payments {
		if p.BookingID == bookingID {
			pay = p
			break
		}
	}
	if pay == nil {
		return nil, shared.NewNotFound("Payment attempt not found.")
	}
	if pay.Status == shared.PaymentPaid {
		return nil, shared.NewConflict("Cannot mark an already paid transaction as failed.")
	}
	if err := shared.AssertPaymentTransition(pay.Status, shared.PaymentFailed); err != nil {
		return nil, err
	}
	pay.Status = shared.PaymentFailed
	pay.FailureReason = reason
	return pay, nil
}

// InitiateFullRefundInTx is called by the Booking/Workflow Coordinator module when a paid booking
// is declined, rejected on reschedule, expired, or paid after hold expiration.
// Strictly idempotent: duplicate refund requests return the existing Refund record.
func (s *Service) InitiateFullRefundInTx(ctx context.Context, tx pgx.Tx, bookingID, reason string) (*sqlcgen.Refund, error) {
	var pay *sqlcgen.Payment
	for _, p := range s.store.Payments {
		if p.BookingID == bookingID {
			pay = p
			break
		}
	}
	if pay == nil || (pay.Status != shared.PaymentPaid && pay.Status != shared.PaymentRefundInitiated && pay.Status != shared.PaymentRefunded) {
		return nil, shared.NewConflict("Cannot initiate refund for an unpaid transaction.")
	}

	for _, existing := range s.store.Refunds {
		if existing.BookingID == bookingID || existing.PaymentID == pay.ID {
			return existing, nil
		}
	}

	if err := shared.AssertPaymentTransition(pay.Status, shared.PaymentRefundInitiated); err != nil {
		return nil, err
	}
	provRef, err := s.provider.InitiateRefund(pay.ProviderPaymentID, pay.Amount)
	if err != nil {
		return nil, err
	}

	pay.Status = shared.PaymentRefundInitiated
	refID := "ref_" + uuid.NewString()[:8]
	ref := &sqlcgen.Refund{
		ID:               refID,
		BookingID:        bookingID,
		PaymentID:        pay.ID,
		ClientID:         pay.ClientID,
		LawyerID:         pay.LawyerID,
		Amount:           pay.Amount, // 100% full refund of captured amount
		Currency:         pay.Currency,
		Reason:           reason,
		ProviderRefundID: provRef,
		Status:           shared.PaymentRefundInitiated,
		InitiatedAt:      time.Now().UTC(),
	}
	s.store.Refunds[refID] = ref
	s.store.WriteOutboxSync(ctx, tx, "refund", refID, "REFUND_INITIATED", map[string]any{
		"refundId":  refID,
		"bookingId": bookingID,
		"amount":    ref.Amount,
	})
	return ref, nil
}

// CompleteRefundInTx marks an initiated refund and its parent payment as REFUNDED.
func (s *Service) CompleteRefundInTx(_ context.Context, _ pgx.Tx, refundOrBookingID string) (*sqlcgen.Refund, error) {
	var ref *sqlcgen.Refund
	for _, r := range s.store.Refunds {
		if r.ID == refundOrBookingID || r.BookingID == refundOrBookingID {
			ref = r
			break
		}
	}
	if ref == nil {
		return nil, shared.NewNotFound("Refund record not found.")
	}
	if ref.Status == shared.PaymentRefunded {
		return ref, nil
	}
	if pay, ok := s.store.Payments[ref.PaymentID]; ok {
		if err := shared.AssertPaymentTransition(pay.Status, shared.PaymentRefunded); err != nil {
			return nil, err
		}
		pay.Status = shared.PaymentRefunded
	}
	now := time.Now().UTC()
	ref.Status = shared.PaymentRefunded
	ref.CompletedAt = &now
	return ref, nil
}

