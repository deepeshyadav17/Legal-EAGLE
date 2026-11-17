import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import * as notificationService from '../services/notificationService';

const NotificationContext = createContext(null);

export function getNotificationLink(notification, role) {
  if (!notification?.bookingId) return '/notifications';
  if (role === 'client') return `/client/consultations/${notification.bookingId}`;
  if (role === 'lawyer') {
    if (notification.type === 'NEW_BOOKING_REQUEST') {
      return `/lawyer/appointments/${notification.bookingId}`;
    }
    return `/lawyer/appointments/${notification.bookingId}`;
  }
  return '/notifications';
}

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshNotifications = useCallback(async () => {
    if (!user?.id) {
      setNotifications([]);
      return;
    }
    setLoading(true);
    try {
      const list = await notificationService.getUserNotifications(user.id);
      setNotifications(list);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  const markRead = useCallback(
    async (id) => {
      if (!user?.id) return;
      await notificationService.markAsRead(id, user.id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    },
    [user?.id],
  );

  const markAllRead = useCallback(async () => {
    if (!user?.id) return;
    await notificationService.markAllAsRead(user.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [user?.id]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      refreshNotifications,
      markRead,
      markAllRead,
    }),
    [notifications, unreadCount, loading, refreshNotifications, markRead, markAllRead],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationProvider');
  return ctx;
}

