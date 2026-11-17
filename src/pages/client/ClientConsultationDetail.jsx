import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, CheckCircle2, Clock, RefreshCw, Video, MapPin, Check, X,
  AlertTriangle, Loader2, ExternalLink, TimerOff, RotateCcw,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Avatar from '../../components/common/Avatar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import BookingTimeline from '../../components/booking/BookingTimeline';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getBookingById } from '../../services/bookingService';
import {
  processClientAcceptReschedule,
  processClientRejectReschedule,
  processRefundCompletion,
  processRequestExpiration,
} from '../../services/workflowCoordinator';
import { BOOKING_STATUS, PAYMENT_STATUS } from '../../services/bookingStateMachine';
import { formatDateTime, formatFullDate, formatINR, formatSlotRange, MODE_LABEL } from '../../utils/format';

export default function ClientConsultationDetail() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const { notify } = useToast();
  const { refreshNotifications } = useNotifications();

  const [busy, setBusy] = useState('');
  const [confirmReject, setConfirmReject] = useState(false);

  const { data: booking, loading, error, reload } = useAsync(
    () => getBookingById(bookingId),
    [bookingId],
  );

  useDocumentTitle(booking ? `Booking ${booking.id}` : 'Consultation Details');

  const handleAcceptProposal = async () => {
    setBusy('accept');
    try {
      await processClientAcceptReschedule(booking.id, user.profileId);
      await refreshNotifications();
      notify('Rescheduled consultation confirmed! No additional payment was charged.');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleConfirmRejectProposal = async () => {
    setBusy('reject');
    try {
      await processClientRejectReschedule(booking.id, user.profileId);
      await refreshNotifications();
      notify('Reschedule rejected. Booking closed and a 100% full refund has been initiated.', 'info');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleSimulateRefundComplete = async () => {
    setBusy('refund');
    try {
      await processRefundCompletion(booking.id);
      await refreshNotifications();
      notify(`Full refund of ${formatINR(booking.totalAmount)} completed!`);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleSimulateTimeout = async () => {
    setBusy('expire');
    try {
      await processRequestExpiration(booking.id, 'Simulated response deadline timeout');
      await refreshNotifications();
      notify('Simulated request expiration — reserved slot released and full refund initiated.', 'info');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LineSkeleton lines={6} />;
  if (error || !booking) return <ErrorState error={error} onRetry={reload} />;

  const origSlot = booking.originalSlot;
  const finalSlot = booking.finalSlot || origSlot;
  const proposal = booking.proposal;
  const propSlot = proposal?.proposedSlot || finalSlot;

  const isConfirmed = booking.bookingStatus === BOOKING_STATUS.CONFIRMED;
  const isAwaitingLawyer = booking.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER;
  const isRescheduleProposed = booking.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED;
  const isRefundPending =
    booking.bookingStatus === BOOKING_STATUS.REFUND_PENDING ||
    booking.payment?.status === PAYMENT_STATUS.REFUND_INITIATED;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/client/consultations"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to My Consultations
        </Link>
      </div>

      <PageHeader
        eyebrow={`Booking Reference · ${booking.id}`}
        title={`Consultation with ${booking.lawyer?.name || 'Advocate'}`}
        description={`Created on ${formatDateTime(booking.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.bookingStatus} />
            {booking.payment && <PaymentStatusBadge status={booking.payment.status} />}
          </div>
        }
      />

      {/* DISTINCT STATUS BANNERS */}
      {/* 1. CONFIRMED APPOINTMENT BANNER (Green) */}
      {isConfirmed && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/90 p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-800 text-white">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="font-serif text-xl font-semibold text-emerald-950">
                Consultation Confirmed
              </h2>
              <p className="mt-1 text-sm text-emerald-900">
                Your consultation with <strong>{booking.lawyer?.name}</strong> is confirmed for{' '}
                <strong>
                  {finalSlot ? `${formatFullDate(finalSlot.date)}, from ${formatSlotRange(finalSlot.startTime, finalSlot.endTime)}` : '—'}
                </strong>{' '}
                (IST).
              </p>

              <div className="mt-4 rounded-xl border border-emerald-200 bg-white p-4 text-sm">
                {booking.mode === 'ONLINE' ? (
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-2.5">
                      <Video className="h-5 w-5 text-gold-600" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-navy">Online Consultation Meeting Link (Placeholder)</p>
                        <p className="font-mono text-xs text-muted">
                          {booking.meetingLink || `https://meet.legaleagle.example.com/session-${booking.id}`}
                        </p>
                      </div>
                    </div>
                    <span className="badge bg-gold-100 text-navy">Join 5 mins before start</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" aria-hidden="true" />
                    <div>
                      <p className="font-semibold text-navy">In-Person Chambers Location</p>
                      <p className="text-xs text-ink">{booking.officeLocation}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. AWAITING LAWYER APPROVAL BANNER (Amber — distinct from Confirmed) */}
      {isAwaitingLawyer && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-900 text-gold">
                <Clock className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-amber-950">
                  Payment Verified — Awaiting Lawyer Approval
                </h2>
                <p className="mt-1 text-sm text-amber-900">
                  Your booking request has been sent to <strong>{booking.lawyer?.name}</strong>. It is not yet a confirmed appointment until the lawyer accepts it.
                </p>
                {booking.responseDeadline && (
                  <p className="mt-1 text-xs text-amber-800">
                    Lawyer response deadline: <strong>{formatDateTime(booking.responseDeadline)}</strong>
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              disabled={!!busy}
              onClick={handleSimulateTimeout}
              className="btn btn-outline btn-sm self-start sm:self-auto"
              title="Demo helper: fast-forward past the 12-hour lawyer response window"
            >
              {busy === 'expire' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <TimerOff className="h-4 w-4" aria-hidden="true" />}
              Simulate Response Timeout
            </button>
          </div>
        </div>
      )}

      {/* 3. FLOW B: LAWYER PROPOSED RESCHEDULE — CLIENT DECISION PANEL */}
      {isRescheduleProposed && proposal && (
        <div className="rounded-2xl border-2 border-purple-300 bg-purple-50/80 p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-purple-900 text-gold">
              <RefreshCw className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="font-serif text-xl font-semibold text-purple-950">
                Your lawyer has proposed a new consultation time.
              </h2>
              <p className="mt-1 text-sm text-purple-900">
                Accept the proposed 1-hour slot to confirm your appointment with <strong>no additional payment</strong>, or reject it to close the booking and receive a <strong>100% full refund</strong>.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-purple-200 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Original Appointment
                  </p>
                  <p className="mt-1 text-sm font-medium text-ink line-through">
                    {origSlot
                      ? `${formatFullDate(origSlot.date)}, ${formatSlotRange(origSlot.startTime, origSlot.endTime)}`
                      : '—'}
                  </p>
                </div>
                <div className="rounded-xl border-2 border-gold bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">
                    Proposed Appointment
                  </p>
                  <p className="mt-1 text-sm font-bold text-navy">
                    {propSlot
                      ? `${formatFullDate(propSlot.date)}, ${formatSlotRange(propSlot.startTime, propSlot.endTime)}`
                      : '—'}
                  </p>
                </div>
              </div>

              {proposal.reason && (
                <blockquote className="mt-4 rounded-xl border border-purple-200 bg-white p-3.5 text-xs italic text-ink">
                  “{proposal.reason}” — <span className="font-semibold not-italic text-navy">{booking.lawyer?.name}</span>
                </blockquote>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={handleAcceptProposal}
                  className="btn btn-primary"
                >
                  {busy === 'accept' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
                  Accept New Time (No Extra Charge)
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => setConfirmReject(true)}
                  className="btn btn-danger-outline"
                >
                  <X className="h-4 w-4" aria-hidden="true" /> Reject & Request Refund
                </button>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={handleSimulateTimeout}
                  className="btn btn-ghost btn-sm ml-auto text-xs text-muted"
                >
                  <TimerOff className="h-3.5 w-3.5" aria-hidden="true" /> Simulate Proposal Timeout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. REFUND INITIATED / IN PROGRESS BANNER */}
      {isRefundPending && (
        <div className="rounded-2xl border border-orange-300 bg-orange-50 p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-orange-700" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-semibold text-orange-950">
                  Full Refund Initiated ({formatINR(booking.totalAmount)})
                </h2>
                <p className="mt-1 text-sm text-orange-900">
                  Your booking is closed and a 100% refund has been initiated through the Payment Module. In Demo Mode, click the button on the right to simulate gateway settlement completion.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={!!busy}
              onClick={handleSimulateRefundComplete}
              className="btn btn-primary btn-sm self-start sm:self-auto"
            >
              {busy === 'refund' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="h-4 w-4" aria-hidden="true" />}
              Simulate Refund Completion
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left 2 Columns: Timeline */}
        <section className="card p-6 lg:col-span-2" aria-labelledby="timeline-heading">
          <h2 id="timeline-heading" className="mb-5 text-lg font-semibold text-navy">
            Consultation Status Timeline
          </h2>
          <BookingTimeline timeline={booking.timeline} />
        </section>

        {/* Right Column: Summary & Payment Details */}
        <aside className="space-y-6">
          <section className="card p-6" aria-labelledby="details-card-heading">
            <h2 id="details-card-heading" className="text-base font-semibold text-navy">
              Appointment Details
            </h2>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cream/60 p-3">
              <Avatar name={booking.lawyer?.name || 'Lawyer'} src={booking.lawyer?.photo} size="sm" />
              <div className="min-w-0 flex-1">
                <Link to={`/lawyers/${booking.lawyerId}`} className="block truncate text-sm font-semibold text-navy hover:underline">
                  {booking.lawyer?.name}
                </Link>
                <p className="text-xs text-muted">{booking.lawyer?.city}</p>
              </div>
              <Link to={`/lawyers/${booking.lawyerId}`} aria-label="View lawyer profile">
                <ExternalLink className="h-4 w-4 text-muted hover:text-navy" />
              </Link>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-muted">Scheduled Date</dt>
                <dd className="font-medium text-navy">
                  {finalSlot ? formatFullDate(finalSlot.date) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-muted">Time Slot (IST)</dt>
                <dd className="font-medium text-navy">
                  {finalSlot ? formatSlotRange(finalSlot.startTime, finalSlot.endTime) : '—'}
                </dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-muted">Duration</dt>
                <dd className="font-medium text-navy">60 Minutes</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-muted">Consultation Mode</dt>
                <dd className="font-medium text-navy">{MODE_LABEL[booking.mode]}</dd>
              </div>
              <div className="flex justify-between gap-2 border-b border-line pb-2">
                <dt className="text-muted">Amount Paid</dt>
                <dd className="font-semibold text-navy">{formatINR(booking.totalAmount)}</dd>
              </div>
              {booking.payment?.transactionReference && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Transaction ID</dt>
                  <dd className="font-mono text-xs font-semibold text-navy">
                    {booking.payment.transactionReference}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>

      {/* Confirmation Dialog for Flow B2: Client Rejects Reschedule */}
      <ConfirmDialog
        open={confirmReject}
        onClose={() => setConfirmReject(false)}
        onConfirm={handleConfirmRejectProposal}
        title="Reject Proposed Time & Request Refund?"
        message="Are you sure you want to reject the proposed consultation time? Your booking will be closed and a full refund will be initiated."
        confirmLabel="Reject & Request Full Refund"
        danger
      />
    </div>
  );
}

