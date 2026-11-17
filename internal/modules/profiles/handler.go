package profiles

import (
	"net/http"
	"sort"
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

// GetLawyer godoc
// @Summary Get public lawyer profile by ID (excludes private contact details)
// @Tags Profiles
// @Produce json
// @Param id path string true "Lawyer ID"
// @Success 200 {object} map[string]any
// @Failure 404 {object} shared.AppError
// @Router /lawyers/{id} [get]
func (h *Handler) GetLawyer(c *gin.Context) {
	id := c.Param("id")
	l, ok := h.store.Lawyers[id]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Lawyer profile not found."))
		return
	}
	claims := middleware.GetClaims(c)
	isOwner := claims != nil && claims.Role == "LAWYER" && claims.ProfileID == id
	c.JSON(http.StatusOK, shared.BuildLawyerPublic(h.store, l, isOwner))
}

// GetLawyerContact godoc
// @Summary Server-enforced lawyer contact visibility check
// @Tags Profiles
// @Produce json
// @Param id path string true "Lawyer ID"
// @Success 200 {object} map[string]any
// @Router /lawyers/{id}/contact [get]
func (h *Handler) GetLawyerContact(c *gin.Context) {
	id := c.Param("id")
	l, ok := h.store.Lawyers[id]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Lawyer profile not found."))
		return
	}
	claims := middleware.GetClaims(c)
	if claims != nil && claims.Role == "LAWYER" && claims.ProfileID == id {
		c.JSON(http.StatusOK, gin.H{
			"status":     "visible",
			"owner":      true,
			"contact":    l.Contact,
			"visibility": l.ContactVisibility,
		})
		return
	}
	if claims == nil {
		c.JSON(http.StatusOK, gin.H{"status": "login_required"})
		return
	}
	if claims.Role != "CLIENT" {
		c.JSON(http.StatusOK, gin.H{"status": "clients_only"})
		return
	}
	if l.ContactVisibility != "clients" {
		c.JSON(http.StatusOK, gin.H{"status": "hidden"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  "visible",
		"contact": l.Contact,
	})
}

// UpdateLawyerMe godoc
// @Summary Update authenticated lawyer's own profile
// @Tags Profiles
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]any
// @Failure 403 {object} shared.AppError
// @Router /lawyers/me [patch]
func (h *Handler) UpdateLawyerMe(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only lawyers can update a lawyer profile."))
		return
	}
	targetID := c.Param("id")
	if targetID != "" && targetID != "me" && targetID != claims.ProfileID {
		shared.RespondError(c, shared.NewForbidden("You can only modify your own lawyer profile."))
		return
	}
	h.updateLawyerByID(c, claims.ProfileID)
}

func (h *Handler) updateLawyerByID(c *gin.Context, lawyerID string) {
	var patch struct {
		Name              *string              `json:"name"`
		Headline          *string              `json:"headline"`
		City              *string              `json:"city"`
		ExperienceYears   *int                 `json:"experienceYears"`
		PracticeAreas     *[]string            `json:"practiceAreas"`
		About             *string              `json:"about"`
		Photo             *string              `json:"photo"`
		Languages         *[]string            `json:"languages"`
		ContactVisibility *string              `json:"contactVisibility"`
		Contact           *sqlcgen.ContactInfo `json:"contact"`
	}
	if err := c.ShouldBindJSON(&patch); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var result map[string]any
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		l, ok := h.store.Lawyers[lawyerID]
		if !ok {
			return shared.NewNotFound("Lawyer profile not found.")
		}
		if patch.Name != nil {
			l.Name = strings.TrimSpace(*patch.Name)
		}
		if patch.Headline != nil {
			l.Headline = strings.TrimSpace(*patch.Headline)
		}
		if patch.City != nil {
			l.City = strings.TrimSpace(*patch.City)
		}
		if patch.ExperienceYears != nil && *patch.ExperienceYears >= 0 {
			l.ExperienceYears = *patch.ExperienceYears
		}
		if patch.PracticeAreas != nil {
			if len(*patch.PracticeAreas) == 0 {
				return shared.NewBadRequest("Select at least one practice area.")
			}
			l.PracticeAreas = *patch.PracticeAreas
		}
		if patch.About != nil {
			l.About = *patch.About
		}
		if patch.Photo != nil {
			l.Photo = *patch.Photo
		}
		if patch.Languages != nil {
			l.Languages = *patch.Languages
		}
		if patch.ContactVisibility != nil {
			if *patch.ContactVisibility != "clients" && *patch.ContactVisibility != "hidden" {
				return shared.NewBadRequest("contactVisibility must be 'clients' or 'hidden'.")
			}
			l.ContactVisibility = *patch.ContactVisibility
		}
		if patch.Contact != nil {
			if patch.Contact.Email != "" {
				l.Contact.Email = patch.Contact.Email
			}
			if patch.Contact.Phone != "" {
				l.Contact.Phone = patch.Contact.Phone
			}
		}
		result = shared.BuildLawyerPublic(h.store, l, true)
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

// AddPortfolioRecord handles POST /api/v1/lawyers/:id/:section
func (h *Handler) AddPortfolioRecord(c *gin.Context) {
	claims := middleware.GetClaims(c)
	lawyerID := c.Param("id")
	if lawyerID == "me" && claims != nil {
		lawyerID = claims.ProfileID
	}
	if claims == nil || claims.Role != "LAWYER" || claims.ProfileID != lawyerID {
		shared.RespondError(c, shared.NewForbidden("Only the profile owner can modify portfolio records."))
		return
	}
	section := c.Param("section")
	var body map[string]any
	if err := c.ShouldBindJSON(&body); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var created any
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		l, ok := h.store.Lawyers[lawyerID]
		if !ok {
			return shared.NewNotFound("Lawyer profile not found.")
		}
		recID := section[:3] + "_" + uuid.NewString()[:6]
		switch section {
		case "education":
			rec := sqlcgen.EducationRecord{
				ID:          recID,
				Institution: strVal(body["institution"]),
				Degree:      strVal(body["degree"]),
				Field:       strVal(body["field"]),
				StartYear:   intVal(body["startYear"]),
				EndYear:     intVal(body["endYear"]),
			}
			l.Education = append([]sqlcgen.EducationRecord{rec}, l.Education...)
			created = rec
		case "experience":
			rec := sqlcgen.ExperienceRecord{
				ID:           recID,
				Organization: strVal(body["organization"]),
				Designation:  strVal(body["designation"]),
				StartDate:    strVal(body["startDate"]),
				EndDate:      strVal(body["endDate"]),
				Description:  strVal(body["description"]),
			}
			l.Experience = append([]sqlcgen.ExperienceRecord{rec}, l.Experience...)
			created = rec
		case "qualifications":
			rec := sqlcgen.QualificationRecord{
				ID:        recID,
				Title:     strVal(body["title"]),
				Issuer:    strVal(body["issuer"]),
				IssueDate: strVal(body["issueDate"]),
			}
			l.Qualifications = append([]sqlcgen.QualificationRecord{rec}, l.Qualifications...)
			created = rec
		case "achievements":
			rec := sqlcgen.AchievementRecord{
				ID:          recID,
				Title:       strVal(body["title"]),
				Description: strVal(body["description"]),
				Date:        strVal(body["date"]),
			}
			l.Achievements = append([]sqlcgen.AchievementRecord{rec}, l.Achievements...)
			created = rec
		default:
			return shared.NewBadRequest("Unknown portfolio section: " + section)
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, created)
}

// DeletePortfolioRecord handles DELETE /api/v1/lawyers/:id/:section/:recordId
func (h *Handler) DeletePortfolioRecord(c *gin.Context) {
	claims := middleware.GetClaims(c)
	lawyerID := c.Param("id")
	if lawyerID == "me" && claims != nil {
		lawyerID = claims.ProfileID
	}
	if claims == nil || claims.Role != "LAWYER" || claims.ProfileID != lawyerID {
		shared.RespondError(c, shared.NewForbidden("Only the profile owner can delete portfolio records."))
		return
	}
	section := c.Param("section")
	recID := c.Param("recordId")

	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		l, ok := h.store.Lawyers[lawyerID]
		if !ok {
			return shared.NewNotFound("Lawyer profile not found.")
		}
		switch section {
		case "education":
			var next []sqlcgen.EducationRecord
			for _, r := range l.Education {
				if r.ID != recID {
					next = append(next, r)
				}
			}
			l.Education = next
		case "experience":
			var next []sqlcgen.ExperienceRecord
			for _, r := range l.Experience {
				if r.ID != recID {
					next = append(next, r)
				}
			}
			l.Experience = next
		case "qualifications":
			var next []sqlcgen.QualificationRecord
			for _, r := range l.Qualifications {
				if r.ID != recID {
					next = append(next, r)
				}
			}
			l.Qualifications = next
		case "achievements":
			var next []sqlcgen.AchievementRecord
			for _, r := range l.Achievements {
				if r.ID != recID {
					next = append(next, r)
				}
			}
			l.Achievements = next
		default:
			return shared.NewBadRequest("Unknown portfolio section.")
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"deleted": recID})
}

// GetClientMe returns the authenticated client's profile, saved items, and recent views.
func (h *Handler) GetClientMe(c *gin.Context) {
	claims := middleware.GetClaims(c)
	cl, ok := h.store.Clients[claims.ProfileID]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Client profile not found."))
		return
	}
	var savedLawyers []shared.LawyerSummaryDTO
	for _, lid := range cl.Saved.Lawyers {
		if l, exists := h.store.Lawyers[lid]; exists {
			savedLawyers = append(savedLawyers, shared.BuildLawyerSummary(h.store, l))
		}
	}
	var savedFirms []shared.FirmSummaryDTO
	for _, fid := range cl.Saved.Firms {
		if f, exists := h.store.Firms[fid]; exists {
			savedFirms = append(savedFirms, shared.BuildFirmSummary(h.store, f))
		}
	}
	c.JSON(http.StatusOK, gin.H{
		"client": cl,
		"savedItems": gin.H{
			"lawyers": savedLawyers,
			"firms":   savedFirms,
		},
	})
}

// ToggleSaved handles POST /api/v1/clients/me/saved
func (h *Handler) ToggleSaved(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var req struct {
		Type string `json:"type" binding:"required"`
		ID   string `json:"id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var resp gin.H
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		cl, ok := h.store.Clients[claims.ProfileID]
		if !ok {
			return shared.NewNotFound("Client profile not found.")
		}
		isSaved := false
		if req.Type == "lawyer" {
			cl.Saved.Lawyers, isSaved = toggleSlice(cl.Saved.Lawyers, req.ID)
		} else {
			cl.Saved.Firms, isSaved = toggleSlice(cl.Saved.Firms, req.ID)
		}
		resp = gin.H{"saved": isSaved, "savedIds": cl.Saved}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, resp)
}

func toggleSlice(list []string, target string) ([]string, bool) {
	for i, v := range list {
		if v == target {
			return append(list[:i], list[i+1:]...), false
		}
	}
	return append([]string{target}, list...), true
}

func strVal(v any) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func intVal(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	default:
		return time.Now().Year()
	}
}

// SortLawyersByName sorts a slice of LawyerSummaryDTO alphabetically.
func SortLawyersByName(list []shared.LawyerSummaryDTO) {
	sort.Slice(list, func(i, j int) bool {
		return list[i].Name < list[j].Name
	})
}

