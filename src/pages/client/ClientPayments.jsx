import { Link } from 'react-router-dom';
import { CreditCard, ArrowRight, RotateCcw } from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import { PaymentStatusBadge } from '../../components/booking/BookingStatusBadge';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { EmptyState, ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getPaymentHistory } from '../../services/paymentService';
import { formatDateTime, formatINR } from '../../utils/format';

export default function ClientPayments() {
  useDocumentTitle('Payment History');
  const { user } = useAuth();

  const { data: payments, loading, error, reload } = useAsync(
    () => getPaymentHistory(user.profileId),
    [user.profileId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Module B · Payments & Refunds"
        title="Payment History"
        description="View all simulated consultation payment transactions, booking references and associated refund statuses."
        actions={
          <Link to="/client/refunds" className="btn btn-outline btn-sm">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> View Refunds Tracker
          </Link>
        }
      />

      {loading ? (
        <LineSkeleton lines={4} />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !payments?.length ? (
        <EmptyState
          icon={CreditCard}
          title="No payment transactions yet"
          message="Completed or attempted consultation bookings will appear in your transaction history."
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-3.5">Transaction ID</th>
                  <th className="px-5 py-3.5">Booking Ref</th>
                  <th className="px-5 py-3.5">Lawyer</th>
                  <th className="px-5 py-3.5">Amount Paid</th>
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5">Payment Status</th>
                  <th className="px-5 py-3.5">Refund Amount & Status</th>
                  <th className="px-5 py-3.5 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-cream/40">
                    <td className="px-5 py-4 font-mono text-xs font-semibold text-navy">
                      {p.transactionReference || p.id}
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      <Link to={`/client/consultations/${p.bookingId}`} className="font-semibold text-navy hover:underline">
                        {p.bookingId}
                      </Link>
                    </td>
                    <td className="px-5 py-4 font-medium text-ink">
                      {p.lawyer?.name || 'Advocate'}
                    </td>
                    <td className="px-5 py-4 font-semibold text-navy">
                      {formatINR(p.amount)}
                    </td>
                    <td className="px-5 py-4 text-xs text-muted">
                      {formatDateTime(p.paidAt || p.createdAt)}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-4 text-xs">
                      {p.refund ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-navy">{formatINR(p.refund.amount)}</p>
                          <PaymentStatusBadge status={p.refund.status} />
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link
                        to={`/client/consultations/${p.bookingId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
                      >
                        Booking <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

