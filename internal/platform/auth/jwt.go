package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the authenticated JWT access token payload.
type Claims struct {
	UserID      string `json:"userId"`
	Role        string `json:"role"`        // Canonical backend role: CLIENT, LAWYER, FIRM_ADMIN, PLATFORM_ADMIN
	FrontendRole string `json:"frontendRole"` // React role: client, lawyer, firm
	ProfileID   string `json:"profileId"`
	Email       string `json:"email"`
	Name        string `json:"name"`
	jwt.RegisteredClaims
}

// NormalizeRole maps frontend or backend role strings to canonical pairs.
func NormalizeRole(input string) (backendRole string, frontendRole string, err error) {
	switch strings.ToUpper(strings.TrimSpace(input)) {
	case "CLIENT":
		return "CLIENT", "client", nil
	case "LAWYER":
		return "LAWYER", "lawyer", nil
	case "FIRM", "FIRM_ADMIN":
		return "FIRM_ADMIN", "firm", nil
	case "PLATFORM_ADMIN", "ADMIN":
		return "PLATFORM_ADMIN", "admin", nil
	default:
		return "", "", fmt.Errorf("unsupported role: %s", input)
	}
}

// TokenManager issues and verifies short-lived JWT access tokens and opaque refresh tokens.
type TokenManager struct {
	secret     []byte
	accessTTL  time.Duration
	refreshTTL time.Duration
}

func NewTokenManager(secret string, accessTTL, refreshTTL time.Duration) *TokenManager {
	return &TokenManager{
		secret:     []byte(secret),
		accessTTL:  accessTTL,
		refreshTTL: refreshTTL,
	}
}

func (tm *TokenManager) IssueAccessToken(userID, role, profileID, email, name string) (string, time.Time, error) {
	bRole, fRole, err := NormalizeRole(role)
	if err != nil {
		return "", time.Time{}, err
	}
	now := time.Now().UTC()
	exp := now.Add(tm.accessTTL)
	claims := Claims{
		UserID:       userID,
		Role:         bRole,
		FrontendRole: fRole,
		ProfileID:    profileID,
		Email:        email,
		Name:         name,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   userID,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			Issuer:    "legal-eagle-api",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(tm.secret)
	if err != nil {
		return "", time.Time{}, err
	}
	return signed, exp, nil
}

func (tm *TokenManager) VerifyAccessToken(tokenStr string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return tm.secret, nil
	})
	if err != nil {
		return nil, err
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, errors.New("invalid access token claims")
	}
	return claims, nil
}

// GenerateRefreshToken creates a cryptographically random opaque token and its SHA-256 database hash.
func (tm *TokenManager) GenerateRefreshToken() (rawToken string, tokenHash string, expiresAt time.Time, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", time.Time{}, err
	}
	rawToken = base64.RawURLEncoding.EncodeToString(buf)
	tokenHash = HashRefreshToken(rawToken)
	expiresAt = time.Now().UTC().Add(tm.refreshTTL)
	return rawToken, tokenHash, expiresAt, nil
}

func HashRefreshToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

