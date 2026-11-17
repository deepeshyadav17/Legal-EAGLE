import {
  BOOKING_STATUS_META,
  PAYMENT_STATUS_META,
  SLOT_STATUS_META,
} from '../../services/bookingStateMachine';
import { cn } from '../../utils/format';

export function BookingStatusBadge({ status, className = '' }) {
  const meta = BOOKING_STATUS_META[status] || {
    label: status || 'Unknown',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span className={cn('badge border', meta.badgeClass, className)}>
      {meta.label}
    </span>
  );
}

export function PaymentStatusBadge({ status, className = '' }) {
  const meta = PAYMENT_STATUS_META[status] || {
    label: status || 'Unknown',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span className={cn('badge border', meta.badgeClass, className)}>
      {meta.label}
    </span>
  );
}

export function SlotStatusBadge({ status, className = '' }) {
  const meta = SLOT_STATUS_META[status] || {
    label: status || 'Unknown',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return (
    <span className={cn('badge border', meta.badgeClass, className)}>
      {meta.label}
    </span>
  );
}

export default BookingStatusBadge;

