import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, Loader2, Send } from 'lucide-react';
import Modal from '../common/Modal';
import FormField from '../forms/FormField';
import { getLawyerSlots } from '../../services/bookingService';
import { SLOT_STATUS } from '../../services/bookingStateMachine';
import { cn, formatFullDate, formatSlotRange, getTodayInTimeZone } from '../../utils/format';

/**
 * Flow B — Lawyer Proposes a Reschedule Modal.
 * Displays current booking date/time, calendar of dates with available 1-hour slots,
 * slot selector, optional reason/message, and Send Proposal button.
 */
export default function RescheduleModal({ open, onClose, booking, onSubmit }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [reason, setReason] = useState(
    'Unfortunately, I am unavailable at the originally requested time. Please consider this alternative.',
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !booking?.lawyerId) return;
    setLoading(true);
    setError('');
    setSelectedSlotId('');
    getLawyerSlots(booking.lawyerId)
      .then((all) => {
        const today = getTodayInTimeZone('Asia/Kolkata');
        const avail = all.filter(
          (s) => s.status === SLOT_STATUS.AVAILABLE
            && s.id !== booking.originalSlotId
            && s.date >= today,
        );
        setSlots(avail);
        const dates = [...new Set(avail.map((s) => s.date))];
        setSelectedDate(dates[0] || '');
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [open, booking?.lawyerId, booking?.originalSlotId]);

  const availableDates = useMemo(
    () => [...new Set(slots.map((s) => s.date))].sort(),
    [slots],
  );

  const daySlots = useMemo(
    () => slots.filter((s) => s.date === selectedDate),
    [slots, selectedDate],
  );

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedSlotId) {
      setError('Please select an alternative 1-hour time slot.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onSubmit({ proposedSlotId: selectedSlotId, reason });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const origSlot = booking?.originalSlot || booking?.finalSlot;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Propose a New Consultation Time"
      description="Select an alternative available 1-hour slot. The original slot hold will be released and the proposed slot will be reserved for the client’s response."
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={submitting} className="btn btn-outline">
            Cancel
          </button>
          <button
            type="submit"
            form="reschedule-proposal-form"
            disabled={submitting || !selectedSlotId}
            className="btn btn-primary"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
            Send Proposal
          </button>
        </>
      }
    >
      <form id="reschedule-proposal-form" onSubmit={handleSend} className="space-y-5">
        {origSlot && (
          <div className="rounded-xl border border-line bg-cream p-4 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Current Requested Slot
            </p>
            <p className="mt-1 font-semibold text-navy">
              {formatFullDate(origSlot.date)} · {formatSlotRange(origSlot.startTime, origSlot.endTime)} (IST)
            </p>
          </div>
        )}

        {loading ? (
          <p className="py-6 text-center text-sm text-muted">Loading your available 1-hour slots…</p>
        ) : availableDates.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
            You have no other available 1-hour slots published. Add slots in Manage Availability first.
          </p>
        ) : (
          <>
            <div>
              <label className="label flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-gold-600" aria-hidden="true" /> 1. Choose Alternative Date
              </label>
              <div className="flex flex-wrap gap-2">
                {availableDates.map((d) => {
                  const active = d === selectedDate;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedSlotId('');
                      }}
                      className={cn(
                        'rounded-xl border px-3.5 py-2 text-xs font-semibold transition',
                        active
                          ? 'border-navy bg-navy text-white'
                          : 'border-line bg-white text-ink hover:border-gold',
                      )}
                    >
                      {formatFullDate(d)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-gold-600" aria-hidden="true" /> 2. Choose 1-Hour Slot ({formatFullDate(selectedDate)})
              </label>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {daySlots.map((s) => {
                  const active = s.id === selectedSlotId;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedSlotId(s.id)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
                        active
                          ? 'border-gold bg-gold-100 text-navy ring-2 ring-gold/40'
                          : 'border-line bg-white text-ink hover:border-gold',
                      )}
                    >
                      <span>{formatSlotRange(s.startTime, s.endTime)}</span>
                      <span className="text-xs text-muted">60 min</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <FormField
          as="textarea"
          label="Message / Reason for Client (optional)"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Explain why you are proposing an alternative time…"
        />

        {error && (
          <p className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700" role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}

