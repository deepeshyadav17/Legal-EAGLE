import { getDb, commit, delay, clone, uid, ServiceError } from './mockDb';
import { PAYMENT_STATUS, assertPaymentTransition } from './bookingStateMachine';
import { lawyerSummary } from './selectors';

/**
 * Module B: Payments and Refunds Service (mock).
 * Responsible for:
 *  - Consultation payment initiation
 *  - Payment status & verification simulation
 *  - Transaction history
 *  - Payment failure handling
 *  - Refund initiation, processing simulation & completion status
 *
 * Architectural boundary:
 *  The Payment Module does NOT directly mutate lawyer availability calendars or
 *  appointment schedules. The Workflow Coordinator connects Payment outcomes to
 *  the Booking and Notification modules.
 *
 * Production note:
 *  Payment verification must happen server-side via signed payment gateway
 *  webhooks/callbacks, never trusted from client-side parameters.
 */

function genTxnRef() {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `TXN-LE-${num}`;
}

export function getPaymentByBookingIdSync(bookingId) {
  const db = getDb();
  return (db.payments || []).find((p) => p.bookingId === bookingId) || null;
}

export async function getPaymentByBookingId(bookingId) {
  await delay(150);
  const p = getPaymentByBookingIdSync(bookingId);
  return p ? clone(p) : null;
}

export async function createPaymentAttempt({ bookingId, clientId, lawyerId, amount, currency = 'INR' }) {
  await delay(200);
  const db = getDb();
  db.payments = db.payments || [];

  let payment = db.payments.find((p) => p.bookingId === bookingId);
  if (payment) {
    if (payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.REFUND_INITIATED || payment.status === PAYMENT_STATUS.REFUNDED) {
      throw new ServiceError('Payment has already been completed for this booking.', 409);
    }
    assertPaymentTransition(payment.status, PAYMENT_STATUS.PENDING);
    payment.status = PAYMENT_STATUS.PENDING;
    payment.amount = amount;
    commit();
    return clone(payment);
  }

  payment = {
    id: uid('pay'),
    bookingId,
    clientId,
    lawyerId,
    amount,
    currency,
    status: PAYMENT_STATUS.PENDING,
    transactionReference: null,
    paidAt: null,
    createdAt: new Date().toISOString(),
  };
  db.payments.unshift(payment);
  commit();
  return clone(payment);
}

export async function simulatePaymentSuccess(bookingId) {
  await delay(450);
  const db = getDb();
  db.payments = db.payments || [];
  const payment = db.payments.find((p) => p.bookingId === bookingId);
  if (!payment) throw new ServiceError('Payment attempt record not found.', 404);

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new ServiceError('This booking has already been paid. Duplicate payments are blocked.', 409);
  }
  assertPaymentTransition(payment.status, PAYMENT_STATUS.PAID);

  payment.status = PAYMENT_STATUS.PAID;
  payment.transactionReference = payment.transactionReference || genTxnRef();
  payment.paidAt = new Date().toISOString();
  commit();
  return clone(payment);
}

export async function simulatePaymentFailure(bookingId, reason = 'Simulated bank authorization decline.') {
  await delay(350);
  const db = getDb();
  const payment = (db.payments || []).find((p) => p.bookingId === bookingId);
  if (!payment) throw new ServiceError('Payment attempt record not found.', 404);

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new ServiceError('Cannot mark an already paid transaction as failed.', 409);
  }
  assertPaymentTransition(payment.status, PAYMENT_STATUS.FAILED);

  payment.status = PAYMENT_STATUS.FAILED;
  payment.failureReason = reason;
  commit();
  return clone(payment);
}

export function initiateRefundSync(bookingId, reason = 'Full refund initiated') {
  const db = getDb();
  db.refunds = db.refunds || [];
  const payment = (db.payments || []).find((p) => p.bookingId === bookingId);
  if (!payment || (payment.status !== PAYMENT_STATUS.PAID && payment.status !== PAYMENT_STATUS.REFUND_INITIATED)) {
    throw new ServiceError('Cannot refund an unpaid booking.', 400);
  }

  // Idempotency: return existing refund if already initiated for this payment
  const existing = db.refunds.find((r) => r.paymentId === payment.id || r.bookingId === bookingId);
  if (existing) {
    return clone(existing);
  }

  assertPaymentTransition(payment.status, PAYMENT_STATUS.REFUND_INITIATED);
  payment.status = PAYMENT_STATUS.REFUND_INITIATED;

  const refund = {
    id: uid('ref'),
    bookingId,
    paymentId: payment.id,
    clientId: payment.clientId,
    lawyerId: payment.lawyerId,
    amount: payment.amount, // Full refund of amount paid — no cancellation deduction
    currency: payment.currency || 'INR',
    reason,
    status: PAYMENT_STATUS.REFUND_INITIATED,
    initiatedAt: new Date().toISOString(),
    completedAt: null,
  };
  db.refunds.unshift(refund);
  commit();
  return clone(refund);
}

export async function initiateRefund(bookingId, reason) {
  await delay(300);
  return initiateRefundSync(bookingId, reason);
}

export async function simulateRefundCompletion(refundIdOrBookingId) {
  await delay(400);
  const db = getDb();
  db.refunds = db.refunds || [];
  const refund = db.refunds.find(
    (r) => r.id === refundIdOrBookingId || r.bookingId === refundIdOrBookingId,
  );
  if (!refund) throw new ServiceError('Refund record not found.', 404);

  if (refund.status === PAYMENT_STATUS.REFUNDED) {
    return clone(refund);
  }

  const payment = (db.payments || []).find((p) => p.id === refund.paymentId);
  if (payment) {
    assertPaymentTransition(payment.status, PAYMENT_STATUS.REFUNDED);
    payment.status = PAYMENT_STATUS.REFUNDED;
  }

  refund.status = PAYMENT_STATUS.REFUNDED;
  refund.completedAt = new Date().toISOString();
  commit();
  return clone(refund);
}

export async function getRefundStatus(bookingId) {
  await delay(150);
  const db = getDb();
  const refund = (db.refunds || []).find((r) => r.bookingId === bookingId);
  return refund ? clone(refund) : null;
}

export async function getPaymentHistory(clientId) {
  await delay(200);
  const db = getDb();
  const list = (db.payments || [])
    .filter((p) => p.clientId === clientId)
    .map((p) => {
      const lawyer = db.lawyers.find((l) => l.id === p.lawyerId);
      const refund = (db.refunds || []).find((r) => r.paymentId === p.id || r.bookingId === p.bookingId);
      const booking = (db.bookings || []).find((b) => b.id === p.bookingId);
      return {
        ...clone(p),
        lawyer: lawyer ? lawyerSummary(db, lawyer) : null,
        refund: refund ? clone(refund) : null,
        bookingStatus: booking?.bookingStatus || null,
      };
    })
    .sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
  return list;
}

export async function getClientRefunds(clientId) {
  await delay(200);
  const db = getDb();
  return (db.refunds || [])
    .filter((r) => r.clientId === clientId)
    .map((r) => {
      const lawyer = db.lawyers.find((l) => l.id === r.lawyerId);
      const payment = (db.payments || []).find((p) => p.id === r.paymentId);
      return {
        ...clone(r),
        lawyer: lawyer ? lawyerSummary(db, lawyer) : null,
        transactionReference: payment?.transactionReference || null,
      };
    })
    .sort((a, b) => (b.initiatedAt > a.initiatedAt ? 1 : -1));
}

