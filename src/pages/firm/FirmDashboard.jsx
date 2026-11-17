import { Link } from 'react-router-dom';
import {
  Users, Inbox, Scale, CalendarDays, UserPen, ExternalLink, ArrowRight, UserPlus,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Avatar from '../../components/common/Avatar';
import StatCard from '../../components/common/StatCard';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import MemberCard from '../../components/firm/MemberCard';
import ProfileCompletion from '../../components/lawyer/ProfileCompletion';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getFirm } from '../../services/firmService';
import { getFirmMemberships } from '../../services/membershipService';
import { firmCompletion } from '../../utils/completion';

export default function FirmDashboard() {
  useDocumentTitle('Firm Dashboard');
  const { user } = useAuth();

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [firm, memberships] = await Promise.all([
        getFirm(user.profileId),
        getFirmMemberships(user.profileId),
      ]);
      return { firm, memberships };
    },
    [user.profileId],
  );

  if (loading) return <LineSkeleton lines={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { firm, memberships } = data;
  const completion = firmCompletion(firm);
  const pendingRequests = memberships.requests.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Law Firm Workspace"
        title={firm.name}
        description="Manage your organization profile, active legal team, membership requests and invitations."
        actions={
          <>
            <Link to={`/firms/${firm.id}`} className="btn btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Preview Public Page
            </Link>
            <Link to="/firm/edit-profile" className="btn btn-primary btn-sm">
              <UserPen className="h-4 w-4" aria-hidden="true" /> Edit Firm Profile
            </Link>
          </>
        }
      />

      {/* Pending requests banner */}
      {pendingRequests > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gold bg-gold-100/70 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-gold">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy">
                {pendingRequests} lawyer join {pendingRequests === 1 ? 'request awaits' : 'requests await'} your review
              </p>
              <p className="text-xs text-ink">
                Approving a request immediately adds the advocate to your public team directory.
              </p>
            </div>
          </div>
          <Link to="/firm/requests" className="btn btn-primary btn-sm self-start sm:self-auto">
            Review Requests <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Users}
          label="Active Lawyers"
          value={firm.activeMemberCount}
          hint="Derived from active memberships"
          accent
        />
        <StatCard
          icon={Inbox}
          label="Pending Requests"
          value={memberships.requests.length}
          hint={`${memberships.invitations.length} sent invitation${memberships.invitations.length === 1 ? '' : 's'}`}
        />
        <StatCard
          icon={Scale}
          label="Practice Areas"
          value={firm.practiceAreas.length}
          hint="Covered legal specializations"
        />
        <StatCard
          icon={CalendarDays}
          label="Established"
          value={firm.established}
          hint={firm.city}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Organization Overview Card */}
          <section className="card p-6" aria-labelledby="firm-overview-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={firm.name} src={firm.logo} size="lg" square />
                <div>
                  <h2 id="firm-overview-heading" className="text-xl font-semibold text-navy">
                    {firm.name}
                  </h2>
                  <p className="text-sm text-muted">
                    {firm.address || firm.city} · Est. {firm.established}
                  </p>
                </div>
              </div>
              <Link to="/firm/edit-profile" className="btn btn-outline btn-sm self-start">
                <UserPen className="h-4 w-4" aria-hidden="true" /> Edit Details
              </Link>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink">
              {firm.about || 'Add an organization overview describing your chambers, history and areas of legal practice.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {firm.practiceAreas.map((slug, idx) => (
                <PracticeAreaBadge key={slug} slug={slug} primary={idx === 0} withIcon />
              ))}
            </div>
          </section>

          {/* Active Team Members Preview */}
          <section className="card p-6" aria-labelledby="active-team-heading">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="active-team-heading" className="text-lg font-semibold text-navy">
                  Active Team Directory ({firm.activeMemberCount})
                </h2>
                <p className="text-xs text-muted">
                  Approved lawyers currently listed on your public firm profile.
                </p>
              </div>
              <div className="flex gap-2">
                <Link to="/firm/members" className="btn btn-outline btn-sm">
                  <UserPlus className="h-4 w-4" aria-hidden="true" /> Manage & Invite
                </Link>
              </div>
            </div>

            {firm.members.length > 0 ? (
              <div className="mt-4 space-y-3">
                {firm.members.map((lawyer) => (
                  <MemberCard key={lawyer.id} lawyer={lawyer} />
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-dashed border-line bg-cream/60 p-6 text-center text-sm text-muted">
                No active lawyers in your firm yet. Invite registered advocates or approve pending join requests.
              </p>
            )}
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <ProfileCompletion percent={completion.percent} missing={completion.missing} />

          <section className="card p-6" aria-labelledby="firm-shortcuts-heading">
            <h2 id="firm-shortcuts-heading" className="text-lg font-semibold text-navy">
              Management Shortcuts
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/firm/consultations" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Team Consultations Overview</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/firm/members" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Active Lawyers & Invitations</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/firm/requests" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Approve / Reject Join Requests</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/firm/edit-profile" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Update Firm Logo & Practice Areas</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

