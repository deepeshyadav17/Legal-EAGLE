package config

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all runtime configuration loaded from environment variables.
type Config struct {
	AppEnv                string
	Port                  string
	CORSAllowedOrigins    []string
	Timezone              string
	DatabaseURL           string
	DBMaxConns            int32
	DBMinConns            int32
	AutoMigrate           bool
	AutoSeed              bool
	JWTAccessSecret       string
	JWTAccessTTL          time.Duration
	RefreshSessionTTL     time.Duration
	CookieSecure          bool
	CookieDomain          string
	RateLimitRPS          float64
	RateLimitBurst        int
	BookingHoldDuration   time.Duration
	LawyerResponseWindow  time.Duration
	ClientResponseWindow  time.Duration
	PaymentProvider       string
	RazorpayKeyID         string
	RazorpayKeySecret     string
	RazorpayWebhookSecret string
	EmbedWorker           bool
	WorkerPollInterval    time.Duration
}

// Load reads configuration from .env (if present) and environment variables with safe development defaults.
func Load() *Config {
	loadDotEnv(".env")

	originsRaw := getEnv("CORS_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
	var origins []string
	for _, o := range strings.Split(originsRaw, ",") {
		if trimmed := strings.TrimSpace(o); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}

	return &Config{
		AppEnv:                getEnv("APP_ENV", "development"),
		Port:                  getEnv("PORT", "8080"),
		CORSAllowedOrigins:    origins,
		Timezone:              getEnv("TIMEZONE", "Asia/Kolkata"),
		DatabaseURL:           getEnv("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/legaleagle?sslmode=disable"),
		DBMaxConns:            int32(getEnvInt("DB_MAX_CONNS", 20)),
		DBMinConns:            int32(getEnvInt("DB_MIN_CONNS", 2)),
		AutoMigrate:           getEnvBool("AUTO_MIGRATE", true),
		AutoSeed:              getEnvBool("AUTO_SEED", true),
		JWTAccessSecret:       getEnv("JWT_ACCESS_SECRET", "dev-only-legal-eagle-secret-key-change-in-prod-32b"),
		JWTAccessTTL:          time.Duration(getEnvInt("JWT_ACCESS_TTL_MINUTES", 15)) * time.Minute,
		RefreshSessionTTL:     time.Duration(getEnvInt("REFRESH_SESSION_TTL_DAYS", 7)) * 24 * time.Hour,
		CookieSecure:          getEnvBool("COOKIE_SECURE", false),
		CookieDomain:          getEnv("COOKIE_DOMAIN", "localhost"),
		RateLimitRPS:          float64(getEnvInt("RATE_LIMIT_RPS", 20)),
		RateLimitBurst:        getEnvInt("RATE_LIMIT_BURST", 40),
		BookingHoldDuration:   time.Duration(getEnvInt("BOOKING_HOLD_MINUTES", 10)) * time.Minute,
		LawyerResponseWindow:  time.Duration(getEnvInt("LAWYER_RESPONSE_HOURS", 12)) * time.Hour,
		ClientResponseWindow:  time.Duration(getEnvInt("CLIENT_RESCHEDULE_HOURS", 12)) * time.Hour,
		PaymentProvider:       strings.ToUpper(getEnv("PAYMENT_PROVIDER", "MOCK")),
		RazorpayKeyID:         getEnv("RAZORPAY_KEY_ID", ""),
		RazorpayKeySecret:     getEnv("RAZORPAY_KEY_SECRET", ""),
		RazorpayWebhookSecret: getEnv("RAZORPAY_WEBHOOK_SECRET", "dev-razorpay-webhook-secret"),
		EmbedWorker:           getEnvBool("EMBED_WORKER", true),
		WorkerPollInterval:    time.Duration(getEnvInt("WORKER_POLL_INTERVAL_SECONDS", 5)) * time.Second,
	}
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		if b, err := strconv.ParseBool(v); err == nil {
			return b
		}
	}
	return fallback
}

func loadDotEnv(filename string) {
	f, err := os.Open(filename)
	if err != nil {
		return
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		k := strings.TrimSpace(parts[0])
		v := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if k == "DATABASE_URL" {
			v = sanitizeDatabaseURL(v)
		}
		if k != "" {
			_ = os.Setenv(k, v)
		}
	}
}

func sanitizeDatabaseURL(raw string) string {
	// If password contains an unescaped '@', e.g. postgres://user:pass@123@localhost:5432/db,
	// encode all '@' except the last one before host:port.
	schemeEnd := strings.Index(raw, "://")
	if schemeEnd == -1 {
		return raw
	}
	rest := raw[schemeEnd+3:]
	slashIdx := strings.Index(rest, "/")
	authority := rest
	pathPart := ""
	if slashIdx != -1 {
		authority = rest[:slashIdx]
		pathPart = rest[slashIdx:]
	}
	if strings.Count(authority, "@") > 1 {
		lastAt := strings.LastIndex(authority, "@")
		userInfo := strings.ReplaceAll(authority[:lastAt], "@", "%40")
		hostPart := authority[lastAt:]
		return raw[:schemeEnd+3] + userInfo + hostPart + pathPart
	}
	return raw
}


