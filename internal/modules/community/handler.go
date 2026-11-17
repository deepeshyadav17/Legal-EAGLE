package community

import (
	"errors"
	"net/http"
	"sort"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/middleware"
	"github.com/legaleagle/backend/internal/shared"
)

const messageLimit = 100

type Handler struct {
	store *database.Store
}

func NewHandler(store *database.Store) *Handler {
	return &Handler{store: store}
}

type verificationResponse struct {
	ProfileID        string     `json:"profileId"`
	BarCouncil       string     `json:"barCouncil"`
	EnrollmentNumber string     `json:"enrollmentNumber"`
	Status           string     `json:"status"`
	SubmittedAt      time.Time  `json:"submittedAt"`
	ReviewedAt       *time.Time `json:"reviewedAt,omitempty"`
	AdvocateName     string     `json:"advocateName,omitempty"`
	City             string     `json:"city,omitempty"`
}

type advocateSummary struct {
	ProfileID string `json:"profileId"`
	Name      string `json:"name"`
	City      string `json:"city"`
	Photo     string `json:"photo"`
}

type conversationSummary struct {
	ID          string          `json:"id"`
	Advocate    advocateSummary `json:"advocate"`
	LastMessage string          `json:"lastMessage"`
	UpdatedAt   time.Time       `json:"updatedAt"`
}

type messageResponse struct {
	ID              string    `json:"id"`
	ConversationID  string    `json:"conversationId"`
	SenderProfileID string    `json:"senderProfileId"`
	Body            string    `json:"body"`
	CreatedAt       time.Time `json:"createdAt"`
}

func (h *Handler) MyVerification(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if err := h.requireActiveLawyer(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	verification, err := h.getVerification(c, claims.ProfileID)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	if verification == nil {
		c.JSON(http.StatusOK, gin.H{"status": "NOT_SUBMITTED"})
		return
	}
	c.JSON(http.StatusOK, verification)
}

func (h *Handler) SubmitVerification(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if err := h.requireActiveLawyer(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	var req struct {
		BarCouncil       string `json:"barCouncil" binding:"required"`
		EnrollmentNumber string `json:"enrollmentNumber" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Bar Council and enrollment number are required."))
		return
	}
	barCouncil, err := shared.ValidateSafeField("Bar Council", req.BarCouncil, 2, 120)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	enrollmentNumber, err := shared.ValidateSafeField("Enrollment number", req.EnrollmentNumber, 2, 80)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	enrollmentNumber = strings.ToUpper(enrollmentNumber)
	now := time.Now().UTC()
	record := &database.AdvocateVerification{
		ProfileID:        claims.ProfileID,
		BarCouncil:       barCouncil,
		EnrollmentNumber: enrollmentNumber,
		Status:           "PENDING",
		SubmittedAt:      now,
	}

	if h.store.Pool != nil {
		var saved database.AdvocateVerification
		err = h.store.Pool.QueryRow(c.Request.Context(), `
			INSERT INTO advocate_verifications (lawyer_profile_id, bar_council, enrollment_number, status, submitted_at)
			VALUES ($1, $2, $3, 'PENDING', $4)
			ON CONFLICT (lawyer_profile_id) DO UPDATE
			SET bar_council = EXCLUDED.bar_council,
			    enrollment_number = EXCLUDED.enrollment_number,
			    status = 'PENDING',
			    submitted_at = EXCLUDED.submitted_at,
			    reviewed_at = NULL,
			    reviewed_by = NULL
			WHERE advocate_verifications.status = 'REJECTED'
			RETURNING lawyer_profile_id, bar_council, enrollment_number, status, submitted_at, reviewed_at
		`, record.ProfileID, record.BarCouncil, record.EnrollmentNumber, now).Scan(
			&saved.ProfileID, &saved.BarCouncil, &saved.EnrollmentNumber, &saved.Status, &saved.SubmittedAt, &saved.ReviewedAt,
		)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				shared.RespondError(c, shared.NewConflict("A verification request is already pending or approved."))
				return
			}
			if isUniqueViolation(err) {
				shared.RespondError(c, shared.NewConflict("That Bar Council enrollment is already associated with another account."))
				return
			}
			shared.RespondError(c, err)
			return
		}
		record = &saved
	} else {
		err = h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
			for profileID, existing := range h.store.AdvocateVerifications {
				if profileID != claims.ProfileID &&
					strings.EqualFold(existing.BarCouncil, barCouncil) &&
					strings.EqualFold(existing.EnrollmentNumber, enrollmentNumber) {
					return shared.NewConflict("That Bar Council enrollment is already associated with another account.")
				}
			}
			if existing := h.store.AdvocateVerifications[claims.ProfileID]; existing != nil && existing.Status != "REJECTED" {
				return shared.NewConflict("A verification request is already pending or approved.")
			}
			h.store.AdvocateVerifications[claims.ProfileID] = record
			return nil
		})
		if err != nil {
			shared.RespondError(c, err)
			return
		}
	}
	c.JSON(http.StatusCreated, record)
}

func (h *Handler) ListPendingVerifications(c *gin.Context) {
	if h.store.Pool != nil {
		rows, err := h.store.Pool.Query(c.Request.Context(), `
			SELECT v.lawyer_profile_id, v.bar_council, v.enrollment_number, v.status, v.submitted_at, v.reviewed_at, lp.name, lp.city
			FROM advocate_verifications v
			JOIN lawyer_profiles lp ON lp.external_id = v.lawyer_profile_id
			WHERE v.status = 'PENDING'
			ORDER BY v.submitted_at ASC
			LIMIT 200
		`)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		defer rows.Close()
		result := make([]verificationResponse, 0)
		for rows.Next() {
			var item verificationResponse
			if err := rows.Scan(&item.ProfileID, &item.BarCouncil, &item.EnrollmentNumber, &item.Status, &item.SubmittedAt, &item.ReviewedAt, &item.AdvocateName, &item.City); err != nil {
				shared.RespondError(c, err)
				return
			}
			result = append(result, item)
		}
		if err := rows.Err(); err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, result)
		return
	}

	result := make([]verificationResponse, 0)
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		for _, record := range h.store.AdvocateVerifications {
			if record.Status == "PENDING" {
				item := toVerificationResponse(record)
				if lawyer := h.store.Lawyers[record.ProfileID]; lawyer != nil {
					item.AdvocateName = lawyer.Name
					item.City = lawyer.City
				}
				result = append(result, item)
			}
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	sort.Slice(result, func(i, j int) bool { return result[i].SubmittedAt.Before(result[j].SubmittedAt) })
	if len(result) > 200 {
		result = result[:200]
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ReviewVerification(c *gin.Context) {
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("A review status is required."))
		return
	}
	status := strings.ToUpper(strings.TrimSpace(req.Status))
	if status != "APPROVED" && status != "REJECTED" {
		shared.RespondError(c, shared.NewBadRequest("Status must be APPROVED or REJECTED."))
		return
	}
	profileID := c.Param("profileId")
	if profileID == "" {
		shared.RespondError(c, shared.NewBadRequest("Advocate profile is required."))
		return
	}
	claims := middleware.GetClaims(c)
	now := time.Now().UTC()
	var reviewed *database.AdvocateVerification

	if h.store.Pool != nil {
		var result database.AdvocateVerification
		err := h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
			if err := tx.QueryRow(c.Request.Context(), `
				UPDATE advocate_verifications
				SET status = $2, reviewed_at = $3, reviewed_by = $4
				WHERE lawyer_profile_id = $1 AND status = 'PENDING'
				RETURNING lawyer_profile_id, bar_council, enrollment_number, status, submitted_at, reviewed_at, COALESCE(reviewed_by, '')
			`, profileID, status, now, claims.UserID).Scan(
				&result.ProfileID, &result.BarCouncil, &result.EnrollmentNumber, &result.Status, &result.SubmittedAt, &result.ReviewedAt, &result.ReviewedBy,
			); err != nil {
				return err
			}
			_, err := tx.Exec(c.Request.Context(), `
				INSERT INTO audit_logs (actor_user_id, actor_role, action, resource_type, resource_id, ip_address)
				VALUES ($1, $2, $3, 'advocate_verification', $4, $5)
			`, claims.UserID, claims.Role, "ADVOCATE_VERIFICATION_"+status, profileID, c.ClientIP())
			return err
		})
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				shared.RespondError(c, shared.NewNotFound("Pending verification request not found."))
				return
			}
			shared.RespondError(c, err)
			return
		}
		reviewed = &result
	} else {
		err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
			record, ok := h.store.AdvocateVerifications[profileID]
			if !ok || record.Status != "PENDING" {
				return shared.NewNotFound("Pending verification request not found.")
			}
			record.Status = status
			record.ReviewedAt = &now
			record.ReviewedBy = claims.UserID
			reviewed = record
			h.store.WriteAuditSync(c.Request.Context(), nil, claims.UserID, claims.Role, "ADVOCATE_VERIFICATION_"+status, "advocate_verification", profileID, c.ClientIP(), nil)
			return nil
		})
		if err != nil {
			shared.RespondError(c, err)
			return
		}
	}

	c.JSON(http.StatusOK, toVerificationResponse(reviewed))
}

func (h *Handler) ListVerifiedAdvocates(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if _, err := h.requireVerified(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	search := strings.ToLower(strings.TrimSpace(c.Query("q")))
	if h.store.Pool != nil {
		rows, err := h.store.Pool.Query(c.Request.Context(), `
			SELECT lp.external_id, lp.name, lp.city, lp.photo_url
			FROM lawyer_profiles lp
			JOIN users u ON u.id = lp.user_id AND u.is_active = TRUE AND u.role = 'LAWYER'
			JOIN advocate_verifications v ON v.lawyer_profile_id = lp.external_id AND v.status = 'APPROVED'
			WHERE lp.external_id <> $1
			  AND ($2 = '' OR LOWER(lp.name) LIKE '%' || $2 || '%' OR LOWER(lp.city) LIKE '%' || $2 || '%')
			ORDER BY lp.name
			LIMIT 100
		`, claims.ProfileID, search)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		defer rows.Close()
		result := make([]advocateSummary, 0)
		for rows.Next() {
			var item advocateSummary
			if err := rows.Scan(&item.ProfileID, &item.Name, &item.City, &item.Photo); err != nil {
				shared.RespondError(c, err)
				return
			}
			result = append(result, item)
		}
		if err := rows.Err(); err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, result)
		return
	}

	result := make([]advocateSummary, 0)
	for id, verification := range h.store.AdvocateVerifications {
		lawyer, exists := h.store.Lawyers[id]
		if !exists || id == claims.ProfileID || verification.Status != "APPROVED" {
			continue
		}
		active, err := h.hasActiveLawyer(c, id)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		if !active {
			continue
		}
		if search != "" && !strings.Contains(strings.ToLower(lawyer.Name), search) && !strings.Contains(strings.ToLower(lawyer.City), search) {
			continue
		}
		result = append(result, advocateSummary{ProfileID: id, Name: lawyer.Name, City: lawyer.City, Photo: lawyer.Photo})
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	if len(result) > 100 {
		result = result[:100]
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ListConversations(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if _, err := h.requireVerified(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	if h.store.Pool != nil {
		rows, err := h.store.Pool.Query(c.Request.Context(), `
			SELECT c.id::text, lp.external_id, lp.name, lp.city, lp.photo_url,
			       COALESCE(last_message.body, ''), COALESCE(last_message.created_at, c.updated_at)
			FROM direct_conversations c
			JOIN lawyer_profiles lp ON lp.external_id = CASE
			    WHEN c.participant_a = $1 THEN c.participant_b ELSE c.participant_a END
			JOIN users u ON u.id = lp.user_id AND u.is_active = TRUE AND u.role = 'LAWYER'
			JOIN advocate_verifications v ON v.lawyer_profile_id = lp.external_id AND v.status = 'APPROVED'
			LEFT JOIN LATERAL (
			    SELECT body, created_at FROM direct_messages
			    WHERE conversation_id = c.id
			    ORDER BY created_at DESC, id DESC LIMIT 1
			) last_message ON TRUE
			WHERE c.participant_a = $1 OR c.participant_b = $1
			ORDER BY COALESCE(last_message.created_at, c.updated_at) DESC
			LIMIT 100
		`, claims.ProfileID)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		defer rows.Close()
		result := make([]conversationSummary, 0)
		for rows.Next() {
			var item conversationSummary
			if err := rows.Scan(&item.ID, &item.Advocate.ProfileID, &item.Advocate.Name, &item.Advocate.City, &item.Advocate.Photo, &item.LastMessage, &item.UpdatedAt); err != nil {
				shared.RespondError(c, err)
				return
			}
			result = append(result, item)
		}
		if err := rows.Err(); err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, result)
		return
	}

	result := h.memoryConversationSummaries(claims.ProfileID)
	c.JSON(http.StatusOK, result)
}

func (h *Handler) StartConversation(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if _, err := h.requireVerified(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	var req struct {
		RecipientProfileID string `json:"recipientProfileId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("A recipient profile is required."))
		return
	}
	if req.RecipientProfileID == claims.ProfileID {
		shared.RespondError(c, shared.NewBadRequest("You cannot start a conversation with yourself."))
		return
	}
	if _, err := h.requireVerified(c, req.RecipientProfileID); err != nil {
		var appErr *shared.AppError
		if errors.As(err, &appErr) && appErr.Status == http.StatusForbidden {
			shared.RespondError(c, shared.NewForbidden("Conversations are available only between approved advocates."))
		} else {
			shared.RespondError(c, err)
		}
		return
	}

	participantA, participantB := orderedProfiles(claims.ProfileID, req.RecipientProfileID)
	var conversation *database.DirectConversation
	if h.store.Pool != nil {
		var row conversationRow
		err := h.store.Pool.QueryRow(c.Request.Context(), `
			INSERT INTO direct_conversations (participant_a, participant_b)
			VALUES ($1, $2)
			ON CONFLICT (participant_a, participant_b) DO UPDATE SET updated_at = direct_conversations.updated_at
			RETURNING id::text, participant_a, participant_b, created_at, updated_at
		`, participantA, participantB).Scan(&row.ID, &row.A, &row.B, &row.CreatedAt, &row.UpdatedAt)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		conversation = &database.DirectConversation{
			ID: row.ID, ParticipantA: row.A, ParticipantB: row.B,
			CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt,
		}
		var advocate advocateSummary
		err = h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT external_id, name, city, photo_url
			FROM lawyer_profiles WHERE external_id = $1
		`, req.RecipientProfileID).Scan(&advocate.ProfileID, &advocate.Name, &advocate.City, &advocate.Photo)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusOK, conversationSummary{
			ID: conversation.ID, Advocate: advocate, UpdatedAt: conversation.UpdatedAt,
		})
		return
	} else {
		err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
			for _, existing := range h.store.DirectConversations {
				if existing.ParticipantA == participantA && existing.ParticipantB == participantB {
					conversation = existing
					return nil
				}
			}
			now := time.Now().UTC()
			conversation = &database.DirectConversation{
				ID: uuid.NewString(), ParticipantA: participantA, ParticipantB: participantB, CreatedAt: now, UpdatedAt: now,
			}
			h.store.DirectConversations[conversation.ID] = conversation
			return nil
		})
		if err != nil {
			shared.RespondError(c, err)
			return
		}
	}
	c.JSON(http.StatusOK, h.summaryForConversation(conversation, claims.ProfileID))
}

type conversationRow struct {
	ID        string
	A         string
	B         string
	CreatedAt time.Time
	UpdatedAt time.Time
}

func (h *Handler) ListMessages(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if _, err := h.requireVerified(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	conversationID := c.Param("conversationId")
	if h.store.Pool != nil {
		if _, err := uuid.Parse(conversationID); err != nil {
			shared.RespondError(c, shared.NewNotFound("Conversation not found."))
			return
		}
		var participantA, participantB string
		err := h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT participant_a, participant_b FROM direct_conversations WHERE id = $1
		`, conversationID).Scan(&participantA, &participantB)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				shared.RespondError(c, shared.NewNotFound("Conversation not found."))
			} else {
				shared.RespondError(c, err)
			}
			return
		}
		if participantA != claims.ProfileID && participantB != claims.ProfileID {
			shared.RespondError(c, shared.NewNotFound("Conversation not found."))
			return
		}
		other := participantA
		if other == claims.ProfileID {
			other = participantB
		}
		if err := h.requireMessagingPeer(c, other); err != nil {
			shared.RespondError(c, err)
			return
		}
		rows, err := h.store.Pool.Query(c.Request.Context(), `
			SELECT id::text, conversation_id::text, sender_profile_id, body, created_at
			FROM direct_messages
			WHERE conversation_id = $1
			ORDER BY created_at DESC, id DESC
			LIMIT $2
		`, conversationID, messageLimit)
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		defer rows.Close()
		reversed := make([]messageResponse, 0)
		for rows.Next() {
			var item messageResponse
			if err := rows.Scan(&item.ID, &item.ConversationID, &item.SenderProfileID, &item.Body, &item.CreatedAt); err != nil {
				shared.RespondError(c, err)
				return
			}
			reversed = append(reversed, item)
		}
		if err := rows.Err(); err != nil {
			shared.RespondError(c, err)
			return
		}
		result := make([]messageResponse, len(reversed))
		for i := range reversed {
			result[len(reversed)-1-i] = reversed[i]
		}
		c.JSON(http.StatusOK, result)
		return
	}

	conversation, ok := h.store.DirectConversations[conversationID]
	if !ok || (conversation.ParticipantA != claims.ProfileID && conversation.ParticipantB != claims.ProfileID) {
		shared.RespondError(c, shared.NewNotFound("Conversation not found."))
		return
	}
	other := conversation.ParticipantA
	if other == claims.ProfileID {
		other = conversation.ParticipantB
	}
	if err := h.requireMessagingPeer(c, other); err != nil {
		shared.RespondError(c, err)
		return
	}
	result := h.memoryMessages(conversationID)
	c.JSON(http.StatusOK, result)
}

func (h *Handler) SendMessage(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if _, err := h.requireVerified(c, claims.ProfileID); err != nil {
		shared.RespondError(c, err)
		return
	}
	var req struct {
		Body string `json:"body" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Message text is required."))
		return
	}
	body := strings.TrimSpace(req.Body)
	if body == "" || utf8.RuneCountInString(body) > 4000 || strings.ContainsRune(body, '\x00') {
		shared.RespondError(c, shared.NewBadRequest("Messages must contain 1 to 4,000 characters."))
		return
	}

	conversationID := c.Param("conversationId")
	if h.store.Pool != nil {
		if _, err := uuid.Parse(conversationID); err != nil {
			shared.RespondError(c, shared.NewNotFound("Conversation not found."))
			return
		}
		var other string
		err := h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT CASE WHEN participant_a = $2 THEN participant_b ELSE participant_a END
			FROM direct_conversations
			WHERE id = $1 AND (participant_a = $2 OR participant_b = $2)
		`, conversationID, claims.ProfileID).Scan(&other)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				shared.RespondError(c, shared.NewNotFound("Conversation not found."))
			} else {
				shared.RespondError(c, err)
			}
			return
		}
		if err := h.requireMessagingPeer(c, other); err != nil {
			shared.RespondError(c, err)
			return
		}
		var item messageResponse
		err = h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
			if err := tx.QueryRow(c.Request.Context(), `
				INSERT INTO direct_messages (conversation_id, sender_profile_id, body)
				VALUES ($1, $2, $3)
				RETURNING id::text, conversation_id::text, sender_profile_id, body, created_at
			`, conversationID, claims.ProfileID, body).Scan(&item.ID, &item.ConversationID, &item.SenderProfileID, &item.Body, &item.CreatedAt); err != nil {
				return err
			}
			_, err := tx.Exec(c.Request.Context(), `UPDATE direct_conversations SET updated_at = $2 WHERE id = $1`, conversationID, item.CreatedAt)
			return err
		})
		if err != nil {
			shared.RespondError(c, err)
			return
		}
		c.JSON(http.StatusCreated, item)
		return
	}

	var item *database.DirectMessage
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		conversation, ok := h.store.DirectConversations[conversationID]
		if !ok || (conversation.ParticipantA != claims.ProfileID && conversation.ParticipantB != claims.ProfileID) {
			return shared.NewNotFound("Conversation not found.")
		}
		item = &database.DirectMessage{
			ID: uuid.NewString(), ConversationID: conversationID, SenderProfileID: claims.ProfileID, Body: body, CreatedAt: time.Now().UTC(),
		}
		h.store.DirectMessages[conversationID] = append(h.store.DirectMessages[conversationID], item)
		conversation.UpdatedAt = item.CreatedAt
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toMessageResponse(item))
}

func (h *Handler) getVerification(c *gin.Context, profileID string) (*database.AdvocateVerification, error) {
	if h.store.Pool != nil {
		var item database.AdvocateVerification
		err := h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT lawyer_profile_id, bar_council, enrollment_number, status, submitted_at, reviewed_at, COALESCE(reviewed_by, '')
			FROM advocate_verifications WHERE lawyer_profile_id = $1
		`, profileID).Scan(&item.ProfileID, &item.BarCouncil, &item.EnrollmentNumber, &item.Status, &item.SubmittedAt, &item.ReviewedAt, &item.ReviewedBy)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		if err != nil {
			return nil, err
		}
		return &item, nil
	}
	item := h.store.AdvocateVerifications[profileID]
	return item, nil
}

func (h *Handler) requireVerified(c *gin.Context, profileID string) (*database.AdvocateVerification, error) {
	if err := h.requireActiveLawyer(c, profileID); err != nil {
		return nil, err
	}
	item, err := h.getVerification(c, profileID)
	if err != nil {
		return nil, err
	}
	if item == nil || item.Status != "APPROVED" {
		return nil, shared.NewForbidden("Only manually approved advocates can use private messaging.")
	}
	return item, nil
}

func (h *Handler) requireMessagingPeer(c *gin.Context, profileID string) error {
	if _, err := h.requireVerified(c, profileID); err != nil {
		var appErr *shared.AppError
		if errors.As(err, &appErr) && appErr.Status == http.StatusForbidden {
			return shared.NewForbidden("Messaging is unavailable because an advocate is no longer approved.")
		}
		return err
	}
	return nil
}

func (h *Handler) requireActiveLawyer(c *gin.Context, profileID string) error {
	active, err := h.hasActiveLawyer(c, profileID)
	if err != nil {
		return err
	}
	if !active {
		return shared.NewForbidden("An active advocate profile is required.")
	}
	return nil
}

func (h *Handler) hasActiveLawyer(c *gin.Context, profileID string) (bool, error) {
	if h.store.Pool != nil {
		var exists bool
		err := h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT EXISTS (
				SELECT 1 FROM lawyer_profiles lp
				JOIN users u ON u.id = lp.user_id
				WHERE lp.external_id = $1 AND u.role = 'LAWYER' AND u.is_active = TRUE
			)
		`, profileID).Scan(&exists)
		if err != nil {
			return false, err
		}
		return exists, nil
	}
	for _, user := range h.store.Users {
		if user.ProfileID == profileID && user.Role == "LAWYER" && user.IsActive {
			return h.store.Lawyers[profileID] != nil, nil
		}
	}
	return false, nil
}

func (h *Handler) memoryConversationSummaries(profileID string) []conversationSummary {
	result := make([]conversationSummary, 0)
	for _, conversation := range h.store.DirectConversations {
		if conversation.ParticipantA != profileID && conversation.ParticipantB != profileID {
			continue
		}
		other := conversation.ParticipantA
		if other == profileID {
			other = conversation.ParticipantB
		}
		if _, err := h.requireVerified(nil, other); err != nil {
			continue
		}
		summary := h.summaryForConversation(conversation, profileID)
		result = append(result, summary)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].UpdatedAt.After(result[j].UpdatedAt) })
	if len(result) > 100 {
		result = result[:100]
	}
	return result
}

func (h *Handler) summaryForConversation(conversation *database.DirectConversation, profileID string) conversationSummary {
	other := conversation.ParticipantA
	if other == profileID {
		other = conversation.ParticipantB
	}
	lawyer := h.store.Lawyers[other]
	advocate := advocateSummary{ProfileID: other, Name: "Advocate"}
	if lawyer != nil {
		advocate.Name = lawyer.Name
		advocate.City = lawyer.City
		advocate.Photo = lawyer.Photo
	}
	item := conversationSummary{
		ID: conversation.ID, Advocate: advocate,
		UpdatedAt: conversation.UpdatedAt,
	}
	messages := h.store.DirectMessages[conversation.ID]
	if len(messages) > 0 {
		item.LastMessage = messages[len(messages)-1].Body
		item.UpdatedAt = messages[len(messages)-1].CreatedAt
	}
	return item
}

func (h *Handler) memoryMessages(conversationID string) []messageResponse {
	messages := h.store.DirectMessages[conversationID]
	start := 0
	if len(messages) > messageLimit {
		start = len(messages) - messageLimit
	}
	result := make([]messageResponse, 0, len(messages)-start)
	for _, item := range messages[start:] {
		result = append(result, toMessageResponse(item))
	}
	return result
}

func toMessageResponse(item *database.DirectMessage) messageResponse {
	return messageResponse{
		ID: item.ID, ConversationID: item.ConversationID, SenderProfileID: item.SenderProfileID, Body: item.Body, CreatedAt: item.CreatedAt,
	}
}

func toVerificationResponse(item *database.AdvocateVerification) verificationResponse {
	return verificationResponse{
		ProfileID: item.ProfileID, BarCouncil: item.BarCouncil, EnrollmentNumber: item.EnrollmentNumber,
		Status: item.Status, SubmittedAt: item.SubmittedAt, ReviewedAt: item.ReviewedAt,
	}
}

func orderedProfiles(a, b string) (string, string) {
	if a < b {
		return a, b
	}
	return b, a
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
