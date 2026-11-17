package payments

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"sort"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/platform/middleware"
	"github.com/legaleagle/backend/internal/shared"
)

// BookingWebhookCoordinator connects verified payment outcomes in Module B to Module A.
type BookingWebhookCoordinator interface {
	VerifyPaymentWebhook(ctx context.Context, bookingID, providerOrderID, providerPaymentID string, amount float64, currency string, forceExpiredHold bool) (map[string]any, error)
	FailPaymentAndReleaseHold(ctx context.Context, bookingID, reason string) (map[string]any, error)
	CompleteRefund(ctx context.Context, refundOrBookingID string) (map[string]any, error)
}

type Handler struct {
	svc         *Service
	store       *database.Store
	coordinator BookingWebhookCoordinator
}

func NewHandler(svc *Service, store *database.Store, coordinator BookingWebhookCoordinator) *Handler {
	return &Handler{svc: svc, store: store, coordinator: coordinator}
}

// CreateOrder godoc
// @Summary Create a payment order for a valid, unexpired booking hold
// @Tags Payments
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 201 {object} sqlcgen.Payment
// @Failure 400 {object} shared.AppError
// @Failure 409 {object} shared.AppError
// @Router /payments/orders [post]
func (h *Handler) CreateOrder(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "CLIENT" {
		shared.RespondError(c, shared.NewForbidden("Only clients can initiate payment orders."))
		return
	}

	var req struct {
		BookingID string `json:"bookingId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("bookingId is required."))
		return
	}

	var payment *sqlcgen.Payment
	err := h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
		bk, ok := h.store.Bookings[req.BookingID]
		if !ok {
			return shared.NewNotFound("Booking hold not found.")
		}
		if bk.ClientID != claims.ProfileID {
			return shared.NewForbidden("You can only create a payment order for your own booking.")
		}
		if bk.BookingStatus != shared.BookingPaymentPending {
			return shared.NewConflict("Booking is not in PAYMENT_PENDING state.")
		}
		if bk.HoldExpiresAt != nil && time.Now().UTC().After(*bk.HoldExpiresAt) {
			return shared.NewConflict("Your 10-minute slot reservation has expired. Please select a new slot.")
		}
		var err error
		payment, err = h.svc.CreatePaymentOrderInTx(c.Request.Context(), tx, bk)
		return err
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, payment)
}

// GetPayment godoc
// @Summary Get payment transaction details by ID or booking ID
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Param id path string true "Payment ID or Booking ID"
// @Success 200 {object} sqlcgen.Payment
// @Failure 404 {object} shared.AppError
// @Router /payments/{id} [get]
func (h *Handler) GetPayment(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id := c.Param("id")
	var found *sqlcgen.Payment
	for _, p := range h.store.Payments {
		if p.ID == id || p.BookingID == id {
			found = p
			break
		}
	}
	if found == nil {
		shared.RespondError(c, shared.NewNotFound("Payment record not found."))
		return
	}
	if claims.Role == "CLIENT" && found.ClientID != claims.ProfileID {
		shared.RespondError(c, shared.NewForbidden("You do not have permission to view this payment."))
		return
	}
	if claims.Role == "LAWYER" && found.LawyerID != claims.ProfileID {
		shared.RespondError(c, shared.NewForbidden("You do not have permission to view this payment."))
		return
	}
	c.JSON(http.StatusOK, found)
}

// GetMyPayments returns all payment transactions for the authenticated client.
func (h *Handler) GetMyPayments(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var list []map[string]any
	for _, p := range h.store.Payments {
		if p.ClientID != claims.ProfileID {
			continue
		}
		var lawyerDTO any
		if l, ok := h.store.Lawyers[p.LawyerID]; ok {
			lawyerDTO = shared.BuildLawyerSummary(h.store, l)
		}
		var refDTO any
		for _, r := range h.store.Refunds {
			if r.PaymentID == p.ID || r.BookingID == p.BookingID {
				refDTO = r
				break
			}
		}
		var bkStatus any
		if bk, ok := h.store.Bookings[p.BookingID]; ok {
			bkStatus = bk.BookingStatus
		}
		list = append(list, map[string]any{
			"id":                   p.ID,
			"bookingId":            p.BookingID,
			"clientId":             p.ClientID,
			"lawyerId":             p.LawyerID,
			"amount":               p.Amount,
			"currency":             p.Currency,
			"status":               p.Status,
			"transactionReference": p.TransactionReference,
			"paidAt":               p.PaidAt,
			"createdAt":            p.CreatedAt,
			"lawyer":               lawyerDTO,
			"refund":               refDTO,
			"bookingStatus":        bkStatus,
		})
	}
	sort.Slice(list, func(i, j int) bool {
		t1, _ := list[i]["createdAt"].(time.Time)
		t2, _ := list[j]["createdAt"].(time.Time)
		return t1.After(t2)
	})
	c.JSON(http.StatusOK, list)
}

type RazorpayWebhookPayload struct {
	Event             string  `json:"event"` // "payment.captured" | "payment.failed" | "refund.processed"
	BookingID         string  `json:"bookingId"`
	ProviderOrderID   string  `json:"providerOrderId"`
	ProviderPaymentID string  `json:"providerPaymentId"`
	Amount            float64 `json:"amount"`
	Currency          string  `json:"currency"`
	FailureReason     string  `json:"failureReason"`
	SimulateLateHold  bool    `json:"simulateLateHold"`
}

// RazorpayWebhook godoc
// @Summary Verify signed payment provider webhook and update payment/booking atomically
// @Tags Payments
// @Accept json
// @Produce json
// @Param X-Razorpay-Signature header string true "HMAC-SHA256 webhook signature"
// @Param body body RazorpayWebhookPayload true "Webhook payload"
// @Success 200 {object} map[string]any
// @Failure 400 {object} shared.AppError
// @Failure 401 {object} shared.AppError
// @Router /webhooks/razorpay [post]
func (h *Handler) RazorpayWebhook(c *gin.Context) {
	rawBody, err := io.ReadAll(c.Request.Body)
	if err != nil {
		shared.RespondError(c, shared.NewBadRequest("Unable to read webhook body."))
		return
	}
	sig := c.GetHeader("X-Razorpay-Signature")
	if sig == "" || !h.svc.Provider().VerifyWebhookSignature(rawBody, sig) {
		shared.RespondError(c, shared.NewUnauthorized("Invalid webhook signature."))
		return
	}

	var payload RazorpayWebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Malformed webhook JSON."))
		return
	}

	switch payload.Event {
	case "payment.failed":
		reason := payload.FailureReason
		if reason == "" {
			reason = "Payment declined by issuing bank"
		}
		res, err := h.coordinator.FailPaymentAndReleaseHold(c.Request.Context(), payload.BookingID, reason)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, res)
	case "refund.processed":
		res, err := h.coordinator.CompleteRefund(c.Request.Context(), payload.BookingID)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, res)
	default: // "payment.captured"
		res, err := h.coordinator.VerifyPaymentWebhook(
			c.Request.Context(),
			payload.BookingID,
			payload.ProviderOrderID,
			payload.ProviderPaymentID,
			payload.Amount,
			payload.Currency,
			payload.SimulateLateHold,
		)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, res)
	}
}

// GetRefund godoc
// @Summary Retrieve refund record by refund ID or booking ID
// @Tags Payments
// @Produce json
// @Security BearerAuth
// @Param id path string true "Refund ID or Booking ID"
// @Success 200 {object} sqlcgen.Refund
// @Failure 404 {object} shared.AppError
// @Router /refunds/{id} [get]
func (h *Handler) GetRefund(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id := c.Param("id")
	var found *sqlcgen.Refund
	for _, r := range h.store.Refunds {
		if r.ID == id || r.BookingID == id {
			found = r
			break
		}
	}
	if found == nil {
		shared.RespondError(c, shared.NewNotFound("Refund record not found."))
		return
	}
	if claims.Role == "CLIENT" && found.ClientID != claims.ProfileID {
		shared.RespondError(c, shared.NewForbidden("You do not have permission to view this refund."))
		return
	}
	c.JSON(http.StatusOK, found)
}

// GetMyRefunds lists all refunds for the authenticated client.
func (h *Handler) GetMyRefunds(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var list []map[string]any
	for _, r := range h.store.Refunds {
		if r.ClientID != claims.ProfileID {
			continue
		}
		var lawyerDTO any
		if l, ok := h.store.Lawyers[r.LawyerID]; ok {
			lawyerDTO = shared.BuildLawyerSummary(h.store, l)
		}
		var txnRef any
		if p, ok := h.store.Payments[r.PaymentID]; ok {
			txnRef = p.TransactionReference
		}
		list = append(list, map[string]any{
			"id":                   r.ID,
			"bookingId":            r.BookingID,
			"paymentId":            r.PaymentID,
			"clientId":             r.ClientID,
			"lawyerId":             r.LawyerID,
			"amount":               r.Amount,
			"currency":             r.Currency,
			"reason":               r.Reason,
			"status":               r.Status,
			"initiatedAt":          r.InitiatedAt,
			"completedAt":          r.CompletedAt,
			"lawyer":               lawyerDTO,
			"transactionReference": txnRef,
		})
	}
	sort.Slice(list, func(i, j int) bool {
		t1, _ := list[i]["initiatedAt"].(time.Time)
		t2, _ := list[j]["initiatedAt"].(time.Time)
		return t1.After(t2)
	})
	c.JSON(http.StatusOK, list)
}

