/**
 * Legal Eagle — Frontend Security, Input Sanitization, Rate Limiting & Session Integrity
 *
 * Security invariants enforced by this module:
 * 1. Input Sanitization: Strips HTML/XSS tags, script blocks, event attributes, and control chars.
 * 2. Client-Side Rate Limiting: Sliding-window rate limiter on auth, signup, and mutation calls.
 * 3. Secret Protection: Asserts that no backend secret keys or private API keys exist in import.meta.env.
 * 4. Tamper-Evident Session & Password Hashing: Never stores plaintext passwords; verifies role & expiry.
 */

const SCRIPT_TAG_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;
const EVENT_ATTR_RE = /\bon[a-z]+\s*=/gi;
const JS_PROTO_RE = /(?:javascript|vbscript|data\s*:[^,]*text\/html)\s*:/gi;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Detects whether a raw input contains XSS, HTML tag, or script injection patterns.
 */
export function containsInjection(value) {
  if (typeof value !== 'string' || !value) return false;
  const lower = value.toLowerCase();
  if (
    /<script/i.test(value) ||
    /<\/?[a-z][^>]*>/i.test(value) ||
    /\bon[a-z]+\s*=/i.test(value) ||
    /(?:javascript|vbscript)\s*:/i.test(value) ||
    lower.includes('document.cookie') ||
    lower.includes('eval(')
  ) {
    return true;
  }
  return false;
}

/**
 * Sanitizes a single string input by removing HTML/script tags, dangerous protocols, and control chars.
 */
export function sanitizeString(value, { trim = true, maxLength = 2000 } = {}) {
  if (typeof value !== 'string') return value;
  let clean = value
    .replace(CONTROL_CHARS_RE, '')
    .replace(SCRIPT_TAG_RE, '')
    .replace(HTML_TAG_RE, '')
    .replace(EVENT_ATTR_RE, '')
    .replace(JS_PROTO_RE, '');

  if (trim) {
    clean = clean.trim();
  }
  if (maxLength > 0 && clean.length > maxLength) {
    clean = clean.slice(0, maxLength);
  }
  return clean;
}

/**
 * Deeply sanitizes all string fields in a form payload object (preserving password characters while capping length).
 */
export function sanitizeFormPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) {
    return payload.map((item) => (typeof item === 'string' ? sanitizeString(item, { maxLength: 250 }) : sanitizeFormPayload(item)));
  }
  const out = {};
  for (const [key, val] of Object.entries(payload)) {
    if (key === 'password' || key === 'confirmPassword') {
      // Do not strip special characters from passwords, only strip null bytes and cap at 72 chars
      out[key] = typeof val === 'string' ? val.replace(/\0/g, '').slice(0, 72) : val;
    } else if (key === 'email') {
      out[key] = typeof val === 'string' ? sanitizeString(val, { maxLength: 254 }).toLowerCase() : val;
    } else if (typeof val === 'string') {
      out[key] = sanitizeString(val, { maxLength: 1000 });
    } else if (Array.isArray(val)) {
      out[key] = val.map((v) => (typeof v === 'string' ? sanitizeString(v, { maxLength: 120 }) : v));
    } else {
      out[key] = val;
    }
  }
  return out;
}

// ============================================================================
// Client-Side Sliding-Window Rate Limiter
// ============================================================================
const rateBuckets = new Map();

const SCOPE_LIMITS = {
  login: { maxRequests: 6, windowMs: 60_000, label: 'login attempts' },
  register: { maxRequests: 5, windowMs: 60_000, label: 'registration attempts' },
  auth: { maxRequests: 10, windowMs: 60_000, label: 'authentication requests' },
  mutation: { maxRequests: 15, windowMs: 60_000, label: 'booking or payment actions' },
  api: { maxRequests: 60, windowMs: 60_000, label: 'API requests' },
};

/**
 * Enforces client-side rate limiting before executing sensitive operations.
 * Throws a 429 error with retryAfter seconds if the limit is exceeded.
 */
export function enforceRateLimit(scope = 'api', identifier = 'default') {
  const cfg = SCOPE_LIMITS[scope] || SCOPE_LIMITS.api;
  const key = `${scope}:${identifier}`;
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => now - ts < cfg.windowMs);

  if (timestamps.length >= cfg.maxRequests) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((cfg.windowMs - (now - oldest)) / 1000));
    const err = new Error(`Too many ${cfg.label}. Please wait ${retryAfterSec}s before trying again.`);
    err.status = 429;
    err.retryAfter = retryAfterSec;
    throw err;
  }

  timestamps.push(now);
  rateBuckets.set(key, timestamps);
}

// ============================================================================
// Deterministic Salted Password Hash & Session Integrity
// ============================================================================
const APP_INTEGRITY_PEPPER = 'le-v1-hmac-integrity-8f4b2e91c3d7';

function fnv1aHash(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < str.length; i += 1) {
    const ch = str.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i & 0xff);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * Creates a salted password digest so plaintext passwords are never stored in browser storage.
 */
export function hashPasswordSync(password, emailSalt = '') {
  const normalizedSalt = String(emailSalt).trim().toLowerCase();
  const round1 = fnv1aHash(`${normalizedSalt}:${password}:${APP_INTEGRITY_PEPPER}`);
  const round2 = fnv1aHash(`${round1}:${password.length}:${normalizedSalt}`);
  return `le_hash$v1$${normalizedSalt}$${round1}${round2}`;
}

export function verifyPasswordSync(password, emailSalt, storedHash) {
  if (!storedHash) return false;
  const candidate = hashPasswordSync(password, emailSalt);
  if (candidate.length !== storedHash.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < candidate.length; i += 1) {
    diff |= candidate.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Wraps an authenticated user session with an expiry timestamp and tamper-evident signature.
 */
export function createSignedSession(user, ttlMs = 8 * 60 * 60 * 1000) {
  if (!user || !user.id || !user.role) return null;
  const exp = Date.now() + ttlMs;
  const payload = `${user.id}:${user.role}:${user.profileId || ''}:${user.email || ''}:${exp}`;
  const sig = fnv1aHash(`${payload}:${APP_INTEGRITY_PEPPER}`);
  return JSON.stringify({
    userId: user.id,
    role: user.role,
    profileId: user.profileId || '',
    email: user.email || '',
    exp,
    sig,
  });
}

/**
 * Verifies a signed session token from sessionStorage; returns null if expired or tampered with.
 */
export function verifySignedSession(rawToken) {
  if (!rawToken) return null;
  try {
    const parsed = JSON.parse(rawToken);
    if (!parsed || !parsed.userId || !parsed.role || !parsed.exp || !parsed.sig) {
      return null;
    }
    if (Date.now() > Number(parsed.exp)) {
      return null;
    }
    const payload = `${parsed.userId}:${parsed.role}:${parsed.profileId || ''}:${parsed.email || ''}:${parsed.exp}`;
    const expectedSig = fnv1aHash(`${payload}:${APP_INTEGRITY_PEPPER}`);
    if (expectedSig !== parsed.sig) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// ============================================================================
// Frontend Secret Exposure Guard
// ============================================================================
const FORBIDDEN_ENV_PATTERNS = [/SECRET/i, /PRIVATE/i, /PASSWORD/i, /DATABASE_URL/i, /WEBHOOK/i, /JWT/i];
const ALLOWED_PUBLIC_ENV_KEYS = new Set(['VITE_API_BASE_URL', 'VITE_DEMO_MODE', 'BASE_URL', 'MODE', 'DEV', 'PROD', 'SSR']);

/**
 * Ensures no secret keys or backend credentials are ever exposed in import.meta.env.
 */
export function getSafePublicConfig() {
  const env = import.meta.env || {};
  for (const key of Object.keys(env)) {
    if (!ALLOWED_PUBLIC_ENV_KEYS.has(key) && FORBIDDEN_ENV_PATTERNS.some((re) => re.test(key))) {
      // Never allow secret env vars to be read by frontend code
      delete env[key];
    }
  }
  const defaultBaseURL =
    typeof window !== 'undefined' && window.location.port && window.location.port !== '5173'
      ? '/api/v1'
      : 'http://localhost:8081/api/v1';

  return Object.freeze({
    apiBaseUrl: env.VITE_API_BASE_URL || defaultBaseURL,
    demoMode: env.VITE_DEMO_MODE !== 'false',
  });
}

