import { Link } from 'react-router-dom';
import {
  UserPen, ExternalLink, Building2, Scale, Briefcase, Eye, MailCheck, ArrowRight,
} from 'lucide-react';
import PageHeader from '../../components/layout/PageHeader';
import Avatar from '../../components/common/Avatar';
import StatCard from '../../components/common/StatCard';
import PracticeAreaBadge from '../../components/common/PracticeAreaBadge';
import ProfileCompletion from '../../components/lawyer/ProfileCompletion';
import { LineSkeleton } from '../../components/common/LoadingSkeleton';
import { ErrorState } from '../../components/common/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { getOwnLawyerProfile } from '../../services/lawyerService';
import { getLawyerMemberships } from '../../services/membershipService';
import { lawyerCompletion } from '../../utils/completion';
import { yearsLabel } from '../../utils/format';

export default function LawyerDashboard() {
  useDocumentTitle('Lawyer Dashboard');
  const { user } = useAuth();

  const { data, loading, error, reload } = useAsync(
    async () => {
      const [lawyer, memberships] = await Promise.all([
        getOwnLawyerProfile(user.profileId),
        getLawyerMemberships(user.profileId),
      ]);
      return { lawyer, memberships };
    },
    [user.profileId],
  );

  if (loading) return <LineSkeleton lines={5} />;
  if (error || !data) return <ErrorState error={error} onRetry={reload} />;

  const { lawyer, memberships } = data;
  const completion = lawyerCompletion(lawyer);
  const pendingInvites = memberships.invitations.length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Advocate Workspace"
        title={`Welcome, ${lawyer.name}`}
        description="Manage your public legal portfolio, credentials, firm affiliation and contact privacy."
        actions={
          <>
            <Link to={`/lawyers/${lawyer.id}`} className="btn btn-outline btn-sm">
              <ExternalLink className="h-4 w-4" aria-hidden="true" /> Preview Public Profile
            </Link>
            <Link to="/lawyer/edit-profile" className="btn btn-primary btn-sm">
              <UserPen className="h-4 w-4" aria-hidden="true" /> Edit Profile
            </Link>
          </>
        }
      />

      {/* Pending invitation alert */}
      {pendingInvites > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-gold bg-gold-100/70 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-navy text-gold">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-navy">
                You have {pendingInvites} pending firm {pendingInvites === 1 ? 'invitation' : 'invitations'}
              </p>
              <p className="text-xs text-ink">
                Review and accept or decline invitations from law firms in your Firm Membership tab.
              </p>
            </div>
          </div>
          <Link to="/lawyer/firm-membership" className="btn btn-primary btn-sm self-start sm:self-auto">
            Review Invitations <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={Briefcase}
          label="Experience"
          value={`${lawyer.experienceYears} yrs`}
          hint={lawyer.city}
          accent
        />
        <StatCard
          icon={Scale}
          label="Practice Areas"
          value={lawyer.practiceAreas.length}
          hint="Selected specializations"
        />
        <StatCard
          icon={Building2}
          label="Firm Status"
          value={lawyer.firm ? 'Affiliated' : 'Independent'}
          hint={lawyer.firm ? lawyer.firm.name : 'No active firm membership'}
        />
        <StatCard
          icon={Eye}
          label="Contact Visibility"
          value={lawyer.contactVisibility === 'clients' ? 'Clients' : 'Hidden'}
          hint={lawyer.contactVisibility === 'clients' ? 'Visible to logged-in clients' : 'Private on public profile'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Summary Card */}
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-6" aria-labelledby="summary-heading">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar name={lawyer.name} src={lawyer.photo} size="lg" />
                <div>
                  <h2 id="summary-heading" className="text-xl font-semibold text-navy">
                    {lawyer.name}
                  </h2>
                  <p className="text-sm text-ink">{lawyer.headline}</p>
                  <p className="mt-1 text-xs text-muted">
                    {lawyer.city} · {yearsLabel(lawyer.experienceYears)}
                  </p>
                </div>
              </div>
              <Link to="/lawyer/edit-profile" className="btn btn-outline btn-sm self-start">
                <UserPen className="h-4 w-4" aria-hidden="true" /> Update Bio & Photo
              </Link>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink">
              {lawyer.about || 'Add a professional summary so prospective clients understand your areas of practice.'}
            </p>

            <div className="mt-4 flex flex-wrap gap-1.5">
              {lawyer.practiceAreas.map((slug, idx) => (
                <PracticeAreaBadge key={slug} slug={slug} primary={idx === 0} withIcon />
              ))}
            </div>
          </section>

          {/* Portfolio Sections Overview */}
          <section className="card p-6" aria-labelledby="portfolio-counts-heading">
            <div className="flex items-center justify-between">
              <h2 id="portfolio-counts-heading" className="text-lg font-semibold text-navy">
                Portfolio Credentials
              </h2>
              <Link to="/lawyer/edit-profile" className="text-xs font-semibold text-navy hover:underline">
                Manage records →
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Education Records', count: lawyer.education.length, anchor: 'education' },
                { label: 'Work Experience', count: lawyer.experience.length, anchor: 'experience' },
                { label: 'Qualifications', count: lawyer.qualifications.length, anchor: 'qualifications' },
                { label: 'Achievements', count: lawyer.achievements.length, anchor: 'achievements' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to="/lawyer/edit-profile"
                  className="flex items-center justify-between rounded-xl border border-line bg-cream/50 p-4 transition hover:border-gold hover:bg-gold-100/40"
                >
                  <span className="text-sm font-medium text-ink">{item.label}</span>
                  <span className="badge bg-navy text-white">{item.count}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Profile Completion & Quick Links */}
        <div className="space-y-6">
          <ProfileCompletion percent={completion.percent} missing={completion.missing} />

          <section className="card p-6" aria-labelledby="quick-actions-heading">
            <h2 id="quick-actions-heading" className="text-lg font-semibold text-navy">
              Workspace Shortcuts
            </h2>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <Link to="/lawyer/consultation-requests" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Review Consultation Requests</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/lawyer/availability" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Manage 1-Hour Availability Slots</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/lawyer/appointments" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Confirmed Appointments & Schedule</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/lawyer/edit-profile" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Edit Education, Experience & Bio</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/lawyer/firm-membership" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Manage Firm Membership</span>
                  <ArrowRight className="h-4 w-4 text-muted" aria-hidden="true" />
                </Link>
              </li>
              <li>
                <Link to="/lawyer/settings" className="flex items-center justify-between rounded-lg px-3 py-2 font-medium text-ink hover:bg-cream">
                  <span>Contact Visibility Settings</span>
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

