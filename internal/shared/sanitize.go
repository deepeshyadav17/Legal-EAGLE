package shared

import (
	"fmt"
	"html"
	"regexp"
	"strings"
	"unicode"
)

var (
	scriptTagRegex = regexp.MustCompile(`(?is)<script.*?>.*?</script>`)
	htmlTagRegex   = regexp.MustCompile(`<[^>]*>`)
	eventAttrRegex = regexp.MustCompile(`(?i)\bon[a-z]+\s*=`)
	jsProtoRegex   = regexp.MustCompile(`(?i)(javascript|vbscript|data\s*:[^,]*text/html)\s*:`)
	emailRegex     = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
	phoneRegex     = regexp.MustCompile(`^\+?[0-9\s\-]{10,15}$`)
)

// SanitizeText removes script blocks, HTML tags, dangerous URI protocols,
// null bytes, and non-printable control characters, and caps string length.
func SanitizeText(input string, maxLen int) string {
	s := strings.TrimSpace(input)
	if s == "" {
		return ""
	}
	// Strip null bytes and control characters (preserve newline and tab)
	s = strings.Map(func(r rune) rune {
		if r == 0 || (unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t') {
			return -1
		}
		return r
	}, s)

	// Unescape HTML entities once to catch encoded tags, then strip tags & scripts
	s = html.UnescapeString(s)
	s = scriptTagRegex.ReplaceAllString(s, "")
	s = htmlTagRegex.ReplaceAllString(s, "")
	s = eventAttrRegex.ReplaceAllString(s, "")
	s = jsProtoRegex.ReplaceAllString(s, "")
	s = strings.TrimSpace(s)

	if maxLen > 0 && len(s) > maxLen {
		s = s[:maxLen]
	}
	return s
}

// SanitizeEmail normalizes and sanitizes an email address.
func SanitizeEmail(email string) string {
	s := SanitizeText(email, 254)
	return strings.ToLower(strings.TrimSpace(s))
}

// ContainsInjectionPattern detects raw XSS or script injection payloads before sanitization.
func ContainsInjectionPattern(input string) bool {
	lower := strings.ToLower(input)
	if scriptTagRegex.MatchString(input) || htmlTagRegex.MatchString(input) || eventAttrRegex.MatchString(input) || jsProtoRegex.MatchString(input) {
		return true
	}
	dangerousTokens := []string{"<script", "javascript:", "onerror=", "onload=", "onclick=", "alert(", "document.cookie", "eval("}
	for _, tok := range dangerousTokens {
		if strings.Contains(lower, tok) {
			return true
		}
	}
	return false
}

// ValidateEmail checks RFC-compliant email structure and length.
func ValidateEmail(email string) error {
	clean := SanitizeEmail(email)
	if clean == "" {
		return NewBadRequest("Email address is required.")
	}
	if len(clean) > 254 || !emailRegex.MatchString(clean) || ContainsInjectionPattern(email) {
		return NewBadRequest("Enter a valid email address.")
	}
	return nil
}

// ValidatePasswordStrength enforces strong password requirements for registration.
func ValidatePasswordStrength(password string) error {
	if len(password) < 8 {
		return NewBadRequest("Password must be at least 8 characters long.")
	}
	if len(password) > 72 {
		return NewBadRequest("Password must not exceed 72 characters.")
	}
	var hasLetter, hasDigit bool
	for _, r := range password {
		if unicode.IsLetter(r) {
			hasLetter = true
		}
		if unicode.IsDigit(r) {
			hasDigit = true
		}
	}
	if !hasLetter || !hasDigit {
		return NewBadRequest("Password must contain both letters and numbers.")
	}
	return nil
}

// ValidatePhone validates a 10-15 digit phone number.
func ValidatePhone(phone string) error {
	clean := SanitizeText(phone, 20)
	if clean == "" {
		return NewBadRequest("Phone number is required.")
	}
	if !phoneRegex.MatchString(clean) {
		return NewBadRequest("Enter a valid phone number (10–15 digits).")
	}
	return nil
}

// ValidateSafeField validates a text field for presence, length bounds, and injection safety.
func ValidateSafeField(label, raw string, minLen, maxLen int) (string, error) {
	if ContainsInjectionPattern(raw) {
		return "", NewBadRequest(fmt.Sprintf("%s contains disallowed HTML or script characters.", label))
	}
	clean := SanitizeText(raw, maxLen)
	if minLen > 0 && len([]rune(clean)) < minLen {
		return "", NewBadRequest(fmt.Sprintf("%s must be at least %d characters.", label, minLen))
	}
	if maxLen > 0 && len([]rune(clean)) > maxLen {
		return "", NewBadRequest(fmt.Sprintf("%s must be at most %d characters.", label, maxLen))
	}
	return clean, nil
}

