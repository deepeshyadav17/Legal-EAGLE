import { CheckCircle2, Clock, AlertCircle, RefreshCw, XCircle } from 'lucide-react';
import { formatDateTime } from '../../utils/format';

const STEP_ICON = {
  SLOT_SELECTED: Clock,
  PAYMENT_SUCCESS: CheckCircle2,
  AWAITING_LAWYER: Clock,
  BOOKING_CONFIRMED: CheckCircle2,
  RESCHEDULE_PROPOSED: RefreshCw,
  RESCHEDULE_ACCEPTED: CheckCircle2,
  RESCHEDULE_REJECTED: XCircle,
  BOOKING_DECLINED: XCircle,
  BOOKING_EXPIRED: AlertCircle,
  LATE_PAYMENT_RECOVERY: AlertCircle,
  PAYMENT_FAILED: XCircle,
  REFUND_INITIATED: RefreshCw,
  REFUND_COMPLETED: CheckCircle2,
  COMPLETED: CheckCircle2,
};

const STEP_COLOR = {
  SLOT_SELECTED: 'bg-gold-100 text-navy border-gold/40',
  PAYMENT_SUCCESS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  AWAITING_LAWYER: 'bg-amber-50 text-amber-800 border-amber-200',
  BOOKING_CONFIRMED: 'bg-emerald-100 text-emerald-900 border-emerald-300',
  RESCHEDULE_PROPOSED: 'bg-purple-50 text-purple-800 border-purple-200',
  RESCHEDULE_ACCEPTED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  RESCHEDULE_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  BOOKING_DECLINED: 'bg-red-50 text-red-700 border-red-200',
  BOOKING_EXPIRED: 'bg-gray-100 text-gray-700 border-gray-300',
  LATE_PAYMENT_RECOVERY: 'bg-amber-50 text-amber-800 border-amber-200',
  PAYMENT_FAILED: 'bg-red-50 text-red-700 border-red-200',
  REFUND_INITIATED: 'bg-orange-50 text-orange-800 border-orange-200',
  REFUND_COMPLETED: 'bg-slate-100 text-slate-800 border-slate-300',
  COMPLETED: 'bg-blue-50 text-blue-800 border-blue-200',
};

export default function BookingTimeline({ timeline = [] }) {
  if (!timeline.length) {
    return <p className="text-sm text-muted">No timeline events recorded yet.</p>;
  }

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-3 before:left-4 before:top-3 before:w-0.5 before:bg-line">
      {timeline.map((item, idx) => {
        const Icon = STEP_ICON[item.step] || Clock;
        const colorCls = STEP_COLOR[item.step] || 'bg-cream text-navy border-line';
        return (
          <li key={`${item.step}-${idx}`} className="relative flex items-start gap-4 pl-1">
            <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border ${colorCls}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium text-navy">{item.label}</p>
              {item.at && <p className="mt-0.5 text-xs text-muted">{formatDateTime(item.at)} (IST)</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

