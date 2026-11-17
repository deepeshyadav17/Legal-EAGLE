package identity

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/legaleagle/backend/internal/config"
	"github.com/legaleagle/backend/internal/platform/auth"
	"github.com/legaleagle/backend/internal/platform/database"
	"github.com/legaleagle/backend/internal/platform/database/sqlcgen"
	"github.com/legaleagle/backend/internal/platform/middleware"
	"github.com/legaleagle/backend/internal/shared"
)

type Handler struct {
	store *database.Store
	tm    *auth.TokenManager
	cfg   *config.Config
}

func NewHandler(store *database.Store, tm *auth.TokenManager, cfg *config.Config) *Handler {
	return &Handler{store: store, tm: tm, cfg: cfg}
}

type RegisterRequest struct {
	Role           string   `json:"role" binding:"required"`
	Name           string   `json:"name"`
	FirmName       string   `json:"firmName"`
	Representative string   `json:"representative"`
	Email          string   `json:"email" binding:"required,email"`
	Password       string   `json:"password" binding:"required,min=6"`
	City           string   `json:"city"`
	Phone          string   `json:"phone"`
	PracticeArea   string   `json:"practiceArea"`
	PracticeAreas  []string `json:"practiceAreas"`
}

type LoginRequest struct {
	Email          string `json:"email" binding:"required"`
	Password       string `json:"password" binding:"required"`
	Name           string `json:"name"`
	Role           string `json:"role"`
	ProfileID      string `json:"profileId"`
	Representative string `json:"representative"`
}

type DemoLoginRequest struct {
	Role string `json:"role" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

// Register godoc
// @Summary Register a new Client, Lawyer, or Law Firm account
// @Tags Authentication
// @Accept json
// @Produce json
// @Param body body RegisterRequest true "Registration payload"
// @Success 201 {object} map[string]any
// @Failure 400 {object} shared.AppError
// @Failure 409 {object} shared.AppError
// @Router /auth/register [post]
func (h *Handler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Invalid registration fields: "+err.Error()))
		return
	}

	bRole, fRole, err := auth.NormalizeRole(req.Role)
	if err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	if err := shared.ValidateEmail(req.Email); err != nil {
		shared.RespondError(c, err)
		return
	}
	email := shared.SanitizeEmail(req.Email)

	if err := shared.ValidatePasswordStrength(req.Password); err != nil {
		shared.RespondError(c, err)
		return
	}

	cleanName, err := shared.ValidateSafeField("Name", req.Name, 0, 120)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	cleanFirmName, err := shared.ValidateSafeField("Firm name", req.FirmName, 0, 150)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	cleanRep, err := shared.ValidateSafeField("Representative name", req.Representative, 0, 120)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	cleanCity, err := shared.ValidateSafeField("City", req.City, 0, 80)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	cleanPhone := shared.SanitizeText(req.Phone, 20)
	if fRole == "lawyer" && cleanPhone != "" {
		if err := shared.ValidatePhone(cleanPhone); err != nil {
			shared.RespondError(c, err)
			return
		}
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var createdUser *sqlcgen.User
	err = h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
		for _, u := range h.store.Users {
			if strings.EqualFold(u.Email, email) {
				return shared.NewConflict("An account with this email already exists.")
			}
		}

		uidStr := "u_" + uuid.NewString()[:8]
		var profileID string
		displayName := cleanName

		switch fRole {
		case "client":
			profileID = "c_" + uuid.NewString()[:6]
			h.store.Clients[profileID] = &sqlcgen.ClientProfile{
				ID:     profileID,
				Name:   displayName,
				Email:  email,
				City:   cleanCity,
				Saved:  sqlcgen.SavedItems{Lawyers: []string{}, Firms: []string{}},
				Recent: []sqlcgen.RecentViewEntry{},
			}
		case "lawyer":
			profileID = "l_" + uuid.NewString()[:6]
			practices := req.PracticeAreas
			if len(practices) == 0 && req.PracticeArea != "" {
				practices = []string{shared.SanitizeText(req.PracticeArea, 64)}
			}
			if len(practices) == 0 {
				practices = []string{"civil"}
			}
			city := cleanCity
			if city == "" {
				city = "Jaipur"
			}
			h.store.Lawyers[profileID] = &sqlcgen.LawyerProfile{
				UUID:              uuid.New(),
				ID:                profileID,
				Name:              displayName,
				Headline:          "Advocate",
				City:              city,
				ExperienceYears:   0,
				PracticeAreas:     practices,
				Languages:         []string{"English"},
				Education:         []sqlcgen.EducationRecord{},
				Experience:        []sqlcgen.ExperienceRecord{},
				Qualifications:    []sqlcgen.QualificationRecord{},
				Achievements:      []sqlcgen.AchievementRecord{},
				Contact:           sqlcgen.ContactInfo{Email: email, Phone: cleanPhone},
				ContactVisibility: "clients",
				JoinedAt:          time.Now().Format("2006-01-02"),
				IsActive:          true,
			}
			h.store.ConsultationSettings[profileID] = &sqlcgen.ConsultationSettings{
				LawyerID:        profileID,
				Fee:             1500,
				Currency:        "INR",
				AvailableModes:  []string{"ONLINE", "IN_PERSON"},
				BookingLeadTime: 2,
				WorkingDays:     []string{"MON", "TUE", "WED", "THU", "FRI", "SAT"},
				WorkingHours:    sqlcgen.WorkingHours{Start: "10:00", End: "18:00"},
				BlockedDates:    []string{},
				OfficeLocation:  fmt.Sprintf("%s Legal Chambers", city),
			}
		case "firm":
			profileID = "f_" + uuid.NewString()[:6]
			if cleanFirmName != "" {
				displayName = cleanFirmName
			}
			practices := req.PracticeAreas
			if len(practices) == 0 {
				practices = []string{"corporate"}
			}
			h.store.Firms[profileID] = &sqlcgen.Firm{
				UUID:          uuid.New(),
				ID:            profileID,
				Name:          displayName,
				City:          cleanCity,
				Address:       cleanCity,
				Established:   time.Now().Year(),
				PracticeAreas: practices,
				Email:         email,
			}
		}

		now := time.Now().UTC()
		createdUser = &sqlcgen.User{
			ID:             uuid.New(),
			ExternalID:     uidStr,
			Email:          email,
			PasswordHash:   hash,
			Role:           bRole,
			FrontendRole:   fRole,
			Name:           displayName,
			ProfileID:      profileID,
			Representative: cleanRep,
			IsActive:       true,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		h.store.Users[uidStr] = createdUser

		if tx != nil {
			ctx := c.Request.Context()
			_, _ = tx.Exec(ctx, `
				INSERT INTO users (id, external_id, email, password_hash, role, name, profile_id, representative, is_active, created_at, updated_at)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $9)
				ON CONFLICT (email) DO NOTHING
			`, createdUser.ID, createdUser.ExternalID, createdUser.Email, createdUser.PasswordHash, createdUser.Role, createdUser.Name, createdUser.ProfileID, createdUser.Representative, now)

			switch fRole {
			case "client":
				cp := h.store.Clients[profileID]
				_, _ = tx.Exec(ctx, `
					INSERT INTO client_profiles (external_id, user_id, name, email, city)
					VALUES ($1, $2, $3, $4, $5)
					ON CONFLICT (external_id) DO NOTHING
				`, cp.ID, createdUser.ID, cp.Name, cp.Email, cp.City)
			case "lawyer":
				lp := h.store.Lawyers[profileID]
				cs := h.store.ConsultationSettings[profileID]
				_, _ = tx.Exec(ctx, `
					INSERT INTO lawyer_profiles (id, external_id, user_id, name, headline, city, experience_years, languages, contact_email, contact_phone, contact_visibility, consultation_fee, currency, available_modes, booking_lead_hours, office_location, is_active)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, TRUE)
					ON CONFLICT (external_id) DO NOTHING
				`, lp.UUID, lp.ID, createdUser.ID, lp.Name, lp.Headline, lp.City, lp.ExperienceYears, lp.Languages, lp.Contact.Email, lp.Contact.Phone, lp.ContactVisibility, cs.Fee, cs.Currency, cs.AvailableModes, cs.BookingLeadTime, cs.OfficeLocation)
			case "firm":
				fm := h.store.Firms[profileID]
				_, _ = tx.Exec(ctx, `
					INSERT INTO firms (id, external_id, admin_user_id, name, city, address, established, practice_areas, email)
					VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
					ON CONFLICT (external_id) DO NOTHING
				`, fm.UUID, fm.ID, createdUser.ID, fm.Name, fm.City, fm.Address, fm.Established, fm.PracticeAreas, fm.Email)
			}
		}

		h.store.WriteAuditSync(c.Request.Context(), tx, uidStr, bRole, "USER_REGISTERED", "user", uidStr, c.ClientIP(), nil)
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}

	h.issueSessionResponse(c, http.StatusCreated, createdUser)
}

// Login godoc
// @Summary Authenticate with email and Argon2id password
// @Tags Authentication
// @Accept json
// @Produce json
// @Param body body LoginRequest true "Credentials"
// @Success 200 {object} map[string]any
// @Failure 401 {object} shared.AppError
// @Router /auth/login [post]
func (h *Handler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Email and password are required."))
		return
	}

	if err := shared.ValidateEmail(req.Email); err != nil {
		shared.RespondError(c, err)
		return
	}
	if len(req.Password) == 0 || len(req.Password) > 72 {
		shared.RespondError(c, shared.NewUnauthorized("Invalid email or password."))
		return
	}

	email := shared.SanitizeEmail(req.Email)
	if strings.EqualFold(h.cfg.AppEnv, "production") && strings.HasSuffix(email, "@demo.legaleagle.in") {
		shared.RespondError(c, shared.NewUnauthorized("Demo accounts cannot sign in to the production service."))
		return
	}
	var found *sqlcgen.User
	for _, u := range h.store.Users {
		if strings.EqualFold(u.Email, email) {
			found = u
			break
		}
	}
	if found == nil && h.store.Pool != nil {
		var u sqlcgen.User
		qErr := h.store.Pool.QueryRow(c.Request.Context(), `
			SELECT id, COALESCE(external_id, ''), email, password_hash, role, name, profile_id, COALESCE(representative, ''), is_active, created_at, updated_at
			FROM users
			WHERE LOWER(email) = LOWER($1)
			LIMIT 1
		`, email).Scan(&u.ID, &u.ExternalID, &u.Email, &u.PasswordHash, &u.Role, &u.Name, &u.ProfileID, &u.Representative, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
		if qErr == nil {
			if u.ExternalID == "" {
				u.ExternalID = "u_" + u.ID.String()[:8]
			}
			_, fRole, _ := auth.NormalizeRole(u.Role)
			u.FrontendRole = fRole
			h.store.Users[u.ExternalID] = &u
			found = &u
		}
	}
	if found == nil && req.Role != "" {
		bRole, fRole, roleErr := auth.NormalizeRole(req.Role)
		hash, hashErr := auth.HashPassword(req.Password)
		if roleErr == nil && hashErr == nil {
			_ = h.store.WithTx(c.Request.Context(), func(tx pgx.Tx) error {
				uidStr := "u_" + uuid.NewString()[:8]
				profID := shared.SanitizeText(req.ProfileID, 64)
				if profID == "" {
					profID = fRole[:1] + "_" + uuid.NewString()[:6]
				}
				dispName := shared.SanitizeText(req.Name, 120)
				if dispName == "" {
					dispName = strings.Split(email, "@")[0]
				}
				now := time.Now().UTC()
				u := &sqlcgen.User{
					ID:             uuid.New(),
					ExternalID:     uidStr,
					Email:          email,
					PasswordHash:   hash,
					Role:           bRole,
					FrontendRole:   fRole,
					Name:           dispName,
					ProfileID:      profID,
					Representative: shared.SanitizeText(req.Representative, 120),
					IsActive:       true,
					CreatedAt:      now,
					UpdatedAt:      now,
				}
				h.store.Users[uidStr] = u
				switch fRole {
				case "client":
					h.store.Clients[profID] = &sqlcgen.ClientProfile{
						ID: profID, Name: dispName, Email: email,
						Saved: sqlcgen.SavedItems{Lawyers: []string{}, Firms: []string{}},
						Recent: []sqlcgen.RecentViewEntry{},
					}
				}
				if tx != nil {
					ctx := c.Request.Context()
					_, _ = tx.Exec(ctx, `
						INSERT INTO users (id, external_id, email, password_hash, role, name, profile_id, representative, is_active, created_at, updated_at)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $9)
						ON CONFLICT (email) DO NOTHING
					`, u.ID, u.ExternalID, u.Email, u.PasswordHash, u.Role, u.Name, u.ProfileID, u.Representative, now)
					if fRole == "client" {
						_, _ = tx.Exec(ctx, `
							INSERT INTO client_profiles (external_id, user_id, name, email, city)
							VALUES ($1, $2, $3, $4, '')
							ON CONFLICT (external_id) DO NOTHING
						`, profID, u.ID, dispName, email)
					}
				}
				found = u
				return nil
			})
		}
	}

	if found == nil || !found.IsActive {
		shared.RespondError(c, shared.NewUnauthorized("Invalid email or password."))
		return
	}

	ok, err := auth.VerifyPassword(req.Password, found.PasswordHash)
	isSeededDemo := strings.HasSuffix(email, "@demo.legaleagle.in") && len(req.Password) >= 6
	if (err != nil || !ok) && !isSeededDemo {
		shared.RespondError(c, shared.NewUnauthorized("Invalid email or password."))
		return
	}

	h.issueSessionResponse(c, http.StatusOK, found)
}

// DemoLogin godoc
// @Summary Sign in with a seeded demo role (development convenience)
// @Tags Authentication
// @Accept json
// @Produce json
// @Param body body DemoLoginRequest true "Demo role"
// @Success 200 {object} map[string]any
// @Router /auth/demo-login [post]
func (h *Handler) DemoLogin(c *gin.Context) {
	if strings.EqualFold(h.cfg.AppEnv, "production") {
		shared.RespondError(c, shared.NewForbidden("Demo sign-in is disabled in production."))
		return
	}
	var req DemoLoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		shared.RespondError(c, shared.NewBadRequest("Role is required."))
		return
	}
	bRole, fRole, err := auth.NormalizeRole(req.Role)
	if err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}
	var target *sqlcgen.User
	for _, u := range h.store.Users {
		if u.Role == bRole || u.FrontendRole == fRole {
			if u.ExternalID == "u1" || u.ExternalID == "u2" || u.ExternalID == "u3" || target == nil {
				target = u
				if u.ExternalID == "u1" || u.ExternalID == "u2" || u.ExternalID == "u3" {
					break
				}
			}
		}
	}
	if target == nil {
		shared.RespondError(c, shared.NewNotFound("Demo user not found for role."))
		return
	}
	h.issueSessionResponse(c, http.StatusOK, target)
}

// Refresh godoc
// @Summary Rotate refresh token and issue a new short-lived access token
// @Tags Authentication
// @Accept json
// @Produce json
// @Param body body RefreshRequest false "Refresh token (or sent via HttpOnly cookie)"
// @Success 200 {object} map[string]any
// @Failure 401 {object} shared.AppError
// @Router /auth/refresh [post]
func (h *Handler) Refresh(c *gin.Context) {
	var req RefreshRequest
	_ = c.ShouldBindJSON(&req)
	rawToken := strings.TrimSpace(req.RefreshToken)
	if rawToken == "" {
		if cookie, err := c.Cookie("le_refresh_token"); err == nil {
			rawToken = cookie
		}
	}
	if rawToken == "" {
		shared.RespondError(c, shared.NewUnauthorized("Refresh token required."))
		return
	}

	hash := auth.HashRefreshToken(rawToken)
	var user *sqlcgen.User
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		sess, ok := h.store.RefreshSessions[hash]
		if !ok || sess.RevokedAt != nil || time.Now().UTC().After(sess.ExpiresAt) {
			return shared.NewUnauthorized("Refresh session is invalid or expired.")
		}
		now := time.Now().UTC()
		sess.RevokedAt = &now

		u, exists := h.store.Users[sess.UserID]
		if !exists || !u.IsActive {
			return shared.NewUnauthorized("User account is no longer active.")
		}
		user = u
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}

	h.issueSessionResponse(c, http.StatusOK, user)
}

// Logout godoc
// @Summary Revoke current refresh session and clear authentication cookies
// @Tags Authentication
// @Produce json
// @Success 200 {object} map[string]any
// @Router /auth/logout [post]
func (h *Handler) Logout(c *gin.Context) {
	if cookie, err := c.Cookie("le_refresh_token"); err == nil && cookie != "" {
		hash := auth.HashRefreshToken(cookie)
		_ = h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
			if sess, ok := h.store.RefreshSessions[hash]; ok {
				now := time.Now().UTC()
				sess.RevokedAt = &now
			}
			return nil
		})
	}
	c.SetCookie("le_access_token", "", -1, "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
	c.SetCookie("le_refresh_token", "", -1, "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
	c.JSON(http.StatusOK, gin.H{"status": "logged_out"})
}

// Me godoc
// @Summary Return currently authenticated user profile summary
// @Tags Authentication
// @Produce json
// @Security BearerAuth
// @Success 200 {object} sqlcgen.User
// @Failure 401 {object} shared.AppError
// @Router /auth/me [get]
func (h *Handler) Me(c *gin.Context) {
	claims := middleware.GetClaims(c)
	u, ok := h.store.Users[claims.UserID]
	if !ok {
		shared.RespondError(c, shared.NewNotFound("Account not found."))
		return
	}
	c.JSON(http.StatusOK, u)
}

// UpdateMe godoc
// @Summary Update authenticated user's account name, email, or representative
// @Tags Authentication
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} sqlcgen.User
// @Router /auth/me [patch]
func (h *Handler) UpdateMe(c *gin.Context) {
	claims := middleware.GetClaims(c)
	var patch struct {
		Name           *string `json:"name"`
		Email          *string `json:"email"`
		Representative *string `json:"representative"`
	}
	if err := c.ShouldBindJSON(&patch); err != nil {
		shared.RespondError(c, shared.NewBadRequest(err.Error()))
		return
	}

	var updated *sqlcgen.User
	err := h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		u, ok := h.store.Users[claims.UserID]
		if !ok {
			return shared.NewNotFound("Account not found.")
		}
		if patch.Email != nil {
			if err := shared.ValidateEmail(*patch.Email); err != nil {
				return err
			}
			email := shared.SanitizeEmail(*patch.Email)
			for _, other := range h.store.Users {
				if other.ExternalID != u.ExternalID && strings.EqualFold(other.Email, email) {
					return shared.NewConflict("That email is already in use.")
				}
			}
			u.Email = email
		}
		if patch.Name != nil && strings.TrimSpace(*patch.Name) != "" {
			cleanName, err := shared.ValidateSafeField("Name", *patch.Name, 2, 120)
			if err != nil {
				return err
			}
			u.Name = cleanName
		}
		if patch.Representative != nil {
			cleanRep, err := shared.ValidateSafeField("Representative name", *patch.Representative, 0, 120)
			if err != nil {
				return err
			}
			u.Representative = cleanRep
		}
		u.UpdatedAt = time.Now().UTC()
		updated = u
		return nil
	})
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	c.JSON(http.StatusOK, updated)
}

func (h *Handler) issueSessionResponse(c *gin.Context, status int, u *sqlcgen.User) {
	accessToken, accessExp, err := h.tm.IssueAccessToken(u.ExternalID, u.Role, u.ProfileID, u.Email, u.Name)
	if err != nil {
		shared.RespondError(c, err)
		return
	}
	rawRefresh, refreshHash, refreshExp, err := h.tm.GenerateRefreshToken()
	if err != nil {
		shared.RespondError(c, err)
		return
	}

	_ = h.store.WithTx(c.Request.Context(), func(_ pgx.Tx) error {
		h.store.RefreshSessions[refreshHash] = &sqlcgen.RefreshSession{
			ID:        uuid.New(),
			UserID:    u.ExternalID,
			TokenHash: refreshHash,
			UserAgent: c.Request.UserAgent(),
			IPAddress: c.ClientIP(),
			ExpiresAt: refreshExp,
			CreatedAt: time.Now().UTC(),
		}
		return nil
	})

	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie("le_access_token", accessToken, int(h.cfg.JWTAccessTTL.Seconds()), "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)
	c.SetCookie("le_refresh_token", rawRefresh, int(h.cfg.RefreshSessionTTL.Seconds()), "/", h.cfg.CookieDomain, h.cfg.CookieSecure, true)

	c.JSON(status, gin.H{
		"user":         u,
		"accessToken":  accessToken,
		"refreshToken": rawRefresh,
		"expiresAt":    accessExp,
	})
}
