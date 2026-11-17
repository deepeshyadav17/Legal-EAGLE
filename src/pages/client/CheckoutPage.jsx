import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ShieldCheck, Clock, CheckCircle2, XCircle, AlertTriangle, Loader2, ArrowLeft, CreditCard,
} from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import DemoBadge from '../../components/common/DemoBadge';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getBookingById } from '../../services/bookingService';
import {
  processPaymentSuccess,
  processPaymentFailure,
  processPaymentCancelled,
} from '../../services/workflowCoordinator';
import { BOOKING_STATUS } from '../../services/bookingStateMachine';
import { formatFullDate, formatINR, formatSlotRange, MODE_LABEL } from '../../utils/format';

export default function CheckoutPage() {
  useDocumentTitle('Consultation Checkout');
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { notify } = useToast();
  const { refreshNotifications } = useNotifications();
  const [busyAction, setBusyAction] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(null);

  const { data: booking, loading, error, reload } = useAsync(
    () => getBookingById(bookingId),
    [bookingId],
  );

  // Live 10-minute slot reservation countdown
  useEffect(() => {
    if (!booking?.holdExpiresAt || booking.bookingStatus !== BOOKING_STATUS.PAYMENT_PENDING) {
      setSecondsLeft(null);
      return undefined;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((new Date(booking.holdExpiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [booking?.holdExpiresAt, booking?.bookingStatus]);

  const handleSuccess = async (simulateExpiredHold = false) => {
    setBusyAction(simulateExpiredHold ? 'late' : 'success');
    try {
      const res = await processPaymentSuccess(bookingId, { simulateExpiredHold });
      await refreshNotifications();
      if (res.latePayment) {
        notify('Slot hold had expired — automatic full refund initiated.', 'info');
      } else {
        notify('Payment verified! Request sent to lawyer for approval.');
      }
      navigate(`/payment-result/${bookingId}`, { replace: true });
    } catch (err) {
      notify(err.message, 'error');
      reload(true);
    } finally {
      setBusyAction('');
    }
  };

  const handleFailure = async () => {
    setBusyAction('fail');
    try {
      await processPaymentFailure(bookingId, 'Simulated bank authorization decline');
      await refreshNotifications();
      notify('Simulated payment failure. Temporary slot hold released.', 'error');
      navigate(`/payment-result/${bookingId}`, { replace: true });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleCancel = async () => {
    setBusyAction('cancel');
    try {
      await processPaymentCancelled(bookingId);
      notify('Checkout cancelled and slot reservation released.', 'info');
      navigate(`/lawyers/${booking.lawyerId}/book`, { replace: true });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusyAction('');
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

  const slot = booking.originalSlot || booking.finalSlot;
  const mins = secondsLeft !== null ? String(Math.floor(secondsLeft / 60)).padStart(2, '0') : '00';
  const secs = secondsLeft !== null ? String(secondsLeft % 60).padStart(2, '0') : '00';
  const isPendingPayment = booking.bookingStatus === BOOKING_STATUS.PAYMENT_PENDING;

  return (
    <div className="container-page py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <Link
            to={`/lawyers/${booking.lawyerId}/book`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to slot selection
          </Link>
          <DemoBadge label="Simulated Payment Gateway · Demo Mode" />
        </div>

        {/* Temporary Slot Hold Countdown Banner */}
        {isPendingPayment && (
          <div className="mb-6 flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-900 text-gold">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Temporary 10-Minute Slot Hold Active
                </p>
                <p className="text-xs text-amber-900">
                  Other clients cannot reserve this lawyer and 1-hour slot while your hold is active.
                </p>
              </div>
            </div>
            <div className="rounded-xl bg-white px-4 py-2 text-center shadow-xs">
              <span className="text-[11px] uppercase tracking-wider text-muted">Hold Expires In</span>
              <p className="font-mono text-lg font-bold text-navy">
                {mins}:{secs}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-12">
          {/* Simulated Payment Controls */}
          <section className="card p-6 sm:p-8 lg:col-span-7" aria-labelledby="checkout-heading">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-navy text-gold">
                <CreditCard className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h1 id="checkout-heading" className="font-serif text-xl font-semibold text-navy sm:text-2xl">
                  Consultation Payment Checkout
                </h1>
                <p className="text-xs text-muted">Booking ID: {booking.id}</p>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-line bg-cream p-4 text-xs leading-relaxed text-ink">
              <p className="font-semibold text-navy">Frontend MVP Payment Simulation</p>
              <p className="mt-1 text-muted">
                No real card, UPI, or bank credentials are collected. Choose a simulated outcome below to test the end-to-end booking state machine.
              </p>
            </div>

            {isPendingPayment ? (
              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => handleSuccess(false)}
                  className="btn btn-primary w-full justify-between py-3.5"
                >
                  <span className="flex items-center gap-2">
                    {busyAction === 'success' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-gold" aria-hidden="true" />
                    )}
                    Simulate Successful Payment
                  </span>
                  <span className="font-bold text-gold">{formatINR(booking.totalAmount)}</span>
                </button>

                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleFailure}
                  className="btn btn-danger-outline w-full justify-between py-3"
                >
                  <span className="flex items-center gap-2">
                    {busyAction === 'fail' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <XCircle className="h-4 w-4" aria-hidden="true" />
                    )}
                    Simulate Failed Payment (Releases Slot Hold)
                  </span>
                  <span className="text-xs">Decline</span>
                </button>

                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={() => handleSuccess(true)}
                  className="btn btn-outline w-full justify-between py-3 text-xs"
                >
                  <span className="flex items-center gap-2">
                    {busyAction === 'late' ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
                    )}
                    Simulate Late Payment After Hold Expiry (Auto-Refund Recovery)
                  </span>
                  <span className="text-muted">Edge Case</span>
                </button>

                <button
                  type="button"
                  disabled={!!busyAction}
                  onClick={handleCancel}
                  className="btn btn-ghost w-full text-xs text-muted"
                >
                  Cancel Checkout & Release Reserved Slot
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-line bg-cream p-5 text-center">
                <p className="text-sm font-semibold text-navy">
                  This checkout session is no longer pending payment.
                </p>
                <div className="mt-2 flex justify-center gap-2">
                  <BookingStatusBadge status={booking.bookingStatus} />
                  {booking.payment && <PaymentStatusBadge status={booking.payment.status} />}
                </div>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link to={`/payment-result/${booking.id}`} className="btn btn-primary btn-sm">
                    View Payment Status
                  </Link>
                  <Link to={`/lawyers/${booking.lawyerId}/book`} className="btn btn-outline btn-sm">
                    Select Another Slot
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-6 flex items-start gap-2.5 border-t border-line pt-4 text-xs text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
              <p>
                Payment success submits your request for lawyer approval. Your consultation is confirmed only when the lawyer accepts it.
              </p>
            </div>
          </section>

          {/* Frozen Booking Quote Summary */}
          <aside className="card p-6 lg:col-span-5" aria-labelledby="quote-heading">
            <h2 id="quote-heading" className="text-base font-semibold text-navy">
              Frozen Payable Quote
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cream/60 p-3.5">
              <Avatar name={booking.lawyer?.name || 'Lawyer'} src={booking.lawyer?.photo} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-navy">{booking.lawyer?.name}</p>
                <p className="truncate text-xs text-muted">{booking.lawyer?.city}</p>
              </div>
            </div>

            <dl className="mt-4 space-y-2.5 border-y border-line py-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Date</dt>
                <dd className="font-medium text-navy">{slot ? formatFullDate(slot.date) : '—'}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Time (IST)</dt>
                <dd className="font-medium text-navy">
                  {slot ? formatSlotRange(slot.startTime, slot.endTime) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Duration</dt>
                <dd className="font-medium text-navy">60 Minutes</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Meeting Mode</dt>
                <dd className="font-medium text-navy">{MODE_LABEL[booking.mode]}</dd>
              </div>
              <div className="flex justify-between gap-2 border-t border-line pt-2.5 text-base font-semibold text-navy">
                <dt>Total Payable</dt>
                <dd>{formatINR(booking.totalAmount)}</dd>
              </div>
            </dl>

            {booking.clientNotes && (
              <div className="mt-4 text-xs">
                <p className="font-semibold text-navy">Your Note to Lawyer:</p>
                <p className="mt-1 rounded-lg bg-cream p-2.5 text-muted">{booking.clientNotes}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

