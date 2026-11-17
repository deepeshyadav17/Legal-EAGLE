package admin

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/legaleagle/backend/internal/platform/database"
)

type Handler struct {
	store *database.Store
}

func NewHandler(store *database.Store) *Handler {
	return &Handler{store: store}
}

// ListAuditLogs godoc
// @Summary Retrieve security and business audit logs (PLATFORM_ADMIN only)
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} sqlcgen.AuditLog
// @Router /admin/audit-logs [get]
func (h *Handler) ListAuditLogs(c *gin.Context) {
	c.JSON(http.StatusOK, h.store.AuditLogs)
}

// ListOutboxEvents godoc
// @Summary Inspect transactional outbox queue (PLATFORM_ADMIN only)
// @Tags Admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} sqlcgen.OutboxEvent
// @Router /admin/outbox [get]
func (h *Handler) ListOutboxEvents(c *gin.Context) {
	c.JSON(http.StatusOK, h.store.Outbox)
}

