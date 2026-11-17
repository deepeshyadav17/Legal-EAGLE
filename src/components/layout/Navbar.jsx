import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu, X, ChevronDown, LayoutDashboard, LogOut, Settings, UserRound, Bell, CheckCheck, ShieldCheck,
} from 'lucide-react';
import Logo from '../common/Logo';
import Avatar from '../common/Avatar';
import { useAuth } from '../../context/AuthContext';
import { useNotifications, getNotificationLink } from '../../context/NotificationContext';
import { cn, dashboardPath, ROLE_LABEL, timeAgo } from '../../utils/format';

const LINKS = [
  { to: '/', label: 'Home', match: (l) => l.pathname === '/' },
  { to: '/search?tab=lawyers', label: 'Find Lawyers', match: (l) => l.pathname === '/search' && !l.search.includes('tab=firms') },
  { to: '/search?tab=firms', label: 'Find Firms', match: (l) => l.pathname === '/search' && l.search.includes('tab=firms') },
  { to: '/about', label: 'About', match: (l) => l.pathname === '/about' },
];

export function publicProfilePath(user) {
  if (user?.role === 'lawyer') return `/lawyers/${user.profileId}`;
  if (user?.role === 'firm') return `/firms/${user.profileId}`;
  return null;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markRead, markAllRead, refreshNotifications } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const menuRef = useRef(null);
  const notifRef = useRef(null);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
    setNotifOpen(false);
    refreshNotifications();
  }, [location.pathname, location.search, refreshNotifications]);

  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.isRead) {
      await markRead(notif.id);
    }
    setNotifOpen(false);
    navigate(getNotificationLink(notif, user?.role));
  };

  const settingsPath = user ? `/${user.role}/settings` : '/';
  const profilePath = publicProfilePath(user);

  return (
    <header className="site-header sticky top-0 z-50 border-b border-line bg-white">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-navy focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <nav className="container-page flex h-[4.5rem] items-center justify-between gap-4" aria-label="Primary">
        <Logo />

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.label}>
              <Link
                to={l.to}
                aria-current={l.match(location) ? 'page' : undefined}
                className={cn(
                  'relative px-3 py-2 text-sm font-medium transition-colors after:absolute after:inset-x-3 after:-bottom-1 after:h-px',
                  l.match(location) ? 'text-navy after:bg-gold-600' : 'text-muted after:bg-transparent hover:text-navy',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <Link to={dashboardPath(user.role)} className="btn btn-outline btn-sm">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Dashboard
              </Link>

              {/* Notification Center Bell */}
              <div className="relative" ref={notifRef}>
                {user.role !== 'admin' && <button
                  type="button"
                  onClick={() => setNotifOpen((o) => !o)}
                  aria-label={`Notifications (${unreadCount} unread)`}
                  aria-expanded={notifOpen}
                  className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-navy transition hover:border-gold"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-navy">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>}

                {notifOpen && (
                  <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-white shadow-lift animate-fade-up sm:w-96">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-navy">Notifications</p>
                        <p className="text-xs text-muted">{unreadCount} unread · Demo Mode</p>
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={markAllRead}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-navy hover:underline"
                        >
                          <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" /> Mark all read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 divide-y divide-line overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.slice(0, 6).map((n) => (
                          <button
                            key={n.id}
                            type="button"
                            onClick={() => handleNotificationClick(n)}
                            className={cn(
                              'flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-cream',
                              !n.isRead && 'bg-gold-100/35',
                            )}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-navy">{n.title}</span>
                              {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-600" />}
                            </div>
                            <p className="line-clamp-2 text-xs text-ink">{n.message}</p>
                            <span className="text-[11px] text-muted">{timeAgo(n.createdAt)}</span>
                          </button>
                        ))
                      ) : (
                        <p className="p-6 text-center text-xs text-muted">No notifications yet.</p>
                      )}
                    </div>

                    <div className="border-t border-line bg-cream/60 px-4 py-2.5 text-center">
                      <Link
                        to="/notifications"
                        className="text-xs font-semibold text-navy hover:underline"
                      >
                        View all notifications →
                      </Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition hover:border-gold"
                >
                  <Avatar name={user.name} size="xs" square={user.role === 'firm'} />
                  <span className="max-w-[120px] truncate text-sm font-medium">{user.name.split(' ')[0]}</span>
                  <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
                </button>
                {menuOpen && (
                  <div role="menu" className="absolute right-0 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-white shadow-lift animate-fade-up">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold text-navy">{user.name}</p>
                      <p className="truncate text-xs text-muted">{ROLE_LABEL[user.role]} · Demo account</p>
                    </div>
                    {profilePath && (
                      <Link role="menuitem" to={profilePath} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-cream">
                        <UserRound className="h-4 w-4" aria-hidden="true" /> View public profile
                      </Link>
                    )}
                    {user.role === 'admin' && (
                      <Link role="menuitem" to="/admin/advocate-verifications" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-cream">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" /> Advocate verification reviews
                      </Link>
                    )}
                    {user.role !== 'admin' && <Link role="menuitem" to="/notifications" className="flex items-center justify-between px-4 py-2.5 text-sm hover:bg-cream">
                      <span className="flex items-center gap-2">
                        <Bell className="h-4 w-4" aria-hidden="true" /> Notifications
                      </span>
                      {unreadCount > 0 && (
                        <span className="badge bg-gold text-navy">{unreadCount}</span>
                      )}
                    </Link>}
                    {user.role !== 'admin' && <Link role="menuitem" to={settingsPath} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-cream">
                      <Settings className="h-4 w-4" aria-hidden="true" /> Settings
                    </Link>}
                    <button role="menuitem" type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-700 hover:bg-red-50">
                      <LogOut className="h-4 w-4" aria-hidden="true" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Login</Link>
              <Link to="/signup" className="btn btn-primary btn-sm">Sign Up</Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="btn-ghost rounded-lg p-2 md:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-menu"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {mobileOpen && (
        <div id="mobile-menu" className="border-t border-line bg-white md:hidden animate-fade-up">
          <ul className="container-page flex flex-col gap-1 py-3">
            {LINKS.map((l) => (
              <li key={l.label}>
                <NavLink to={l.to} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-cream">{l.label}</NavLink>
              </li>
            ))}
            <li className="my-2 h-px bg-line" aria-hidden="true" />
            {user ? (
              <>
                <li><Link to={dashboardPath(user.role)} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream">Dashboard</Link></li>
                {user.role === 'admin' ? (
                  <li><Link to="/admin/advocate-verifications" className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream">Advocate verification reviews</Link></li>
                ) : (
                  <>
                    <li><Link to="/notifications" className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream">Notifications ({unreadCount})</Link></li>
                    <li><Link to={settingsPath} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream">Settings</Link></li>
                  </>
                )}
                {profilePath && <li><Link to={profilePath} className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-cream">View public profile</Link></li>}
                <li><button type="button" onClick={handleLogout} className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-red-700 hover:bg-red-50">Log out</button></li>
              </>
            ) : (
              <li className="grid grid-cols-2 gap-2">
                <Link to="/login" className="btn btn-outline">Login</Link>
                <Link to="/signup" className="btn btn-primary">Sign Up</Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </header>
  );
}
