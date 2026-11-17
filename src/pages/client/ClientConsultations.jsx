import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarCheck, Clock, Video, Users, ArrowRight, Search, RefreshCw,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Avatar from '../../components/common/Avatar';
import { BookingStatusBadge, PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getClientBookings } from '../../services/bookingService';
import { BOOKING_STATUS } from '../../services/bookingStateMachine';
import { cn, formatFullDate, formatINR, formatSlotRange, MODE_LABEL } from '../../utils/format';

const TABS = [
  { id: 'ALL', label: 'All' },
  { id: 'AWAITING_LAWYER', label: 'Awaiting Approval' },
  { id: 'RESCHEDULE_PROPOSED', label: 'Reschedule Requests' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'REFUNDED', label: 'Refunded' },
];

export default function ClientConsultations() {
  useDocumentTitle('My Consultations');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');

  const initialTab =
    filterParam === 'upcoming'
      ? 'CONFIRMED'
      : filterParam === 'reschedule'
        ? 'RESCHEDULE_PROPOSED'
        : 'ALL';

  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    if (filterParam === 'upcoming') setActiveTab('CONFIRMED');
    else if (filterParam === 'reschedule') setActiveTab('RESCHEDULE_PROPOSED');
    else if (!filterParam) setActiveTab('ALL');
  }, [filterParam]);

  const { data: bookings, loading, error, reload } = useAsync(
    () => getClientBookings(user.profileId),
    [user.profileId],
  );

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'CONFIRMED') setSearchParams({ filter: 'upcoming' }, { replace: true });
    else if (tabId === 'RESCHEDULE_PROPOSED') setSearchParams({ filter: 'reschedule' }, { replace: true });
    else setSearchParams({}, { replace: true });
  };

  const filtered = useMemo(() => {
    if (!bookings) return [];
    return bookings.filter((b) => {
      if (activeTab === 'ALL') return true;
      if (activeTab === 'REFUNDED') {
        return [BOOKING_STATUS.REFUND_PENDING, BOOKING_STATUS.REFUNDED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.EXPIRED].includes(
          b.bookingStatus,
        );
      }
      return b.bookingStatus === activeTab;
    });
  }, [bookings, activeTab]);

  const counts = useMemo(() => {
    const list = bookings || [];
    return {
      ALL: list.length,
      AWAITING_LAWYER: list.filter((b) => b.bookingStatus === BOOKING_STATUS.AWAITING_LAWYER).length,
      RESCHEDULE_PROPOSED: list.filter((b) => b.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED).length,
      CONFIRMED: list.filter((b) => b.bookingStatus === BOOKING_STATUS.CONFIRMED).length,
      COMPLETED: list.filter((b) => b.bookingStatus === BOOKING_STATUS.COMPLETED).length,
      REFUNDED: list.filter((b) =>
        [BOOKING_STATUS.REFUND_PENDING, BOOKING_STATUS.REFUNDED, BOOKING_STATUS.DECLINED, BOOKING_STATUS.EXPIRED].includes(b.bookingStatus),
      ).length,
    };
  }, [bookings]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client Workspace"
        title="My Consultations"
        description="Track your consultation requests, respond to lawyer reschedule proposals, and view confirmed meeting instructions."
        actions={
          <Link to="/search?tab=lawyers" className="btn btn-primary btn-sm">
            <Search className="h-4 w-4" aria-hidden="true" /> Book New Consultation
          </Link>
        }
      />

      {/* Filter Tabs */}
      <div role="tablist" aria-label="Consultation status tabs" className="flex flex-wrap gap-1.5 rounded-2xl border border-line bg-white p-1.5">
        {TABS.map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition sm:text-sm',
                active ? 'bg-navy text-white shadow-xs' : 'text-muted hover:bg-cream hover:text-navy',
              )}
            >
              <span>{t.label}</span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[11px]',
                  active ? 'bg-gold text-navy' : 'bg-cream text-muted',
                )}
              >
                {counts[t.id] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <LineSkeleton lines={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={CalendarCheck}
          title="No consultations in this category"
          message="Browse the lawyer directory and click Book Consultation on any advocate’s profile to schedule a 1-hour session."
          action={
            <Link to="/search?tab=lawyers" className="btn btn-primary">
              Find a Lawyer
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((b) => {
            const slot = b.finalSlot || b.originalSlot;
            const origSlot = b.originalSlot;
            const isReschedule = b.bookingStatus === BOOKING_STATUS.RESCHEDULE_PROPOSED;
            return (
              <article key={b.id} className="card p-5 transition hover:border-gold/60">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="flex items-start gap-4">
                    <Avatar name={b.lawyer?.name || 'Lawyer'} src={b.lawyer?.photo} size="md" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-muted">{b.id}</span>
                        <BookingStatusBadge status={b.bookingStatus} />
                        {b.payment && <PaymentStatusBadge status={b.payment.status} />}
                      </div>
                      <Link
                        to={`/lawyers/${b.lawyerId}`}
                        className="mt-1.5 block text-lg font-semibold text-navy hover:underline"
                      >
                        {b.lawyer?.name || 'Advocate'}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                        <span className="inline-flex items-center gap-1 font-medium text-ink">
                          <Clock className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                          {slot ? `${formatFullDate(slot.date)} · ${formatSlotRange(slot.startTime, slot.endTime)}` : '—'}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          {b.mode === 'ONLINE' ? (
                            <Video className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                          ) : (
                            <Users className="h-3.5 w-3.5 text-gold-600" aria-hidden="true" />
                          )}
                          {MODE_LABEL[b.mode]}
                        </span>
                        <span className="font-semibold text-navy">{formatINR(b.totalAmount)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Link
                      to={`/client/consultations/${b.id}`}
                      className={cn('btn btn-sm', isReschedule ? 'btn-gold' : 'btn-outline')}
                    >
                      {isReschedule ? 'Respond to Proposal' : 'View Details'}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {isReschedule && b.proposal && (
                  <div className="mt-4 flex flex-col justify-between gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-3.5 text-xs sm:flex-row sm:items-center">
                    <div className="flex items-start gap-2.5">
                      <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" aria-hidden="true" />
                      <div>
                        <p className="font-semibold text-purple-950">
                          Your lawyer has proposed a new consultation time:
                        </p>
                        <p className="mt-0.5 text-purple-900">
                          Original: {origSlot ? `${formatFullDate(origSlot.date)}, ${formatSlotRange(origSlot.startTime, origSlot.endTime)}` : '—'} →{' '}
                          <strong>
                            Proposed: {slot ? `${formatFullDate(slot.date)}, ${formatSlotRange(slot.startTime, slot.endTime)}` : '—'}
                          </strong>
                        </p>
                      </div>
                    </div>
                    <Link to={`/client/consultations/${b.id}`} className="font-semibold text-purple-950 underline">
                      Accept or Reject for Full Refund →
                    </Link>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

