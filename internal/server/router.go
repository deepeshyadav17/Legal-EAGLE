package server

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"

	_ "github.com/legaleagle/backend/docs"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/modules/admin"
	"github.com/legaleagle/backend/internal/modules/availability"
	"github.com/legaleagle/backend/internal/modules/bookings"
	"github.com/legaleagle/backend/internal/modules/discovery"
	"github.com/legaleagle/backend/internal/modules/firms"
	"github.com/legaleagle/backend/internal/modules/identity"
	"github.com/legaleagle/backend/internal/modules/notifications"
	"github.com/legaleagle/backend/internal/modules/payments"
	"github.com/legaleagle/backend/internal/modules/profiles"
	"github.com/legaleagle/backend/internal/platform/auth"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/middleware"
)

// AppBundle holds wired services and router for API server and integration tests.
type AppBundle struct {
	Router       *gin.Engine
	Store        *database.Store
	TokenManager *auth.TokenManager
	BookingSvc   *bookings.Service
	PaymentSvc   *payments.Service
}

// NewRouter wires all Legal Eagle domain modules into a Gin HTTP engine.
func NewRouter(cfg *config.Config, store *database.Store) *AppBundle {
	if cfg.AppEnv == "production" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.New()
	r.Use(gin.Recovery())
	r.Use(middleware.SecurityHeadersMiddleware())
	r.Use(middleware.CORSMiddleware(cfg.CORSAllowedOrigins))
	r.Use(middleware.MaxBodySize(2 << 20)) // 2 MB request limit
	r.Use(middleware.InProcessRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst))

	authLimiter := middleware.StrictEndpointRateLimiter("auth", 5, 15)
	mutationLimiter := middleware.StrictEndpointRateLimiter("mutation", 10, 25)

	tm := auth.NewTokenManager(cfg.JWTAccessSecret, cfg.JWTAccessTTL, cfg.RefreshSessionTTL)

	// Domain Services
	paymentSvc := payments.NewService(store, cfg)
	bookingSvc := bookings.NewService(store, paymentSvc, cfg)

	// Domain Handlers
	identityH := identity.NewHandler(store, tm, cfg)
	profilesH := profiles.NewHandler(store)
	firmsH := firms.NewHandler(store)
	discoveryH := discovery.NewHandler(store)
	availH := availability.NewHandler(store)
	bookingsH := bookings.NewHandler(bookingSvc, store)
	paymentsH := payments.NewHandler(paymentSvc, store, bookingSvc)
	notifH := notifications.NewHandler(store)
	adminH := admin.NewHandler(store)

	// Health & Readiness Endpoints
	r.GET("/health/live", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "alive"})
	})
	r.GET("/health/ready", func(c *gin.Context) {
		ok, mode := store.Ping(c.Request.Context())
		if !ok {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "unready", "reason": mode})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ready", "engine": mode})
	})

	// Swagger UI Documentation (/swagger/index.html)
	r.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	v1 := r.Group("/api/v1")
	{
		// 1. Authentication (with strict per-IP brute-force rate limiting)
		authGroup := v1.Group("/auth")
		{
			authGroup.POST("/register", authLimiter, identityH.Register)
			authGroup.POST("/login", authLimiter, identityH.Login)
			authGroup.POST("/demo-login", authLimiter, identityH.DemoLogin)
			authGroup.POST("/refresh", authLimiter, identityH.Refresh)
			authGroup.POST("/logout", identityH.Logout)
			authGroup.GET("/me", middleware.AuthRequired(tm), identityH.Me)
			authGroup.PATCH("/me", middleware.AuthRequired(tm), identityH.UpdateMe)
		}

		// 2. Discovery & Profiles
		v1.GET("/practice-areas", discoveryH.GetPracticeAreas)
		v1.GET("/discover", discoveryH.GetDiscoverData)
		v1.GET("/lawyers", discoveryH.SearchLawyers)
		v1.GET("/lawyers/:id", middleware.OptionalAuth(tm), profilesH.GetLawyer)
		v1.GET("/lawyers/:id/contact", middleware.OptionalAuth(tm), profilesH.GetLawyerContact)
		v1.PATCH("/lawyers/me", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), profilesH.UpdateLawyerMe)
		v1.PATCH("/lawyers/:id", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), profilesH.UpdateLawyerMe)
		v1.POST("/lawyers/:id/:section", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), profilesH.AddPortfolioRecord)
		v1.DELETE("/lawyers/:id/:section/:recordId", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), profilesH.DeletePortfolioRecord)

		// Client Profile & Saved
		v1.GET("/clients/me", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), profilesH.GetClientMe)
		v1.POST("/clients/me/saved", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), profilesH.ToggleSaved)

		// 3. Firms & Memberships
		v1.GET("/firms", discoveryH.SearchFirms)
		v1.GET("/firms/:id", firmsH.GetFirm)
		v1.PATCH("/firms/:id", middleware.AuthRequired(tm), middleware.RequireRoles("FIRM_ADMIN"), firmsH.UpdateFirm)
		v1.GET("/firms/:id/memberships", firmsH.GetFirmMemberships)
		v1.GET("/lawyers/:id/memberships", firmsH.GetLawyerMemberships)
		v1.POST("/firms/:id/invitations", middleware.AuthRequired(tm), middleware.RequireRoles("FIRM_ADMIN"), firmsH.InviteLawyer)
		v1.POST("/firms/:id/join-requests", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), firmsH.RequestToJoin)
		v1.POST("/memberships/:id/:action", middleware.AuthRequired(tm), firmsH.MutateMembership)
		v1.GET("/firms/:id/consultations", middleware.AuthRequired(tm), middleware.RequireRoles("FIRM_ADMIN"), bookingsH.GetFirmConsultationsOverview)

		// 4. Lawyer Availability
		v1.GET("/lawyers/:id/availability", availH.GetLawyerAvailability)
		v1.PUT("/lawyers/me/availability/rules", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), availH.UpdateRules)
		v1.POST("/lawyers/me/availability/exceptions", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), availH.ToggleException)

		// 5. Consultation Bookings (Module A)
		v1.POST("/booking-holds", mutationLimiter, middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), bookingsH.CreateHold)
		v1.GET("/bookings/me", middleware.AuthRequired(tm), bookingsH.GetMyBookings)
		v1.GET("/bookings/:id", middleware.AuthRequired(tm), bookingsH.GetBooking)
		v1.POST("/bookings/:id/accept", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), bookingsH.AcceptBooking)
		v1.POST("/bookings/:id/decline", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), bookingsH.DeclineBooking)
		v1.POST("/bookings/:id/reschedule-proposals", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), bookingsH.ProposeReschedule)
		v1.POST("/bookings/:id/reschedule-proposals/:proposalId/accept", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), bookingsH.AcceptRescheduleProposal)
		v1.POST("/bookings/:id/reschedule-proposals/:proposalId/reject", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), bookingsH.RejectRescheduleProposal)
		v1.POST("/bookings/:id/complete", middleware.AuthRequired(tm), middleware.RequireRoles("LAWYER"), bookingsH.CompleteBooking)

		// 6. Payments & Refunds (Module B)
		v1.POST("/payments/orders", mutationLimiter, middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), paymentsH.CreateOrder)
		v1.GET("/payments/me", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), paymentsH.GetMyPayments)
		v1.GET("/payments/:id", middleware.AuthRequired(tm), paymentsH.GetPayment)
		v1.POST("/webhooks/razorpay", paymentsH.RazorpayWebhook)
		v1.GET("/refunds/me", middleware.AuthRequired(tm), middleware.RequireRoles("CLIENT"), paymentsH.GetMyRefunds)
		v1.GET("/refunds/:id", middleware.AuthRequired(tm), paymentsH.GetRefund)

		// 7. Notifications (Module C)
		v1.GET("/notifications", middleware.AuthRequired(tm), notifH.ListNotifications)
		v1.PATCH("/notifications/:id/read", middleware.AuthRequired(tm), notifH.MarkRead)
		v1.PATCH("/notifications/read-all", middleware.AuthRequired(tm), notifH.MarkAllRead)

		// 8. Admin & Audit Logging
		v1.GET("/admin/audit-logs", middleware.AuthRequired(tm), middleware.RequireRoles("PLATFORM_ADMIN"), adminH.ListAuditLogs)
		v1.GET("/admin/outbox", middleware.AuthRequired(tm), middleware.RequireRoles("PLATFORM_ADMIN"), adminH.ListOutboxEvents)

		// API Root Index
		v1.GET("", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"service": "Legal Eagle Backend API",
				"version": "1.0.0",
				"swagger": "/swagger/index.html",
				"health":  "/health/ready",
			})
		})
	}

	// Serve built React SPA from ./dist if present; otherwise redirect / to Swagger UI
	if _, err := os.Stat("dist/index.html"); err == nil {
		r.Static("/assets", "./dist/assets")
		r.StaticFile("/favicon.svg", "./dist/favicon.svg")
		r.GET("/", func(c *gin.Context) {
			c.File("./dist/index.html")
		})
		r.NoRoute(func(c *gin.Context) {
			reqPath := c.Request.URL.Path
			if strings.HasPrefix(reqPath, "/api/") || strings.HasPrefix(reqPath, "/swagger/") || strings.HasPrefix(reqPath, "/health/") {
				c.JSON(http.StatusNotFound, gin.H{"error": gin.H{"code": "NOT_FOUND", "message": "Endpoint not found"}})
				return
			}
			cleanPath := filepath.Clean(strings.TrimPrefix(reqPath, "/"))
			candidate := filepath.Join("dist", cleanPath)
			if info, statErr := os.Stat(candidate); statErr == nil && !info.IsDir() {
				c.File(candidate)
				return
			}
			c.File("./dist/index.html")
		})
	} else {
		r.GET("/", func(c *gin.Context) {
			c.Redirect(http.StatusTemporaryRedirect, "/swagger/index.html")
		})
	}

	return &AppBundle{
		Router:       r,
		Store:        store,
		TokenManager: tm,
		BookingSvc:   bookingSvc,
		PaymentSvc:   paymentSvc,
	}
}

