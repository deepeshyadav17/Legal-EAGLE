import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Save, Loader2, CalendarClock, Video, Users, Plus, X } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import FormField from '../../components/forms/FormField';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  getConsultationSettings,
  updateConsultationSettings,
} from '../../services/bookingService';
import { cn, formatFullDate } from '../../utils/format';

const WEEKDAYS = [
  { code: 'MON', label: 'Mon' },
  { code: 'TUE', label: 'Tue' },
  { code: 'WED', label: 'Wed' },
  { code: 'THU', label: 'Thu' },
  { code: 'FRI', label: 'Fri' },
  { code: 'SAT', label: 'Sat' },
  { code: 'SUN', label: 'Sun' },
];

export default function LawyerConsultationSettings() {
  useDocumentTitle('Consultation Settings');
  const { user } = useAuth();
  const { notify } = useToast();

  const [fee, setFee] = useState(1500);
  const [availableModes, setAvailableModes] = useState(['ONLINE', 'IN_PERSON']);
  const [bookingLeadTime, setBookingLeadTime] = useState(2);
  const [workingDays, setWorkingDays] = useState(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']);
  const [workStart, setWorkStart] = useState('10:00');
  const [workEnd, setWorkEnd] = useState('18:00');
  const [officeLocation, setOfficeLocation] = useState('');
  const [blockedDates, setBlockedDates] = useState([]);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: settings, loading, error, reload } = useAsync(
    () => getConsultationSettings(user.profileId),
    [user.profileId],
  );

  useEffect(() => {
    if (settings) {
      setFee(settings.fee ?? 1500);
      setAvailableModes(settings.availableModes || ['ONLINE']);
      setBookingLeadTime(settings.bookingLeadTime ?? 2);
      setWorkingDays(settings.workingDays || ['MON', 'TUE', 'WED', 'THU', 'FRI']);
      setWorkStart(settings.workingHours?.start || '10:00');
      setWorkEnd(settings.workingHours?.end || '18:00');
      setOfficeLocation(settings.officeLocation || '');
      setBlockedDates(settings.blockedDates || []);
    }
  }, [settings]);

  const toggleMode = (m) => {
    setAvailableModes((prev) =>
      prev.includes(m) ? (prev.length > 1 ? prev.filter((x) => x !== m) : prev) : [...prev, m],
    );
  };

  const toggleDay = (d) => {
    setWorkingDays((prev) =>
      prev.includes(d) ? (prev.length > 1 ? prev.filter((x) => x !== d) : prev) : [...prev, d],
    );
  };

  const addBlocked = () => {
    if (!newBlockedDate) return;
    if (!blockedDates.includes(newBlockedDate)) {
      setBlockedDates((prev) => [...prev, newBlockedDate].sort());
    }
    setNewBlockedDate('');
  };

  const removeBlocked = (d) => {
    setBlockedDates((prev) => prev.filter((x) => x !== d));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateConsultationSettings(user.profileId, {
        fee: Number(fee),
        availableModes,
        bookingLeadTime: Number(bookingLeadTime),
        workingDays,
        workingHours: { start: workStart, end: workEnd },
        officeLocation,
        blockedDates,
      });
      notify('Consultation fee, modes and schedule settings saved.');
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LineSkeleton lines={5} />;
  if (error || !settings) return <ErrorState error={error} onRetry={reload} />;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Lawyer Workspace"
        title="Consultation Settings"
        description="Configure your 1-hour consultation fee in INR, offered meeting modes, working days, lead time and holiday dates."
        actions={
          <Link to="/lawyer/availability" className="btn btn-outline btn-sm">
            <CalendarClock className="h-4 w-4" aria-hidden="true" /> Manage Time Slots
          </Link>
        }
      />

      <form onSubmit={handleSubmit} className="card max-w-3xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="1-Hour Consultation Fee (INR ₹)"
            type="number"
            min={200}
            max={100000}
            step={100}
            required
            value={fee}
            onChange={(e) => setFee(e.target.value)}
            hint="Displayed on your public profile and frozen when a client reserves a slot."
          />
          <FormField
            label="Minimum Advance Booking Time (Hours)"
            type="number"
            min={0}
            max={72}
            value={bookingLeadTime}
            onChange={(e) => setBookingLeadTime(e.target.value)}
            hint="Minimum notice before a consultation start time."
          />
        </div>

        {/* Supported Consultation Modes */}
        <div>
          <p className="label">Supported Consultation Modes *</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { code: 'ONLINE', label: 'Online Consultation', icon: Video, desc: 'Video session (link shared upon confirmation)' },
              { code: 'IN_PERSON', label: 'In-Person Consultation', icon: Users, desc: 'At your chambers / office address' },
            ].map(({ code, label, icon: Icon, desc }) => {
              const active = availableModes.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleMode(code)}
                  className={cn(
                    'flex flex-col items-start rounded-2xl border p-4 text-left transition',
                    active ? 'border-navy bg-navy text-white' : 'border-line bg-cream/40 text-ink hover:border-gold',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active ? 'text-gold' : 'text-navy')} aria-hidden="true" />
                  <span className="mt-2 font-semibold">{label}</span>
                  <span className={cn('mt-0.5 text-xs', active ? 'text-white/75' : 'text-muted')}>{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        <FormField
          label="Approved Office / Chambers Location (for In-Person Consultations)"
          value={officeLocation}
          onChange={(e) => setOfficeLocation(e.target.value)}
          placeholder="e.g. Chamber 204, C-Scheme Legal Complex, Jaipur"
        />

        {/* Available Weekdays */}
        <div>
          <p className="label">Available Working Weekdays *</p>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const active = workingDays.includes(d.code);
              return (
                <button
                  key={d.code}
                  type="button"
                  onClick={() => toggleDay(d.code)}
                  className={cn(
                    'rounded-xl border px-4 py-2 text-xs font-semibold transition',
                    active ? 'border-navy bg-navy text-white' : 'border-line bg-white text-ink hover:border-gold',
                  )}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Default Daily Working Hours */}
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Default Daily Start Time"
            type="time"
            value={workStart}
            onChange={(e) => setWorkStart(e.target.value)}
          />
          <FormField
            label="Default Daily End Time"
            type="time"
            value={workEnd}
            onChange={(e) => setWorkEnd(e.target.value)}
          />
        </div>

        {/* Blocked Dates */}
        <div className="border-t border-line pt-5">
          <p className="label">Blocked Dates (Holidays / Personal Leave)</p>
          <div className="flex gap-2">
            <input
              type="date"
              value={newBlockedDate}
              onChange={(e) => setNewBlockedDate(e.target.value)}
              className="input max-w-xs"
            />
            <button type="button" onClick={addBlocked} className="btn btn-outline btn-sm">
              <Plus className="h-4 w-4" aria-hidden="true" /> Block Date
            </button>
          </div>
          {blockedDates.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {blockedDates.map((d) => (
                <span key={d} className="badge border border-red-200 bg-red-50 text-red-900">
                  {formatFullDate(d)}
                  <button
                    type="button"
                    onClick={() => removeBlocked(d)}
                    aria-label={`Unblock ${d}`}
                    className="ml-1 hover:text-red-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end border-t border-line pt-4">
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            Save Consultation Settings
          </button>
        </div>
      </form>
    </div>
  );
}

