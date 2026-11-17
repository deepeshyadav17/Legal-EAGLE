package notifications

import (
	"net/http"

	"github.com/gin-gonic/gin"
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

// ListNotifications godoc
// @Summary List notifications for the authenticated user
// @Tags Notifications
// @Produce json
// @Security BearerAuth
// @Success 200 {array} sqlcgen.Notification
// @Router /notifications [get]
func (h *Handler) ListNotifications(c *gin.Context) {
	claims := middleware.GetClaims(c)
	out := []*sqlcgen.Notification{}
	for _, n := range h.store.Notifications {
		if n.RecipientID == claims.UserID {
			out = append(out, n)
		}
	}
	c.JSON(http.StatusOK, out)
}

// MarkRead godoc
// @Summary Mark a single notification as read
// @Tags Notifications
// @Produce json
// @Security BearerAuth
// @Param id path string true "Notification ID"
// @Success 200 {object} sqlcgen.Notification
// @Router /notifications/{id}/read [patch]
func (h *Handler) MarkRead(c *gin.Context) {
	claims := middleware.GetClaims(c)
	id := c.Param("id")
	var found *sqlcgen.Notification
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		for _, n := range h.store.Notifications {
			if n.ID == id && n.RecipientID == claims.UserID {
				n.IsRead = true
				found = n
				break
			}
		}
		if found == nil {
			return shared.NewNotFound("Notification not found.")
		}
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, found)
}

// MarkAllRead godoc
// @Summary Mark all notifications as read for the authenticated user
// @Tags Notifications
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]any
// @Router /notifications/read-all [patch]
func (h *Handler) MarkAllRead(c *gin.Context) {
	claims := middleware.GetClaims(c)
	count := 0
	_ = h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		for _, n := range h.store.Notifications {
			if n.RecipientID == claims.UserID && !n.IsRead {
				n.IsRead = true
				count++
			}
		}
		return nil
	})
	c.JSON(http.StatusOK, gin.H{"updated": count})
}

