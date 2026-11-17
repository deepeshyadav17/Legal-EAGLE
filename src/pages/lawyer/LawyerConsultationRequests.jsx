import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  Inbox,
  MapPin,
  Video,
  XCircle,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import Modal from '../../components/common/Modal';
import FormField from '../../components/forms/FormField';
import RescheduleModal from '../../components/booking/RescheduleModal';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { getLawyerBookings } from '../../services/bookingService';
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
 * Screen 9 — Lawyer Consultation Requests Page (`/lawyer/consultation-requests`).
 * Displays incoming paid consultation requests with Accept Booking, Propose New Time,
 * and Decline Booking actions.
 */
export default function LawyerConsultationRequests() {
  const { user } = useAuth();
  const { refreshNotifications } = useNotifications();
  const toast = useToast();

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const [acceptTarget, setAcceptTarget] = useState(null);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);
  const [declineTarget, setDeclineTarget] = useState(null);
  const [declineReason, setDeclineReason] = useState(
    'Court hearing scheduled during this window. Unable to offer an alternative time right now.',
  );
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    getLawyerBookings(user.profileId)
      .then((list) => {
        const requests = list.filter((b) =>
          [BOOKING_STATUS.AWAITING_LAWYER, BOOKING_STATUS.RESCHEDULE_PROPOSED].includes(
            b.bookingStatus,
          ),
        );
        setBookings(requests);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.profileId]);

  const handleConfirmAccept = async () => {
    if (!acceptTarget) return;
    setBusyId(acceptTarget.id);
    try {
      await processLawyerAcceptBooking(acceptTarget.id, user.profileId);
      await refreshNotifications();
      toast.success({
        title: 'Consultation confirmed',
        description: `Appointment with ${acceptTarget.client?.name || 'client'} is now confirmed.`,
      });
      setAcceptTarget(null);
      load();
    } catch (err) {
      toast.error({ title: 'Could not accept booking', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleProposeReschedule = async ({ proposedSlotId, reason }) => {
    if (!rescheduleTarget) return;
    setBusyId(rescheduleTarget.id);
    try {
      await processLawyerProposeReschedule(rescheduleTarget.id, user.profileId, {
        proposedSlotId,
        reason,
      });
      await refreshNotifications();
      toast.success({
        title: 'Reschedule proposal sent',
        description: 'The proposed 1-hour slot is reserved while awaiting the client’s response.',
      });
      setRescheduleTarget(null);
      load();
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmDecline = async (e) => {
    e.preventDefault();
    if (!declineTarget) return;
    setBusyId(declineTarget.id);
    try {
      await processLawyerDeclineBooking(declineTarget.id, user.profileId, declineReason);
      await refreshNotifications();
      toast.info({
        title: 'Booking declined & refund initiated',
        description: `The slot hold was released and a full refund was initiated for ${declineTarget.client?.name || 'the client'}.`,
      });
      setDeclineTarget(null);
      load();
    } catch (err) {
      toast.error({ title: 'Could not decline booking', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Consultation Management"
        title="Consultation Requests"
        subtitle="Review incoming paid consultation requests. Accept to confirm the 1-hour appointment, propose an alternative slot, or decline to trigger an automatic full refund."
        action={
          <Link to="/lawyer/appointments" className="btn btn-outline">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            Confirmed Appointments
          </Link>
        }
      />

      {loading ? (
        <LineSkeleton lines={4} />
      ) : bookings.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="No pending consultation requests"
          description="Incoming paid booking requests and reschedule proposals awaiting client response will appear here."
          action={
            <Link to="/lawyer/availability" className="btn btn-primary">
              Manage 1-Hour Availability Slots
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {bookings.map((bk) => {
            const slot = bk.finalSlot || bk.originalSlot;
            const awaitingLawyer = bk.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER;
            return (
              <div key={bk.id} className="card p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-cream px-2 py-0.5 font-mono text-xs font-semibold text-navy">
                        {bk.id}
                      </span>
                      <BookingStatusBadge status={bk.bookingStatus} />
                      {bk.payment && <PaymentStatusBadge status={bk.payment.status || bk.payment.paymentStatus} />}
                    </div>
                    <h3 className="mt-2 font-display text-lg font-bold text-navy">
                      {bk.client?.name || 'Client'}
                    </h3>
                    <p className="text-xs text-muted">
                      {bk.client?.email} {bk.client?.city ? `· ${bk.client.city}` : ''}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted">Paid Consultation Fee</p>
                    <p className="font-display text-xl font-bold text-navy">
                      {formatINR(bk.totalAmount)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700">60 Minutes · Verified</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 rounded-xl border border-line bg-cream/60 p-4 text-sm sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      {bk.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED
                        ? 'Proposed Date'
                        : 'Requested Date'}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                      <Calendar className="h-4 w-4 text-gold-600" aria-hidden="true" />
                      {slot ? formatFullDate(slot.date) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Time Range (1 Hour)
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                      <Clock className="h-4 w-4 text-gold-600" aria-hidden="true" />
                      {slot ? formatSlotRange(slot.startTime, slot.endTime) : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Consultation Mode
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 font-semibold text-navy">
                      {bk.mode === 'ONLINE' ? (
                        <Video className="h-4 w-4 text-gold-600" aria-hidden="true" />
                      ) : (
                        <MapPin className="h-4 w-4 text-gold-600" aria-hidden="true" />
                      )}
                      {MODE_LABEL[bk.mode] || bk.mode}
                    </p>
                  </div>
                </div>

                {bk.clientNotes && (
                  <div className="mt-3 rounded-xl border border-line bg-white p-3.5 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Client’s Matter Summary
                    </p>
                    <p className="mt-1 text-ink">{bk.clientNotes}</p>
                  </div>
                )}

                {bk.responseDeadline && (
                  <p className="mt-3 text-xs text-muted">
                    Response deadline:{' '}
                    <span className="font-semibold text-navy">
                      {formatDateTime(bk.responseDeadline)}
                    </span>
                  </p>
                )}

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
                  <Link
                    to={`/lawyer/appointments/${bk.id}`}
                    className="btn btn-ghost btn-sm text-navy"
                  >
                    <Eye className="h-4 w-4" aria-hidden="true" />
                    View Full Request Details
                  </Link>

                  {awaitingLawyer ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        type="button"
                        disabled={busyId === bk.id}
                        onClick={() => setAcceptTarget(bk)}
                        className="btn btn-primary btn-sm"
                      >
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        Accept Booking
                      </button>
                      <button
                        type="button"
                        disabled={busyId === bk.id}
                        onClick={() => setRescheduleTarget(bk)}
                        className="btn btn-accent btn-sm"
                      >
                        <CalendarClock className="h-4 w-4" aria-hidden="true" />
                        Propose New Time
                      </button>
                      <button
                        type="button"
                        disabled={busyId === bk.id}
                        onClick={() => setDeclineTarget(bk)}
                        className="btn btn-danger btn-sm"
                      >
                        <XCircle className="h-4 w-4" aria-hidden="true" />
                        Decline Booking
                      </button>
                    </div>
                  ) : (
                    <span className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-semibold text-purple-800">
                      Reschedule proposed — waiting for client to accept or reject
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Flow A: Accept Confirmation Modal */}
      <ConfirmDialog
        open={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        onConfirm={handleConfirmAccept}
        loading={Boolean(busyId)}
        title="Accept & Confirm Consultation?"
        description={
          acceptTarget
            ? `Confirm the 60-minute consultation with ${acceptTarget.client?.name || 'the client'} on ${formatFullDate(acceptTarget.originalSlot?.date)} (${formatSlotRange(acceptTarget.originalSlot?.startTime, acceptTarget.originalSlot?.endTime)}). The client will be notified immediately.`
            : ''
        }
        confirmLabel="Confirm Appointment"
      />

      {/* Flow B: Propose a Reschedule Modal */}
      <RescheduleModal
        open={Boolean(rescheduleTarget)}
        onClose={() => setRescheduleTarget(null)}
        booking={rescheduleTarget}
        onSubmit={handleProposeReschedule}
      />

      {/* Flow C: Decline Booking Modal */}
      <Modal
        open={Boolean(declineTarget)}
        onClose={busyId ? () => {} : () => setDeclineTarget(null)}
        title="Decline Consultation Request"
        description="Declining this request releases the reserved slot and initiates a 100% full refund of the consultation fee to the client."
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeclineTarget(null)}
              disabled={Boolean(busyId)}
              className="btn btn-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="decline-booking-form"
              disabled={Boolean(busyId)}
              className="btn btn-danger"
            >
              Decline & Refund Client
            </button>
          </>
        }
      >
        <form id="decline-booking-form" onSubmit={handleConfirmDecline} className="space-y-4">
          <FormField
            as="textarea"
            label="Reason for declining (shared with client)"
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
