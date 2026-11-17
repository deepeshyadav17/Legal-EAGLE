import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarClock, Plus, Sparkles, Ban, Trash2, Sliders, Loader2, Calendar,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { SlotStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getConsultationSettings,
  getLawyerSlots,
  addOneHourSlot,
  generateBulkOneHourSlots,
  removeAvailableSlot,
  toggleBlockedDate,
} from '../../services/bookingService';
import { SLOT_STATUS } from '../../services/bookingStateMachine';
import { cn, formatFullDate, formatINR, formatSlotRange, MODE_LABEL } from '../../utils/format';

const START_TIME_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const h = i + 8; // 08:00 to 19:00
  const val = `${String(h).padStart(2, '0')}:00`;
  const endVal = `${String(h + 1).padStart(2, '0')}:00`;
  return { value: val, label: formatSlotRange(val, endVal) };
});

export default function LawyerAvailability() {
  useDocumentTitle('Manage Availability');
  const { user } = useAuth();
  const { notify } = useToast();

  const [selectedDate, setSelectedDate] = useState('2026-11-10');
  const [newStartTime, setNewStartTime] = useState('10:00');
  const [bulkStart, setBulkStart] = useState('10');
  const [bulkEnd, setBulkEnd] = useState('17');
  const [busy, setBusy] = useState('');

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [settings, slots] = await Promise.all([
        getConsultationSettings(user.profileId),
        getLawyerSlots(user.profileId),
      ]);
      return { settings, slots };
    },
    [user.profileId],
  );

  useEffect(() => {
    if (data?.slots?.length && !selectedDate) {
      setSelectedDate(data.slots[0].date);
    }
  }, [data, selectedDate]);

  const allDates = useMemo(() => {
    if (!data) return [];
    const set = new Set([
      ...data.slots.map((s) => s.date),
      ...(data.settings.blockedDates || []),
      selectedDate,
    ].filter(Boolean));
    return [...set].sort();
  }, [data, selectedDate]);

  const daySlots = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.slots.filter((s) => s.date === selectedDate);
  }, [data, selectedDate]);

  const isDateBlocked = useMemo(
    () => Boolean(data?.settings?.blockedDates?.includes(selectedDate)),
    [data, selectedDate],
  );

  const handleAddSingleSlot = async (e) => {
    e.preventDefault();
    setBusy('add');
    try {
      await addOneHourSlot(user.profileId, { date: selectedDate, startTime: newStartTime });
      notify(`Added 1-hour slot on ${formatFullDate(selectedDate)}.`);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleBulkGenerate = async () => {
    setBusy('bulk');
    try {
      const created = await generateBulkOneHourSlots(user.profileId, {
        date: selectedDate,
        startHour: Number(bulkStart),
        endHour: Number(bulkEnd),
        skipBreakHour: 13,
      });
      notify(`Generated ${created.length} one-hour slot${created.length === 1 ? '' : 's'} for ${formatFullDate(selectedDate)}.`);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleToggleBlock = async () => {
    setBusy('block');
    try {
      const updated = await toggleBlockedDate(user.profileId, selectedDate);
      const nowBlocked = updated.blockedDates.includes(selectedDate);
      notify(
        nowBlocked
          ? `${formatFullDate(selectedDate)} marked as blocked/unavailable.`
          : `${formatFullDate(selectedDate)} unblocked and available.`,
        nowBlocked ? 'info' : 'success',
      );
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  const handleRemoveSlot = async (slotId) => {
    setBusy(slotId);
    try {
      await removeAvailableSlot(user.profileId, slotId);
      notify('Available slot removed.', 'info');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <LineSkeleton lines={6} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { settings, slots } = data;

  const statusCounts = {
    available: slots.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length,
    reserved: slots.filter((s) => s.status === SLOT_STATUS.RESERVED).length,
    awaiting: slots.filter((s) => s.status === SLOT_STATUS.AWAITING_APPROVAL).length,
    proposed: slots.filter((s) => s.status === SLOT_STATUS.PROPOSED).length,
    confirmed: slots.filter((s) => s.status === SLOT_STATUS.CONFIRMED).length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module A · Lawyer Availability"
        title="Manage Availability & 1-Hour Slots"
        description="Publish 60-minute consultation slots, generate daily schedules, block holiday dates, and monitor reserved or confirmed slots."
        actions={
          <Link to="/lawyer/consultation-settings" className="btn btn-outline btn-sm">
            <Sliders className="h-4 w-4" aria-hidden="true" /> Fee & Mode Settings ({formatINR(settings.fee)}/hr)
          </Link>
        }
      />

      {/* Current Fee & Status Summary Strip */}
      <div className="card flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div>
            <span className="text-xs text-muted">1-Hour Consultation Fee</span>
            <p className="font-sans tabular-nums text-xl font-semibold text-navy">{formatINR(settings.fee)}</p>
          </div>
          <div className="h-8 w-px bg-line" aria-hidden="true" />
          <div>
            <span className="text-xs text-muted">Offered Modes</span>
            <p className="font-medium text-navy">
              {(settings.availableModes || []).map((m) => MODE_LABEL[m]).join(' · ')}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge border border-emerald-200 bg-emerald-50 text-emerald-900">
            Available: {statusCounts.available}
          </span>
          <span className="badge border border-amber-300 bg-amber-50 text-amber-900">
            Reserved: {statusCounts.reserved}
          </span>
          <span className="badge border border-amber-300 bg-amber-100 text-amber-900">
            Awaiting Approval: {statusCounts.awaiting}
          </span>
          <span className="badge border border-purple-200 bg-purple-50 text-purple-900">
            Proposed: {statusCounts.proposed}
          </span>
          <span className="badge bg-navy text-white">
            Confirmed: {statusCounts.confirmed}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Date Picker & Slot Creation Controls */}
        <div className="space-y-6 lg:col-span-5">
          {/* Date Selector */}
          <section className="card p-5" aria-labelledby="date-picker-heading">
            <h2 id="date-picker-heading" className="flex items-center gap-2 text-base font-semibold text-navy">
              <Calendar className="h-4 w-4 text-gold-600" aria-hidden="true" /> Select Date to Manage
            </h2>
            <div className="mt-3">
              <label htmlFor="custom-date-input" className="label text-xs">
                Jump to any date
              </label>
              <input
                id="custom-date-input"
                type="date"
                min="2026-11-02"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input"
              />
            </div>

            <div className="mt-4 max-h-60 space-y-1.5 overflow-y-auto pr-1">
              {allDates.map((d) => {
                const count = slots.filter((s) => s.date === d).length;
                const blocked = settings.blockedDates?.includes(d);
                const active = d === selectedDate;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDate(d)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 text-left text-xs font-medium transition',
                      active
                        ? 'border-navy bg-navy text-white'
                        : 'border-line bg-cream/40 text-ink hover:border-gold',
                    )}
                  >
                    <span>{formatFullDate(d)}</span>
                    <span className={cn('badge', active ? 'bg-gold text-navy' : blocked ? 'bg-red-50 text-red-700' : 'bg-white text-muted')}>
                      {blocked ? 'Blocked' : `${count} slot${count === 1 ? '' : 's'}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Add Single 1-Hour Slot */}
          <section className="card p-5" aria-labelledby="single-slot-heading">
            <h2 id="single-slot-heading" className="text-base font-semibold text-navy">
              Add 1-Hour Slot on {formatFullDate(selectedDate)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Every consultation slot is fixed at 60 minutes. Overlapping slots are prevented automatically.
            </p>
            <form onSubmit={handleAddSingleSlot} className="mt-4 flex gap-2">
              <select
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                aria-label="Select 1-hour slot window"
                className="input flex-1"
              >
                {START_TIME_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!!busy || isDateBlocked}
                className="btn btn-primary shrink-0"
              >
                {busy === 'add' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                Add Slot
              </button>
            </form>
          </section>

          {/* Generate Working-Hours Schedule */}
          <section className="card p-5" aria-labelledby="bulk-slot-heading">
            <h2 id="bulk-slot-heading" className="text-base font-semibold text-navy">
              Generate Working Hours Schedule
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Populate 1-hour slots across working hours for {formatFullDate(selectedDate)} (skips 1:00–2:00 PM lunch break).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="bulk-start" className="label text-xs">Start Hour</label>
                <select id="bulk-start" value={bulkStart} onChange={(e) => setBulkStart(e.target.value)} className="input">
                  {[8, 9, 10, 11, 12, 14].map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="bulk-end" className="label text-xs">End Hour</label>
                <select id="bulk-end" value={bulkEnd} onChange={(e) => setBulkEnd(e.target.value)} className="input">
                  {[14, 15, 16, 17, 18, 19, 20].map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
            </div>
            <button
              type="button"
              disabled={!!busy || isDateBlocked}
              onClick={handleBulkGenerate}
              className="btn btn-outline btn-sm mt-3 w-full"
            >
              {busy === 'bulk' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Sparkles className="h-4 w-4 text-gold-600" aria-hidden="true" />}
              Generate 1-Hour Slots for {formatFullDate(selectedDate)}
            </button>
          </section>
        </div>

        {/* Right Column: Slots on Selected Date */}
        <section className="card p-6 lg:col-span-7" aria-labelledby="day-slots-heading">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
            <div>
              <h2 id="day-slots-heading" className="flex items-center gap-2 text-lg font-semibold text-navy">
                <CalendarClock className="h-5 w-5 text-gold-600" aria-hidden="true" />
                Slots for {formatFullDate(selectedDate)}
              </h2>
              <p className="text-xs text-muted">
                Timezone: Asia/Kolkata (IST) · 60-minute slots
              </p>
            </div>

            <button
              type="button"
              disabled={!!busy}
              onClick={handleToggleBlock}
              className={cn('btn btn-sm', isDateBlocked ? 'btn-primary' : 'btn-danger-outline')}
            >
              {busy === 'block' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Ban className="h-4 w-4" aria-hidden="true" />}
              {isDateBlocked ? 'Unblock Date' : 'Block Date (Holiday / Leave)'}
            </button>
          </div>

          {isDateBlocked && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-900">
              This date is currently blocked for holiday or personal leave. Clients cannot book slots on this date unless you unblock it.
            </div>
          )}

          {daySlots.length > 0 ? (
            <ul className="mt-5 divide-y divide-line">
              {daySlots.map((slot) => {
                const canRemove = [SLOT_STATUS.AVAILABLE, SLOT_STATUS.UNAVAILABLE].includes(slot.status);
                return (
                  <li key={slot.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                    <div>
                      <p className="text-sm font-semibold text-navy">
                        {formatSlotRange(slot.startTime, slot.endTime)}
                      </p>
                      <p className="text-xs text-muted">
                        Duration: 60 mins · ID: <span className="font-mono">{slot.id}</span>
                        {slot.bookingId && (
                          <>
                            {' · '}
                            <Link to={`/lawyer/appointments/${slot.bookingId}`} className="font-semibold text-navy hover:underline">
                              Booking {slot.bookingId}
                            </Link>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <SlotStatusBadge status={slot.status} />
                      {canRemove && (
                        <button
                          type="button"
                          disabled={busy === slot.id}
                          onClick={() => handleRemoveSlot(slot.id)}
                          className="rounded-lg p-2 text-red-700 hover:bg-red-50"
                          aria-label={`Remove slot ${formatSlotRange(slot.startTime, slot.endTime)}`}
                          title="Remove available slot"
                        >
                          {busy === slot.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-line bg-cream/60 p-8 text-center">
              <p className="text-sm font-medium text-navy">
                No 1-hour slots configured for {formatFullDate(selectedDate)}.
              </p>
              <p className="mt-1 text-xs text-muted">
                Use the controls on the left to add an individual 1-hour slot or generate a full day’s schedule.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

