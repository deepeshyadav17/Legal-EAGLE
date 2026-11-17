import { ServiceError } from './mockDb';

/**
 * Central State Machine for Consultation Bookings, Payments, and Time Slots.
 * Rejects invalid transitions across Booking and Payment modules.
 */

export const BOOKING_STATUS = {
  DRAFT: 'DRAFT',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  AWAITING_LAWYER: 'AWAITING_LAWYER',
  RESCHEDULE_PROPOSED: 'RESCHEDULE_PROPOSED',
  CONFIRMED: 'CONFIRMED',
  COMPLETED: 'COMPLETED',
  DECLINED: 'DECLINED',
  EXPIRED: 'EXPIRED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
};

export const PAYMENT_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUND_INITIATED: 'REFUND_INITIATED',
  REFUNDED: 'REFUNDED',
};

export const SLOT_STATUS = {
  AVAILABLE: 'AVAILABLE',
  RESERVED: 'RESERVED',
  AWAITING_APPROVAL: 'AWAITING_APPROVAL',
  PROPOSED: 'PROPOSED',
  CONFIRMED: 'CONFIRMED',
  UNAVAILABLE: 'UNAVAILABLE',
};

export const NOTIFICATION_TYPE = {
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  NEW_BOOKING_REQUEST: 'NEW_BOOKING_REQUEST',
  BOOKING_CONFIRMED: 'BOOKING_CONFIRMED',
  RESCHEDULE_PROPOSED: 'RESCHEDULE_PROPOSED',
  RESCHEDULE_ACCEPTED: 'RESCHEDULE_ACCEPTED',
  RESCHEDULE_REJECTED: 'RESCHEDULE_REJECTED',
  BOOKING_DECLINED: 'BOOKING_DECLINED',
  BOOKING_EXPIRED: 'BOOKING_EXPIRED',
  REFUND_INITIATED: 'REFUND_INITIATED',
  REFUND_COMPLETED: 'REFUND_COMPLETED',
  CONSULTATION_REMINDER: 'CONSULTATION_REMINDER',
};

export const BOOKING_TRANSITIONS = {
  [BOOKING_STATUS.DRAFT]: [BOOKING_STATUS.PAYMENT_PENDING, BOOKING_STATUS.EXPIRED],
  [BOOKING_STATUS.PAYMENT_PENDING]: [
    BOOKING_STATUS.AWAITING_LAWYER,
    BOOKING_STATUS.EXPIRED,
    BOOKING_STATUS.REFUND_PENDING,
    BOOKING_STATUS.DECLINED,
  ],
  [BOOKING_STATUS.AWAITING_LAWYER]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.RESCHEDULE_PROPOSED,
    BOOKING_STATUS.DECLINED,
    BOOKING_STATUS.EXPIRED,
    BOOKING_STATUS.REFUND_PENDING,
  ],
  [BOOKING_STATUS.RESCHEDULE_PROPOSED]: [
    BOOKING_STATUS.CONFIRMED,
    BOOKING_STATUS.REFUND_PENDING,
    BOOKING_STATUS.EXPIRED,
  ],
  [BOOKING_STATUS.CONFIRMED]: [BOOKING_STATUS.COMPLETED],
  [BOOKING_STATUS.DECLINED]: [BOOKING_STATUS.REFUND_PENDING, BOOKING_STATUS.REFUNDED],
  [BOOKING_STATUS.EXPIRED]: [BOOKING_STATUS.REFUND_PENDING, BOOKING_STATUS.REFUNDED],
  [BOOKING_STATUS.REFUND_PENDING]: [BOOKING_STATUS.REFUNDED],
  [BOOKING_STATUS.REFUNDED]: [],
  [BOOKING_STATUS.COMPLETED]: [],
};

export const PAYMENT_TRANSITIONS = {
  [PAYMENT_STATUS.NOT_STARTED]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.PENDING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.FAILED]: [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID],
  [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUND_INITIATED],
  [PAYMENT_STATUS.REFUND_INITIATED]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.REFUNDED]: [],
};

export function assertBookingTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  const allowed = BOOKING_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ServiceError(
      `Invalid booking state transition from ${currentStatus} to ${nextStatus}.`,
      400,
    );
  }
}

export function assertPaymentTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return;
  const allowed = PAYMENT_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new ServiceError(
      `Invalid payment state transition from ${currentStatus} to ${nextStatus}.`,
      400,
    );
  }
}

export const BOOKING_STATUS_META = {
  [BOOKING_STATUS.DRAFT]: {
    label: 'Draft',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  [BOOKING_STATUS.PAYMENT_PENDING]: {
    label: 'Slot Reserved · Payment Pending',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300',
  },
  [BOOKING_STATUS.AWAITING_LAWYER]: {
    label: 'Awaiting Lawyer Approval',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  [BOOKING_STATUS.RESCHEDULE_PROPOSED]: {
    label: 'New Time Proposed',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
  },
  [BOOKING_STATUS.CONFIRMED]: {
    label: 'Appointment Confirmed',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  [BOOKING_STATUS.COMPLETED]: {
    label: 'Completed',
    badgeClass: 'bg-blue-50 text-blue-900 border-blue-200',
  },
  [BOOKING_STATUS.DECLINED]: {
    label: 'Declined by Lawyer',
    badgeClass: 'bg-red-50 text-red-900 border-red-200',
  },
  [BOOKING_STATUS.EXPIRED]: {
    label: 'Expired',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-300',
  },
  [BOOKING_STATUS.REFUND_PENDING]: {
    label: 'Refund Initiated',
    badgeClass: 'bg-orange-50 text-orange-900 border-orange-200',
  },
  [BOOKING_STATUS.REFUNDED]: {
    label: 'Refunded',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

export const PAYMENT_STATUS_META = {
  [PAYMENT_STATUS.NOT_STARTED]: {
    label: 'Not Started',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  [PAYMENT_STATUS.PENDING]: {
    label: 'Pending Verification',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  [PAYMENT_STATUS.PAID]: {
    label: 'Paid',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  [PAYMENT_STATUS.FAILED]: {
    label: 'Failed',
    badgeClass: 'bg-red-50 text-red-900 border-red-200',
  },
  [PAYMENT_STATUS.REFUND_INITIATED]: {
    label: 'Refund Initiated',
    badgeClass: 'bg-orange-50 text-orange-900 border-orange-200',
  },
  [PAYMENT_STATUS.REFUNDED]: {
    label: 'Refund Completed',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
  },
};

export const SLOT_STATUS_META = {
  [SLOT_STATUS.AVAILABLE]: {
    label: 'Available',
    badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  },
  [SLOT_STATUS.RESERVED]: {
    label: 'Temporarily Reserved',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
  },
  [SLOT_STATUS.AWAITING_APPROVAL]: {
    label: 'Awaiting Approval',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
  },
  [SLOT_STATUS.PROPOSED]: {
    label: 'Proposed for Reschedule',
    badgeClass: 'bg-purple-50 text-purple-900 border-purple-200',
  },
  [SLOT_STATUS.CONFIRMED]: {
    label: 'Confirmed',
    badgeClass: 'bg-navy text-white border-navy',
  },
  [SLOT_STATUS.UNAVAILABLE]: {
    label: 'Unavailable',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

