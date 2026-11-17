export const cn = (...classes) => classes.filter(Boolean).join(' ');

export const initials = (name = '') =>
  name
    .replace(/&/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getTodayInTimeZone(timeZone = 'Asia/Kolkata') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const dateParts = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, value]),
  );
  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

/** "2024-03" -> "Mar 2024" */
export function formatMonth(value) {
  if (!value) return '';
  const [y, m] = value.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : y;
}

export const formatDateRange = (start, end) => `${formatMonth(start)} – ${end ? formatMonth(end) : 'Present'}`;

export const yearsLabel = (n) => `${n} yr${n === 1 ? '' : 's'} experience`;

export function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return `${Math.floor(diff / 86400)} d ago`;
}

/** Deterministic gradient for avatars/covers from an id or name. */
const PALETTES = [
  ['#101F35', '#2a4570'],
  ['#1f3658', '#C8A96B'],
  ['#23314a', '#5b6f8f'],
  ['#3b2f1e', '#C8A96B'],
  ['#14324a', '#3f7c8c'],
  ['#2b2140', '#6d5a8f'],
];
export function gradientFor(seed = '') {
  const sum = [...seed].reduce((a, c) => a + c.charCodeAt(0), 0);
  const [a, b] = PALETTES[sum % PALETTES.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}

export const dashboardPath = (role) => ({ client: '/client/dashboard', lawyer: '/lawyer/dashboard', firm: '/firm/dashboard' })[role] || '/';

export const ROLE_LABEL = { client: 'Client', lawyer: 'Lawyer', firm: 'Law Firm' };

/** Formats an amount in INR (e.g. 1500 -> "₹1,500") */
export function formatINR(amount = 0) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);
}

/** Converts "14:00" or "09:00" -> "2:00 PM" or "9:00 AM" */
export function formatTime12h(time24 = '') {
  if (!time24) return '';
  const [hStr, mStr = '00'] = time24.split(':');
  const h = Number(hStr);
  if (Number.isNaN(h)) return time24;
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${mStr.padStart(2, '0')} ${period}`;
}

export function formatSlotRange(startTime, endTime) {
  return `${formatTime12h(startTime)} – ${formatTime12h(endTime)}`;
}

/** Formats "2026-11-10" -> "10 November 2026" */
export function formatFullDate(dateStr = '') {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(iso = '') {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export const MODE_LABEL = {
  ONLINE: 'Online Consultation',
  IN_PERSON: 'In-Person Consultation',
};
