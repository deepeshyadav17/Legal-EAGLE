import { getDb, commit, delay, clone, uid, ServiceError } from './mockDb';
import { lawyerPublic, lawyerSummary } from './selectors';

/**
 * Lawyer profile service (mock).
 * Future endpoints:
 *  GET    /api/lawyers/:id
 *  GET    /api/lawyers/:id/contact        (server enforces visibility)
 *  PATCH  /api/lawyers/:id
 *  POST   /api/lawyers/:id/:section
 *  PUT    /api/lawyers/:id/:section/:recordId
 *  DELETE /api/lawyers/:id/:section/:recordId
 */
export const RECORD_SECTIONS = ['education', 'experience', 'qualifications', 'achievements'];

function findLawyer(id) {
  const lawyer = getDb().lawyers.find((l) => l.id === id);
  if (!lawyer) throw new ServiceError('Lawyer profile not found.', 404);
  return lawyer;
}

export async function getLawyer(id) {
  await delay();
  return lawyerPublic(getDb(), findLawyer(id));
}

/** Owner-only view including contact details (for the dashboard editor). */
export async function getOwnLawyerProfile(id) {
  await delay();
  const db = getDb();
  return { ...lawyerPublic(db, findLawyer(id)), contact: clone(findLawyer(id).contact) };
}

/**
 * Simulates the backend contact-visibility rule. In production this check
 * MUST happen on the server; the UI only mirrors the outcome.
 * Returns { status: 'visible' | 'login_required' | 'clients_only' | 'hidden', contact? }
 */
export async function getLawyerContact(id, viewer) {
  await delay(200);
  const lawyer = findLawyer(id);
  if (viewer?.role === 'lawyer' && viewer.profileId === id) {
    return { status: 'visible', owner: true, contact: clone(lawyer.contact), visibility: lawyer.contactVisibility };
  }
  if (!viewer) return { status: 'login_required' };
  if (viewer.role !== 'client') return { status: 'clients_only' };
  if (lawyer.contactVisibility !== 'clients') return { status: 'hidden' };
  return { status: 'visible', contact: clone(lawyer.contact) };
}

export async function listLawyers({ q = '' } = {}) {
  await delay(200);
  const db = getDb();
  const term = q.trim().toLowerCase();
  return db.lawyers
    .filter((l) => !term || l.name.toLowerCase().includes(term) || l.city.toLowerCase().includes(term))
    .map((l) => lawyerSummary(db, l));
}

export async function getLawyersByIds(ids) {
  await delay(200);
  const db = getDb();
  return ids.map((id) => db.lawyers.find((l) => l.id === id)).filter(Boolean).map((l) => lawyerSummary(db, l));
}

const EDITABLE = ['name', 'headline', 'city', 'experienceYears', 'practiceAreas', 'about', 'photo', 'languages', 'contactVisibility'];

export async function updateLawyer(id, patch) {
  await delay();
  const lawyer = findLawyer(id);
  EDITABLE.forEach((key) => {
    if (patch[key] !== undefined) lawyer[key] = clone(patch[key]);
  });
  if (patch.contact) lawyer.contact = { ...lawyer.contact, ...clone(patch.contact) };
  if (!lawyer.practiceAreas.length) throw new ServiceError('Select at least one practice area.');
  commit();
  return { ...lawyerPublic(getDb(), lawyer), contact: clone(lawyer.contact) };
}

function assertSection(section) {
  if (!RECORD_SECTIONS.includes(section)) throw new ServiceError('Unknown profile section.');
}

export async function addRecord(lawyerId, section, record) {
  await delay();
  assertSection(section);
  const lawyer = findLawyer(lawyerId);
  const created = { ...clone(record), id: uid(section.slice(0, 3)) };
  lawyer[section].unshift(created);
  commit();
  return created;
}

export async function updateRecord(lawyerId, section, recordId, record) {
  await delay();
  assertSection(section);
  const lawyer = findLawyer(lawyerId);
  const idx = lawyer[section].findIndex((r) => r.id === recordId);
  if (idx === -1) throw new ServiceError('Record not found.', 404);
  lawyer[section][idx] = { ...clone(record), id: recordId };
  commit();
  return lawyer[section][idx];
}

export async function deleteRecord(lawyerId, section, recordId) {
  await delay();
  assertSection(section);
  const lawyer = findLawyer(lawyerId);
  lawyer[section] = lawyer[section].filter((r) => r.id !== recordId);
  commit();
}
