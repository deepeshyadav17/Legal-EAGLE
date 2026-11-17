import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Calendar, Clock, Video, Users, MapPin, ShieldCheck, Loader2, Lock, Sparkles,
} from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import DemoBadge from '../../components/common/DemoBadge';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import { SlotStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getLawyer } from '../../services/lawyerService';
import { getConsultationSettings, getLawyerSlots } from '../../services/bookingService';
import { initiateConsultationCheckout } from '../../services/workflowCoordinator';
import { SLOT_STATUS } from '../../services/bookingStateMachine';
import { practiceName } from '../../mock/referenceData';
import {
  cn, formatFullDate, formatINR, formatSlotRange, getTodayInTimeZone, MODE_LABEL,
} from '../../utils/format';

export default function BookConsultationPage() {
  const { id: lawyerId } = useParams();
  const navigate = useNavigate();
  const { user, demoLogin } = useAuth();
  const { notify } = useToast();
  const { refreshNotifications } = useNotifications();

  const [mode, setMode] = useState('ONLINE');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [clientNotes, setClientNotes] = useState('');
  const [reserving, setReserving] = useState(false);
  const [switchingDemo, setSwitchingDemo] = useState(false);
  const todayStr = getTodayInTimeZone('Asia/Kolkata');

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [lawyer, settings, slots] = await Promise.all([
        getLawyer(lawyerId),
        getConsultationSettings(lawyerId),
        getLawyerSlots(lawyerId),
      ]);
      return { lawyer, settings, slots };
    },
    [lawyerId],
  );

  useDocumentTitle(data?.lawyer ? `Book Consultation · ${data.lawyer.name}` : 'Book Consultation');

  // Preselect offered consultation mode & first date with available slots
  useEffect(() => {
    if (!data) return;
    const modes = data.settings.availableModes || ['ONLINE'];
    if (!modes.includes(mode)) {
      setMode(modes[0]);
    }
    const availDates = [
      ...new Set(
        data.slots
          .filter((s) => s.date >= todayStr && s.status === SLOT_STATUS.AVAILABLE)
          .map((s) => s.date),
      ),
    ].sort();
    if (selectedDate && selectedDate < todayStr) {
      setSelectedDate(availDates[0] || '');
      setSelectedSlotId('');
    } else if (availDates.length && !selectedDate) {
      setSelectedDate(availDates[0]);
    }
  }, [data, mode, selectedDate, todayStr]);

  const calendarDates = useMemo(() => {
    if (!data) return [];
    const byDate = new Map();
    data.slots.forEach((s) => {
      if (!byDate.has(s.date)) byDate.set(s.date, []);
      byDate.get(s.date).push(s);
    });
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, list]) => {
        const isPast = date < todayStr;
        const isBlocked = (data.settings.blockedDates || []).includes(date);
        const availCount = list.filter((s) => s.status === SLOT_STATUS.AVAILABLE).length;
        return {
          date,
          isPast,
          isBlocked,
          availCount,
          totalCount: list.length,
          selectable: !isPast && !isBlocked && availCount > 0,
        };
      });
  }, [data, todayStr]);

  const slotsForDate = useMemo(() => {
    if (!data || !selectedDate) return [];
    return data.slots.filter((s) => s.date === selectedDate);
  }, [data, selectedDate]);

  const selectedSlot = useMemo(
    () => slotsForDate.find((s) => s.id === selectedSlotId) || null,
    [slotsForDate, selectedSlotId],
  );

  const handleQuickClientLogin = async () => {
    setSwitchingDemo(true);
    try {
      const u = await demoLogin('client');
      notify(`Signed in as Demo Client (${u.name}).`);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSwitchingDemo(false);
    }
  };

  const handleProceedToPayment = async () => {
    if (!user || user.role !== 'client') {
      notify('Please sign in with a Client account to book a consultation.', 'error');
      return;
    }
    if (!selectedSlot) {
      notify('Please select an available 1-hour time slot.', 'error');
      return;
    }
    setReserving(true);
    try {
      const { booking } = await initiateConsultationCheckout({
        clientId: user.profileId,
        lawyerId,
        slotId: selectedSlot.id,
        mode,
        clientNotes,
      });
      await refreshNotifications();
      notify('Slot reserved for 10 minutes. Complete payment to submit your request.');
      navigate(`/checkout/${booking.id}`);
    } catch (err) {
      notify(err.message, 'error');
      reload(true);
    } finally {
      setReserving(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-10">
        <LineSkeleton lines={6} />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="container-page py-10">
        <ErrorState error={error} onRetry={reload} />
      </div>
    );
  }

  const { lawyer, settings } = data;
  const availableModes = settings.availableModes || ['ONLINE'];
  const fee = settings.fee ?? 1500;
  const isClient = user?.role === 'client';

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/lawyers/${lawyer.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to {lawyer.name}’s Profile
        </Link>
        <DemoBadge label="Demo Booking Flow · Asia/Kolkata (IST)" />
      </div>

      {!isClient && (
        <div className="mb-6 flex flex-col justify-between gap-4 rounded-2xl border border-gold bg-gold-100/70 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-gold">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy">
                Client Account Required to Complete Booking
              </p>
              <p className="text-xs text-ink">
                You can browse slots below, or switch to the Demo Client account in one click to reserve a slot and test payment.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleQuickClientLogin}
            disabled={switchingDemo}
            className="btn btn-primary btn-sm self-start sm:self-auto"
          >
            {switchingDemo && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            Switch to Demo Client (Ananya Verma)
          </button>
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Steps Column */}
        <div className="space-y-6 lg:col-span-7 xl:col-span-8">
          {/* Step 1: Lawyer Card */}
          <section className="card p-6" aria-labelledby="step1-heading">
            <p className="eyebrow">Step 1 · Selected Legal Professional</p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={lawyer.name} src={lawyer.photo} size="lg" />
                <div>
                  <h1 id="step1-heading" className="font-serif text-xl font-semibold text-navy sm:text-2xl">
                    {lawyer.name}
                  </h1>
                  <p className="text-sm text-ink">{lawyer.headline}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {lawyer.practiceAreas.map((s, idx) => (
                      <PracticeAreaBadge key={s} slug={s} primary={idx === 0} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-line bg-cream px-4 py-3 text-right">
                <p className="text-xs text-muted">1-Hour Consultation</p>
                <p className="font-sans tabular-nums text-2xl font-semibold text-navy">{formatINR(fee)}</p>
              </div>
            </div>
          </section>

          {/* Step 2: Select Consultation Type */}
          <section className="card p-6" aria-labelledby="step2-heading">
            <p className="eyebrow">Step 2 · Consultation Mode</p>
            <h2 id="step2-heading" className="mt-1 text-lg font-semibold text-navy">
              Select Consultation Type
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {['ONLINE', 'IN_PERSON'].map((m) => {
                const supported = availableModes.includes(m);
                const active = mode === m;
                const Icon = m === 'ONLINE' ? Video : Users;
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={!supported}
                    onClick={() => setMode(m)}
                    className={cn(
                      'flex flex-col items-start rounded-2xl border p-4 text-left transition',
                      !supported
                        ? 'cursor-not-allowed border-line bg-gray-50 opacity-50'
                        : active
                          ? 'border-navy bg-navy text-white shadow-sm'
                          : 'border-line bg-cream/40 text-ink hover:border-gold',
                    )}
                  >
                    <div className="flex w-full items-center justify-between">
                      <Icon className={cn('h-5 w-5', active ? 'text-gold' : 'text-navy')} aria-hidden="true" />
                      {!supported && <span className="text-[11px] font-medium text-muted">Not offered</span>}
                    </div>
                    <span className="mt-2.5 font-semibold">{MODE_LABEL[m]}</span>
                    <span className={cn('mt-1 text-xs', active ? 'text-white/75' : 'text-muted')}>
                      {m === 'ONLINE'
                        ? 'Video consultation · Meeting link shared after lawyer confirms'
                        : 'Meet at the lawyer’s chambers'}
                    </span>
                  </button>
                );
              })}
            </div>

            {mode === 'IN_PERSON' ? (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-cream p-3.5 text-xs text-ink">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                <div>
                  <strong className="text-navy">Approved Office Location:</strong>{' '}
                  {settings.officeLocation || `${lawyer.city} Chambers`}
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-line bg-cream p-3.5 text-xs text-muted">
                <Video className="mt-0.5 h-4 w-4 shrink-0 text-gold-600" aria-hidden="true" />
                <span>
                  Online meeting details and joining link are generated and shared only after the lawyer confirms your appointment.
                </span>
              </div>
            )}
          </section>

          {/* Step 3: Select Date */}
          <section className="card p-6" aria-labelledby="step3-heading">
            <p className="eyebrow">Step 3 · Select Date</p>
            <h2 id="step3-heading" className="mt-1 flex items-center gap-2 text-lg font-semibold text-navy">
              <Calendar className="h-5 w-5 text-gold-600" aria-hidden="true" /> Published Availability Calendar
            </h2>
            <p className="mt-1 text-xs text-muted">
              Past dates, blocked holidays, and dates with zero available slots cannot be selected.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
              {calendarDates.map((d) => {
                const active = d.date === selectedDate;
                return (
                  <button
                    key={d.date}
                    type="button"
                    disabled={!d.selectable}
                    onClick={() => {
                      setSelectedDate(d.date);
                      setSelectedSlotId('');
                    }}
                    className={cn(
                      'flex flex-col rounded-xl border p-3 text-left transition',
                      !d.selectable
                        ? 'cursor-not-allowed border-line bg-gray-50 text-muted opacity-55'
                        : active
                          ? 'border-navy bg-navy text-white shadow-sm'
                          : 'border-line bg-white text-ink hover:border-gold',
                    )}
                  >
                    <span className="text-xs font-semibold">{formatFullDate(d.date)}</span>
                    <span className={cn('mt-1 text-[11px]', active ? 'text-gold' : 'text-muted')}>
                      {d.isPast
                        ? 'Past date'
                        : d.isBlocked
                          ? 'Blocked / Leave'
                          : d.availCount > 0
                            ? `${d.availCount} slot${d.availCount === 1 ? '' : 's'} open`
                            : 'Fully booked'}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Step 4: Select 1-Hour Time Slot */}
          <section className="card p-6" aria-labelledby="step4-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="eyebrow">Step 4 · Select 1-Hour Slot</p>
                <h2 id="step4-heading" className="mt-1 flex items-center gap-2 text-lg font-semibold text-navy">
                  <Clock className="h-5 w-5 text-gold-600" aria-hidden="true" />
                  {selectedDate ? `Time Slots for ${formatFullDate(selectedDate)}` : 'Select a date above'}
                </h2>
              </div>
              <span className="text-xs font-medium text-muted">Timezone: Asia/Kolkata (IST)</span>
            </div>

            {slotsForDate.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {slotsForDate.map((slot) => {
                  const isAvail = slot.status === SLOT_STATUS.AVAILABLE;
                  const active = slot.id === selectedSlotId;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!isAvail}
                      onClick={() => setSelectedSlotId(slot.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-4 text-left transition',
                        !isAvail
                          ? 'cursor-not-allowed border-line bg-gray-50 opacity-65'
                          : active
                            ? 'border-gold bg-gold-100 text-navy ring-2 ring-gold/50'
                            : 'border-line bg-white hover:border-gold',
                      )}
                    >
                      <div>
                        <p className="text-sm font-semibold text-navy">
                          {formatSlotRange(slot.startTime, slot.endTime)}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">60 minutes · 1-on-1 consultation</p>
                      </div>
                      <SlotStatusBadge status={slot.status} />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
                Select an available date above to view 1-hour slots.
              </p>
            )}

            <div className="mt-5">
              <label htmlFor="client-notes" className="label">
                Brief Matter Summary (optional)
              </label>
              <textarea
                id="client-notes"
                rows={3}
                value={clientNotes}
                onChange={(e) => setClientNotes(e.target.value)}
                placeholder="Briefly describe the legal topic you wish to discuss (do not include sensitive confidential data in this demo)…"
                className="input resize-y"
              />
            </div>
          </section>
        </div>

        {/* Step 5: Booking Summary Sidebar */}
        <aside className="card sticky top-24 p-6 lg:col-span-5 xl:col-span-4" aria-labelledby="summary-heading">
          <p className="eyebrow">Step 5 · Review & Reserve</p>
          <h2 id="summary-heading" className="mt-1 text-lg font-semibold text-navy">
            Booking Summary
          </h2>

          <div className="mt-4 flex items-center gap-3 rounded-xl border border-line bg-cream/60 p-3.5">
            <Avatar name={lawyer.name} src={lawyer.photo} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-navy">{lawyer.name}</p>
              <p className="truncate text-xs text-gold-600">{practiceName(lawyer.practiceAreas[0])}</p>
            </div>
          </div>

          <dl className="mt-4 space-y-2.5 border-y border-line py-4 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Consultation Mode</dt>
              <dd className="font-medium text-navy">{MODE_LABEL[mode]}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Selected Date</dt>
              <dd className="font-medium text-navy">
                {selectedSlot ? formatFullDate(selectedSlot.date) : 'Not selected'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Time Window (IST)</dt>
              <dd className="font-medium text-navy">
                {selectedSlot ? formatSlotRange(selectedSlot.startTime, selectedSlot.endTime) : 'Select a slot'}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Duration</dt>
              <dd className="font-medium text-navy">60 Minutes (1 Hour)</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-line pt-2.5">
              <dt className="text-muted">Consultation Fee</dt>
              <dd className="font-medium text-navy">{formatINR(fee)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Platform Fee & Taxes</dt>
              <dd className="font-medium text-navy">{formatINR(0)} (Included)</dd>
            </div>
            <div className="flex justify-between gap-2 border-t border-line pt-2.5 text-base font-semibold text-navy">
              <dt>Total Payable</dt>
              <dd>{formatINR(fee)}</dd>
            </div>
          </dl>

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs leading-relaxed text-amber-950">
            <p className="flex items-center gap-1.5 font-semibold">
              <ShieldCheck className="h-4 w-4 shrink-0 text-amber-800" aria-hidden="true" /> Important Booking Policy
            </p>
            <p className="mt-1">
              Payment is required to submit your consultation request. Your appointment will be confirmed only after the lawyer accepts it. If the lawyer proposes another time, you can accept that time or reject it and receive a full refund.
            </p>
          </div>

          <button
            type="button"
            disabled={!selectedSlot || reserving || !isClient}
            onClick={handleProceedToPayment}
            className="btn btn-primary mt-5 w-full"
          >
            {reserving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-4 w-4 text-gold" aria-hidden="true" />
            )}
            Proceed to Payment ({formatINR(fee)})
          </button>

          <p className="mt-2.5 text-center text-[11px] text-muted">
            Proceeding places a 10-minute temporary hold on your selected 1-hour slot.
          </p>
        </aside>
      </div>
    </div>
  );
}

