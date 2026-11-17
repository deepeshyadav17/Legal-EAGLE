import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Users,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import StatCard from '../../components/common/StatCard';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { useAuth } from '../../context/AuthContext';
import { getFirmConsultationsOverview } from '../../services/bookingService';

/**
 * Firm Consultations Overview Page (`/firm/consultations`).
 * Shows aggregate consultation metrics for active affiliated lawyers without
 * exposing confidential client notes or allowing firm admins to mutate lawyer bookings.
 */
export default function FirmConsultations() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getFirmConsultationsOverview(user.profileId)
      .then(setOverview)
      .finally(() => setLoading(false));
  }, [user.profileId]);

  if (loading || !overview) {
    return <LineSkeleton lines={5} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Firm Consultation Analytics"
        title="Affiliated Lawyer Consultations"
        subtitle="Aggregate consultation volume and schedule status across active lawyers in your firm."
        action={
          <Link to="/firm/lawyers" className="btn btn-outline">
            <Users className="h-4 w-4" aria-hidden="true" />
            Manage Roster
          </Link>
        }
      />

      <div className="rounded-xl border border-gold/40 bg-gold-100/50 p-4 text-xs text-navy flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 shrink-0 text-gold-600 mt-0.5" aria-hidden="true" />
        <p>
          <strong>Client Confidentiality & Autonomy Policy:</strong> Individual advocates manage their own 1-hour availability, approvals, and rescheduling. Confidential client matter notes and private booking actions are visible only to the assigned lawyer.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Calendar}
          label="Upcoming Confirmed"
          value={overview.upcomingConsultations}
          hint="Scheduled 1-hour sessions"
        />
        <StatCard
          icon={Clock}
          label="Awaiting Approval"
          value={overview.awaitingApprovalBookings}
          hint="Pending lawyer or client response"
          accent
        />
        <StatCard
          icon={CheckCircle2}
          label="Confirmed Bookings"
          value={overview.confirmedBookings}
          hint="Active confirmed consultations"
        />
        <StatCard
          icon={Building2}
          label="Completed Sessions"
          value={overview.completedBookings}
          hint="Historical completed consultations"
        />
      </div>

      <div className="card p-6">
        <h2 className="font-display text-lg font-bold text-navy">
          Consultation Count by Affiliated Lawyer
        </h2>
        <p className="mt-1 text-xs text-muted">
          Includes only lawyers with an active (`ACTIVE`) firm membership.
        </p>

        {overview.byLawyer.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={Users}
              title="No active affiliated lawyers"
              description="Invite lawyers or approve join requests to view firm-wide consultation activity."
              action={
                <Link to="/firm/lawyers" className="btn btn-primary">
                  Go to Lawyer Management
                </Link>
              }
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-muted">
                  <th className="pb-3 pr-4">Affiliated Advocate</th>
                  <th className="pb-3 px-4">Practice Area</th>
                  <th className="pb-3 px-4 text-center">Awaiting / Proposed</th>
                  <th className="pb-3 px-4 text-center">Confirmed</th>
                  <th className="pb-3 px-4 text-center">Completed</th>
                  <th className="pb-3 pl-4 text-right">Total Consultations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {overview.byLawyer.map((row) => (
                  <tr key={row.lawyer.id} className="hover:bg-cream/50">
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar
                          src={row.lawyer.photo}
                          name={row.lawyer.name}
                          size="sm"
                        />
                        <div>
                          <Link
                            to={`/lawyers/${row.lawyer.id}`}
                            className="font-semibold text-navy hover:text-gold-600"
                          >
                            {row.lawyer.name}
                          </Link>
                          <p className="text-xs text-muted">{row.lawyer.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-medium text-ink">
                      {row.lawyer.primaryPracticeArea}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex min-w-8 justify-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                        {row.awaitingApproval}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex min-w-8 justify-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900">
                        {row.confirmed}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-flex min-w-8 justify-center rounded-full bg-navy/10 px-2.5 py-0.5 text-xs font-bold text-navy">
                        {row.completed}
                      </span>
                    </td>
                    <td className="py-4 pl-4 text-right font-display font-bold text-navy">
                      {row.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
