import { getSharedCalendarBookings } from './bookingService';
import { ServiceError, uid } from './mockDb';

const STORAGE_KEY = 'legal-eagle-calendar-v1';
const REMINDER_OPTIONS = [0, 10, 30, 60, 1440];

function readCalendarData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { events: [], reminders: {} };

  const data = JSON.parse(raw);
  if (!Array.isArray(data.events) || !data.reminders || typeof data.reminders !== 'object') {
    throw new ServiceError('Saved calendar data is invalid. Reset the calendar data to continue.');
  }
  return data;
}

function saveCalendarData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    throw new ServiceError('Could not save this calendar change in browser storage.');
  }
}

export async function getCalendarEvents() {
  const data = readCalendarData();
  const bookings = await getSharedCalendarBookings();
  const bookedEvents = bookings.map((booking) => ({
    id: `booking:${booking.id}`,
    bookingId: booking.id,
    source: 'booking',
    type: 'meeting',
    title: 'Consultation',
    date: booking.finalSlot.date,
    startTime: booking.finalSlot.startTime,
    endTime: booking.finalSlot.endTime,
    allDay: false,
    notes: '',
    participants: [booking.client?.name, booking.lawyer?.name].filter(Boolean),
    reminderMinutes: data.reminders[`booking:${booking.id}`] ?? 30,
  }));

  const manualEvents = data.events.map((event) => ({
    ...event,
    source: 'manual',
    participants: [],
    reminderMinutes: data.reminders[event.id] ?? event.reminderMinutes ?? 30,
  }));

  return [...bookedEvents, ...manualEvents].sort((a, b) =>
    `${a.date}T${a.allDay ? '00:00' : a.startTime}`.localeCompare(
      `${b.date}T${b.allDay ? '00:00' : b.startTime}`,
    ),
  );
}

export function saveCalendarReminder(eventId, reminderMinutes) {
  if (!REMINDER_OPTIONS.includes(Number(reminderMinutes))) {
    throw new ServiceError('Choose a valid reminder time.');
  }
  const data = readCalendarData();
  data.reminders[eventId] = Number(reminderMinutes);
  saveCalendarData(data);
}

export function createCalendarEvent(event) {
  const title = String(event.title || '').trim();
  if (!title) throw new ServiceError('Add a title for this calendar event.');
  if (!['meeting', 'court'].includes(event.type)) throw new ServiceError('Choose a valid event type.');
  const dateParts = String(event.date || '').split('-').map(Number);
  const parsedDate = new Date(`${event.date}T00:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(event.date)
    || dateParts.length !== 3
    || dateParts.some(Number.isNaN)
    || Number.isNaN(parsedDate.getTime())
    || parsedDate.getFullYear() !== dateParts[0]
    || parsedDate.getMonth() + 1 !== dateParts[1]
    || parsedDate.getDate() !== dateParts[2]
  ) {
    throw new ServiceError('Choose a valid event date.');
  }
  const timeParts = String(event.startTime || '').split(':').map(Number);
  if (
    !/^\d{2}:\d{2}$/.test(event.startTime)
    || timeParts.length !== 2
    || timeParts.some(Number.isNaN)
    || timeParts[0] < 0
    || timeParts[0] > 23
    || timeParts[1] < 0
    || timeParts[1] > 59
  ) {
    throw new ServiceError('Choose a valid event time.');
  }
  if (!REMINDER_OPTIONS.includes(Number(event.reminderMinutes))) throw new ServiceError('Choose a valid reminder time.');

  const data = readCalendarData();
  const created = {
    id: uid('calendar'),
    type: event.type,
    title,
    date: event.date,
    startTime: event.startTime,
    endTime: event.startTime,
    allDay: Boolean(event.allDay),
    notes: String(event.notes || '').trim(),
    reminderMinutes: Number(event.reminderMinutes),
    source: 'manual',
  };
  data.events.push(created);
  saveCalendarData(data);
  return created;
}

export function deleteCalendarEvent(eventId) {
  const data = readCalendarData();
  const initialLength = data.events.length;
  data.events = data.events.filter((event) => event.id !== eventId);
  if (data.events.length === initialLength) throw new ServiceError('This calendar event could not be found.');
  delete data.reminders[eventId];
  saveCalendarData(data);
}

export function getReminderTime(event) {
  const eventTime = new Date(`${event.date}T${event.allDay ? '09:00' : event.startTime}:00+05:30`);
  return eventTime.getTime() - event.reminderMinutes * 60 * 1000;
}

export function getReminderKey(event) {
  return `${event.id}:${event.date}:${event.startTime}:${event.reminderMinutes}`;
}
