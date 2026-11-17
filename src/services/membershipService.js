import { getDb, commit, delay, uid, ServiceError } from './mockDb';
import { activeMembershipForLawyer, firmSummary, lawyerSummary } from './selectors';

/**
 * Firm membership service (mock). One active affiliation per lawyer (MVP rule).
 * Future endpoints:
 *  GET  /api/firms/:id/memberships
 *  GET  /api/lawyers/:id/memberships
 *  POST /api/firms/:id/invitations            { lawyerId }
 *  POST /api/firms/:id/join-requests          (by lawyer)
 *  POST /api/memberships/:id/{approve|reject|accept|decline|cancel|withdraw|remove|leave}
 */
const now = () => new Date().toISOString();

function findMembership(id) {
  const m = getDb().memberships.find((x) => x.id === id);
  if (!m) throw new ServiceError('Membership record not found.', 404);
  return m;
}

function setStatus(m, status) {
  m.status = status;
  m.updatedAt = now();
}

function activate(m) {
  const db = getDb();
  if (m.status !== 'pending') throw new ServiceError('This request is no longer pending.');
  const existing = activeMembershipForLawyer(db, m.lawyerId);
  if (existing) throw new ServiceError('This lawyer already has an active firm affiliation. They must leave it first.');
  setStatus(m, 'active');
  // Close the lawyer's other pending invitations/requests (single affiliation rule).
  db.memberships
    .filter((x) => x.lawyerId === m.lawyerId && x.status === 'pending' && x.id !== m.id)
    .forEach((x) => setStatus(x, 'cancelled'));
}

async function mutate(id, fn) {
  await delay();
  const m = findMembership(id);
  fn(m);
  commit();
  return { ...m };
}

/* ---------- Firm side ---------- */

export async function getFirmMemberships(firmId) {
  await delay();
  const db = getDb();
  const withLawyer = (m) => {
    const l = db.lawyers.find((x) => x.id === m.lawyerId);
    return l ? { ...m, lawyer: lawyerSummary(db, l) } : null;
  };
  const mine = db.memberships.filter((m) => m.firmId === firmId).map(withLawyer).filter(Boolean);
  return {
    active: mine.filter((m) => m.status === 'active'),
    requests: mine.filter((m) => m.status === 'pending' && m.initiatedBy === 'lawyer'),
    invitations: mine.filter((m) => m.status === 'pending' && m.initiatedBy === 'firm'),
  };
}

export async function inviteLawyer(firmId, lawyerId) {
  await delay();
  const db = getDb();
  if (db.memberships.some((m) => m.firmId === firmId && m.lawyerId === lawyerId && ['active', 'pending'].includes(m.status))) {
    throw new ServiceError('This lawyer is already a member or has a pending request with your firm.');
  }
  if (activeMembershipForLawyer(db, lawyerId)) {
    throw new ServiceError('This lawyer is currently affiliated with another firm.');
  }
  const m = { id: uid('m'), firmId, lawyerId, status: 'pending', initiatedBy: 'firm', createdAt: now(), updatedAt: now() };
  db.memberships.push(m);
  commit();
  return m;
}

export const approveRequest = (id) => mutate(id, activate);
export const rejectRequest = (id) => mutate(id, (m) => setStatus(m, 'rejected'));
export const cancelInvitation = (id) => mutate(id, (m) => setStatus(m, 'cancelled'));
export const removeMember = (id) =>
  mutate(id, (m) => {
    if (m.status !== 'active') throw new ServiceError('Only active members can be removed.');
    setStatus(m, 'removed');
  });

/* ---------- Lawyer side ---------- */

export async function getLawyerMemberships(lawyerId) {
  await delay();
  const db = getDb();
  const withFirm = (m) => {
    const f = db.firms.find((x) => x.id === m.firmId);
    return f ? { ...m, firm: firmSummary(db, f) } : null;
  };
  const mine = db.memberships.filter((m) => m.lawyerId === lawyerId).map(withFirm).filter(Boolean);
  return {
    active: mine.find((m) => m.status === 'active') || null,
    invitations: mine.filter((m) => m.status === 'pending' && m.initiatedBy === 'firm'),
    requests: mine.filter((m) => m.status === 'pending' && m.initiatedBy === 'lawyer'),
    allFirms: db.firms.map((f) => firmSummary(db, f)),
  };
}

export async function requestToJoin(lawyerId, firmId) {
  await delay();
  const db = getDb();
  if (activeMembershipForLawyer(db, lawyerId)) throw new ServiceError('Leave your current firm before requesting to join another.');
  if (db.memberships.some((m) => m.firmId === firmId && m.lawyerId === lawyerId && m.status === 'pending')) {
    throw new ServiceError('A request or invitation with this firm is already pending.');
  }
  const m = { id: uid('m'), firmId, lawyerId, status: 'pending', initiatedBy: 'lawyer', createdAt: now(), updatedAt: now() };
  db.memberships.push(m);
  commit();
  return m;
}

export const acceptInvitation = (id) => mutate(id, activate);
export const declineInvitation = (id) => mutate(id, (m) => setStatus(m, 'declined'));
export const withdrawRequest = (id) => mutate(id, (m) => setStatus(m, 'withdrawn'));
export const leaveFirm = (id) => mutate(id, (m) => setStatus(m, 'left'));
