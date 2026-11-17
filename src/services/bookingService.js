import { getDb, commit, delay, clone, uid, ServiceError } from './mockDb';
import {
  BOOKING_STATUS,
  SLOT_STATUS,
  assertBookingTransition,
} from './bookingStateMachine';
import { activeMemberIds, activeMembershipForLawyer, lawyerSummary } from './selectors';
import { formatFullDate, formatSlotRange, getTodayInTimeZone } from '../utils/format';
import { containsInjection, enforceRateLimit, sanitizeString } from '../utils/security';
import { requireOwnership } from './authService';

/**
 * Module A: Consultation Booking & Availability Service (mock).
 * Responsible for:
 *  - Lawyer availability settings & 60-minute slot management
 *  - Temporary 10-minute slot reservations
 *  - Consultation booking lifecycle & state transitions
 *  - Lawyer approval, rescheduling & decline transitions
 *  - Client reschedule acceptance & rejection transitions
 *  - Appointment confirmation, history & expiration calculation
 *
 * Production note:
 *  Slot holds and booking state transitions must be executed inside atomic
 *  database transactions with row-level locks / unique constraints on the
 *  backend so two clients cannot reserve the same slot concurrently.
 */

export const HOLD_DURATION_MS = 10 * 60 * 1000; // 10 minutes
export const LAWYER_RESPONSE_MS = 12 * 60 * 60 * 1000; // 12 hours
export const CLIENT_RESPONSE_MS = 12 * 60 * 60 * 1000; // 12 hours

function addOneHour(time24) {
  const [hStr, mStr = '00'] = (time24 || '').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 22) {
    throw new ServiceError('Select a valid start time between 00:00 and 22:00.');
  }
  const endH = String(h + 1).padStart(2, '0');
  const endM = String(m).padStart(2, '0');
  return `${endH}:${endM}`;
}

function slotStartIso(slot) {
  return new Date(`${slot.date}T${slot.startTime}:00+05:30`).toISOString();
}

function computeDeadline(windowMs, slot) {
  const target = Date.now() + windowMs;
  if (!slot) return new Date(target).toISOString();
  const slotTime = new Date(`${slot.date}T${slot.startTime}:00+05:30`).getTime();
  // Deadlines must never extend beyond the consultation start time
  const effective = slotTime > Date.now() ? Math.min(target, slotTime) : target;
  return new Date(effective).toISOString();
}

function enrichBooking(db, booking) {
  if (!booking) return null;
  const lawyer = db.lawyers.find((l) => l.id === booking.lawyerId);
  const client = db.clients.find((c) => c.id === booking.clientId);
  const originalSlot = (db.availabilitySlots || []).find((s) => s.id === booking.originalSlotId) || null;
  const finalSlot = (db.availabilitySlots || []).find((s) => s.id === booking.finalSlotId) || originalSlot;
  const payment = (db.payments || []).find((p) => p.id === booking.paymentId || p.bookingId === booking.id) || null;
  const refund = (db.refunds || []).find((r) => r.bookingId === booking.id) || null;
  const proposal = (db.rescheduleProposals || [])
    .filter((p) => p.bookingId === booking.id)
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0] || null;
  const proposedSlot = proposal
    ? (db.availabilitySlots || []).find((s) => s.id === proposal.proposedSlotId) || null
    : null;

  return {
    ...clone(booking),
    lawyer: lawyer ? lawyerSummary(db, lawyer) : null,
    client: client ? { id: client.id, name: client.name, email: client.email, city: client.city } : null,
    originalSlot: originalSlot ? clone(originalSlot) : null,
    finalSlot: finalSlot ? clone(finalSlot) : null,
    payment: payment ? clone(payment) : null,
    refund: refund ? clone(refund) : null,
    proposal: proposal ? { ...clone(proposal), proposedSlot: proposedSlot ? clone(proposedSlot) : null } : null,
  };
}

/**
 * Releases expired 10-minute payment holds and returns any paid bookings whose
 * lawyer/client response deadline has passed so the Workflow Coordinator can
 * initiate refunds and notifications.
 */
export function collectAndReleaseExpiredHoldsSync() {
  const db = getDb();
  const nowMs = Date.now();
  let changed = false;

  (db.availabilitySlots || []).forEach((slot) => {
    if (slot.status === SLOT_STATUS.RESERVED && slot.reservedUntil) {
      if (new Date(slot.reservedUntil).getTime() <= nowMs) {
        slot.status = SLOT_STATUS.AVAILABLE;
        slot.reservedUntil = null;
        if (slot.bookingId) {
          const bk = (db.bookings || []).find((b) => b.id === slot.bookingId);
          if (bk && bk.bookingStatus === BOOKING_STATUS.PAYMENT_PENDING) {
            bk.bookingStatus = BOOKING_STATUS.EXPIRED;
            bk.updatedAt = new Date().toISOString();
            bk.timeline = bk.timeline || [];
            bk.timeline.push({
              step: 'HOLD_EXPIRED',
              label: '10-minute temporary slot reservation expired before payment completion',
              at: bk.updatedAt,
            });
          }
          slot.bookingId = null;
        }
        changed = true;
      }
    }
  });

  if (changed) commit();
}

/* ---------- Lawyer Consultation Settings & Availability ---------- */

export async function getConsultationSettings(lawyerId) {
  await delay(150);
  const db = getDb();
  db.consultationSettings = db.consultationSettings || [];
  let settings = db.consultationSettings.find((s) => s.lawyerId === lawyerId);
  if (!settings) {
    const lawyer = db.lawyers.find((l) => l.id === lawyerId);
    settings = {
      lawyerId,
      fee: 1500,
      currency: 'INR',
      availableModes: ['ONLINE', 'IN_PERSON'],
      bookingLeadTime: 2,
      workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
      workingHours: { start: '10:00', end: '18:00' },
      blockedDates: [],
      officeLocation: `${lawyer?.city || 'District'} Court Chambers`,
    };
    db.consultationSettings.push(settings);
    commit();
  }
  return clone(settings);
}

export async function updateConsultationSettings(lawyerId, patch) {
  await delay(250);
  const db = getDb();
  db.consultationSettings = db.consultationSettings || [];
  let settings = db.consultationSettings.find((s) => s.lawyerId === lawyerId);
  if (!settings) {
    settings = await getConsultationSettings(lawyerId);
    db.consultationSettings.push(settings);
  }

  if (patch.fee !== undefined) {
    const fee = Number(patch.fee);
    if (Number.isNaN(fee) || fee < 200 || fee > 100000) {
      throw new ServiceError('Consultation fee must be between ₹200 and ₹1,00,000.');
    }
    settings.fee = fee;
  }
  if (patch.availableModes !== undefined) {
    if (!Array.isArray(patch.availableModes) || patch.availableModes.length === 0) {
      throw new ServiceError('Select at least one consultation mode (Online or In-Person).');
    }
    settings.availableModes = [...patch.availableModes];
  }
  if (patch.bookingLeadTime !== undefined) {
    settings.bookingLeadTime = Math.max(0, Number(patch.bookingLeadTime) || 0);
  }
  if (patch.workingDays !== undefined) {
    if (!patch.workingDays.length) throw new ServiceError('Select at least one working weekday.');
    settings.workingDays = [...patch.workingDays];
  }
  if (patch.workingHours !== undefined) {
    settings.workingHours = { ...settings.workingHours, ...patch.workingHours };
  }
  if (patch.blockedDates !== undefined) {
    settings.blockedDates = [...patch.blockedDates];
  }
  if (patch.officeLocation !== undefined) {
    settings.officeLocation = patch.officeLocation.trim();
  }

  commit();
  return clone(settings);
}

export async function getLawyerSlots(lawyerId, { date } = {}) {
  await delay(150);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  const settings = (db.consultationSettings || []).find((s) => s.lawyerId === lawyerId);
  const blocked = new Set(settings?.blockedDates || []);

  const slots = (db.availabilitySlots || [])
    .filter((s) => s.lawyerId === lawyerId && (!date || s.date === date))
    .map((s) => {
      const effectiveStatus = blocked.has(s.date) && s.status === SLOT_STATUS.AVAILABLE
        ? SLOT_STATUS.UNAVAILABLE
        : s.status;
      return { ...clone(s), status: effectiveStatus };
    })
    .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`));

  return slots;
}

export async function addOneHourSlot(lawyerId, { date, startTime }) {
  await delay(200);
  if (!date || !startTime) throw new ServiceError('Date and start time are required.');
  const endTime = addOneHour(startTime);
  const db = getDb();
  db.availabilitySlots = db.availabilitySlots || [];

  const settings = (db.consultationSettings || []).find((s) => s.lawyerId === lawyerId);
  if (settings?.blockedDates?.includes(date)) {
    throw new ServiceError(`${formatFullDate(date)} is currently marked as a blocked holiday/leave date. Unblock it first.`);
  }

  // Prevent overlapping 60-minute slots on the same date for this lawyer
  const existingOnDate = db.availabilitySlots.filter((s) => s.lawyerId === lawyerId && s.date === date);
  const overlaps = existingOnDate.some(
    (s) => startTime < s.endTime && endTime > s.startTime,
  );
  if (overlaps) {
    throw new ServiceError(`Overlapping slot: you already have a slot between ${formatSlotRange(startTime, endTime)} on ${formatFullDate(date)}.`);
  }

  const slot = {
    id: `slot_${lawyerId}_${date}_${startTime.replace(':', '')}`,
    lawyerId,
    date,
    startTime,
    endTime,
    timezone: 'Asia/Kolkata',
    status: SLOT_STATUS.AVAILABLE,
    reservedUntil: null,
    bookingId: null,
  };
  db.availabilitySlots.push(slot);
  commit();
  return clone(slot);
}

const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export async function generateBulkOneHourSlots(lawyerId, { date, startHour = 10, endHour = 17, skipBreakHour = 13 }) {
  await delay(250);
  if (!date) throw new ServiceError('Select a date to generate slots.');
  const start = Number(startHour);
  const end = Number(endHour);
  if (Number.isNaN(start) || Number.isNaN(end) || start >= end || start < 6 || end > 22) {
    throw new ServiceError('Working hours must be between 06:00 and 22:00 with start before end.');
  }

  const db = getDb();
  const settings = (db.consultationSettings || []).find((s) => s.lawyerId === lawyerId);
  if (settings?.blockedDates?.includes(date)) {
    throw new ServiceError(`${formatFullDate(date)} is blocked for leave. Unblock the date before generating slots.`);
  }

  const dObj = new Date(`${date}T00:00:00`);
  const dayCode = DAY_CODES[dObj.getDay()];
  if (settings?.workingDays?.length && !settings.workingDays.includes(dayCode)) {
    throw new ServiceError(`${dayCode} is not enabled in your working weekdays. Enable it in Consultation Settings or add an individual slot.`);
  }

  db.availabilitySlots = db.availabilitySlots || [];
  const existingOnDate = db.availabilitySlots.filter((s) => s.lawyerId === lawyerId && s.date === date);
  const created = [];

  for (let h = start; h < end; h += 1) {
    if (skipBreakHour && h === Number(skipBreakHour)) continue;
    const startTime = `${String(h).padStart(2, '0')}:00`;
    const endTime = `${String(h + 1).padStart(2, '0')}:00`;
    const overlaps = existingOnDate.some((s) => startTime < s.endTime && endTime > s.startTime);
    if (!overlaps) {
      const slot = {
        id: `slot_${lawyerId}_${date}_${startTime.replace(':', '')}`,
        lawyerId,
        date,
        startTime,
        endTime,
        timezone: 'Asia/Kolkata',
        status: SLOT_STATUS.AVAILABLE,
        reservedUntil: null,
        bookingId: null,
      };
      db.availabilitySlots.push(slot);
      existingOnDate.push(slot);
      created.push(slot);
    }
  }

  if (created.length === 0) {
    throw new ServiceError('All 1-hour slots in that time range already exist for this date.');
  }

  commit();
  return clone(created);
}

export async function removeAvailableSlot(lawyerId, slotId) {
  await delay(180);
  const db = getDb();
  const slot = (db.availabilitySlots || []).find((s) => s.id === slotId && s.lawyerId === lawyerId);
  if (!slot) throw new ServiceError('Time slot not found.', 404);
  if (![SLOT_STATUS.AVAILABLE, SLOT_STATUS.UNAVAILABLE].includes(slot.status)) {
    throw new ServiceError('Cannot remove a slot that is currently reserved, awaiting approval, or confirmed.');
  }
  db.availabilitySlots = db.availabilitySlots.filter((s) => s.id !== slotId);
  commit();
  return true;
}

export async function toggleBlockedDate(lawyerId, date) {
  await delay(200);
  if (!date) throw new ServiceError('Select a valid date.');
  const db = getDb();
  const settings = await getConsultationSettings(lawyerId);
  const target = db.consultationSettings.find((s) => s.lawyerId === lawyerId);
  const blocked = new Set(target.blockedDates || []);

  if (blocked.has(date)) {
    blocked.delete(date);
    // Restore UNAVAILABLE slots on that date back to AVAILABLE if no booking is attached
    (db.availabilitySlots || []).forEach((s) => {
      if (s.lawyerId === lawyerId && s.date === date && s.status === SLOT_STATUS.UNAVAILABLE && !s.bookingId) {
        s.status = SLOT_STATUS.AVAILABLE;
      }
    });
  } else {
    const activeOnDate = (db.availabilitySlots || []).some(
      (s) =>
        s.lawyerId === lawyerId &&
        s.date === date &&
        [SLOT_STATUS.RESERVED, SLOT_STATUS.AWAITING_APPROVAL, SLOT_STATUS.PROPOSED, SLOT_STATUS.CONFIRMED].includes(s.status),
    );
    if (activeOnDate) {
      throw new ServiceError('Cannot block this date because it has a reserved, pending or confirmed consultation.');
    }
    blocked.add(date);
    (db.availabilitySlots || []).forEach((s) => {
      if (s.lawyerId === lawyerId && s.date === date && s.status === SLOT_STATUS.AVAILABLE) {
        s.status = SLOT_STATUS.UNAVAILABLE;
      }
    });
  }

  target.blockedDates = [...blocked].sort();
  commit();
  return clone(target);
}

/* ---------- Client Slot Reservation & Booking Creation ---------- */

export async function reserveSlotForBooking({ clientId, lawyerId, slotId, mode, clientNotes = '' }) {
  enforceRateLimit('mutation', clientId || 'booking');
  requireOwnership(clientId, ['client']);

  if (typeof clientNotes === 'string' && containsInjection(clientNotes)) {
    throw new ServiceError('Consultation notes contain disallowed HTML or script tags.', 400);
  }
  const cleanNotes = sanitizeString(String(clientNotes ?? ''), { maxLength: 1000 });

  await delay(300);
  collectAndReleaseExpiredHoldsSync();

  const db = getDb();
  const lawyer = db.lawyers.find((l) => l.id === lawyerId);
  if (!lawyer) throw new ServiceError('Lawyer not found.', 404);

  const settings = (db.consultationSettings || []).find((s) => s.lawyerId === lawyerId);
  const availableModes = settings?.availableModes || ['ONLINE', 'IN_PERSON'];
  if (!availableModes.includes(mode)) {
    throw new ServiceError(`This lawyer does not currently offer ${mode} consultations.`);
  }

  const slot = (db.availabilitySlots || []).find((s) => s.id === slotId && s.lawyerId === lawyerId);
  if (!slot) throw new ServiceError('Selected time slot does not exist.', 404);
  if (slot.date < getTodayInTimeZone('Asia/Kolkata')) {
    throw new ServiceError('Past consultation dates cannot be booked. Please choose a future date.');
  }
  if (settings?.blockedDates?.includes(slot.date)) {
    throw new ServiceError('This date is blocked by the lawyer.');
  }
  if (slot.status !== SLOT_STATUS.AVAILABLE) {
    throw new ServiceError('This 1-hour slot is no longer available. Please choose another time slot.', 409);
  }

  const nowIso = new Date().toISOString();
  const holdExpiresAt = new Date(Date.now() + HOLD_DURATION_MS).toISOString();
  const bookingId = uid('bk');
  const activeMembership = activeMembershipForLawyer(db, lawyerId);

  const fee = settings?.fee ?? 1500;
  const totalAmount = fee; // Frozen payable quote for this payment attempt

  // Temporarily reserve the slot for 10 minutes
  slot.status = SLOT_STATUS.RESERVED;
  slot.reservedUntil = holdExpiresAt;
  slot.bookingId = bookingId;

  const booking = {
    id: bookingId,
    clientId,
    lawyerId,
    firmId: activeMembership?.firmId || null,
    originalSlotId: slot.id,
    finalSlotId: slot.id,
    mode,
    consultationFee: fee,
    platformFee: 0,
    taxAmount: 0,
    totalAmount,
    currency: settings?.currency || 'INR',
    bookingStatus: BOOKING_STATUS.PAYMENT_PENDING,
    paymentId: null,
    responseDeadline: null,
    holdExpiresAt,
    clientNotes: cleanNotes,
    meetingLink: null,
    officeLocation: settings?.officeLocation || `${lawyer.city} Chambers`,
    timeline: [
      {
        step: 'SLOT_SELECTED',
        label: `1-Hour Slot Reserved (${formatFullDate(slot.date)}, ${formatSlotRange(slot.startTime, slot.endTime)}) — 10-min payment hold active`,
        at: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  db.bookings = db.bookings || [];
  db.bookings.unshift(booking);
  commit();
  return enrichBooking(db, booking);
}

/* ---------- State Transitions Invoked by Workflow Coordinator ---------- */

export function finalizeBookingAfterPaymentSync(bookingId, payment, { forceExpiredHold = false } = {}) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);

  booking.paymentId = payment.id;
  const slot = (db.availabilitySlots || []).find((s) => s.id === booking.originalSlotId);
  const nowMs = Date.now();
  const holdExpired =
    forceExpiredHold ||
    booking.bookingStatus === BOOKING_STATUS.EXPIRED ||
    (booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() <= nowMs) ||
    !slot ||
    (slot.bookingId && slot.bookingId !== booking.id);

  const nowIso = new Date().toISOString();

  // Late payment after hold expiration -> do not assign occupied/expired slot; trigger refund recovery
  if (holdExpired) {
    if (slot && slot.bookingId === booking.id && slot.status === SLOT_STATUS.RESERVED) {
      slot.status = SLOT_STATUS.AVAILABLE;
      slot.reservedUntil = null;
      slot.bookingId = null;
    }
    assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.REFUND_PENDING);
    booking.bookingStatus = BOOKING_STATUS.REFUND_PENDING;
    booking.holdExpiresAt = null;
    booking.updatedAt = nowIso;
    booking.timeline.push({
      step: 'LATE_PAYMENT_RECOVERY',
      label: `Payment (${payment.transactionReference}) arrived after temporary slot hold expired — automatic full refund initiated`,
      at: nowIso,
    });
    commit();
    return { latePayment: true, booking: enrichBooking(db, booking) };
  }

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.AWAITING_LAWYER);
  booking.bookingStatus = BOOKING_STATUS.AWAITING_LAWYER;
  booking.holdExpiresAt = null;
  booking.responseDeadline = computeDeadline(LAWYER_RESPONSE_MS, slot);
  booking.updatedAt = nowIso;

  slot.status = SLOT_STATUS.AWAITING_APPROVAL;
  slot.reservedUntil = null;
  slot.bookingId = booking.id;

  booking.timeline.push(
    {
      step: 'PAYMENT_SUCCESS',
      label: `Payment Successful (₹${payment.amount.toLocaleString('en-IN')} · ${payment.transactionReference})`,
      at: payment.paidAt || nowIso,
    },
    {
      step: 'AWAITING_LAWYER',
      label: 'Booking Request Submitted — Awaiting Lawyer Approval',
      at: nowIso,
    },
  );

  commit();
  return { latePayment: false, booking: enrichBooking(db, booking) };
}

export function releaseSlotOnPaymentFailureSync(bookingId, reason = 'Payment failed') {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);

  const slot = (db.availabilitySlots || []).find((s) => s.id === booking.originalSlotId);
  if (slot && slot.bookingId === booking.id && slot.status === SLOT_STATUS.RESERVED) {
    slot.status = SLOT_STATUS.AVAILABLE;
    slot.reservedUntil = null;
    slot.bookingId = null;
  }

  const nowIso = new Date().toISOString();
  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.EXPIRED);
  booking.bookingStatus = BOOKING_STATUS.EXPIRED;
  booking.holdExpiresAt = null;
  booking.updatedAt = nowIso;
  booking.timeline.push({
    step: 'PAYMENT_FAILED',
    label: `${reason} — Temporary slot reservation released`,
    at: nowIso,
  });

  commit();
  return enrichBooking(db, booking);
}

export function acceptBookingSync(bookingId, lawyerId) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking request not found.', 404);
  if (booking.lawyerId !== lawyerId) {
    throw new ServiceError('Only the lawyer associated with this booking can approve it.', 403);
  }
  if (booking.bookingStatus !== BOOKING_STATUS.AWAITING_LAWYER) {
    throw new ServiceError(`Cannot accept a booking in ${booking.bookingStatus} status.`, 400);
  }

  const slot = (db.availabilitySlots || []).find((s) => s.id === booking.finalSlotId);
  if (!slot || (slot.bookingId && slot.bookingId !== booking.id)) {
    throw new ServiceError('The reserved time slot is no longer valid.', 409);
  }

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.CONFIRMED);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = BOOKING_STATUS.CONFIRMED;
  booking.responseDeadline = null;
  booking.updatedAt = nowIso;
  if (booking.mode === 'ONLINE' && !booking.meetingLink) {
    booking.meetingLink = `https://meet.legaleagle.example.com/session-${booking.id}`;
  }

  slot.status = SLOT_STATUS.CONFIRMED;
  slot.bookingId = booking.id;

  const lawyer = db.lawyers.find((l) => l.id === lawyerId);
  booking.timeline.push({
    step: 'BOOKING_CONFIRMED',
    label: `Appointment Confirmed by ${lawyer?.name || 'Lawyer'} for ${formatFullDate(slot.date)}, ${formatSlotRange(slot.startTime, slot.endTime)}`,
    at: nowIso,
  });

  commit();
  return enrichBooking(db, booking);
}

export function proposeRescheduleSync(bookingId, lawyerId, { proposedSlotId, reason = '' }) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking request not found.', 404);
  if (booking.lawyerId !== lawyerId) {
    throw new ServiceError('Only the lawyer associated with this booking can propose a reschedule.', 403);
  }
  if (booking.bookingStatus !== BOOKING_STATUS.AWAITING_LAWYER) {
    throw new ServiceError(`Cannot propose a reschedule when booking is in ${booking.bookingStatus} status.`, 400);
  }
  if (!proposedSlotId || proposedSlotId === booking.originalSlotId) {
    throw new ServiceError('Please choose a different available 1-hour slot to propose.');
  }

  const proposedSlot = (db.availabilitySlots || []).find(
    (s) => s.id === proposedSlotId && s.lawyerId === lawyerId,
  );
  if (!proposedSlot || proposedSlot.status !== SLOT_STATUS.AVAILABLE) {
    throw new ServiceError('The selected alternative slot is not available.', 409);
  }
  if (proposedSlot.date < getTodayInTimeZone('Asia/Kolkata')) {
    throw new ServiceError('Past consultation dates cannot be proposed. Please choose a future date.');
  }

  const originalSlot = (db.availabilitySlots || []).find((s) => s.id === booking.originalSlotId);

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.RESCHEDULE_PROPOSED);

  const nowIso = new Date().toISOString();
  const expiresAt = computeDeadline(CLIENT_RESPONSE_MS, proposedSlot);

  // Atomically reserve the proposed slot and release the original pending slot
  proposedSlot.status = SLOT_STATUS.PROPOSED;
  proposedSlot.bookingId = booking.id;
  proposedSlot.reservedUntil = expiresAt;

  if (originalSlot && originalSlot.bookingId === booking.id) {
    originalSlot.status = SLOT_STATUS.AVAILABLE;
    originalSlot.bookingId = null;
    originalSlot.reservedUntil = null;
  }

  db.rescheduleProposals = db.rescheduleProposals || [];
  const proposal = {
    id: uid('prop'),
    bookingId: booking.id,
    lawyerId,
    originalSlotId: booking.originalSlotId,
    proposedSlotId: proposedSlot.id,
    reason: reason.trim() || 'Unfortunately, I am unavailable at the originally requested time. Please consider this alternative slot.',
    status: 'PENDING',
    expiresAt,
    createdAt: nowIso,
  };
  db.rescheduleProposals.unshift(proposal);

  booking.bookingStatus = BOOKING_STATUS.RESCHEDULE_PROPOSED;
  booking.finalSlotId = proposedSlot.id;
  booking.responseDeadline = expiresAt;
  booking.updatedAt = nowIso;
  booking.timeline.push({
    step: 'RESCHEDULE_PROPOSED',
    label: `Lawyer Proposed New Slot: ${formatFullDate(proposedSlot.date)}, ${formatSlotRange(proposedSlot.startTime, proposedSlot.endTime)}`,
    at: nowIso,
  });

  commit();
  return enrichBooking(db, booking);
}

export function acceptRescheduleSync(bookingId, clientId) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);
  if (booking.clientId !== clientId) {
    throw new ServiceError('Only the client who created this booking can respond to the proposal.', 403);
  }
  if (booking.bookingStatus !== BOOKING_STATUS.RESCHEDULE_PROPOSED) {
    throw new ServiceError(`Cannot accept a reschedule proposal when booking status is ${booking.bookingStatus}.`, 400);
  }

  const proposal = (db.rescheduleProposals || []).find(
    (p) => p.bookingId === bookingId && p.status === 'PENDING',
  );
  if (!proposal) throw new ServiceError('Active reschedule proposal not found.', 404);
  if (proposal.expiresAt && new Date(proposal.expiresAt).getTime() <= Date.now()) {
    throw new ServiceError('This reschedule proposal has expired.', 400);
  }

  const proposedSlot = (db.availabilitySlots || []).find((s) => s.id === proposal.proposedSlotId);
  if (!proposedSlot || (proposedSlot.bookingId && proposedSlot.bookingId !== booking.id)) {
    throw new ServiceError('The proposed slot is no longer reserved for this booking.', 409);
  }

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.CONFIRMED);
  const nowIso = new Date().toISOString();

  proposal.status = 'ACCEPTED';
  proposedSlot.status = SLOT_STATUS.CONFIRMED;
  proposedSlot.bookingId = booking.id;
  proposedSlot.reservedUntil = null;

  booking.finalSlotId = proposedSlot.id;
  booking.bookingStatus = BOOKING_STATUS.CONFIRMED;
  booking.responseDeadline = null;
  booking.updatedAt = nowIso;
  if (booking.mode === 'ONLINE' && !booking.meetingLink) {
    booking.meetingLink = `https://meet.legaleagle.example.com/session-${booking.id}`;
  }

  booking.timeline.push(
    {
      step: 'RESCHEDULE_ACCEPTED',
      label: `Client Accepted Proposed Time (${formatFullDate(proposedSlot.date)}, ${formatSlotRange(proposedSlot.startTime, proposedSlot.endTime)})`,
      at: nowIso,
    },
    {
      step: 'BOOKING_CONFIRMED',
      label: 'Rescheduled Consultation Confirmed (No additional payment required)',
      at: nowIso,
    },
  );

  commit();
  return enrichBooking(db, booking);
}

export function rejectRescheduleSync(bookingId, clientId) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);
  if (booking.clientId !== clientId) {
    throw new ServiceError('Only the client who created this booking can reject the proposal.', 403);
  }
  if (booking.bookingStatus !== BOOKING_STATUS.RESCHEDULE_PROPOSED) {
    throw new ServiceError(`Cannot reject reschedule when booking status is ${booking.bookingStatus}.`, 400);
  }

  const proposal = (db.rescheduleProposals || []).find(
    (p) => p.bookingId === bookingId && p.status === 'PENDING',
  );
  if (proposal) {
    proposal.status = 'REJECTED';
    const proposedSlot = (db.availabilitySlots || []).find((s) => s.id === proposal.proposedSlotId);
    if (proposedSlot && proposedSlot.bookingId === booking.id) {
      proposedSlot.status = SLOT_STATUS.AVAILABLE;
      proposedSlot.bookingId = null;
      proposedSlot.reservedUntil = null;
    }
  }

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.REFUND_PENDING);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = BOOKING_STATUS.REFUND_PENDING;
  booking.responseDeadline = null;
  booking.updatedAt = nowIso;
  booking.timeline.push({
    step: 'RESCHEDULE_REJECTED',
    label: 'Client Rejected Proposed Time — Booking Closed & Full Refund Requested',
    at: nowIso,
  });

  commit();
  return enrichBooking(db, booking);
}

export function declineBookingSync(bookingId, lawyerId, reason = '') {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);
  if (booking.lawyerId !== lawyerId) {
    throw new ServiceError('Only the lawyer associated with this booking can decline it.', 403);
  }
  if (booking.bookingStatus !== BOOKING_STATUS.AWAITING_LAWYER) {
    throw new ServiceError(`Cannot decline a booking in ${booking.bookingStatus} status.`, 400);
  }

  const slot = (db.availabilitySlots || []).find((s) => s.id === booking.originalSlotId);
  if (slot && slot.bookingId === booking.id) {
    slot.status = SLOT_STATUS.AVAILABLE;
    slot.bookingId = null;
    slot.reservedUntil = null;
  }

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.DECLINED);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = BOOKING_STATUS.DECLINED;
  booking.responseDeadline = null;
  booking.updatedAt = nowIso;
  booking.declineReason = reason.trim() || 'Lawyer unavailable for the requested consultation window.';
  booking.timeline.push({
    step: 'BOOKING_DECLINED',
    label: `Declined by Lawyer (${booking.declineReason})`,
    at: nowIso,
  });

  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.REFUND_PENDING);
  booking.bookingStatus = BOOKING_STATUS.REFUND_PENDING;

  commit();
  return enrichBooking(db, booking);
}

export function expireBookingSync(bookingId, reason = 'Response deadline expired') {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);

  if (![BOOKING_STATUS.AWAITING_LAWYER, BOOKING_STATUS.RESCHEDULE_PROPOSED, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.bookingStatus)) {
    throw new ServiceError(`Booking in ${booking.bookingStatus} status cannot expire.`, 400);
  }

  // Release any held or proposed slots associated with this booking
  (db.availabilitySlots || []).forEach((s) => {
    if (s.bookingId === booking.id && s.status !== SLOT_STATUS.CONFIRMED) {
      s.status = SLOT_STATUS.AVAILABLE;
      s.bookingId = null;
      s.reservedUntil = null;
    }
  });

  const proposal = (db.rescheduleProposals || []).find(
    (p) => p.bookingId === bookingId && p.status === 'PENDING',
  );
  if (proposal) proposal.status = 'EXPIRED';

  const wasPaid = booking.bookingStatus !== BOOKING_STATUS.PAYMENT_PENDING;
  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.EXPIRED);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = BOOKING_STATUS.EXPIRED;
  booking.responseDeadline = null;
  booking.holdExpiresAt = null;
  booking.updatedAt = nowIso;
  booking.timeline.push({
    step: 'BOOKING_EXPIRED',
    label: `${reason} — Reserved slot released`,
    at: nowIso,
  });

  if (wasPaid) {
    assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.REFUND_PENDING);
    booking.bookingStatus = BOOKING_STATUS.REFUND_PENDING;
  }

  commit();
  return { wasPaid, booking: enrichBooking(db, booking) };
}

export function attachRefundInitiatedTimelineSync(bookingId, refund) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) return null;
  booking.timeline.push({
    step: 'REFUND_INITIATED',
    label: `Full Refund Initiated (₹${refund.amount.toLocaleString('en-IN')})`,
    at: refund.initiatedAt,
  });
  commit();
  return enrichBooking(db, booking);
}

export function markBookingRefundedSync(bookingId, refund) {
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);

  if (booking.bookingStatus !== BOOKING_STATUS.REFUNDED) {
    assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.REFUNDED);
    booking.bookingStatus = BOOKING_STATUS.REFUNDED;
  }
  booking.updatedAt = refund.completedAt || new Date().toISOString();
  booking.timeline.push({
    step: 'REFUND_COMPLETED',
    label: `Full Refund Completed (₹${refund.amount.toLocaleString('en-IN')} credited to original payment method)`,
    at: booking.updatedAt,
  });

  commit();
  return enrichBooking(db, booking);
}

export async function markBookingCompleted(bookingId, lawyerId) {
  await delay(250);
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Booking not found.', 404);
  if (lawyerId && booking.lawyerId !== lawyerId) {
    throw new ServiceError('Only the assigned lawyer can mark this consultation completed.', 403);
  }
  assertBookingTransition(booking.bookingStatus, BOOKING_STATUS.COMPLETED);
  const nowIso = new Date().toISOString();
  booking.bookingStatus = BOOKING_STATUS.COMPLETED;
  booking.updatedAt = nowIso;
  booking.timeline.push({
    step: 'COMPLETED',
    label: 'Consultation Completed',
    at: nowIso,
  });
  commit();
  return enrichBooking(db, booking);
}

/* ---------- Queries ---------- */

export async function getBookingById(bookingId) {
  await delay(150);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  const booking = (db.bookings || []).find((b) => b.id === bookingId);
  if (!booking) throw new ServiceError('Consultation booking not found.', 404);
  return enrichBooking(db, booking);
}

export async function getClientBookings(clientId) {
  await delay(200);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  return (db.bookings || [])
    .filter((b) => b.clientId === clientId)
    .map((b) => enrichBooking(db, b))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function getLawyerBookings(lawyerId) {
  await delay(200);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  return (db.bookings || [])
    .filter((b) => b.lawyerId === lawyerId && b.bookingStatus !== BOOKING_STATUS.PAYMENT_PENDING)
    .map((b) => enrichBooking(db, b))
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

export async function getSharedCalendarBookings() {
  await delay(150);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  return (db.bookings || [])
    .filter((booking) => booking.bookingStatus === BOOKING_STATUS.CONFIRMED)
    .map((booking) => enrichBooking(db, booking))
    .filter((booking) => booking.finalSlot)
    .sort((a, b) => {
      const aStart = `${a.finalSlot.date}T${a.finalSlot.startTime}`;
      const bStart = `${b.finalSlot.date}T${b.finalSlot.startTime}`;
      return aStart.localeCompare(bStart);
    });
}

/**
 * Firm Consultations Overview.
 * Uses only active firm memberships. Exposes aggregate counts and schedule
 * status by affiliated lawyer — does NOT expose confidential client notes or
 * allow firm administrators to modify individual lawyers' bookings.
 */
export async function getFirmConsultationsOverview(firmId) {
  await delay(250);
  collectAndReleaseExpiredHoldsSync();
  const db = getDb();
  const memberIds = activeMemberIds(db, firmId);
  const memberSet = new Set(memberIds);

  const relevantBookings = (db.bookings || []).filter(
    (b) => memberSet.has(b.lawyerId) && b.bookingStatus !== BOOKING_STATUS.PAYMENT_PENDING,
  );

  const awaitingCount = relevantBookings.filter(
    (b) => b.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER || b.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED,
  ).length;
  const confirmedCount = relevantBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED).length;
  const completedCount = relevantBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.COMPLETED).length;

  const byLawyer = memberIds
    .map((lid) => {
      const lawyer = db.lawyers.find((l) => l.id === lid);
      if (!lawyer) return null;
      const lBookings = relevantBookings.filter((b) => b.lawyerId === lid);
      return {
        lawyer: lawyerSummary(db, lawyer),
        awaitingApproval: lBookings.filter(
          (b) => b.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER || b.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED,
        ).length,
        confirmed: lBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED).length,
        completed: lBookings.filter((b) => b.bookingStatus === BOOKING_STATUS.COMPLETED).length,
        total: lBookings.length,
      };
    })
    .filter(Boolean);

  return {
    upcomingConsultations: confirmedCount,
    awaitingApprovalBookings: awaitingCount,
    confirmedBookings: confirmedCount,
    completedBookings: completedCount,
    totalConsultations: relevantBookings.length,
    byLawyer,
  };
}
