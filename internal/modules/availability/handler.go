package availability

import (
	"fmt"
	"net/http"
	"sort"
	"strconv"
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

// GetLawyerAvailability godoc
// @Summary List 60-minute consultation slots and consultation settings for a lawyer
// @Tags Availability
// @Produce json
// @Param id path string true "Lawyer ID"
// @Param date query string false "Optional YYYY-MM-DD filter"
// @Success 200 {object} map[string]any
// @Router /lawyers/{id}/availability [get]
func (h *Handler) GetLawyerAvailability(c *gin.Context) {
	lawyerID := c.Param("id")
	dateFilter := strings.TrimSpace(c.Query("date"))

	if _, exists := h.store.Lawyers[lawyerID]; !exists {
		shared.RespondError(c, shared.NewNotFound("Lawyer not found."))
		return
	}

	settings := shared.ConsultationInfoForLawyer(h.store, lawyerID)
	blockedSet := make(map[string]bool, len(settings.BlockedDates))
	for _, d := range settings.BlockedDates {
		blockedSet[d] = true
	}

	slots := []sqlcgen.ConsultationSlot{}
	for _, s := range h.store.Slots {
		if s.LawyerID != lawyerID {
			continue
		}
		if dateFilter != "" && s.Date != dateFilter {
			continue
		}
		slotCopy := *s
		if blockedSet[s.Date] && s.BackendStatus == shared.SlotAvailable {
			slotCopy.BackendStatus = shared.SlotBlocked
			slotCopy.Status = shared.FrontendSlotStatus(shared.SlotBlocked)
		} else {
			slotCopy.Status = shared.FrontendSlotStatus(s.BackendStatus)
		}
		slots = append(slots, slotCopy)
	}

	sort.Slice(slots, func(i, j int) bool {
		aKey := slots[i].Date + " " + slots[i].StartTime
		bKey := slots[j].Date + " " + slots[j].StartTime
		return aKey < bKey
	})

	c.JSON(http.StatusOK, gin.H{
		"settings": settings,
		"slots":    slots,
	})
}

// UpdateRules godoc
// @Summary Configure lawyer consultation fee, modes, working hours, and lead time
// @Tags Availability
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} sqlcgen.ConsultationSettings
// @Router /lawyers/me/availability/rules [put]
func (h *Handler) UpdateRules(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only lawyers can configure consultation rules."))
		return
	}

	var patch struct {
		Fee             *float64              `json:"fee"`
		AvailableModes  *[]string             `json:"availableModes"`
		BookingLeadTime *int                  `json:"bookingLeadTime"`
		WorkingDays     *[]string             `json:"workingDays"`
		WorkingHours    *sqlcgen.WorkingHours `json:"workingHours"`
		BlockedDates    *[]string             `json:"blockedDates"`
		OfficeLocation  *string               `json:"officeLocation"`
	}
	if err := c.ShouldBindJSON(&patch); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var updated *sqlcgen.ConsultationSettings
	err := h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
		cs := shared.ConsultationInfoForLawyer(h.store, claims.ProfileID)
		if patch.Fee != nil {
			if *patch.Fee < 200 || *patch.Fee > 100000 {
				return shared.NewBadRequest("Consultation fee must be between ₹200 and ₹1,00,000.")
			}
			cs.Fee = *patch.Fee
		}
		if patch.AvailableModes != nil {
			if len(*patch.AvailableModes) == 0 {
				return shared.NewBadRequest("Select at least one consultation mode (ONLINE or IN_PERSON).")
			}
			cs.AvailableModes = *patch.AvailableModes
		}
		if patch.BookingLeadTime != nil && *patch.BookingLeadTime >= 0 {
			cs.BookingLeadTime = *patch.BookingLeadTime
		}
		if patch.WorkingDays != nil {
			if len(*patch.WorkingDays) == 0 {
				return shared.NewBadRequest("Select at least one working weekday.")
			}
			cs.WorkingDays = *patch.WorkingDays
		}
		if patch.WorkingHours != nil {
			cs.WorkingHours = *patch.WorkingHours
		}
		if patch.BlockedDates != nil {
			cs.BlockedDates = *patch.BlockedDates
		}
		if patch.OfficeLocation != nil {
			cs.OfficeLocation = strings.TrimSpace(*patch.OfficeLocation)
		}
		h.store.ConsultationSettings[claims.ProfileID] = cs
		updated = cs
		h.store.WriteAuditSync(c.Request.Context(), tx, claims.UserID, claims.Role, "AVAILABILITY_RULES_UPDATED", "lawyer", claims.ProfileID, c.ClientIP(), nil)
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, updated)
}

// ToggleException godoc
// @Summary Block or unblock a date (holiday/leave) or add date-specific 1-hour slots
// @Tags Availability
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]any
// @Router /lawyers/me/availability/exceptions [post]
func (h *Handler) ToggleException(c *gin.Context) {
	claims := middleware.GetClaims(c)
	if claims == nil || claims.Role != "LAWYER" {
		shared.RespondError(c, shared.NewForbidden("Only lawyers can manage availability exceptions."))
		return
	}

	var req struct {
		Action         string `json:"action"` // "toggle_block" | "add_slot" | "bulk_generate" | "remove_slot"
		Date           string `json:"date"`
		StartTime      string `json:"startTime"`
		StartHour      int    `json:"startHour"`
		EndHour        int    `json:"endHour"`
		SkipBreakHour  int    `json:"skipBreakHour"`
		SlotID         string `json:"slotId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	lawyerID := claims.ProfileID
	var out any

	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		cs := shared.ConsultationInfoForLawyer(h.store, lawyerID)
		switch req.Action {
		case "add_slot":
			slot, err := h.createOneHourSlotLocked(lawyerID, cs, req.Date, req.StartTime)
			if err != nil {
				return err
			}
			out = slot
		case "bulk_generate":
			startH := req.StartHour
			endH := req.EndHour
			if startH == 0 {
				startH = 10
			}
			if endH == 0 {
				endH = 17
			}
			if startH < 6 || endH > 22 || startH >= endH {
				return shared.NewBadRequest("Working hours must be between 06:00 and 22:00 with start before end.")
			}
			var created []*sqlcgen.ConsultationSlot
			for hNum := startH; hNum < endH; hNum++ {
				if req.SkipBreakHour > 0 && hNum == req.SkipBreakHour {
					continue
				}
				st := fmt.Sprintf("%02d:00", hNum)
				if s, err := h.createOneHourSlotLocked(lawyerID, cs, req.Date, st); err == nil {
					created = append(created, s)
				}
			}
			if len(created) == 0 {
				return shared.NewConflict("All 1-hour slots in that time range already exist on this date.")
			}
			out = created
		case "remove_slot":
			slot, ok := h.store.Slots[req.SlotID]
			if !ok || slot.LawyerID != lawyerID {
				return shared.NewNotFound("Time slot not found.")
			}
			if slot.BackendStatus != shared.SlotAvailable && slot.BackendStatus != shared.SlotBlocked {
				return shared.NewConflict("Cannot remove a slot that is currently held, awaiting approval, or confirmed.")
			}
			delete(h.store.Slots, req.SlotID)
			out = gin.H{"deleted": req.SlotID}
		default: // toggle_block
			if req.Date == "" {
				return shared.NewBadRequest("Date is required.")
			}
			isBlocked := false
			var next []string
			for _, d := range cs.BlockedDates {
				if d == req.Date {
					isBlocked = true
				} else {
					next = append(next, d)
				}
			}
			if !isBlocked {
				// Prevent blocking a date with active held/pending/confirmed slots
				for _, s := range h.store.Slots {
					if s.LawyerID == lawyerID && s.Date == req.Date &&
						(s.BackendStatus == shared.SlotHeld || s.BackendStatus == shared.SlotAwaitingLawyer || s.BackendStatus == shared.SlotProposed || s.BackendStatus == shared.SlotConfirmed) {
						return shared.NewConflict("Cannot block this date because it has a reserved, pending or confirmed consultation.")
					}
				}
				next = append(next, req.Date)
				sort.Strings(next)
				for _, s := range h.store.Slots {
					if s.LawyerID == lawyerID && s.Date == req.Date && s.BackendStatus == shared.SlotAvailable {
						s.BackendStatus = shared.SlotBlocked
						s.Status = shared.FrontendSlotStatus(shared.SlotBlocked)
					}
				}
			} else {
				for _, s := range h.store.Slots {
					if s.LawyerID == lawyerID && s.Date == req.Date && s.BackendStatus == shared.SlotBlocked && s.BookingID == nil {
						s.BackendStatus = shared.SlotAvailable
						s.Status = shared.FrontendSlotStatus(shared.SlotAvailable)
					}
				}
			}
			cs.BlockedDates = next
			h.store.ConsultationSettings[lawyerID] = cs
			out = cs
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, out)
}

func (h *Handler) createOneHourSlotLocked(lawyerID string, cs *sqlcgen.ConsultationSettings, date, startTime string) (*sqlcgen.ConsultationSlot, error) {
	if date == "" || startTime == "" {
		return nil, shared.NewBadRequest("Date and start time are required.")
	}
	for _, b := range cs.BlockedDates {
		if b == date {
			return nil, shared.NewConflict("This date is currently marked as a blocked holiday/leave date. Unblock it first.")
		}
	}
	parts := strings.Split(startTime, ":")
	if len(parts) < 2 {
		return nil, shared.NewBadRequest("Invalid startTime format (expected HH:MM).")
	}
	hour, err := strconv.Atoi(parts[0])
	if err != nil || hour < 0 || hour > 22 {
		return nil, shared.NewBadRequest("Start time must be between 00:00 and 22:00.")
	}
	endTime := fmt.Sprintf("%02d:%s", hour+1, parts[1])

	// Check for overlapping 60-minute slots on the same date for this lawyer
	for _, s := range h.store.Slots {
		if s.LawyerID == lawyerID && s.Date == date {
			if startTime < s.EndTime && endTime > s.StartTime {
				return nil, shared.NewConflict(fmt.Sprintf("Overlapping slot: you already have a slot between %s and %s on %s.", startTime, endTime, date))
			}
		}
	}

	startsUTC, err := time.Parse(time.RFC3339, fmt.Sprintf("%sT%s:00+05:30", date, startTime))
	if err != nil {
		return nil, shared.NewBadRequest("Invalid date or time.")
	}
	endsUTC := startsUTC.Add(60 * time.Minute)
	id := fmt.Sprintf("slot_%s_%s_%s", lawyerID, date, strings.ReplaceAll(startTime, ":", ""))
	slot := &sqlcgen.ConsultationSlot{
		UUID:          uuid.New(),
		ID:            id,
		LawyerID:      lawyerID,
		Date:          date,
		StartTime:     startTime,
		EndTime:       endTime,
		StartsAtUTC:   startsUTC.UTC(),
		EndsAtUTC:     endsUTC.UTC(),
		Timezone:      "Asia/Kolkata",
		BackendStatus: shared.SlotAvailable,
		Status:        shared.FrontendSlotStatus(shared.SlotAvailable),
	}
	h.store.Slots[id] = slot
	return slot, nil
}

