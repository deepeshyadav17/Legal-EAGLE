package integration_test

import (
	"context"
	"net/http"
	"strings"
	"testing"

	"github.com/legaleagle/backend/db/seed"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/logger"
	"github.com/legaleagle/backend/internal/server"
)

func TestCommunityMessagingRequiresApprovedAdvocates(t *testing.T) {
	bundle, _ := setupTestApp(t)
	lawyerOne := tokenFor(t, bundle, "u2", "LAWYER", "l1", "lawyer@demo.legaleagle.in")
	lawyerTwo := tokenFor(t, bundle, "u4", "LAWYER", "l15", "lawyer2@demo.legaleagle.in")
	admin := tokenFor(t, bundle, "u5", "PLATFORM_ADMIN", "admin1", "admin@demo.legaleagle.in")
	client := tokenFor(t, bundle, "u1", "CLIENT", "c1", "client@demo.legaleagle.in")

	w, _ := doJSON(t, bundle.Router, http.MethodGet, "/api/v1/community/advocates", lawyerOne, nil, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("unverified advocate should be denied messaging, got %d: %s", w.Code, w.Body.String())
	}

	for _, submission := range []struct {
		token string
		body  map[string]any
	}{
		{lawyerOne, map[string]any{"barCouncil": "Bar Council of Delhi", "enrollmentNumber": "D/1001/2018"}},
		{lawyerTwo, map[string]any{"barCouncil": "Bar Council of Rajasthan", "enrollmentNumber": "R/2002/2017"}},
	} {
		w, _ = doJSON(t, bundle.Router, http.MethodPost, "/api/v1/advocates/verification/me", submission.token, submission.body, nil)
		if w.Code != http.StatusCreated {
			t.Fatalf("verification submission failed: %d %s", w.Code, w.Body.String())
		}
	}

	for _, profileID := range []string{"l1", "l15"} {
		w, _ = doJSON(t, bundle.Router, http.MethodPatch, "/api/v1/admin/advocate-verifications/"+profileID, admin, map[string]any{"status": "APPROVED"}, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("admin approval failed for %s: %d %s", profileID, w.Code, w.Body.String())
		}
	}

	w, startResponse := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/community/conversations", lawyerOne, map[string]any{
		"recipientProfileId": "l15",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("starting a conversation failed: %d %s", w.Code, w.Body.String())
	}
	conversationID, ok := startResponse["id"].(string)
	if !ok || conversationID == "" {
		t.Fatalf("expected a conversation id, got %#v", startResponse)
	}

	w, _ = doJSON(t, bundle.Router, http.MethodPost, "/api/v1/community/conversations/"+conversationID+"/messages", lawyerOne, map[string]any{
		"body": "Hello, advocate.",
	}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("sending a message failed: %d %s", w.Code, w.Body.String())
	}

	w, _ = doJSON(t, bundle.Router, http.MethodGet, "/api/v1/community/conversations/"+conversationID+"/messages", lawyerTwo, nil, nil)
	if w.Code != http.StatusOK || !strings.Contains(w.Body.String(), "Hello, advocate.") {
		t.Fatalf("conversation participant should be able to read messages: %d %s", w.Code, w.Body.String())
	}

	w, _ = doJSON(t, bundle.Router, http.MethodGet, "/api/v1/community/conversations/"+conversationID+"/messages", client, nil, nil)
	if w.Code != http.StatusForbidden {
		t.Fatalf("non-advocate should not read advocate messages, got %d: %s", w.Code, w.Body.String())
	}
}

func TestCommunityMessagesValidateContentAndReviewStatus(t *testing.T) {
	bundle, _ := setupTestApp(t)
	lawyerOne := tokenFor(t, bundle, "u2", "LAWYER", "l1", "lawyer@demo.legaleagle.in")
	lawyerTwo := tokenFor(t, bundle, "u4", "LAWYER", "l15", "lawyer2@demo.legaleagle.in")
	admin := tokenFor(t, bundle, "u5", "PLATFORM_ADMIN", "admin1", "admin@demo.legaleagle.in")
	w, _ := doJSON(t, bundle.Router, http.MethodPatch, "/api/v1/admin/advocate-verifications/l1", admin, map[string]any{"status": "INVALID"}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid review status should be rejected, got %d: %s", w.Code, w.Body.String())
	}

	func TestDemoAccountsCannotAuthenticateInProduction(t *testing.T) {
		cfg := config.Load()
		cfg.AppEnv = "production"
		cfg.DatabaseURL = ""
		store, err := database.NewStore(context.Background(), cfg, logger.New("test"))
		if err != nil {
			t.Fatalf("NewStore: %v", err)
		}
		if err := seed.Populate(store); err != nil {
			t.Fatalf("seed.Populate: %v", err)
		}
		bundle := server.NewRouter(cfg, store)

		w, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/auth/demo-login", "", map[string]any{"role": "admin"}, nil)
		if w.Code != http.StatusForbidden {
			t.Fatalf("demo login should be disabled in production, got %d: %s", w.Code, w.Body.String())
		}

		w, _ = doJSON(t, bundle.Router, http.MethodPost, "/api/v1/auth/login", "", map[string]any{
			"email":    "admin@demo.legaleagle.in",
			"password": seed.DefaultDemoPassword,
		}, nil)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("seeded demo credentials should be rejected in production, got %d: %s", w.Code, w.Body.String())
		}
	}

	for _, submission := range []struct {
		token string
		body  map[string]any
	}{
		{lawyerOne, map[string]any{"barCouncil": "Bar Council of Delhi", "enrollmentNumber": "D/1001/2018"}},
		{lawyerTwo, map[string]any{"barCouncil": "Bar Council of Rajasthan", "enrollmentNumber": "R/2002/2017"}},
	} {
		w, _ := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/advocates/verification/me", submission.token, submission.body, nil)
		if w.Code != http.StatusCreated {
			t.Fatalf("verification submission failed: %d %s", w.Code, w.Body.String())
		}
	}
	for _, profileID := range []string{"l1", "l15"} {
		w, _ := doJSON(t, bundle.Router, http.MethodPatch, "/api/v1/admin/advocate-verifications/"+profileID, admin, map[string]any{"status": "APPROVED"}, nil)
		if w.Code != http.StatusOK {
			t.Fatalf("admin approval failed: %d %s", w.Code, w.Body.String())
		}
	}
	w, startResponse := doJSON(t, bundle.Router, http.MethodPost, "/api/v1/community/conversations", lawyerOne, map[string]any{
		"recipientProfileId": "l15",
	}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("starting a conversation failed: %d %s", w.Code, w.Body.String())
	}
	conversationID := startResponse["id"].(string)

	w, _ = doJSON(t, bundle.Router, http.MethodPost, "/api/v1/community/conversations/"+conversationID+"/messages", lawyerOne, map[string]any{"body": strings.Repeat("x", 4001)}, nil)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("oversized message should be rejected, got %d: %s", w.Code, w.Body.String())
	}
}
