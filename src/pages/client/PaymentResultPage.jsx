import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  Clock, XCircle, RotateCcw, ArrowRight, Scale, CalendarCheck, AlertTriangle, Loader2,
} from 'lucide-react';
import DemoBadge from '../../components/common/DemoBadge';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import BookingTimeline from '../../components/booking/BookingTimeline';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getBookingById } from '../../services/bookingService';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../services/bookingStateMachine';
import { formatDateTime, formatFullDate, formatINR, formatSlotRange, MODE_LABEL } from '../../utils/format';

/**
 * Dedicated Payment Status Screen.
 * Explicitly distinguishes "Payment Successful — Awaiting Lawyer Approval"
 * from a confirmed appointment so clients never confuse payment receipt with
 * lawyer confirmation.
 */
export default function PaymentResultPage() {
  useDocumentTitle('Payment Status');
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { demoLogin } = useAuth();
  const { notify } = useToast();
  const [switching, setSwitching] = useState(false);

  const { data: booking, loading, error, reload } = useAsync(
    () => getBookingById(bookingId),
    [bookingId],
  );

  const handleSwitchToLawyerDemo = async () => {
    setSwitching(true);
    try {
      const lawyerUser = await demoLogin('lawyer');
      notify(`Switched to ${lawyerUser.name}’s Lawyer Workspace to review the request.`);
      navigate('/lawyer/consultation-requests');
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-12">
        <LineSkeleton lines={5} />
      </div>
    );
  }
  if (error || !booking) {
    return (
      <div className="container-page py-12">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const slot = booking.finalSlot || booking.originalSlot;
  const payment = booking.payment;
  const isPaidAwaiting =
    payment?.status === PAYMENT_STATUS.PAID &&
    booking.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER;
  const isFailed = payment?.status === PAYMENT_STATUS.FAILED;
  const isRefundRecovery =
    booking.bookingStatus === BOOKING_STATUS.REFUND_PENDING ||
    booking.bookingStatus === BOOKING_STATUS.REFUNDED;

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex justify-end">
          <DemoBadge />
        </div>

        {/* CASE 1: Payment Successful — Awaiting Lawyer Approval (Amber/Gold theme, NEVER green "Confirmed") */}
        {isPaidAwaiting && (
          <div className="card overflow-hidden border-amber-300">
            <div className="bg-amber-50/90 px-6 py-6 sm:px-8">
              <div className="flex items-start gap-4">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-900 text-gold">
                  <Clock className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <PaymentStatusBadge status={payment.status} />
                    <BookingStatusBadge status={booking.bookingStatus} />
                  </div>
                  <h1 className="mt-2 font-serif text-2xl font-semibold text-navy sm:text-3xl">
                    Payment Successful
                  </h1>
                  <p className="mt-1 text-sm font-medium text-amber-950">
                    Your booking request has been sent to the lawyer. Your consultation is awaiting approval.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6 sm:p-8">
              <div className="rounded-xl border border-amber-200 bg-cream p-4 text-xs leading-relaxed text-ink">
                <strong className="text-navy">Not Confirmed Yet:</strong> This receipt confirms your payment of{' '}
                <strong>{formatINR(booking.totalAmount)}</strong> ({payment.transactionReference}). Your appointment will be confirmed only after{' '}
                <strong>{booking.lawyer?.name}</strong> accepts your request. If the lawyer proposes another 1-hour slot, you can accept that time or reject it for a 100% refund.
              </div>

              <dl className="grid gap-4 rounded-2xl border border-line bg-white p-5 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted">Booking ID</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-navy">{booking.id}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Transaction Reference</dt>
                  <dd className="mt-0.5 font-mono font-semibold text-navy">{payment.transactionReference}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Legal Professional</dt>
                  <dd className="mt-0.5 font-semibold text-navy">{booking.lawyer?.name}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Consultation Mode</dt>
                  <dd className="mt-0.5 font-medium text-navy">{MODE_LABEL[booking.mode]}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Requested Date & Time (IST)</dt>
                  <dd className="mt-0.5 font-semibold text-navy">
                    {slot ? `${formatFullDate(slot.date)} · ${formatSlotRange(slot.startTime, slot.endTime)}` : '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Lawyer Response Deadline</dt>
                  <dd className="mt-0.5 font-medium text-navy">
                    {booking.responseDeadline ? formatDateTime(booking.responseDeadline) : 'Within 12 hours'}
                  </dd>
                </div>
              </dl>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                <div className="flex flex-wrap gap-2">
                  <Link to={`/client/consultations/${booking.id}`} className="btn btn-primary">
                    <CalendarCheck className="h-4 w-4" aria-hidden="true" /> View Booking Status & Timeline
                  </Link>
                  <Link to="/client/consultations" className="btn btn-outline">
                    My Consultations
                  </Link>
                </div>

                {booking.lawyerId === 'l1' && (
                  <button
                    type="button"
                    onClick={handleSwitchToLawyerDemo}
                    disabled={switching}
                    className="btn btn-gold btn-sm"
                  >
                    {switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Scale className="h-4 w-4" aria-hidden="true" />}
                    Switch to Demo Lawyer to Approve / Reschedule <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CASE 2: Payment Failed */}
        {isFailed && (
          <div className="card border-red-200 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-red-50 text-red-700">
                <XCircle className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <PaymentStatusBadge status={payment.status} />
                  <BookingStatusBadge status={booking.bookingStatus} />
                </div>
                <h1 className="mt-2 font-serif text-2xl font-semibold text-navy">
                  Payment Failed — Slot Hold Released
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Your payment could not be completed ({payment.failureReason || 'declined'}). No paid lawyer request was created and your temporary slot reservation has been released.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to={`/lawyers/${booking.lawyerId}/book`} className="btn btn-primary">
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Select a Slot & Try Again
                  </Link>
                  <Link to="/client/consultations" className="btn btn-outline">
                    Go to My Consultations
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CASE 3: Late Payment after Expired Hold -> Automatic Refund Recovery */}
        {isRefundRecovery && !isPaidAwaiting && (
          <div className="card border-orange-200 p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-orange-50 text-orange-700">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {payment && <PaymentStatusBadge status={payment.status} />}
                  <BookingStatusBadge status={booking.bookingStatus} />
                </div>
                <h1 className="mt-2 font-serif text-2xl font-semibold text-navy">
                  Slot Hold Expired — Full Refund Initiated
                </h1>
                <p className="mt-1 text-sm text-muted">
                  Payment verification arrived after the 10-minute temporary slot reservation had expired. To prevent double booking, the slot was not assigned and a full refund of{' '}
                  <strong>{formatINR(booking.totalAmount)}</strong> has been initiated.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link to="/client/refunds" className="btn btn-primary">
                    Track Refund Status
                  </Link>
                  <Link to={`/lawyers/${booking.lawyerId}/book`} className="btn btn-outline">
                    Book a New Slot
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Preview */}
        <section className="card p-6">
          <h2 className="mb-4 text-base font-semibold text-navy">Booking Lifecycle Log</h2>
          <BookingTimeline timeline={booking.timeline} />
        </section>
      </div>
    </div>
  );
}

