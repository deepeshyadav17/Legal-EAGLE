import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Gavel, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageHeader from '../../components/layout/PageHeader';
import Modal from '../../components/common/Modal';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  createCalendarEvent,
  deleteCalendarEvent,
  getCalendarEvents,
  saveCalendarReminder,
} from '../../services/calendarService';
import { formatFullDate, formatMonth, formatTime12h } from '../../utils/format';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const REMINDER_OPTIONS = [
  { value: 0, label: 'No reminder' },
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' },
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createInitialForm() {
  return {
    type: 'meeting',
    title: '',
    date: dateKey(new Date()),
    startTime: '10:00',
    allDay: false,
    notes: '',
    reminderMinutes: 30,
  };
}

function monthDays(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - mondayOffset);
  return Array.from({ length: 42 }, (_, index) =>
    new Date(start.getFullYear(), start.getMonth(), start.getDate() + index),
  );
}

function eventDateTime(event) {
  if (event.allDay) return 'All day';
  return formatTime12h(event.startTime);
}

export default function CalendarPage() {
  useDocumentTitle('Shared Calendar');
  const { user } = useAuth();
  const toast = useToast();
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  );

  const refreshEvents = useCallback(async () => {
    try {
      const list = await getCalendarEvents();
      setEvents(list);
      setError('');
    } catch (err) {
      setError(err.message || 'Could not load calendar events.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshEvents();
    const intervalId = window.setInterval(refreshEvents, 30_000);
    return () => window.clearInterval(intervalId);
  }, [refreshEvents]);

  const dates = useMemo(() => monthDays(month), [month]);
  const selectedEvents = useMemo(
    () => events.filter((event) => event.date === selectedDate),
    [events, selectedDate],
  );
  const eventCounts = useMemo(() => {
    const counts = new Map();
    events.forEach((event) => counts.set(event.date, (counts.get(event.date) || 0) + 1));
    return counts;
  }, [events]);
  const monthLabel = formatMonth(`${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`);

  const moveMonth = (amount) => {
    const nextMonth = new Date(month.getFullYear(), month.getMonth() + amount, 1);
    setMonth(nextMonth);
    setSelectedDate(dateKey(nextMonth));
  };

  const openNewEvent = () => {
    setForm({ ...createInitialForm(), date: selectedDate });
    setFormOpen(true);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const created = createCalendarEvent(form);
      setSelectedDate(created.date);
      setMonth(new Date(Number(created.date.slice(0, 4)), Number(created.date.slice(5, 7)) - 1, 1));
      setFormOpen(false);
      await refreshEvents();
      toast.success({ title: 'Event added', description: 'It is now visible on the shared calendar.' });
    } catch (err) {
      toast.error({ title: 'Could not add event', description: err.message });
    }
  };

  const handleReminderChange = (event, value) => {
    try {
      saveCalendarReminder(event.id, value);
      setEvents((current) =>
        current.map((item) =>
          item.id === event.id ? { ...item, reminderMinutes: Number(value) } : item,
        ),
      );
      toast.success('Reminder updated.');
    } catch (err) {
      toast.error({ title: 'Could not update reminder', description: err.message });
    }
  };

  const handleDelete = async () => {
    try {
      deleteCalendarEvent(deleteTarget.id);
      setDeleteTarget(null);
      await refreshEvents();
      toast.success('Calendar event removed.');
    } catch (err) {
      toast.error({ title: 'Could not remove event', description: err.message });
    }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      toast.info('Browser alerts are not supported here. In-app reminders will still appear while the app is open.');
      return;
    }
    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        toast.success('Browser reminders are enabled.');
      } else {
        toast.info('Browser alerts are not enabled. In-app reminders will still appear while the app is open.');
      }
    } catch (err) {
      toast.error({ title: 'Could not enable browser alerts', description: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Shared Workspace"
        title="Calendar"
        description="Confirmed consultations appear automatically. Add meetings and court dates for everyone using this workspace."
        actions={
          <>
            <button type="button" className="btn btn-outline btn-sm" onClick={enableNotifications}>
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              {permission === 'granted' ? 'Browser alerts enabled' : 'Enable browser alerts'}
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openNewEvent}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add event
            </button>
          </>
        }
      />

      <div className="rounded-xl border border-gold/30 bg-gold-100/60 px-4 py-3 text-sm text-ink">
        This demo calendar is stored in this browser and shared by its client, lawyer, and firm workspaces. Reminders run while the app is open; browser alerts need permission.
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error}
          <button type="button" className="ml-3 font-semibold underline" onClick={refreshEvents}>Try again</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(18rem,0.8fr)]">
        <section className="card overflow-hidden p-4 sm:p-5" aria-label="Monthly calendar">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold">{monthLabel}</h2>
              <p className="text-xs text-muted">{loading ? 'Updating events…' : `${events.length} scheduled event${events.length === 1 ? '' : 's'}`}</p>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-outline btn-sm px-2.5" onClick={() => moveMonth(-1)} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => { setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1)); setSelectedDate(today); }}>
                Today
              </button>
              <button type="button" className="btn btn-outline btn-sm px-2.5" onClick={() => moveMonth(1)} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-line pb-2 text-center text-xs font-semibold text-muted">
            {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {dates.map((date) => {
              const key = dateKey(date);
              const isCurrentMonth = date.getMonth() === month.getMonth();
              const isSelected = key === selectedDate;
              const count = eventCounts.get(key) || 0;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setSelectedDate(key)}
                  aria-label={`${date.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ''}`}
                  aria-pressed={isSelected}
                  className={`min-h-[4.2rem] border-b border-r border-line p-1.5 text-left transition hover:bg-cream sm:min-h-[5.5rem] sm:p-2 ${
                    isSelected ? 'bg-gold-100/70' : 'bg-white'
                  } ${isCurrentMonth ? 'text-ink' : 'text-muted/45'}`}
                >
                  <span className={`grid h-7 w-7 place-items-center rounded-full text-sm ${
                    key === today ? 'bg-navy font-semibold text-white' : ''
                  }`}>{date.getDate()}</span>
                  {count > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-navy sm:text-xs">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold-600" />
                      <span className="truncate">{count} event{count === 1 ? '' : 's'}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <aside className="card flex flex-col p-4 sm:p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow mb-1">Selected day</p>
              <h2 className="font-serif text-xl font-semibold">{formatFullDate(selectedDate)}</h2>
            </div>
            <button type="button" className="btn btn-outline btn-sm shrink-0" onClick={openNewEvent}>
              <Plus className="h-4 w-4" aria-hidden="true" /> Add
            </button>
          </div>

          <div className="space-y-3">
            {!selectedEvents.length ? (
              <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
                <CalendarDays className="mx-auto mb-2 h-7 w-7 text-muted/60" aria-hidden="true" />
                <p className="text-sm font-medium">Nothing scheduled</p>
                <p className="mt-1 text-xs text-muted">Meetings and court dates for this day will show here.</p>
              </div>
            ) : selectedEvents.map((event) => (
              <article key={event.id} className="rounded-xl border border-line bg-white p-3.5">
                <div className="flex items-start gap-3">
                  <span className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
                    event.type === 'court' ? 'bg-amber-50 text-amber-800' : 'bg-sky-50 text-sky-800'
                  }`}>
                    {event.type === 'court' ? <Gavel className="h-4 w-4" /> : <CalendarDays className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="mt-0.5 text-xs text-muted">
                          {event.type === 'court' ? 'Court date' : event.source === 'booking' ? 'Confirmed consultation' : 'Meeting'}
                          {' · '}{eventDateTime(event)}
                        </p>
                      </div>
                      {event.source === 'manual' && (
                        <button
                          type="button"
                          className="rounded-md p-1 text-muted hover:bg-red-50 hover:text-red-700"
                          onClick={() => setDeleteTarget(event)}
                          aria-label={`Remove ${event.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {event.participants.length > 0 && (
                      <p className="mt-2 text-xs text-muted">{event.participants.join(' · ')}</p>
                    )}
                    {event.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{event.notes}</p>}
                    {event.bookingId && user.role !== 'firm' && (
                      <Link
                        className="mt-2 inline-block text-xs font-semibold text-navy underline"
                        to={user.role === 'client' ? `/client/consultations/${event.bookingId}` : `/lawyer/appointments/${event.bookingId}`}
                      >
                        View consultation
                      </Link>
                    )}
                    <label className="mt-3 block text-xs font-medium text-muted">
                      Reminder
                      <select
                        className="input mt-1 py-2 text-xs"
                        value={event.reminderMinutes}
                        onChange={(e) => handleReminderChange(event, e.target.value)}
                        aria-label={`Reminder for ${event.title}`}
                      >
                        {REMINDER_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title="Add to shared calendar"
        description="Add a meeting or court date. Everyone in this browser workspace will see it."
        footer={
          <>
            <button type="button" className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" form="calendar-event-form" className="btn btn-primary">Add event</button>
          </>
        }
      >
        <form id="calendar-event-form" onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="calendar-event-type" className="label">Event type</label>
            <select
              id="calendar-event-type"
              className="input"
              value={form.type}
              onChange={(e) => setForm((current) => ({ ...current, type: e.target.value }))}
            >
              <option value="meeting">Meeting</option>
              <option value="court">Court date</option>
            </select>
          </div>
          <div>
            <label htmlFor="calendar-event-title" className="label">Title</label>
            <input
              id="calendar-event-title"
              className="input"
              maxLength={100}
              required
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              placeholder={form.type === 'court' ? 'e.g. District Court hearing' : 'e.g. Case review meeting'}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="calendar-event-date" className="label">Date</label>
              <input
                id="calendar-event-date"
                type="date"
                className="input"
                required
                value={form.date}
                onChange={(e) => setForm((current) => ({ ...current, date: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="calendar-event-time" className="label">Time</label>
              <input
                id="calendar-event-time"
                type="time"
                className="input"
                disabled={form.allDay}
                required={!form.allDay}
                value={form.startTime}
                onChange={(e) => setForm((current) => ({ ...current, startTime: e.target.value }))}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => setForm((current) => ({
                ...current,
                allDay: e.target.checked,
                reminderMinutes: e.target.checked ? 1440 : 30,
              }))}
            />
            All-day event
          </label>
          <div>
            <label htmlFor="calendar-event-notes" className="label">Notes <span className="font-normal text-muted">(optional)</span></label>
            <textarea
              id="calendar-event-notes"
              className="input min-h-20 resize-y"
              maxLength={500}
              value={form.notes}
              onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))}
              placeholder="Location, case reference, or other details"
            />
          </div>
          <div>
            <label htmlFor="calendar-event-reminder" className="label">Reminder</label>
            <select
              id="calendar-event-reminder"
              className="input"
              value={form.reminderMinutes}
              onChange={(e) => setForm((current) => ({ ...current, reminderMinutes: Number(e.target.value) }))}
            >
              {REMINDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove calendar event?"
        message={`“${deleteTarget?.title || ''}” will be removed from the shared calendar.`}
        confirmLabel="Remove event"
      />
    </div>
  );
}
