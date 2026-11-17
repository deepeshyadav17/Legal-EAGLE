import { useEffect } from 'react';
import { useToast } from '../../context/ToastContext';
import {
  getCalendarEvents,
  getReminderKey,
  getReminderTime,
} from '../../services/calendarService';

const SENT_REMINDERS_KEY = 'legal-eagle-calendar-reminders-sent-v1';

function readSentReminders() {
  const raw = localStorage.getItem(SENT_REMINDERS_KEY);
  if (!raw) return new Set();
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved calendar reminder state is invalid.');
  return new Set(parsed);
}

export default function CalendarReminderMonitor() {
  const toast = useToast();

  useEffect(() => {
    let active = true;
    let checking = false;
    let lastError = '';

    const checkReminders = async () => {
      if (checking) return;
      checking = true;
      try {
        const [events, sent] = await Promise.all([
          getCalendarEvents(),
          Promise.resolve(readSentReminders()),
        ]);
        if (!active) return;

        const now = Date.now();
        const updated = new Set(sent);
        events.forEach((event) => {
          if (event.reminderMinutes === 0) return;
          const reminderKey = getReminderKey(event);
          const reminderTime = getReminderTime(event);
          const eventTime = new Date(`${event.date}T${event.allDay ? '09:00' : event.startTime}:00+05:30`).getTime();
          if (now < reminderTime || now >= eventTime || sent.has(reminderKey)) return;

          const reminderDate = new Date(`${event.date}T${event.allDay ? '09:00' : event.startTime}:00+05:30`);
          const dateText = reminderDate.toLocaleString('en-IN', event.allDay
            ? { day: 'numeric', month: 'short' }
            : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
          const message = `${event.title} is coming up${event.allDay ? ` on ${dateText}` : ` at ${dateText}`}.`;
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            new Notification('Legal Eagle calendar reminder', { body: message });
          } else {
            toast.info({ title: 'Calendar reminder', description: message });
          }
          updated.add(reminderKey);
        });

        if (updated.size !== sent.size) {
          localStorage.setItem(SENT_REMINDERS_KEY, JSON.stringify([...updated]));
        }
        lastError = '';
      } catch (error) {
        if (error.message !== lastError) {
          toast.error({ title: 'Calendar reminder error', description: error.message });
          lastError = error.message;
        }
      } finally {
        checking = false;
      }
    };

    checkReminders();
    const intervalId = window.setInterval(checkReminders, 30_000);
    window.addEventListener('focus', checkReminders);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', checkReminders);
    };
  }, [toast]);

  return null;
}
