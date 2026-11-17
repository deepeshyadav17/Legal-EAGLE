import { containsInjection, sanitizeString } from './security';

/** Reusable form validation rules. Each returns an error string or ''. */
export const rules = {
  required: (label = 'This field') => (v) =>
    (Array.isArray(v) ? v.length : String(v ?? '').trim()) ? '' : `${label} is required.`,

  safeText: (label = 'This field') => (v) =>
    typeof v === 'string' && containsInjection(v)
      ? `${label} contains disallowed HTML or script characters.`
      : '',

  email: () => (v) => {
    if (!v) return '';
    if (containsInjection(v)) return 'Email contains invalid characters.';
    const clean = sanitizeString(v, { maxLength: 254 });
    return clean.length <= 254 && /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)
      ? ''
      : 'Enter a valid email address.';
  },

  password: () => (v) => {
    if (!v) return '';
    if (v.length < 8) return 'Password must be at least 8 characters long.';
    if (v.length > 72) return 'Password must be at most 72 characters.';
    if (!/[A-Za-z]/.test(v) || !/\d/.test(v)) {
      return 'Use at least 8 characters with both letters and numbers.';
    }
    return '';
  },

  minLength: (n, label = 'This field') => (v) =>
    !v || sanitizeString(String(v)).length >= n ? '' : `${label} must be at least ${n} characters.`,

  maxLength: (n, label = 'This field') => (v) =>
    !v || String(v).length <= n ? '' : `${label} must be at most ${n} characters.`,

  phone: () => (v) => {
    if (!v) return '';
    if (containsInjection(v)) return 'Enter a valid phone number.';
    const trimmed = String(v).trim();
    return /^\+?[\d\s-]{10,15}$/.test(trimmed) ? '' : 'Enter a valid phone number (10–15 digits).';
  },

  matches: (field, message) => (v, values) => (v === values[field] ? '' : message),

  year: (label = 'Year') => (v) => {
    if (v === '' || v === undefined) return '';
    const n = Number(v);
    return Number.isInteger(n) && n >= 1950 && n <= 2035 ? '' : `${label} must be a valid year.`;
  },

  range: (min, max, label) => (v) => {
    if (v === '' || v === undefined) return '';
    const n = Number(v);
    return n >= min && n <= max ? '' : `${label} must be between ${min} and ${max}.`;
  },

  notBefore: (field, message) => (v, values) =>
    !v || !values[field] || String(v) >= String(values[field]) ? '' : message,
};

/** Runs a schema of { field: [rule, ...] } and returns { field: error }. */
export function validate(schema, values) {
  const errors = {};
  Object.entries(schema).forEach(([field, fieldRules]) => {
    const val = values[field];
    // Global XSS/script guard on all non-password string inputs
    if (field !== 'password' && field !== 'confirmPassword' && typeof val === 'string' && containsInjection(val)) {
      errors[field] = 'Input contains disallowed HTML or script tags.';
      return;
    }
    for (const rule of fieldRules) {
      const msg = rule(val, values);
      if (msg) {
        errors[field] = msg;
        break;
      }
    }
  });
  return errors;
}
