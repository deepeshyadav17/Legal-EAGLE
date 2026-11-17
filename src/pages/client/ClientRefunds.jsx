import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RotateCcw, CheckCircle2, Clock, Loader2, ArrowRight } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useNotifications } from '../../context/NotificationContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getClientRefunds } from '../../services/paymentService';
import { processRefundCompletion } from '../../services/workflowCoordinator';
import { PAYMENT_STATUS } from '../../services/bookingStateMachine';
import { formatDateTime, formatINR } from '../../utils/format';

export default function ClientRefunds() {
  useDocumentTitle('Refunds Tracker');
  const { user } = useAuth();
  const { notify } = useToast();
  const { refreshNotifications } = useNotifications();
  const [completingId, setCompletingId] = useState('');

  const { data: refunds, loading, error, reload } = useAsync(
    () => getClientRefunds(user.profileId),
    [user.profileId],
  );

  const handleCompleteRefund = async (refund) => {
    setCompletingId(refund.id);
    try {
      await processRefundCompletion(refund.id);
      await refreshNotifications();
      notify(`Refund of ${formatINR(refund.amount)} marked completed.`);
      await reload(true);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setCompletingId('');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module B · Refund Tracker"
        title="Refunds"
        description="Full refunds initiated for declined, expired, or rejected-reschedule bookings. No cancellation fee is deducted."
      />

      {loading ? (
        <LineSkeleton lines={3} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !refunds?.length ? (
        <EmptyState
          icon={RotateCcw}
          title="No refunds recorded"
          message="If a lawyer declines your request or you reject a proposed reschedule time, your 100% refund will appear here."
        />
      ) : (
        <div className="space-y-4">
          {refunds.map((r) => {
            const isCompleted = r.status === PAYMENT_STATUS.REFUNDED;
            return (
              <article key={r.id} className="card p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-muted">{r.id}</span>
                      <PaymentStatusBadge status={r.status} />
                      {r.transactionReference && (
                        <span className="text-xs text-muted">Orig. Txn: {r.transactionReference}</span>
                      )}
                    </div>
                    <h2 className="mt-2 text-lg font-semibold text-navy">
                      {formatINR(r.amount)} Full Refund · {r.lawyer?.name || 'Advocate'}
                    </h2>
                    <p className="mt-1 text-xs text-ink">{r.reason}</p>
                    <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
                      <span>Initiated: {formatDateTime(r.initiatedAt)}</span>
                      {r.completedAt && <span>Completed: {formatDateTime(r.completedAt)}</span>}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!isCompleted && (
                      <button
                        type="button"
                        disabled={completingId === r.id}
                        onClick={() => handleCompleteRefund(r)}
                        className="btn btn-primary btn-sm"
                      >
                        {completingId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                        )}
                        Simulate Refund Completion
                      </button>
                    )}
                    <Link to={`/client/consultations/${r.bookingId}`} className="btn btn-outline btn-sm">
                      View Booking <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>

                {/* Visual Refund Progress Bar */}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-xs">
                  <div className="flex items-center gap-2 font-medium text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>1. Refund Initiated ({formatDateTime(r.initiatedAt)})</span>
                  </div>
                  <div className={`flex items-center gap-2 font-medium ${isCompleted ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
                    )}
                    <span>
                      {isCompleted
                        ? `2. Refund Completed (${formatDateTime(r.completedAt)})`
                        : '2. Awaiting Settlement Completion'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

