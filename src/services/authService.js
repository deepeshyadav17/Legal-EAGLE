import { getDb, commit, delay, clone, uid, ServiceError } from './mockDb';
import { apiClient, DEMO_MODE, setAccessToken } from './apiClient';
import {
  containsInjection,
  createSignedSession,
  enforceRateLimit,
  hashPasswordSync,
  sanitizeFormPayload,
  sanitizeString,
  verifyPasswordSync,
  verifySignedSession,
} from '../utils/security';
import { rules } from '../utils/validators';

const SESSION_KEY = 'legal-eagle-auth-session';
const LEGACY_SESSION_KEY = 'legal-eagle-demo-session';

/** Strip sensitive fields (like passwordHash) before returning user objects to UI. */
const publicUser = (u) => {
  if (!u) return null;
  const copy = clone(u);
  delete copy.passwordHash;
  delete copy.password;
  return copy;
};

export function getSessionUser() {
  const rawSigned = sessionStorage.getItem(SESSION_KEY);
  if (rawSigned) {
    const verified = verifySignedSession(rawSigned);
    if (!verified) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    const found = getDb().users.find((u) => u.id === verified.userId);
    if (!found || found.role !== verified.role) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return publicUser(found);
  }

  // Upgrade legacy session if present
  const legacyId = sessionStorage.getItem(LEGACY_SESSION_KEY);
  if (legacyId) {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    const found = getDb().users.find((u) => u.id === legacyId);
    if (found) {
      sessionStorage.setItem(SESSION_KEY, createSignedSession(found));
      return publicUser(found);
    }
  }
  return null;
}

/**
 * Authorization helper: ensures a user is currently authenticated with a valid signed session.
 */
export function requireAuth() {
  const user = getSessionUser();
  if (!user) {
    throw new ServiceError('Authentication required. Please log in to continue.', 401);
  }
  return user;
}

/**
 * Authorization helper: enforces role-based access control (RBAC).
 */
export function requireRole(allowedRoles = []) {
  const user = requireAuth();
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  if (roles.length > 0 && !roles.includes(user.role)) {
    throw new ServiceError('You do not have permission to perform this action.', 403);
  }
  return user;
}

/**
 * Authorization helper: verifies that the authenticated user owns the target profile/resource.
 */
export function requireOwnership(ownerProfileId, allowedRoles = []) {
  const user = requireRole(allowedRoles);
  if (ownerProfileId && user.profileId !== ownerProfileId && user.id !== ownerProfileId) {
    throw new ServiceError('Forbidden: you can only modify your own resources.', 403);
  }
  return user;
}

export async function login(rawEmail, rawPassword) {
  const email = sanitizeString(String(rawEmail ?? ''), { maxLength: 254 }).toLowerCase();
  const password = String(rawPassword ?? '');

  enforceRateLimit('login', email || 'anonymous');
  await delay();

  if (!email || !password) {
    throw new ServiceError('Email and password are required.', 400);
  }
  const emailErr = rules.email()(email);
  if (emailErr) {
    throw new ServiceError(emailErr, 400);
  }
  if (password.length > 72) {
    throw new ServiceError('Invalid email or password.', 401);
  }

  const db = getDb();
  let user = db.users.find((u) => u.email.toLowerCase() === email);

  // If user is already known locally, verify their salted password hash first before hitting network
  if (user) {
    if (user.passwordHash) {
      if (!verifyPasswordSync(password, email, user.passwordHash)) {
        throw new ServiceError('Invalid email or password.', 401);
      }
    } else if (password.length < 6) {
      throw new ServiceError('Invalid email or password.', 401);
    }
  }

  // Authenticate against Go + PostgreSQL only in Live Mode.
  if (!DEMO_MODE) {
    try {
      const loginPayload = user
        ? {
            email,
            password,
            name: user.name,
            role: user.role,
            profileId: user.profileId,
            representative: user.representative || '',
          }
        : { email, password };
      const res = await apiClient.post('/auth/login', loginPayload);
      if (res?.data?.accessToken) {
        setAccessToken(res.data.accessToken);
      }
      const backendUser = res?.data?.user;
      if (backendUser && !user) {
        const normalizedRole = (backendUser.role || 'client').toLowerCase().replace('firm_admin', 'firm');
        user = {
          id: backendUser.id || uid('u'),
          role: normalizedRole,
          name: backendUser.name || email.split('@')[0],
          email: backendUser.email || email,
          profileId: backendUser.profileId || uid(normalizedRole[0]),
          passwordHash: hashPasswordSync(password, email),
          ...(backendUser.representative && { representative: backendUser.representative }),
        };
        db.users.push(user);
        if (normalizedRole === 'client' && !db.clients.some((c) => c.id === user.profileId)) {
          db.clients.push({ id: user.profileId, name: user.name, email, city: '', saved: { lawyers: [], firms: [] }, recent: [] });
        }
        commit();
      }
    } catch (err) {
      if (err.status === 429) throw new ServiceError(err.message, 429);
      throw new ServiceError(err.message || 'Unable to authenticate with the live service.', err.status || 503);
    }
  }

  if (!user) {
    throw new ServiceError('Invalid email or password.', 401);
  }

  sessionStorage.setItem(SESSION_KEY, createSignedSession(user));
  return publicUser(user);
}

export async function demoLogin(rawRole) {
  if (!DEMO_MODE) {
    throw new ServiceError('Demo sign-in is disabled when the live backend is enabled.', 403);
  }
  const role = sanitizeString(String(rawRole ?? ''), { maxLength: 32 }).toLowerCase();
  enforceRateLimit('auth', `demo:${role}`);
  await delay(200);

  if (!['client', 'lawyer', 'firm', 'admin'].includes(role)) {
    throw new ServiceError('Invalid demo role requested.', 400);
  }

  const user = getDb().users.find((u) => u.role === role);
  if (!user) throw new ServiceError('Demo account not available.', 404);
  sessionStorage.setItem(SESSION_KEY, createSignedSession(user));
  return publicUser(user);
}

export async function logout() {
  await delay(100);
  if (!DEMO_MODE) {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore offline error on logout
    }
  }
  setAccessToken(null);
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(LEGACY_SESSION_KEY);
}

export async function refreshSession() {
  if (DEMO_MODE) return getSessionUser();

  try {
    const { data } = await apiClient.post('/auth/refresh');
    setAccessToken(data.accessToken);
    const backendUser = data.user;
    if (!backendUser) return null;

    const normalizedRole = (backendUser.frontendRole || backendUser.role || 'client')
      .toString()
      .toLowerCase()
      .replace('firm_admin', 'firm')
      .replace('platform_admin', 'admin');
    const user = {
      id: backendUser.externalId || backendUser.id || backendUser.profileId,
      role: normalizedRole,
      name: backendUser.name || backendUser.email?.split('@')[0] || 'Account',
      email: backendUser.email,
      profileId: backendUser.profileId,
      ...(backendUser.representative && { representative: backendUser.representative }),
    };

    const db = getDb();
    const existingIndex = db.users.findIndex((u) => u.email?.toLowerCase() === user.email?.toLowerCase());
    if (existingIndex >= 0) db.users[existingIndex] = { ...db.users[existingIndex], ...user };
    else db.users.push(user);
    commit();
    sessionStorage.setItem(SESSION_KEY, createSignedSession(user));
    return publicUser(user);
  } catch {
    setAccessToken(null);
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export async function register(rawRole, rawData) {
  const role = sanitizeString(String(rawRole ?? ''), { maxLength: 32 }).toLowerCase();
  const data = sanitizeFormPayload(rawData || {});
  const email = (data.email || '').toLowerCase();

  enforceRateLimit('register', email || 'anonymous');
  await delay(400);

  if (!['client', 'lawyer', 'firm'].includes(role)) {
    throw new ServiceError('Invalid account role selected.', 400);
  }

  // Reject any field containing raw script/HTML injection
  for (const [key, val] of Object.entries(rawData || {})) {
    if (key !== 'password' && key !== 'confirmPassword' && typeof val === 'string' && containsInjection(val)) {
      throw new ServiceError(`Field "${key}" contains disallowed HTML or script tags.`, 400);
    }
  }

  const emailErr = rules.email()(email);
  if (emailErr) throw new ServiceError(emailErr, 400);

  const pwErr = rules.password()(data.password || '');
  if (pwErr) throw new ServiceError(pwErr, 400);

  const db = getDb();
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    throw new ServiceError('An account with this email already exists.', 409);
  }

  let profileId;
  let name = sanitizeString(data.name || '', { maxLength: 120 });

  if (role === 'client') {
    if (name.length < 2) throw new ServiceError('Full name must be at least 2 characters.', 400);
    profileId = uid('c');
    db.clients.push({ id: profileId, name, email, city: '', saved: { lawyers: [], firms: [] }, recent: [] });
  } else if (role === 'lawyer') {
    if (name.length < 2) throw new ServiceError('Full name must be at least 2 characters.', 400);
    const phoneErr = rules.phone()(data.phone || '');
    if (phoneErr) throw new ServiceError(phoneErr, 400);
    if (!data.city) throw new ServiceError('City is required.', 400);
    if (!data.practiceArea) throw new ServiceError('Primary practice area is required.', 400);

    profileId = uid('l');
    db.lawyers.push({
      id: profileId,
      name,
      headline: 'Advocate',
      city: data.city,
      experienceYears: 0,
      practiceAreas: [data.practiceArea],
      about: '',
      photo: '',
      languages: ['English'],
      education: [],
      experience: [],
      qualifications: [],
      achievements: [],
      contact: { email, phone: data.phone },
      contactVisibility: 'clients',
      joinedAt: new Date().toISOString().slice(0, 10),
    });
    db.consultationSettings = db.consultationSettings || [];
    db.consultationSettings.push({
      lawyerId: profileId,
      fee: 1500,
      currency: 'INR',
      availableModes: ['ONLINE', 'IN_PERSON'],
      bookingLeadTime: 2,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: { start: '10:00', end: '18:00' },
      blockedDates: [],
      officeLocation: `${data.city} Legal Chambers`,
    });
  } else if (role === 'firm') {
    profileId = uid('f');
    name = sanitizeString(data.firmName || '', { maxLength: 150 });
    const representative = sanitizeString(data.representative || '', { maxLength: 120 });
    if (name.length < 3) throw new ServiceError('Firm name must be at least 3 characters.', 400);
    if (!representative) throw new ServiceError('Representative name is required.', 400);
    if (!data.city) throw new ServiceError('City is required.', 400);
    if (!Array.isArray(data.practiceAreas) || data.practiceAreas.length === 0) {
      throw new ServiceError('At least one practice area is required.', 400);
    }

    db.firms.push({
      id: profileId,
      name,
      city: data.city,
      address: data.city,
      established: new Date().getFullYear(),
      practiceAreas: data.practiceAreas,
      about: '',
      email,
      phone: '',
      website: '',
      logo: '',
      cover: '',
    });
  }

  const passwordHash = hashPasswordSync(data.password, email);
  const user = {
    id: uid('u'),
    role,
    name,
    email,
    profileId,
    passwordHash,
    ...(role === 'firm' && { representative: sanitizeString(data.representative || '', { maxLength: 120 }) }),
  };
  db.users.push(user);
  commit();
  sessionStorage.setItem(SESSION_KEY, createSignedSession(user));

  // Sync registration with Go + PostgreSQL only in Live Mode.
  if (!DEMO_MODE) {
    try {
      const res = await apiClient.post('/auth/register', { role, ...data, password: rawData.password });
      if (res?.data?.accessToken) {
        setAccessToken(res.data.accessToken);
      }
    } catch (err) {
      if (err.status === 429) throw new ServiceError(err.message, 429);
    }
  }

  return publicUser(user);
}

export async function updateAccount(userId, rawPatch) {
  const activeUser = requireAuth();
  if (activeUser.id !== userId) {
    throw new ServiceError('Forbidden: you can only update your own account.', 403);
  }

  for (const [, val] of Object.entries(rawPatch || {})) {
    if (typeof val === 'string' && containsInjection(val)) {
      throw new ServiceError('Input contains disallowed HTML or script tags.', 400);
    }
  }

  const patch = sanitizeFormPayload(rawPatch || {});
  await delay();
  const db = getDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) throw new ServiceError('Account not found.', 404);

  if (patch.email) {
    const emailErr = rules.email()(patch.email);
    if (emailErr) throw new ServiceError(emailErr, 400);
    const email = patch.email.toLowerCase();
    if (db.users.some((u) => u.id !== userId && u.email.toLowerCase() === email)) {
      throw new ServiceError('That email is already in use.', 409);
    }
    user.email = email;
  }
  if (patch.name) {
    if (patch.name.length < 2) throw new ServiceError('Name must be at least 2 characters.', 400);
    user.name = patch.name;
  }
  if (patch.representative !== undefined) {
    user.representative = patch.representative;
  }
  commit();
  sessionStorage.setItem(SESSION_KEY, createSignedSession(user));
  return publicUser(user);
}
