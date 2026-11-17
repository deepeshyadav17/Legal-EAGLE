package integration_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/legaleagle/backend/db/seed"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/logger"
	"github.com/legaleagle/backend/internal/server"
	"github.com/legaleagle/backend/internal/shared"
	"github.com/legaleagle/backend/internal/workers"
)

func setupTestApp(t *testing.T) (*server.AppBundle, *workers.Coordinator) {
	t.Helper()
	cfg := config.Load()
	cfg.DatabaseURL = "" // Use isolated transactional store per test
	cfg.RateLimitRPS = 1000
	cfg.RateLimitBurst = 1000

	log := logger.New("test")
	store, err := database.NewStore(context.Background(), cfg, log)
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}
	if err := seed.Populate(store); err != nil {
		t.Fatalf("seed.Populate: %v", err)
	}
	bundle := server.NewRouter(cfg, store)
	worker := workers.NewCoordinator(store, bundle.BookingSvc, log, time.Second)
	return bundle, worker
}

func tokenFor(t *testing.T, bundle *server.AppBundle, userID, role, profileID, email string) string {
	t.Helper()
	tok, _, err := bundle.TokenManager.IssueAccessToken(userID, role, profileID, email, userID)
	if err != nil {
		t.Fatalf("IssueAccessToken: %v", err)
	}
	return tok
}

func doJSON(t *testing.T, router http.Handler, method, path, token string, body any, headers map[string]string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		_ = json.NewEncoder(&buf).Encode(body)
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w, out
}

// Scenarios 1 & 2: Client books a slot -> Payment verified -> AWAITING_LAWYER -> Lawyer accepts -> CONFIRMED
func TestScenario1And2_BookPayAndLawyerAccepts(t *testing.T) {
	bundle, _ := setupTestApp(t)
	clientTok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")
	lawyerTok := tokenFor(t, bundle, "u2", "LAWYER", "l1", "lawyer@demo.legaleagle.in")

	// 1. Client creates 10-minute slot hold
	w, holdResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/booking-holds", clientTok, map[string]any{
		"lawyerId":         "l1",
		"slotId":           "slot_l1_2026-11-10_1100",
		"consultationMode": "ONLINE",
		"clientNotes":      "Bail consultation",
	}, map[string]string{"X-Idempotency-Key": "idem-test-1"})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}
	bookingID := holdResp["id"].(string)
	if holdResp["bookingStatus"] != shared.BookingPaymentPending {
		t.Fatalf("expected PAYMENT_PENDING, got %v", holdResp["bookingStatus"])
	}

	// 2. Signed payment webhook marks payment PAID and booking AWAITING_LAWYER (never CONFIRMED yet)
	w, webhookResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", map[string]any{
		"event":             "payment.captured",
		"bookingId":         bookingID,
		"providerPaymentId": "TXN-TEST-101",
		"amount":            1500,
		"currency":          "INR",
	}, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})

	if w.Code != http.StatusOK {
		t.Fatalf("webhook failed: %d %s", w.Code, w.Body.String())
	}
	bkAfterPay := webhookResp["booking"].(map[string]any)
	if bkAfterPay["bookingStatus"] != shared.BookingAwaitingLawyer {
		t.Fatalf("payment success must transition to AWAITING_LAWYER, got %v", bkAfterPay["bookingStatus"])
	}

	// 3. Lawyer accepts the request -> CONFIRMED
	w, acceptResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/"+bookingID+"/accept", lawyerTok, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("lawyer accept failed: %d %s", w.Code, w.Body.String())
	}
	if acceptResp["bookingStatus"] != shared.BookingConfirmed {
		t.Fatalf("expected CONFIRMED, got %v", acceptResp["bookingStatus"])
	}
}

// Scenarios 3 & 4: Lawyer proposes a new slot -> Client accepts reschedule (no additional payment)
func TestScenario3And4_LawyerProposesAndClientAcceptsReschedule(t *testing.T) {
	bundle, _ := setupTestApp(t)
	clientTok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")
	lawyerTok := tokenFor(t, bundle, "u2", "LAWYER", "l1", "lawyer@demo.legaleagle.in")

	// Seeded bk_1001 is in AWAITING_LAWYER for lawyer l1 on slot_l1_2026-11-10_1000
	w, propResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/bk_1001/reschedule-proposals", lawyerTok, map[string]any{
		"proposedSlotId": "slot_l1_2026-11-12_1600",
		"reason":         "High Court appearance in morning session",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("propose reschedule failed: %d %s", w.Code, w.Body.String())
	}
	if propResp["bookingStatus"] != shared.BookingRescheduleProposed {
		t.Fatalf("expected RESCHEDULE_PROPOSED, got %v", propResp["bookingStatus"])
	}
	// Original slot must be released back to AVAILABLE
	if bundle.Store.Slots["slot_l1_2026-11-10_1000"].BackendStatus != shared.SlotAvailable {
		t.Fatalf("expected original slot to be released to AVAILABLE")
	}
	// Proposed slot must be reserved as PROPOSED
	if bundle.Store.Slots["slot_l1_2026-11-12_1600"].BackendStatus != shared.SlotProposed {
		t.Fatalf("expected proposed slot to be PROPOSED")
	}

	proposal := propResp["proposal"].(map[string]any)
	proposalID := proposal["id"].(string)

	// Client accepts the reschedule proposal
	w, acceptResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/bk_1001/reschedule-proposals/"+proposalID+"/accept", clientTok, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("client accept proposal failed: %d %s", w.Code, w.Body.String())
	}
	if acceptResp["bookingStatus"] != shared.BookingConfirmed {
		t.Fatalf("expected CONFIRMED after accepting proposal, got %v", acceptResp["bookingStatus"])
	}
	if acceptResp["finalSlotId"] != "slot_l1_2026-11-12_1600" {
		t.Fatalf("expected finalSlotId to be updated to proposed slot")
	}
}

// Scenario 5: Client rejects reschedule and receives a full refund
func TestScenario5_ClientRejectsRescheduleAndReceivesFullRefund(t *testing.T) {
	bundle, _ := setupTestApp(t)
	clientTok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")

	// Seeded bk_1002 is in RESCHEDULE_PROPOSED with proposal prop_2001 (amount ₹2,500)
	w, rejectResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/bk_1002/reschedule-proposals/prop_2001/reject", clientTok, nil, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("client reject proposal failed: %d %s", w.Code, w.Body.String())
	}
	bk := rejectResp["booking"].(map[string]any)
	ref := rejectResp["refund"].(map[string]any)
	if bk["bookingStatus"] != shared.BookingRefundPending {
		t.Fatalf("expected REFUND_PENDING, got %v", bk["bookingStatus"])
	}
	if ref["amount"].(float64) != 2500 {
		t.Fatalf("expected full refund of 2500, got %v", ref["amount"])
	}

	// Webhook completes the refund -> REFUNDED
	w, doneResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", map[string]any{
		"event":     "refund.processed",
		"bookingId": "bk_1002",
	}, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})
	if w.Code != http.StatusOK {
		t.Fatalf("refund completion webhook failed: %d", w.Code)
	}
	bkDone := doneResp["booking"].(map[string]any)
	if bkDone["bookingStatus"] != shared.BookingRefunded {
		t.Fatalf("expected REFUNDED, got %v", bkDone["bookingStatus"])
	}
}

// Scenario 6: Lawyer declines and triggers a full refund
func TestScenario6_LawyerDeclinesAndTriggersFullRefund(t *testing.T) {
	bundle, _ := setupTestApp(t)
	lawyerTok := tokenFor(t, bundle, "u2", "LAWYER", "l1", "lawyer@demo.legaleagle.in")

	w, declineResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/bk_1001/decline", lawyerTok, map[string]any{
		"reason": "Out of station for Supreme Court hearing",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("lawyer decline failed: %d %s", w.Code, w.Body.String())
	}
	bk := declineResp["booking"].(map[string]any)
	if bk["bookingStatus"] != shared.BookingRefundPending {
		t.Fatalf("expected REFUND_PENDING, got %v", bk["bookingStatus"])
	}
	if bundle.Store.Slots["slot_l1_2026-11-10_1000"].BackendStatus != shared.SlotAvailable {
		t.Fatalf("expected declined slot to be released to AVAILABLE")
	}
}

// Scenarios 7 & 8: Lawyer does not respond before deadline & Client does not respond before deadline
func TestScenario7And8_DeadlineExpirations(t *testing.T) {
	bundle, worker := setupTestApp(t)

	// Fast-forward time past both bk_1001 (AWAITING_LAWYER) and bk_1002 (RESCHEDULE_PROPOSED) deadlines
	future := time.Date(2026, 11, 15, 12, 0, 0, 0, time.UTC)
	worker.RunOnce(context.Background(), future)

	if bundle.Store.Bookings["bk_1001"].BookingStatus != shared.BookingRefundPending {
		t.Fatalf("expected bk_1001 to expire into REFUND_PENDING, got %s", bundle.Store.Bookings["bk_1001"].BookingStatus)
	}
	if bundle.Store.Bookings["bk_1002"].BookingStatus != shared.BookingRefundPending {
		t.Fatalf("expected bk_1002 to expire into REFUND_PENDING, got %s", bundle.Store.Bookings["bk_1002"].BookingStatus)
	}
}

// Scenarios 9 & 10: Payment fails and slot is released; Payment hold expires & late payment recovery
func TestScenario9And10_PaymentFailureAndHoldExpiration(t *testing.T) {
	bundle, _ := setupTestApp(t)
	clientTok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")

	// Scenario 9: Hold slot then payment fails
	_, hold1 := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/booking-holds", clientTok, map[string]any{
		"lawyerId":         "l1",
		"slotId":           "slot_l1_2026-11-10_1500",
		"consultationMode": "ONLINE",
	}, nil)
	bkID1 := hold1["id"].(string)

	w, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", map[string]any{
		"event":         "payment.failed",
		"bookingId":     bkID1,
		"failureReason": "Card declined",
	}, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})
	if w.Code != http.StatusOK {
		t.Fatalf("payment.failed webhook failed: %d", w.Code)
	}
	if bundle.Store.Slots["slot_l1_2026-11-10_1500"].BackendStatus != shared.SlotAvailable {
		t.Fatalf("slot must be AVAILABLE after failed payment")
	}

	// Scenario 10: Re-reserve same slot, then simulate late payment after hold expiry
	_, hold2 := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/booking-holds", clientTok, map[string]any{
		"lawyerId":         "l1",
		"slotId":           "slot_l1_2026-11-10_1500",
		"consultationMode": "ONLINE",
	}, nil)
	bkID2 := hold2["id"].(string)

	w, lateResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", map[string]any{
		"event":             "payment.captured",
		"bookingId":         bkID2,
		"providerPaymentId": "TXN-LATE-999",
		"amount":            1500,
		"currency":          "INR",
		"simulateLateHold":  true,
	}, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})
	if w.Code != http.StatusOK {
		t.Fatalf("late payment webhook failed: %d", w.Code)
	}
	if lateResp["latePayment"] != true {
		t.Fatalf("expected latePayment=true recovery")
	}
	bkLate := lateResp["booking"].(map[string]any)
	if bkLate["bookingStatus"] != shared.BookingRefundPending {
		t.Fatalf("expected late payment to trigger REFUND_PENDING, got %v", bkLate["bookingStatus"])
	}
}

// Scenarios 11 & 12: Duplicate webhook delivery & duplicate refund request idempotency
func TestScenario11And12_IdempotentWebhooksAndRefunds(t *testing.T) {
	bundle, _ := setupTestApp(t)
	clientTok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")

	_, hold := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/booking-holds", clientTok, map[string]any{
		"lawyerId":         "l1",
		"slotId":           "slot_l1_2026-11-10_1600",
		"consultationMode": "ONLINE",
	}, nil)
	bkID := hold["id"].(string)

	payload := map[string]any{
		"event":             "payment.captured",
		"bookingId":         bkID,
		"providerPaymentId": "TXN-DUP-1",
		"amount":            1500,
		"currency":          "INR",
	}
	w1, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", payload, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})
	w2, dupResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/webhooks/razorpay", "", payload, map[string]string{"X-Razorpay-Signature": "mock_valid_signature"})
	if w1.Code != http.StatusOK || w2.Code != http.StatusOK || dupResp["idempotent"] != true {
		t.Fatalf("expected duplicate webhook delivery to succeed idempotently")
	}

	// Duplicate refund initiation on same booking must return exact same refund ID
	ref1, err1 := bundle.PaymentSvc.InitiateFullRefundInTx(context.Background(), nil, bkID, "First refund call")
	ref2, err2 := bundle.PaymentSvc.InitiateFullRefundInTx(context.Background(), nil, bkID, "Duplicate refund call")
	if err1 != nil || err2 != nil || ref1.ID != ref2.ID {
		t.Fatalf("expected idempotent refund initiation, got %v vs %v", ref1, ref2)
	}
}

// Scenario 13: Two clients attempt to reserve the same slot concurrently
func TestScenario13_ConcurrentSlotReservation(t *testing.T) {
	bundle, _ := setupTestApp(t)
	client1Tok := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")

	// Register a second client
	_, regResp := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"role":     "client",
		"name":     "Rohan Verma",
		"email":    "client2@example.com",
		"password": "Password@123",
	}, nil)
	client2Tok := regResp["accessToken"].(string)

	var wg sync.WaitGroup
	var successCount int32
	var conflictCount int32

	tokens := []string{client1Tok, client2Tok}
	for _, tok := range tokens {
		wg.Add(1)
		go func(tk string) {
			defer wg.Done()
			w, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/booking-holds", tk, map[string]any{
				"lawyerId":         "l1",
				"slotId":           "slot_l1_2026-11-10_1700",
				"consultationMode": "ONLINE",
			}, nil)
			if w.Code == http.StatusCreated {
				atomic.AddInt32(&successCount, 1)
			} else if w.Code == http.StatusConflict {
				atomic.AddInt32(&conflictCount, 1)
			}
		}(tok)
	}
	wg.Wait()

	if successCount != 1 || conflictCount != 1 {
		t.Fatalf("expected exactly 1 success (201) and 1 conflict (409), got success=%d conflict=%d", successCount, conflictCount)
	}
}

// Scenarios 14 & 15: Unauthorized booking access & Firm admin attempting lawyer booking action
func TestScenario14And15_OwnershipAndRBACEnforcement(t *testing.T) {
	bundle, _ := setupTestApp(t)
	otherLawyerTok := tokenFor(t, bundle, "u4", "LAWYER", "l15", "lawyer2@demo.legaleagle.in")
	firmAdminTok := tokenFor(t, bundle, "u3", "FIRM_ADMIN", "f1", "firm@demo.legaleagle.in")

	// Scenario 14: Lawyer l15 tries to view or accept Lawyer l1's booking bk_1001
	wView, _ := doJSON(t, bundle.Router, http.MethodGet, "/api/v1/bookings/bk_1001", otherLawyerTok, nil, nil)
	if wView.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when accessing another lawyer's booking, got %d", wView.Code)
	}

	// Scenario 15: Firm administrator tries to accept an affiliated lawyer's booking
	wFirm, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/bookings/bk_1001/accept", firmAdminTok, nil, nil)
	if wFirm.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden when firm admin attempts lawyer booking action, got %d", wFirm.Code)
	}
}

func TestSecurity_SanitizationValidationAndHeaders(t *testing.T) {
	bundle, _ := setupTestApp(t)

	// 1. XSS/Script injection in registration name must be rejected with 400 Bad Request
	wXSS, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"role":     "client",
		"name":     "<script>alert('xss')</script>Priya",
		"email":    "xss@example.com",
		"password": "Password@123",
	}, nil)
	if wXSS.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for XSS payload in registration, got %d", wXSS.Code)
	}

	// 2. Weak password without letters+numbers or < 8 chars must be rejected with 400 Bad Request
	wWeak, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/auth/register", "", map[string]any{
		"role":     "client",
		"name":     "Priya Malhotra",
		"email":    "priya@example.com",
		"password": "onlyletters",
	}, nil)
	if wWeak.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request for weak password, got %d", wWeak.Code)
	}

	// 3. Verify defensive security headers and rate limit headers
	if wWeak.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Fatalf("expected X-Content-Type-Options: nosniff header")
	}
	if wWeak.Header().Get("X-Frame-Options") != "DENY" {
		t.Fatalf("expected X-Frame-Options: DENY header")
	}
	if wWeak.Header().Get("X-RateLimit-Limit") == "" {
		t.Fatalf("expected X-RateLimit-Limit header on response")
	}
}


