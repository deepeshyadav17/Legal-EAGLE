import { getDb, commit, delay, clone, ServiceError } from './mockDb';
import { firmSummary, lawyerSummary } from './selectors';

/**
 * Client workspace service (mock).
 * Future endpoints:
 *  GET    /api/clients/me
 *  PATCH  /api/clients/me
 *  POST   /api/clients/me/saved            { type, id }
 *  DELETE /api/clients/me/saved/:type/:id
 *  POST   /api/clients/me/recent           { type, id }
 */
function findClient(id) {
  const c = getDb().clients.find((x) => x.id === id);
  if (!c) throw new ServiceError('Client account not found.', 404);
  return c;
}

const listKey = (type) => (type === 'lawyer' ? 'lawyers' : 'firms');

export async function getClient(id) {
  await delay(200);
  return clone(findClient(id));
}

export async function toggleSaved(clientId, type, targetId) {
  await delay(200);
  const client = findClient(clientId);
  const key = listKey(type);
  const list = client.saved[key];
  const saved = !list.includes(targetId);
  client.saved[key] = saved ? [targetId, ...list] : list.filter((x) => x !== targetId);
  commit();
  return { saved, savedIds: clone(client.saved) };
}

export async function getSavedProfiles(clientId) {
  await delay();
  const db = getDb();
  const client = findClient(clientId);
  return {
    lawyers: client.saved.lawyers.map((id) => db.lawyers.find((l) => l.id === id)).filter(Boolean).map((l) => lawyerSummary(db, l)),
    firms: client.saved.firms.map((id) => db.firms.find((f) => f.id === id)).filter(Boolean).map((f) => firmSummary(db, f)),
  };
}

export async function recordView(clientId, type, targetId) {
  const client = getDb().clients.find((x) => x.id === clientId);
  if (!client) return;
  client.recent = [{ type, id: targetId, at: new Date().toISOString() }, ...client.recent.filter((r) => !(r.type === type && r.id === targetId))].slice(0, 8);
  commit();
}

export async function getRecentlyViewed(clientId) {
  await delay();
  const db = getDb();
  return findClient(clientId)
    .recent.map((r) => {
      if (r.type === 'lawyer') {
        const l = db.lawyers.find((x) => x.id === r.id);
        return l && { type: 'lawyer', at: r.at, item: lawyerSummary(db, l) };
      }
      const f = db.firms.find((x) => x.id === r.id);
      return f && { type: 'firm', at: r.at, item: firmSummary(db, f) };
    })
    .filter(Boolean);
}

export async function clearRecentlyViewed(clientId) {
  await delay(150);
  findClient(clientId).recent = [];
  commit();
}

export async function updateClient(clientId, patch) {
  await delay();
  const client = findClient(clientId);
  ['name', 'email', 'city'].forEach((k) => {
    if (patch[k] !== undefined) client[k] = patch[k].trim();
  });
  commit();
  return clone(client);
}
