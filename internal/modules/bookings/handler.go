package bookings

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/middleware"
	"github.com/legaleagle/backend/internal/shared"
)

type Handler struct {
	svc   *Service
	store *database.Store
}

func NewHandler(svc *Service, store *database.Store) *Handler {
	return &Handler{svc: svc, store: store}
}

func (h *Handler) Service() *Service {
	return h.svc
}

// CreateHold godoc
// @Summary Create a 10-minute slot reservation and booking in PAYMENT_PENDING
// @Tags Bookings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param X-Idempotency-Key header string false "Idempotency key"
// @Param body body CreateHoldInput true "Slot hold request"
// @Success 201 {object} map[string]any
// @Failure 400 {object} shared.AppError
// @Failure 409 {object} shared.AppError
// @Router /booking-holds [post]
func (h *Handler) CreateHold(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "CLIENT" {
		shared.RespondError(c, shared.NewForbidden("Only authenticated clients can reserve consultation slots."))
		return
	}

	var in CreateHoldInput
	if err := c.ShouldBindJSON(&in); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Invalid slot hold request: "+err.Error()))
		return
	}
	in.ClientID = claims.ProfileID
	cleanNotes, notesErr := shared.ValidateSafeField("Consultation notes", in.ClientNotes, 0, 1000)
	if notesErr != nil {
		shared.RespondError(c, notesErr)
		return
	}
	in.ClientNotes = cleanNotes
	if in.IdempotencyKey == "" {
		in.IdempotencyKey = shared.SanitizeText(c.GetHeader("X-Idempotency-Key"), 128)
	}

	booking, err := h.svc.CreateBookingHold(c.Request.Context(), in)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, booking)
}

// GetBooking godoc
// @Summary Retrieve booking details (enforces client or assigned lawyer ownership)
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Success 200 {object} map[string]any
// @Failure 403 {object} shared.AppError
// @Failure 404 {object} shared.AppError
// @Router /bookings/{id} [get]
func (h *Handler) GetBooking(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id := c.Param("id")
	bk, ok := h.store.Bookings[id]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Consultation booking not found."))
		return
	}
	// Ownership check: only the client who booked, the assigned lawyer, or platform admin
	isClientOwner := claims.Role == "CLIENT" && claims.ProfileID == bk.ClientID
	isLawyerOwner := claims.Role == "LAWYER" && claims.ProfileID == bk.LawyerID
	isAdmin := claims.Role == "PLATFORM_ADMIN"
	if !isClientOwner && !isLawyerOwner && !isAdmin {
		shared.RespondError(c, shared.NewForbidden("You do not have permission to view this booking."))
		return
	}
	c.JSON(http.StatusOK, h.svc.EnrichBooking(bk))
}

// GetMyBookings godoc
// @Summary List bookings for the authenticated client or lawyer
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Success 200 {array} map[string]any
// @Router /bookings/me [get]
func (h *Handler) GetMyBookings(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil {
		shared.RespondError(c, shared.NewUnauthorized("Authentication required."))
		return
	}
	list := h.svc.ListBookingsForUser(claims.Role, claims.ProfileID)
	c.JSON(http.StatusOK, list)
}

// AcceptBooking godoc
// @Summary Lawyer accepts a paid consultation request (AWAITING_LAWYER -> CONFIRMED)
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Success 200 {object} map[string]any
// @Failure 403 {object} shared.AppError
// @Failure 409 {object} shared.AppError
// @Router /bookings/{id}/accept [post]
func (h *Handler) AcceptBooking(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only the assigned lawyer can accept a booking request."))
		return
	}
	booking, err := h.svc.AcceptBooking(c.Request.Context(), c.Param("id"), claims.ProfileID)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, booking)
}

// DeclineBooking godoc
// @Summary Lawyer declines a consultation request and triggers a full refund
// @Tags Bookings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Success 200 {object} map[string]any
// @Router /bookings/{id}/decline [post]
func (h *Handler) DeclineBooking(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only the assigned lawyer can decline a booking request."))
		return
	}
	var req struct {
		Reason string `json:"reason"`
	}
	_ = c.ShouldBindJSON(&req)
	cleanReason, reasonErr := shared.ValidateSafeField("Decline reason", req.Reason, 0, 500)
	if reasonErr != nil {
		shared.RespondError(c, reasonErr)
		return
	}

	res, err := h.svc.DeclineBooking(c.Request.Context(), c.Param("id"), claims.ProfileID, cleanReason)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// ProposeReschedule godoc
// @Summary Lawyer proposes an alternative 1-hour slot (AWAITING_LAWYER -> RESCHEDULE_PROPOSED)
// @Tags Bookings
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Success 200 {object} map[string]any
// @Router /bookings/{id}/reschedule-proposals [post]
func (h *Handler) ProposeReschedule(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only the assigned lawyer can propose a reschedule."))
		return
	}
	var req struct {
		ProposedSlotID string `json:"proposedSlotId" binding:"required"`
		Reason         string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("proposedSlotId is required."))
		return
	}
	cleanReason, reasonErr := shared.ValidateSafeField("Reschedule reason", req.Reason, 0, 500)
	if reasonErr != nil {
		shared.RespondError(c, reasonErr)
		return
	}

	res, err := h.svc.ProposeReschedule(c.Request.Context(), c.Param("id"), claims.ProfileID, shared.SanitizeText(req.ProposedSlotID, 80), cleanReason)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// AcceptRescheduleProposal godoc
// @Summary Client accepts the lawyer's proposed slot (RESCHEDULE_PROPOSED -> CONFIRMED, no extra charge)
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Param proposalId path string true "Proposal ID"
// @Success 200 {object} map[string]any
// @Router /bookings/{id}/reschedule-proposals/{proposalId}/accept [post]
func (h *Handler) AcceptRescheduleProposal(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "CLIENT" {
		shared.RespondError(c, shared.NewForbidden("Only the client can accept a reschedule proposal."))
		return
	}
	res, err := h.svc.AcceptRescheduleProposal(c.Request.Context(), c.Param("id"), c.Param("proposalId"), claims.ProfileID)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// RejectRescheduleProposal godoc
// @Summary Client rejects the lawyer's proposed slot and initiates a 100% full refund
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Param proposalId path string true "Proposal ID"
// @Success 200 {object} map[string]any
// @Router /bookings/{id}/reschedule-proposals/{proposalId}/reject [post]
func (h *Handler) RejectRescheduleProposal(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "CLIENT" {
		shared.RespondError(c, shared.NewForbidden("Only the client can reject a reschedule proposal."))
		return
	}
	res, err := h.svc.RejectRescheduleProposal(c.Request.Context(), c.Param("id"), c.Param("proposalId"), claims.ProfileID)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// CompleteBooking godoc
// @Summary Lawyer marks a confirmed consultation as COMPLETED
// @Tags Bookings
// @Produce json
// @Security BearerAuth
// @Param id path string true "Booking ID"
// @Success 200 {object} map[string]any
// @Router /bookings/{id}/complete [post]
func (h *Handler) CompleteBooking(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only the assigned lawyer can mark a consultation completed."))
		return
	}
	res, err := h.svc.MarkBookingCompleted(c.Request.Context(), c.Param("id"), claims.ProfileID)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, res)
}

// GetFirmConsultationsOverview returns aggregate consultation metrics for active affiliated lawyers of a firm.
func (h *Handler) GetFirmConsultationsOverview(c *gin.Context) {
	claims := middleware.GetClaims(c)
	firmID := c.Param("id")
	if firmID == "me" && claims != nil {
		firmID = claims.ProfileID
	}
	if claims == nil || claims.Role != "FIRM_ADMIN" || claims.ProfileID != firmID {
		shared.RespondError(c, shared.NewForbidden("Only the firm administrator can view firm consultation metrics."))
		return
	}

	memberIDs := shared.ActiveMemberIDs(h.store, firmID)
	memberSet := make(map[string]bool, len(memberIDs))
	for _, id := range memberIDs {
		memberSet[id] = true
	}

	awaitingCount := 0
	confirmedCount := 0
	completedCount := 0
	totalCount := 0

	for _, b := range h.store.Bookings {
		if !memberSet[b.LawyerID] || b.BookingStatus == shared.BookingPaymentPending {
			continue
		}
		totalCount++
		switch b.BookingStatus {
		case shared.BookingAwaitingLawyer, shared.BookingRescheduleProposed:
			awaitingCount++
		case shared.BookingConfirmed:
			confirmedCount++
		case shared.BookingCompleted:
			completedCount++
		}
	}

	byLawyer := []map[string]any{}
	for _, lid := range memberIDs {
		l, ok := h.store.Lawyers[lid]
		if !ok {
			continue
		}
		aw, cf, cp, tot := 0, 0, 0, 0
		for _, b := range h.store.Bookings {
			if b.LawyerID != lid || b.BookingStatus == shared.BookingPaymentPending {
				continue
			}
			tot++
			switch b.BookingStatus {
			case shared.BookingAwaitingLawyer, shared.BookingRescheduleProposed:
				aw++
			case shared.BookingConfirmed:
				cf++
			case shared.BookingCompleted:
				cp++
			}
		}
		byLawyer = append(byLawyer, map[string]any{
			"lawyer":           shared.BuildLawyerSummary(h.store, l),
			"awaitingApproval": aw,
			"confirmed":        cf,
			"completed":        cp,
			"total":            tot,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"upcomingConsultations":    confirmedCount,
		"awaitingApprovalBookings": awaitingCount,
		"confirmedBookings":        confirmedCount,
		"completedBookings":        completedCount,
		"totalConsultations":       totalCount,
		"byLawyer":                 byLawyer,
	})
}

