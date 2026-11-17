import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, Bell, CalendarClock, CalendarDays, Check, CheckCheck, CheckCircle2, ChevronDown,
  Clock3, CreditCard, ExternalLink, RotateCcw, XCircle,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { getNotificationLink, useNotifications } from '../../context/NotificationContext';
import { cn, formatDateTime, timeAgo } from '../../utils/format';

const NOTIFICATION_PRESENTATION = {
  PAYMENT_SUCCESS: { label: 'Payment received', icon: CreditCard, color: 'bg-emerald-100 text-emerald-700' },
  PAYMENT_FAILED: { label: 'Payment issue', icon: AlertTriangle, color: 'bg-rose-100 text-rose-700' },
  NEW_BOOKING_REQUEST: { label: 'New booking', icon: CalendarDays, color: 'bg-violet-100 text-violet-700' },
  BOOKING_CONFIRMED: { label: 'Confirmed', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
  RESCHEDULE_PROPOSED: { label: 'Reschedule', icon: CalendarClock, color: 'bg-amber-100 text-amber-800' },
  RESCHEDULE_ACCEPTED: { label: 'Reschedule accepted', icon: CalendarClock, color: 'bg-teal-100 text-teal-700' },
  RESCHEDULE_REJECTED: { label: 'Reschedule declined', icon: XCircle, color: 'bg-rose-100 text-rose-700' },
  BOOKING_DECLINED: { label: 'Booking declined', icon: XCircle, color: 'bg-rose-100 text-rose-700' },
  BOOKING_EXPIRED: { label: 'Booking expired', icon: Clock3, color: 'bg-slate-100 text-slate-700' },
  REFUND_INITIATED: { label: 'Refund started', icon: RotateCcw, color: 'bg-sky-100 text-sky-700' },
  REFUND_COMPLETED: { label: 'Refund complete', icon: CheckCircle2, color: 'bg-teal-100 text-teal-700' },
  CONSULTATION_REMINDER: { label: 'Reminder', icon: Clock3, color: 'bg-indigo-100 text-indigo-700' },
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const filtered = useMemo(() => {
    if (filter === 'unread') return notifications.filter((n) => !n.isRead);
    return notifications;
  }, [notifications, filter]);

  const handleOpenNotification = async (notif) => {
    if (!notif.isRead) {
      await markRead(notif.id);
    }
    const target = getNotificationLink(notif, user?.role);
    if (target) navigate(target);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your activity"
        title="Notifications"
        action={
          unreadCount > 0 && (
            <button type="button" onClick={markAllRead} className="btn btn-outline btn-sm">
              <CheckCheck className="h-4 w-4" aria-hidden="true" />
              Mark all read
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] tabular-nums text-sky-800">
                {unreadCount}
              </span>
            </button>
          )
        }
      />

      <div className="flex items-center gap-2" role="group" aria-label="Filter notifications">
        {[
          { id: 'all', label: 'All', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            aria-pressed={filter === item.id}
            className={cn(
              'inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition',
              filter === item.id
                ? 'bg-navy text-white shadow-sm'
                : 'border border-line bg-white text-muted hover:border-sky-200 hover:text-navy',
            )}
          >
            {item.label}
            <span className={cn(
              'rounded-full px-2 py-0.5 text-xs tabular-nums',
              filter === item.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-600',
            )}
            >
              {item.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title={filter === 'unread' ? 'You’re all caught up' : 'No notifications yet'}
          description={filter === 'unread' ? 'New updates will appear here.' : 'Booking and payment updates will appear here.'}
        />
      ) : (
        <div className="space-y-3" role="list" aria-label="Notifications">
          {filtered.map((notif) => {
            const presentation = NOTIFICATION_PRESENTATION[notif.type] || {
              label: 'Update',
              icon: Bell,
              color: 'bg-blue-100 text-blue-700',
            };
            const Icon = presentation.icon;
            const expanded = expandedId === notif.id;

            return (
              <article
                key={notif.id}
                role="listitem"
                className={cn(
                  'relative overflow-hidden rounded-2xl border p-4 transition-all sm:p-5',
                  notif.isRead
                    ? 'border-line bg-white hover:border-sky-200 hover:shadow-card'
                    : 'border-blue-200 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-sm',
                )}
              >
                {!notif.isRead && (
                  <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-blue-500 to-teal-400" aria-hidden="true" />
                )}
                <div className="flex items-start gap-3 sm:gap-4">
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', presentation.color)}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold', presentation.color)}>
                        {presentation.label}
                      </span>
                      {notif.bookingId && (
                        <span className="text-[11px] font-medium text-muted">
                          Booking {notif.bookingId}
                        </span>
                      )}
                      <time
                        dateTime={notif.createdAt}
                        title={formatDateTime(notif.createdAt)}
                        className="text-xs text-muted"
                      >
                        {timeAgo(notif.createdAt)}
                      </time>
                    </div>
                    <h2 className="mt-2 text-sm font-bold text-navy sm:text-base">{notif.title}</h2>
                    <p className={cn('mt-1 text-sm leading-relaxed text-ink', !expanded && 'line-clamp-1')}>
                      {notif.message}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expanded ? null : notif.id)}
                      aria-label={`${expanded ? 'Hide' : 'Show'} details for “${notif.title}”`}
                      aria-expanded={expanded}
                      title={expanded ? 'Hide details' : 'Show details'}
                      className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-blue-700"
                    >
                      <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
                    </button>
                    {!notif.isRead && (
                      <button
                        type="button"
                        onClick={() => markRead(notif.id)}
                        aria-label={`Mark “${notif.title}” as read`}
                        title="Mark as read"
                        className="grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                    {notif.bookingId && (
                      <button
                        type="button"
                        onClick={() => handleOpenNotification(notif)}
                        aria-label={`Open booking ${notif.bookingId}`}
                        title="Open booking"
                        className="grid h-9 w-9 place-items-center rounded-xl bg-white text-sky-700 shadow-sm transition hover:bg-sky-50"
                      >
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
