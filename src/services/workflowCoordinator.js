import { delay } from './mockDb';
import { NOTIFICATION_TYPE } from './bookingStateMachine';
import * as bookingService from './bookingService';
import * as paymentService from './paymentService';
import {
  createNotificationSync,
  resolveUserIdByProfile,
} from './notificationService';
import { formatFullDate, formatINR, formatSlotRange } from '../utils/format';

/**
 * Shared Workflow Coordinator connecting:
 *  - Module A: Consultation Booking (`bookingService.js`)
 *  - Module B: Payments & Refunds (`paymentService.js`)
 *  - Module C: Notifications (`notificationService.js`)
 *
 * Ensures clean separation of concerns without duplicating business logic.
 */

export async function initiateConsultationCheckout({ clientId, lawyerId, slotId, mode, clientNotes }) {
  const booking = await bookingService.reserveSlotForBooking({
    clientId,
    lawyerId,
    slotId,
    mode,
    clientNotes,
  });
  const payment = await paymentService.createPaymentAttempt({
    bookingId: booking.id,
    clientId,
    lawyerId,
    amount: booking.totalAmount,
    currency: booking.currency,
  });
  const refreshed = await bookingService.getBookingById(booking.id);
  return { booking: refreshed, payment };
}

export async function processPaymentSuccess(bookingId, { simulateExpiredHold = false } = {}) {
  const payment = await paymentService.simulatePaymentSuccess(bookingId);
  const { latePayment, booking } = bookingService.finalizeBookingAfterPaymentSync(bookingId, payment, {
    forceExpiredHold: simulateExpiredHold,
  });

  const clientUserId = resolveUserIdByProfile('client', booking.clientId);
  const lawyerUserId = resolveUserIdByProfile('lawyer', booking.lawyerId);

  if (latePayment) {
    const refund = paymentService.initiateRefundSync(
      bookingId,
      'Payment verification arrived after the 10-minute slot reservation expired. Full refund initiated automatically.',
    );
    const updatedBooking = bookingService.attachRefundInitiatedTimelineSync(bookingId, refund);
    createNotificationSync({
      recipientId: clientUserId,
      bookingId: booking.id,
      type: NOTIFICATION_TYPE.REFUND_INITIATED,
      title: 'Slot Hold Expired — Full Refund Initiated',
      message: `Your payment (${payment.transactionReference}) arrived after the 10-minute slot reservation expired. The slot was not assigned and a full refund of ${formatINR(refund.amount)} has been initiated.`,
    });
    return { booking: updatedBooking, payment, refund, latePayment: true };
  }

  const slot = booking.originalSlot;
  const dateText = slot ? `${formatFullDate(slot.date)} from ${formatSlotRange(slot.startTime, slot.endTime)}` : '';

  // Notify Client: Payment Successful (Awaiting Lawyer Approval — never "Confirmed")
  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.PAYMENT_SUCCESS,
    title: 'Payment Successful — Awaiting Lawyer Approval',
    message: `Payment of ${formatINR(payment.amount)} (${payment.transactionReference}) received for your consultation request with ${booking.lawyer?.name || 'your lawyer'} on ${dateText}. Your consultation is awaiting lawyer approval.`,
  });

  // Notify Lawyer: New Consultation Request
  createNotificationSync({
    recipientId: lawyerUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.NEW_BOOKING_REQUEST,
    title: 'New Consultation Request',
    message: `${booking.client?.name || 'A client'} has requested a one-hour consultation on ${dateText}. Payment of ${formatINR(payment.amount)} has been received and the request is awaiting your response.`,
  });

  return { booking, payment, latePayment: false };
}

export async function processPaymentFailure(bookingId, reason = 'Simulated payment gateway decline.') {
  const payment = await paymentService.simulatePaymentFailure(bookingId, reason);
  const booking = bookingService.releaseSlotOnPaymentFailureSync(bookingId, reason);
  const clientUserId = resolveUserIdByProfile('client', booking.clientId);

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.PAYMENT_FAILED,
    title: 'Payment Failed — Slot Hold Released',
    message: `Payment for booking ${booking.id} could not be completed (${reason}). Your temporary slot hold has been released. You may select an available slot and try again.`,
  });

  return { booking, payment };
}

export async function processPaymentCancelled(bookingId) {
  const payment = await paymentService.simulatePaymentFailure(bookingId, 'Payment cancelled by client at checkout.');
  const booking = bookingService.releaseSlotOnPaymentFailureSync(bookingId, 'Checkout cancelled by client');
  return { booking, payment };
}

export async function processLawyerAcceptBooking(bookingId, lawyerId) {
  await delay(300);
  const booking = bookingService.acceptBookingSync(bookingId, lawyerId);
  const clientUserId = resolveUserIdByProfile('client', booking.clientId);
  const slot = booking.finalSlot || booking.originalSlot;

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
    title: 'Consultation Confirmed',
    message: `Your consultation with ${booking.lawyer?.name || 'Advocate'} is confirmed for ${formatFullDate(slot.date)}, from ${formatSlotRange(slot.startTime, slot.endTime)}.`,
  });

  return booking;
}

export async function processLawyerProposeReschedule(bookingId, lawyerId, { proposedSlotId, reason }) {
  await delay(350);
  const booking = bookingService.proposeRescheduleSync(bookingId, lawyerId, { proposedSlotId, reason });
  const clientUserId = resolveUserIdByProfile('client', booking.clientId);
  const propSlot = booking.proposal?.proposedSlot || booking.finalSlot;

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.RESCHEDULE_PROPOSED,
    title: 'Your lawyer has proposed a new consultation time',
    message: `${booking.lawyer?.name || 'Your lawyer'} proposed ${formatFullDate(propSlot.date)}, ${formatSlotRange(propSlot.startTime, propSlot.endTime)} for booking ${booking.id}. Accept the new time or reject it for a full refund.`,
  });

  return booking;
}

export async function processClientAcceptReschedule(bookingId, clientId) {
  await delay(300);
  const booking = bookingService.acceptRescheduleSync(bookingId, clientId);
  const clientUserId = resolveUserIdByProfile('client', booking.clientId);
  const lawyerUserId = resolveUserIdByProfile('lawyer', booking.lawyerId);
  const slot = booking.finalSlot;

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.BOOKING_CONFIRMED,
    title: 'Rescheduled Consultation Confirmed',
    message: `Your consultation with ${booking.lawyer?.name || 'Advocate'} is confirmed for ${formatFullDate(slot.date)} from ${formatSlotRange(slot.startTime, slot.endTime)}. No additional payment was charged.`,
  });

  createNotificationSync({
    recipientId: lawyerUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.RESCHEDULE_ACCEPTED,
    title: 'Client Accepted Rescheduled Time',
    message: `${booking.client?.name || 'The client'} accepted your proposed consultation slot on ${formatFullDate(slot.date)} (${formatSlotRange(slot.startTime, slot.endTime)}). The appointment is now confirmed.`,
  });

  return booking;
}

export async function processClientRejectReschedule(bookingId, clientId) {
  await delay(350);
  const closedBooking = bookingService.rejectRescheduleSync(bookingId, clientId);
  const refund = paymentService.initiateRefundSync(
    bookingId,
    'Client rejected lawyer-proposed reschedule time — full refund initiated with zero deduction.',
  );
  const booking = bookingService.attachRefundInitiatedTimelineSync(bookingId, refund);

  const clientUserId = resolveUserIdByProfile('client', booking.clientId);
  const lawyerUserId = resolveUserIdByProfile('lawyer', booking.lawyerId);

  createNotificationSync({
    recipientId: lawyerUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.RESCHEDULE_REJECTED,
    title: 'Proposed Reschedule Rejected by Client',
    message: `${booking.client?.name || 'The client'} declined the proposed reschedule time for booking ${booking.id}. The booking has been closed and a full refund initiated.`,
  });

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.REFUND_INITIATED,
    title: 'Full Refund Initiated',
    message: `You rejected the proposed consultation time for booking ${booking.id}. A full refund of ${formatINR(refund.amount)} has been initiated.`,
  });

  return { booking, refund };
}

export async function processLawyerDeclineBooking(bookingId, lawyerId, reason = '') {
  await delay(350);
  const declinedBooking = bookingService.declineBookingSync(bookingId, lawyerId, reason);
  const refund = paymentService.initiateRefundSync(
    bookingId,
    `Lawyer declined booking request: ${declinedBooking.declineReason || 'Unavailable'}`,
  );
  const booking = bookingService.attachRefundInitiatedTimelineSync(bookingId, refund);

  const clientUserId = resolveUserIdByProfile('client', booking.clientId);

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.BOOKING_DECLINED,
    title: 'Consultation Request Declined — Full Refund Initiated',
    message: `${booking.lawyer?.name || 'The lawyer'} was unable to accept booking ${booking.id}. A full refund of ${formatINR(refund.amount)} has been initiated.`,
  });

  return { booking, refund };
}

export async function processRequestExpiration(bookingId, reason = 'Response deadline expired without action') {
  await delay(300);
  const { wasPaid, booking: expBooking } = bookingService.expireBookingSync(bookingId, reason);
  const clientUserId = resolveUserIdByProfile('client', expBooking.clientId);
  const lawyerUserId = resolveUserIdByProfile('lawyer', expBooking.lawyerId);

  let refund = null;
  let booking = expBooking;
  if (wasPaid) {
    refund = paymentService.initiateRefundSync(
      bookingId,
      `Booking expired (${reason}) — automatic full refund initiated.`,
    );
    booking = bookingService.attachRefundInitiatedTimelineSync(bookingId, refund);
  }

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.BOOKING_EXPIRED,
    title: 'Consultation Request Expired',
    message: wasPaid
      ? `Booking ${booking.id} expired because the response deadline passed. A full refund of ${formatINR(refund.amount)} has been initiated.`
      : `Your temporary slot reservation for booking ${booking.id} expired.`,
  });

  createNotificationSync({
    recipientId: lawyerUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.BOOKING_EXPIRED,
    title: 'Consultation Request Expired',
    message: `Booking ${booking.id} with ${booking.client?.name || 'client'} expired after the response deadline.`,
  });

  return { booking, refund };
}

export async function processRefundCompletion(refundIdOrBookingId) {
  const refund = await paymentService.simulateRefundCompletion(refundIdOrBookingId);
  const booking = bookingService.markBookingRefundedSync(refund.bookingId, refund);
  const clientUserId = resolveUserIdByProfile('client', booking.clientId);

  createNotificationSync({
    recipientId: clientUserId,
    bookingId: booking.id,
    type: NOTIFICATION_TYPE.REFUND_COMPLETED,
    title: 'Full Refund Completed',
    message: `Your refund of ${formatINR(refund.amount)} for booking ${booking.id} with ${booking.lawyer?.name || 'Advocate'} has been completed and credited.`,
  });

  return { booking, refund };
}

