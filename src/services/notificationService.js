import { getDb, commit, delay, clone, uid } from './mockDb';

/**
 * Module C: Notifications Service (mock).
 * Responsible for:
 *  - New booking notifications
 *  - Payment notifications
 *  - Lawyer approval updates
 *  - Reschedule requests & client responses
 *  - Refund notifications
 *  - Upcoming appointment reminders
 *  - Read / unread notification states
 *
 * Future endpoints:
 *  GET   /api/notifications
 *  PATCH /api/notifications/:id/read
 *  POST  /api/notifications/read-all
 */

export function resolveUserIdByProfile(role, profileId) {
  const db = getDb();
  const user = db.users.find((u) => u.role === role && u.profileId === profileId);
  return user ? user.id : `${role}:${profileId}`;
}

export function createNotificationSync({ recipientId, bookingId = null, type, title, message }) {
  const db = getDb();
  db.notifications = db.notifications || [];
  const notif = {
    id: uid('notif'),
    recipientId,
    bookingId,
    type,
    title,
    message,
    isRead: false,
    createdAt: new Date().toISOString(),
  };
  db.notifications.unshift(notif);
  commit();
  return clone(notif);
}

export async function createNotification(payload) {
  await delay(100);
  return createNotificationSync(payload);
}

export async function getUserNotifications(userId) {
  await delay(150);
  if (!userId) return [];
  const db = getDb();
  const list = (db.notifications || [])
    .filter((n) => n.recipientId === userId)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return clone(list);
}

export function getUnreadCountSync(userId) {
  if (!userId) return 0;
  const db = getDb();
  return (db.notifications || []).filter((n) => n.recipientId === userId && !n.isRead).length;
}

export async function getUnreadCount(userId) {
  await delay(80);
  return getUnreadCountSync(userId);
}

export async function markAsRead(notificationId, userId) {
  await delay(100);
  const db = getDb();
  const notif = (db.notifications || []).find(
    (n) => n.id === notificationId && (!userId || n.recipientId === userId),
  );
  if (notif) {
    notif.isRead = true;
    commit();
  }
  return notif ? clone(notif) : null;
}

export async function markAllAsRead(userId) {
  await delay(120);
  const db = getDb();
  (db.notifications || []).forEach((n) => {
    if (n.recipientId === userId) n.isRead = true;
  });
  commit();
  return true;
}

