import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Bookmark, Settings, UserPen, Building2, Users, Inbox, ExternalLink,
  CalendarCheck, Clock, RefreshCw, CreditCard, RotateCcw, Bell, CalendarClock, Sliders, History, CalendarDays,
} from 'lucide-react';
import Avatar from '../common/Avatar';
import DemoBadge from '../common/DemoBadge';
import { cn, ROLE_LABEL } from '../../utils/format';

export const NAV_BY_ROLE = {
  client: [
    { to: '/client/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/client/consultations', label: 'My Consultations', icon: CalendarCheck, exactQuery: '' },
    { to: '/client/consultations?filter=upcoming', label: 'Upcoming Meetings', icon: Clock },
    { to: '/client/consultations?filter=reschedule', label: 'Reschedule Requests', icon: RefreshCw },
    { to: '/client/payments', label: 'Payment History', icon: CreditCard },
    { to: '/client/refunds', label: 'Refunds', icon: RotateCcw },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/calendar', label: 'Shared Calendar', icon: CalendarDays },
    { to: '/client/saved', label: 'Saved Profiles', icon: Bookmark },
    { to: '/client/settings', label: 'Account Settings', icon: Settings },
  ],
  lawyer: [
    { to: '/lawyer/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/lawyer/consultation-requests', label: 'Consultation Requests', icon: Inbox },
    { to: '/lawyer/appointments', label: 'Upcoming Appointments', icon: CalendarCheck, exactQuery: '' },
    { to: '/lawyer/availability', label: 'Manage Availability', icon: CalendarClock },
    { to: '/lawyer/consultation-settings', label: 'Consultation Settings', icon: Sliders },
    { to: '/lawyer/appointments?filter=history', label: 'Appointment History', icon: History },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/calendar', label: 'Shared Calendar', icon: CalendarDays },
    { to: '/lawyer/edit-profile', label: 'Edit Profile', icon: UserPen },
    { to: '/lawyer/firm-membership', label: 'Firm Membership', icon: Building2 },
    { to: '/lawyer/settings', label: 'Contact & Settings', icon: Settings },
  ],
  firm: [
    { to: '/firm/dashboard', label: 'Overview', icon: LayoutDashboard },
    { to: '/firm/consultations', label: 'Consultations Overview', icon: CalendarCheck },
    { to: '/firm/edit-profile', label: 'Firm Profile', icon: UserPen },
    { to: '/firm/members', label: 'Members', icon: Users },
    { to: '/firm/requests', label: 'Requests & Invites', icon: Inbox },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/calendar', label: 'Shared Calendar', icon: CalendarDays },
    { to: '/firm/settings', label: 'Settings', icon: Settings },
  ],
};

export default function Sidebar({ user, publicPath, onNavigate }) {
  const location = useLocation();
  const currentFull = `${location.pathname}${location.search}`;

  return (
    <nav aria-label="Dashboard" className="flex h-full flex-col gap-4 overflow-y-auto">
      <div className="flex items-center gap-3 border-b border-line px-2 pb-4">
        <Avatar name={user.name} size="sm" square={user.role === 'firm'} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
          <p className="text-xs text-muted">{ROLE_LABEL[user.role]} workspace</p>
        </div>
      </div>
      <ul className="space-y-1">
        {NAV_BY_ROLE[user.role].map(({ to, label, icon: Icon, exactQuery }) => {
          const hasQuery = to.includes('?');
          const active = hasQuery
            ? currentFull === to
            : exactQuery !== undefined
              ? location.pathname === to && location.search === exactQuery
              : location.pathname === to;

          return (
            <li key={to}>
              <NavLink
                to={to}
                onClick={onNavigate}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-navy text-white' : 'text-ink hover:bg-cream hover:text-navy',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          );
        })}
        {publicPath && (
          <li>
            <NavLink to={publicPath} onClick={onNavigate} className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-cream hover:text-navy">
              <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" /> Preview public profile
            </NavLink>
          </li>
        )}
      </ul>
      <div className="mt-auto border-t border-line pt-4 text-xs leading-relaxed text-muted">
        <DemoBadge className="mb-2" />
        <p>Changes are saved to this browser only and are visible to anyone using it.</p>
      </div>
    </nav>
  );
}
