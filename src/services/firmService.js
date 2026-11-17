import { getDb, commit, delay, clone, ServiceError } from './mockDb';
import { activeMemberIds, firmSummary, lawyerSummary } from './selectors';

/**
 * Firm organisation service (mock).
 * Future endpoints:
 *  GET   /api/firms/:id        (includes active team + derived count)
 *  PATCH /api/firms/:id
 *  GET   /api/firms?ids=...
 */
function findFirm(id) {
  const firm = getDb().firms.find((f) => f.id === id);
  if (!firm) throw new ServiceError('Law firm not found.', 404);
  return firm;
}

export async function getFirm(id) {
  await delay();
  const db = getDb();
  const firm = findFirm(id);
  const members = activeMemberIds(db, id)
    .map((lid) => db.lawyers.find((l) => l.id === lid))
    .filter(Boolean)
    .map((l) => lawyerSummary(db, l));
  // Firm contact details are organisational (public business info), not personal data.
  return { ...clone(firm), members, activeMemberCount: members.length };
}

export async function getFirmsByIds(ids) {
  await delay(200);
  const db = getDb();
  return ids.map((id) => db.firms.find((f) => f.id === id)).filter(Boolean).map((f) => firmSummary(db, f));
}

const EDITABLE = ['name', 'about', 'city', 'address', 'established', 'practiceAreas', 'logo', 'cover', 'email', 'phone', 'website'];

export async function updateFirm(id, patch) {
  await delay();
  const firm = findFirm(id);
  EDITABLE.forEach((key) => {
    if (patch[key] !== undefined) firm[key] = clone(patch[key]);
  });
  if (!firm.practiceAreas.length) throw new ServiceError('Select at least one practice area.');
  const user = getDb().users.find((u) => u.role === 'firm' && u.profileId === id);
  if (user && patch.name) user.name = patch.name;
  commit();
  return getFirm(id);
}
