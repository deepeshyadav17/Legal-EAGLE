package middleware

import (
	"fmt"
	"math"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/legaleagle/backend/internal/platform/auth"
	"github.com/legaleagle/backend/internal/shared"
	"golang.org/x/time/rate"
)

const ContextClaimsKey = "auth_claims"

// SecurityHeadersMiddleware attaches defensive HTTP security headers to every response.
func SecurityHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("X-XSS-Protection", "1; mode=block")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=(self)")
		c.Header("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' http://localhost:* http://127.0.0.1:*;")
		c.Next()
	}
}

// CORSMiddleware enforces an explicit origin allowlist and supports credentials.
func CORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origin != "" && (allowed[origin] || allowed["*"]) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization, X-Idempotency-Key, X-CSRF-Token")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
			c.Header("Vary", "Origin")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

type visitor struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

// InProcessRateLimiter enforces per-IP token-bucket rate limiting without Redis.
func InProcessRateLimiter(rps float64, burst int) gin.HandlerFunc {
	return StrictEndpointRateLimiter("global", rps, burst)
}

// StrictEndpointRateLimiter enforces scoped per-IP token-bucket rate limiting (e.g. stricter limits on /auth/* and /payments/*).
func StrictEndpointRateLimiter(scope string, rps float64, burst int) gin.HandlerFunc {
	var mu sync.Mutex
	visitors := make(map[string]*visitor)

	// Cleanup stale entries periodically
	go func() {
		for {
			time.Sleep(3 * time.Minute)
			mu.Lock()
			for key, v := range visitors {
				if time.Since(v.lastSeen) > 5*time.Minute {
					delete(visitors, key)
				}
			}
			mu.Unlock()
		}
	}()

	return func(c *gin.Context) {
		key := fmt.Sprintf("%s:%s", scope, c.ClientIP())
		mu.Lock()
		v, exists := visitors[key]
		if !exists {
			v = &visitor{limiter: rate.NewLimiter(rate.Limit(rps), burst)}
			visitors[key] = v
		}
		v.lastSeen = time.Now()
		allow := v.limiter.Allow()
		tokensLeft := int(math.Max(0, math.Floor(v.limiter.Tokens())))
		mu.Unlock()

		c.Header("X-RateLimit-Scope", scope)
		c.Header("X-RateLimit-Limit", strconv.Itoa(burst))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(tokensLeft))

		if !allow {
			retryAfterSec := int(math.Ceil(1.0 / math.Max(rps, 0.1)))
			c.Header("Retry-After", strconv.Itoa(retryAfterSec))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":      "RATE_LIMITED",
				"message":    "Too many requests. Please wait a moment and try again.",
				"status":     http.StatusTooManyRequests,
				"retryAfter": retryAfterSec,
			})
			return
		}
		c.Next()
	}
}

// MaxBodySize limits request payloads to prevent memory exhaustion.
func MaxBodySize(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

func extractBearerOrCookie(c *gin.Context) string {
	authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
	if strings.HasPrefix(strings.ToLower(authHeader), "bearer ") {
		return strings.TrimSpace(authHeader[7:])
	}
	if cookie, err := c.Cookie("le_access_token"); err == nil && cookie != "" {
		return cookie
	}
	return ""
}

// AuthRequired validates the JWT access token from Authorization header or HttpOnly cookie.
func AuthRequired(tm *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractBearerOrCookie(c)
		if tokenStr == "" {
			shared.RespondError(c, shared.NewUnauthorized("Authentication required."))
			c.Abort()
			return
		}
		claims, err := tm.VerifyAccessToken(tokenStr)
		if err != nil {
			shared.RespondError(c, shared.NewUnauthorized("Invalid or expired access token."))
			c.Abort()
			return
		}
		c.Set(ContextClaimsKey, claims)
		c.Next()
	}
}

// OptionalAuth attaches claims if a valid token is present without blocking anonymous requests.
func OptionalAuth(tm *auth.TokenManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenStr := extractBearerOrCookie(c)
		if tokenStr != "" {
			if claims, err := tm.VerifyAccessToken(tokenStr); err == nil {
				c.Set(ContextClaimsKey, claims)
			}
		}
		c.Next()
	}
}

// GetClaims retrieves the authenticated user's Claims from the Gin context.
func GetClaims(c *gin.Context) *auth.Claims {
	val, exists := c.Get(ContextClaimsKey)
	if !exists {
		return nil
	}
	claims, _ := val.(*auth.Claims)
	return claims
}

// RequireRoles enforces backend RBAC across canonical or frontend roles.
func RequireRoles(allowedRoles ...string) gin.HandlerFunc {
	allowed := make(map[string]bool, len(allowedRoles)*2)
	for _, r := range allowedRoles {
		bRole, fRole, err := auth.NormalizeRole(r)
		if err == nil {
			allowed[bRole] = true
			allowed[fRole] = true
		} else {
			allowed[strings.ToUpper(r)] = true
		}
	}
	return func(c *gin.Context) {
		claims := GetClaims(c)
		if claims == nil {
			shared.RespondError(c, shared.NewUnauthorized("Authentication required."))
			c.Abort()
			return
		}
		if !allowed[claims.Role] && !allowed[claims.FrontendRole] {
			shared.RespondError(c, shared.NewForbidden("You do not have permission to perform this action."))
			c.Abort()
			return
		}
		c.Next()
	}
}

