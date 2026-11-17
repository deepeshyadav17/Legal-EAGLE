package firms

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/platform/middleware"
	"github.com/legaleagle/backend/internal/shared"
)

type Handler struct {
	store *database.Store
}

func NewHandler(store *database.Store) *Handler {
	return &Handler{store: store}
}

// GetFirm godoc
// @Summary Get public law firm profile including active team directory
// @Tags Firms
// @Produce json
// @Param id path string true "Firm ID"
// @Success 200 {object} map[string]any
// @Failure 404 {object} shared.AppError
// @Router /firms/{id} [get]
func (h *Handler) GetFirm(c *gin.Context) {
	id := c.Param("id")
	f, ok := h.store.Firms[id]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Law firm not found."))
		return
	}
	memberIDs := shared.ActiveMemberIDs(h.store, id)
	members := make([]shared.LawyerSummaryDTO, 0, len(memberIDs))
	for _, lid := range memberIDs {
		if l, exists := h.store.Lawyers[lid]; exists {
			members = append(members, shared.BuildLawyerSummary(h.store, l))
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"id":                f.ID,
		"name":              f.Name,
		"city":              f.City,
		"address":           f.Address,
		"established":       f.Established,
		"practiceAreas":     f.PracticeAreas,
		"about":             f.About,
		"email":             f.Email,
		"phone":             f.Phone,
		"website":           f.Website,
		"logo":              f.Logo,
		"cover":             f.Cover,
		"members":           members,
		"activeMemberCount": len(members),
	})
}

// UpdateFirm godoc
// @Summary Update law firm profile (firm admin only)
// @Tags Firms
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Firm ID"
// @Success 200 {object} map[string]any
// @Router /firms/{id} [patch]
func (h *Handler) UpdateFirm(c *gin.Context) {
	claims := middleware.GetClaims(c)
	firmID := c.Param("id")
	if firmID == "me" && claims != nil {
		firmID = claims.ProfileID
	}
	if claims == nil || claims.Role != "FIRM_ADMIN" || claims.ProfileID != firmID {
		shared.RespondError(c, shared.NewForbidden("Only the firm administrator can update this firm profile."))
		return
	}

	var patch struct {
		Name          *string   `json:"name"`
		About         *string   `json:"about"`
		City          *string   `json:"city"`
		Address       *string   `json:"address"`
		Established   *int      `json:"established"`
		PracticeAreas *[]string `json:"practiceAreas"`
		Logo          *string   `json:"logo"`
		Cover         *string   `json:"cover"`
		Email         *string   `json:"email"`
		Phone         *string   `json:"phone"`
		Website       *string   `json:"website"`
	}
	if err := c.ShouldBindJSON(&patch); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		f, ok := h.store.Firms[firmID]
		if !ok {
			return shared.NewNotFound("Law firm not found.")
		}
		if patch.Name != nil && strings.TrimSpace(*patch.Name) != "" {
			f.Name = strings.TrimSpace(*patch.Name)
		}
		if patch.About != nil {
			f.About = *patch.About
		}
		if patch.City != nil {
			f.City = strings.TrimSpace(*patch.City)
		}
		if patch.Address != nil {
			f.Address = strings.TrimSpace(*patch.Address)
		}
		if patch.Established != nil {
			f.Established = *patch.Established
		}
		if patch.PracticeAreas != nil {
			if len(*patch.PracticeAreas) == 0 {
				return shared.NewBadRequest("Select at least one practice area.")
			}
			f.PracticeAreas = *patch.PracticeAreas
		}
		if patch.Logo != nil {
			f.Logo = *patch.Logo
		}
		if patch.Cover != nil {
			f.Cover = *patch.Cover
		}
		if patch.Email != nil {
			f.Email = *patch.Email
		}
		if patch.Phone != nil {
			f.Phone = *patch.Phone
		}
		if patch.Website != nil {
			f.Website = *patch.Website
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	h.GetFirm(c)
}

// GetFirmMemberships returns active members, join requests, and sent invitations for a firm.
func (h *Handler) GetFirmMemberships(c *gin.Context) {
	firmID := c.Param("id")
	active := []map[string]any{}
	requests := []map[string]any{}
	invitations := []map[string]any{}

	for _, m := range h.store.Memberships {
		if m.FirmID != firmID {
			continue
		}
		l, ok := h.store.Lawyers[m.LawyerID]
		if !ok {
			continue
		}
		item := map[string]any{
			"id":          m.ID,
			"firmId":      m.FirmID,
			"lawyerId":    m.LawyerID,
			"status":      m.Status,
			"initiatedBy": m.InitiatedBy,
			"createdAt":   m.CreatedAt,
			"updatedAt":   m.UpdatedAt,
			"lawyer":      shared.BuildLawyerSummary(h.store, l),
		}
		switch {
		case m.Status == "active":
			active = append(active, item)
		case m.Status == "pending" && m.InitiatedBy == "lawyer":
			requests = append(requests, item)
		case m.Status == "pending" && m.InitiatedBy == "firm":
			invitations = append(invitations, item)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"active":      active,
		"requests":    requests,
		"invitations": invitations,
	})
}

// GetLawyerMemberships returns active firm membership, invitations, and join requests for a lawyer.
func (h *Handler) GetLawyerMemberships(c *gin.Context) {
	lawyerID := c.Param("id")
	var active any
	invitations := []map[string]any{}
	requests := []map[string]any{}

	for _, m := range h.store.Memberships {
		if m.LawyerID != lawyerID {
			continue
		}
		f, ok := h.store.Firms[m.FirmID]
		if !ok {
			continue
		}
		item := map[string]any{
			"id":          m.ID,
			"firmId":      m.FirmID,
			"lawyerId":    m.LawyerID,
			"status":      m.Status,
			"initiatedBy": m.InitiatedBy,
			"createdAt":   m.CreatedAt,
			"updatedAt":   m.UpdatedAt,
			"firm":        shared.BuildFirmSummary(h.store, f),
		}
		switch {
		case m.Status == "active":
			active = item
		case m.Status == "pending" && m.InitiatedBy == "firm":
			invitations = append(invitations, item)
		case m.Status == "pending" && m.InitiatedBy == "lawyer":
			requests = append(requests, item)
		}
	}

	allFirms := []shared.FirmSummaryDTO{}
	for _, f := range h.store.Firms {
		allFirms = append(allFirms, shared.BuildFirmSummary(h.store, f))
	}

	c.JSON(http.StatusOK, gin.H{
		"active":      active,
		"invitations": invitations,
		"requests":    requests,
		"allFirms":    allFirms,
	})
}

// InviteLawyer creates a firm invitation to a lawyer.
func (h *Handler) InviteLawyer(c *gin.Context) {
	claims := middleware.GetClaims(c)
	firmID := c.Param("id")
	if claims == nil || claims.Role != "FIRM_ADMIN" || claims.ProfileID != firmID {
		shared.RespondError(c, shared.NewForbidden("Only the firm administrator can invite lawyers."))
		return
	}
	var req struct {
		LawyerID string `json:"lawyerId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var created *sqlcgen.FirmMembership
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		if shared.ActiveMembershipForLawyer(h.store, req.LawyerID) != nil {
			return shared.NewConflict("This lawyer is currently affiliated with another firm.")
		}
		for _, m := range h.store.Memberships {
			if m.FirmID == firmID && m.LawyerID == req.LawyerID && (m.Status == "active" || m.Status == "pending") {
				return shared.NewConflict("This lawyer already has an active or pending record with your firm.")
			}
		}
		now := time.Now().UTC()
		created = &sqlcgen.FirmMembership{
			ID:          "m_" + uuid.NewString()[:6],
			FirmID:      firmID,
			LawyerID:    req.LawyerID,
			MemberRole:  "MEMBER",
			Status:      "pending",
			InitiatedBy: "firm",
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		h.store.Memberships[created.ID] = created
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

// RequestToJoin allows a lawyer to request to join a firm.
func (h *Handler) RequestToJoin(c *gin.Context) {
	claims := middleware.GetClaims(c)
	firmID := c.Param("id")
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only lawyers can request to join a firm."))
		return
	}
	lawyerID := claims.ProfileID

	var created *sqlcgen.FirmMembership
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		if shared.ActiveMembershipForLawyer(h.store, lawyerID) != nil {
			return shared.NewConflict("Leave your current firm before requesting to join another.")
		}
		for _, m := range h.store.Memberships {
			if m.FirmID == firmID && m.LawyerID == lawyerID && m.Status == "pending" {
				return shared.NewConflict("A request or invitation with this firm is already pending.")
			}
		}
		now := time.Now().UTC()
		created = &sqlcgen.FirmMembership{
			ID:          "m_" + uuid.NewString()[:6],
			FirmID:      firmID,
			LawyerID:    lawyerID,
			MemberRole:  "MEMBER",
			Status:      "pending",
			InitiatedBy: "lawyer",
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		h.store.Memberships[created.ID] = created
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

// MutateMembership handles approve|reject|accept|decline|cancel|withdraw|remove|leave.
func (h *Handler) MutateMembership(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil {
		shared.RespondError(c, shared.NewUnauthorized("Authentication required."))
		return
	}
	id := c.Param("id")
	action := c.Param("action")

	var updated *sqlcgen.FirmMembership
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		m, ok := h.store.Memberships[id]
		if !ok {
			return shared.NewNotFound("Membership record not found.")
		}
		now := time.Now().UTC()
		switch action {
		case "approve", "accept":
			if action == "approve" && (claims.Role != "FIRM_ADMIN" || claims.ProfileID != m.FirmID) {
				return shared.NewForbidden("Only the firm administrator can approve join requests.")
			}
			if action == "accept" && (claims.Role != "LAWYER" || claims.ProfileID != m.LawyerID) {
				return shared.NewForbidden("Only the invited lawyer can accept this invitation.")
			}
			if m.Status != "pending" {
				return shared.NewConflict("This request is no longer pending.")
			}
			if shared.ActiveMembershipForLawyer(h.store, m.LawyerID) != nil {
				return shared.NewConflict("Lawyer already has an active firm affiliation.")
			}
			m.Status = "active"
			m.UpdatedAt = now
			for _, other := range h.store.Memberships {
				if other.LawyerID == m.LawyerID && other.Status == "pending" && other.ID != m.ID {
					other.Status = "cancelled"
					other.UpdatedAt = now
				}
			}
		case "reject":
			m.Status = "rejected"
			m.UpdatedAt = now
		case "decline":
			m.Status = "declined"
			m.UpdatedAt = now
		case "cancel":
			m.Status = "cancelled"
			m.UpdatedAt = now
		case "withdraw":
			m.Status = "withdrawn"
			m.UpdatedAt = now
		case "remove":
			m.Status = "removed"
			m.UpdatedAt = now
		case "leave":
			m.Status = "left"
			m.UpdatedAt = now
		default:
			return shared.NewBadRequest("Unsupported membership action: " + action)
		}
		updated = m
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, updated)
}

