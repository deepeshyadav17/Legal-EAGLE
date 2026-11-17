package logger

import (
	"log/slog"
	"os"
	"strings"
)

var sensitiveKeys = []string{"password", "secret", "token", "authorization", "cookie", "signature"}

// New creates a structured JSON or text logger with automatic secret redaction.
func New(env string) *slog.Logger {
	opts := &slog.HandlerOptions{
		Level: slog.LevelInfo,
		ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
			lowerKey := strings.ToLower(a.Key)
			for _, s := range sensitiveKeys {
				if strings.Contains(lowerKey, s) {
					return slog.String(a.Key, "[REDACTED]")
				}
			}
			return a
		},
	}

	var handler slog.Handler
	if strings.EqualFold(env, "production") {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}

