import { useCallback, useEffect, useState } from 'react';
import { BadgeCheck, Loader2, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import Avatar from '../../components/common/Avatar';
import PageHeader from '../../components/layout/PageHeader';
import { useToast } from '../../context/ToastContext';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import {
  listPendingAdvocateVerifications,
  reviewAdvocateVerification,
} from '../../services/communityService';

export default function AdminAdvocateVerificationsPage() {
  useDocumentTitle('Advocate Verification Reviews');
  const { notify } = useToast();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRequests(await listPendingAdvocateVerifications());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const review = async (request, status) => {
    const action = status === 'APPROVED' ? 'approve' : 'reject';
    if (!window.confirm(`Are you sure you want to ${action} ${request.advocateName || 'this advocate'}?`)) return;
    setReviewing(request.profileId);
    setError('');
    try {
      await reviewAdvocateVerification(request.profileId, status);
      notify(`Advocate verification ${status.toLowerCase()}.`);
      setRequests((current) => current.filter((item) => item.profileId !== request.profileId));
    } catch (err) {
      setError(err.message);
    } finally {
      setReviewing('');
    }
  };

  return (
    <div className="container-page py-8 sm:py-12">
      <PageHeader
        eyebrow="Platform administration"
        title="Advocate verification reviews"
        description="Review Bar Council enrollment details before granting access to private advocate messaging."
        actions={(
          <button type="button" onClick={refresh} disabled={loading} className="btn btn-outline btn-sm">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Refresh
          </button>
        )}
      />

      <div className="mb-6 flex items-start gap-3 rounded-xl border border-gold/40 bg-gold-100/40 p-4 text-sm text-ink">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-navy" aria-hidden="true" />
        <p>Submission details are not proof by themselves. Independently confirm each enrollment with the relevant Bar Council before approving. Do not approve based only on the name or city.</p>
      </div>

      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      {loading ? (
        <div className="card flex items-center gap-3 p-8 text-sm text-muted">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Loading requests…
        </div>
      ) : requests.length ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <article key={request.profileId} className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={request.advocateName || request.profileId} size="md" />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-navy">{request.advocateName || 'Advocate'}</h2>
                  <p className="text-sm text-muted">{request.city || 'Location not listed'}</p>
                  <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div><dt className="inline font-medium">Bar Council: </dt><dd className="inline">{request.barCouncil}</dd></div>
                    <div><dt className="inline font-medium">Enrollment: </dt><dd className="inline">{request.enrollmentNumber}</dd></div>
                    <div className="text-xs text-muted sm:col-span-2">Submitted {new Date(request.submittedAt).toLocaleString()}</div>
                  </dl>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  disabled={!!reviewing}
                  onClick={() => review(request, 'REJECTED')}
                  className="btn btn-outline btn-sm"
                >
                  {reviewing === request.profileId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <XCircle className="h-4 w-4" aria-hidden="true" />}
                  Reject
                </button>
                <button
                  type="button"
                  disabled={!!reviewing}
                  onClick={() => review(request, 'APPROVED')}
                  className="btn btn-primary btn-sm"
                >
                  {reviewing === request.profileId ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <BadgeCheck className="h-4 w-4" aria-hidden="true" />}
                  Approve
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="card p-10 text-center">
          <BadgeCheck className="mx-auto h-9 w-9 text-green-700" aria-hidden="true" />
          <h2 className="mt-3 font-semibold text-navy">No pending requests</h2>
          <p className="mt-1 text-sm text-muted">New advocate verification submissions will appear here.</p>
        </div>
      )}
    </div>
  );
}
