import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import FormField from '../../components/forms/FormField';
import RescheduleModal from '../../components/booking/RescheduleModal';
import BookingTimeline from '../../components/booking/BookingTimeline';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { getBookingById, markBookingCompleted } from '../../services/bookingService';
import {
  processLawyerAcceptBooking,
  processLawyerDeclineBooking,
  processLawyerProposeReschedule,
} from '../../services/workflowCoordinator';
import { BOOKING_STATUS } from '../../services/bookingStateMachine';
import {
  formatDateTime,
  formatFullDate,
  formatINR,
  formatSlotRange,
  MODE_LABEL,
} from '../../utils/format';

/**
 * Detailed Lawyer Appointment / Request Page (`/lawyer/appointments/:bookingId`).
 */
export default function LawyerAppointmentDetail() {
  const { bookingId } = useParams();
  const { user } = useAuth();
  const { refreshNotifications } = useNotifications();
  const toast = useToast();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [acceptOpen, setAcceptOpen] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState(
    'Unavailable during the requested window due to court appearances.',
  );

  const load = () => {
    setLoading(true);
    getBookingById(bookingId)
      .then(setBooking)
      .catch((err) => toast.error({ title: 'Could not load appointment', description: err.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const handleAccept = async () => {
    setBusy(true);
    try {
      const updated = await processLawyerAcceptBooking(booking.id, user.profileId);
      setBooking(updated);
      await refreshNotifications();
      toast.success({ title: 'Consultation confirmed' });
      setAcceptOpen(false);
    } catch (err) {
      toast.error({ title: 'Action failed', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handlePropose = async ({ proposedSlotId, reason }) => {
    setBusy(true);
    try {
      const updated = await processLawyerProposeReschedule(booking.id, user.profileId, {
        proposedSlotId,
        reason,
      });
      setBooking(updated);
      await refreshNotifications();
      toast.success({ title: 'Reschedule proposal sent to client' });
      setRescheduleOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { booking: updated } = await processLawyerDeclineBooking(
        booking.id,
        user.profileId,
        declineReason,
      );
      setBooking(updated);
      await refreshNotifications();
      toast.info({ title: 'Booking declined & full refund initiated' });
      setDeclineOpen(false);
    } catch (err) {
      toast.error({ title: 'Could not decline booking', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  const handleMarkCompleted = async () => {
    setBusy(true);
    try {
      const updated = await markBookingCompleted(booking.id, user.profileId);
      setBooking(updated);
      toast.success({ title: 'Consultation marked completed' });
    } catch (err) {
      toast.error({ title: 'Could not update status', description: err.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !booking) {
    return <LineSkeleton lines={5} />;
  }

  const slot = booking.finalSlot || booking.originalSlot;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/lawyer/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Appointments
        </Link>
      </div>

      <PageHeader
        eyebrow={`Booking Reference · ${booking.id}`}
        title={`Consultation with ${booking.client?.name || 'Client'}`}
        subtitle={`Created ${formatDateTime(booking.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={booking.bookingStatus} />
            {booking.payment && <PaymentStatusBadge status={booking.payment.status || booking.payment.paymentStatus} />}
          </div>
        }
      />

      {booking.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/90 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Action Required · Paid Consultation Request
            </p>
            <p className="mt-1 text-sm text-amber-950">
              Client has completed payment of <strong>{formatINR(booking.totalAmount)}</strong>. Accept to confirm the 1-hour slot, propose an alternative time, or decline.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => setAcceptOpen(true)}
              className="btn btn-primary btn-sm"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Accept Booking
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setRescheduleOpen(true)}
              className="btn btn-accent btn-sm"
            >
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              Propose New Time
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setDeclineOpen(true)}
              className="btn btn-danger btn-sm"
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Decline Booking
            </button>
          </div>
        </div>
      )}

      {booking.bookingStatus === BOOKING_STATUS.CONFIRMED && (
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-900">
              Confirmed 1-Hour Consultation
            </p>
            <p className="mt-1 text-sm text-emerald-950">
              {booking.mode === 'ONLINE'
                ? `Video Session Link: ${booking.meetingLink}`
                : `In-Person Location: ${booking.officeLocation}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            {booking.mode === 'ONLINE' && booking.meetingLink && (
              <a
                href={booking.meetingLink}
                target="_blank"
                rel="noreferrer"
                className="btn btn-outline btn-sm bg-white"
              >
                Open Video Room <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={handleMarkCompleted}
              className="btn btn-primary btn-sm"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Mark Consultation Completed
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card p-6 space-y-5">
            <h2 className="font-display text-lg font-bold text-navy">
              Client & Session Details
            </h2>
            <div className="grid gap-4 rounded-xl border border-line bg-cream/60 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Client Name
                </p>
                <p className="mt-1 font-semibold text-navy">{booking.client?.name}</p>
                <p className="text-xs text-muted">{booking.client?.email}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Client City
                </p>
                <p className="mt-1 font-semibold text-navy">{booking.client?.city || '—'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Consultation Date
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                  <Calendar className="h-4 w-4 text-gold-600" aria-hidden="true" />
                  {slot ? formatFullDate(slot.date) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Time Slot (60 Minutes)
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                  <Clock className="h-4 w-4 text-gold-600" aria-hidden="true" />
                  {slot ? formatSlotRange(slot.startTime, slot.endTime) : '—'} (IST)
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Consultation Mode
                </p>
                <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                  {booking.mode === 'ONLINE' ? (
                    <Video className="h-4 w-4 text-gold-600" aria-hidden="true" />
                  ) : (
                    <MapPin className="h-4 w-4 text-gold-600" aria-hidden="true" />
                  )}
                  {MODE_LABEL[booking.mode] || booking.mode}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Consultation Fee Paid
                </p>
                <p className="mt-1 font-display text-base font-bold text-navy">
                  {formatINR(booking.totalAmount)}
                </p>
              </div>
            </div>

            {booking.clientNotes && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Client Matter Notes
                </h3>
                <p className="mt-1.5 rounded-xl border border-line bg-white p-4 text-sm text-ink">
                  {booking.clientNotes}
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-6">
          <div className="card p-6">
            <h2 className="font-display text-base font-bold text-navy">
              Consultation Status Timeline
            </h2>
            <div className="mt-4">
              <BookingTimeline booking={booking} />
            </div>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        onConfirm={handleAccept}
        loading={busy}
        title="Confirm Consultation Appointment?"
        description={`Confirm the 1-hour consultation with ${booking.client?.name} on ${formatFullDate(slot?.date)} (${formatSlotRange(slot?.startTime, slot?.endTime)}).`}
        confirmLabel="Confirm Appointment"
      />

      <RescheduleModal
        open={rescheduleOpen}
        onClose={() => setRescheduleOpen(false)}
        booking={booking}
        onSubmit={handlePropose}
      />

      <Modal
        open={declineOpen}
        onClose={busy ? () => {} : () => setDeclineOpen(false)}
        title="Decline Consultation Request"
        description="Declining releases the time slot and initiates a full refund to the client."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeclineOpen(false)}
              disabled={busy}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="lawyer-detail-decline-form"
              disabled={busy}
              className="btn btn-danger"
            >
              Decline & Initiate Refund
            </button>
          </>
        }
      >
        <form id="lawyer-detail-decline-form" onSubmit={handleDecline}>
          <FormField
            as="textarea"
            label="Reason for declining"
            name="declineReason"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            required
          />
        </form>
      </Modal>
    </div>
  );
}
