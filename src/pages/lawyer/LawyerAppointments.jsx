import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Eye,
  LayoutGrid,
  List,
  MapPin,
  Video,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import EmptyState from '../../components/common/EmptyState';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { getLawyerBookings, markBookingCompleted } from '../../services/bookingService';
import { BOOKING_STATUS } from '../../services/bookingStateMachine';
import {
  cn,
  formatFullDate,
  formatINR,
  formatSlotRange,
  MODE_LABEL,
} from '../../utils/format';

const TABS = [
  { id: 'upcoming', label: 'Upcoming Confirmed' },
  { id: 'pending', label: 'Awaiting / Proposed' },
  { id: 'history', label: 'Appointment History' },
];

/**
 * Screen 11 — Lawyer Appointments Page (`/lawyer/appointments`).
 * Supports List View and Calendar View, plus filter tabs and Mark Consultation Completed.
 */
export default function LawyerAppointments() {
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('filter') || 'upcoming';
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'calendar'

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = () => {
    setLoading(true);
    getLawyerBookings(user.profileId)
      .then(setBookings)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.profileId]);

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab === 'upcoming') {
        return b.bookingStatus === BOOKING_STATUS.CONFIRMED;
      }
      if (activeTab === 'pending') {
        return [BOOKING_STATUS.AWAITING_LAWYER, BOOKING_STATUS.RESCHEDULE_PROPOSED].includes(
          b.bookingStatus,
        );
      }
      if (activeTab === 'history') {
        return [
          BOOKING_STATUS.COMPLETED,
          BOOKING_STATUS.DECLINED,
          BOOKING_STATUS.EXPIRED,
          BOOKING_STATUS.REFUND_PENDING,
          BOOKING_STATUS.REFUNDED,
        ].includes(b.bookingStatus);
      }
      return true;
    });
  }, [bookings, activeTab]);

  // Group by slot date for Calendar View
  const groupedByDate = useMemo(() => {
    const map = new Map();
    filtered.forEach((bk) => {
      const slot = bk.finalSlot || bk.originalSlot;
      const key = slot?.date || 'Unscheduled';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(bk);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const handleMarkCompleted = async (bk) => {
    setBusyId(bk.id);
    try {
      await markBookingCompleted(bk.id, user.profileId);
      toast.success({
        title: 'Consultation marked completed',
        description: `Session with ${bk.client?.name || 'client'} moved to appointment history.`,
      });
      load();
    } catch (err) {
      toast.error({ title: 'Could not update appointment', description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const setTab = (tabId) => {
    const next = new URLSearchParams(searchParams);
    if (tabId === 'upcoming') next.delete('filter');
    else next.set('filter', tabId);
    setSearchParams(next);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Schedule & Sessions"
        title="Confirmed Appointments & History"
        subtitle="Switch between List View and Calendar View to manage confirmed 1-hour consultations and past sessions."
        action={
          <div className="inline-flex rounded-xl border border-line bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                viewMode === 'list' ? 'bg-navy text-white' : 'text-ink hover:bg-cream',
              )}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                viewMode === 'calendar' ? 'bg-navy text-white' : 'text-ink hover:bg-cream',
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              Calendar View
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={cn(
                'rounded-xl px-4 py-2 text-xs font-semibold transition',
                active
                  ? 'bg-navy text-white shadow-sm'
                  : 'bg-white text-ink hover:bg-cream border border-line',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <LineSkeleton lines={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No appointments in this view"
          description="Confirmed consultations and completed sessions will appear here."
          action={
            <Link to="/lawyer/consultation-requests" className="btn btn-outline">
              Check Incoming Requests
            </Link>
          }
        />
      ) : viewMode === 'calendar' ? (
        <div className="space-y-5">
          {groupedByDate.map(([date, dayBookings]) => (
            <div key={date} className="card p-5">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <h3 className="flex items-center gap-2 font-display text-base font-bold text-navy">
                  <Calendar className="h-4 w-4 text-gold-600" aria-hidden="true" />
                  {date === 'Unscheduled' ? date : formatFullDate(date)}
                </h3>
                <span className="badge badge-gold">{dayBookings.length} session(s)</span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {dayBookings.map((bk) => {
                  const slot = bk.finalSlot || bk.originalSlot;
                  return (
                    <div
                      key={bk.id}
                      className="rounded-xl border border-line bg-cream/60 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-navy">
                            {slot ? formatSlotRange(slot.startTime, slot.endTime) : '—'}
                          </span>
                          <BookingStatusBadge status={bk.bookingStatus} />
                        </div>
                        <p className="mt-1.5 font-display text-sm font-bold text-navy">
                          {bk.client?.name || 'Client'}
                        </p>
                        <p className="text-xs text-muted">
                          {MODE_LABEL[bk.mode] || bk.mode} · {formatINR(bk.totalAmount)}
                        </p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          to={`/lawyer/appointments/${bk.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((bk) => {
            const slot = bk.finalSlot || bk.originalSlot;
            return (
              <div key={bk.id} className="card p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
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
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-ink">
                      {slot && (
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                          {formatFullDate(slot.date)}
                        </span>
                      )}
                      {slot && (
                        <span className="inline-flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                          {formatSlotRange(slot.startTime, slot.endTime)} (60 mins)
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1.5">
                        {bk.mode === 'ONLINE' ? (
                          <Video className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                        ) : (
                          <MapPin className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                        )}
                        {MODE_LABEL[bk.mode] || bk.mode}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <p className="font-display text-lg font-bold text-navy">
                      {formatINR(bk.totalAmount)}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {bk.bookingStatus === BOOKING_STATUS.CONFIRMED && (
                        <button
                          type="button"
                          disabled={busyId === bk.id}
                          onClick={() => handleMarkCompleted(bk)}
                          className="btn btn-primary btn-sm"
                        >
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          Mark Completed
                        </button>
                      )}
                      <Link
                        to={`/lawyer/appointments/${bk.id}`}
                        className="btn btn-outline btn-sm"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>

                {bk.bookingStatus === BOOKING_STATUS.CONFIRMED && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-950">
                    {bk.mode === 'ONLINE' ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>
                          <strong>Online Video Session:</strong> {bk.meetingLink}
                        </span>
                        <a
                          href={bk.meetingLink}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-navy underline"
                        >
                          Open Link <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                      </div>
                    ) : (
                      <span>
                        <strong>In-Person Chambers Location:</strong> {bk.officeLocation}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
