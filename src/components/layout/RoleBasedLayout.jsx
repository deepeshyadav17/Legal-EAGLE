import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { PanelLeft, X } from 'lucide-react';
import Navbar, { publicProfilePath } from './Navbar';
import Sidebar from './Sidebar';
import DemoBanner from './DemoBanner';
import { useAuth } from '../../context/AuthContext';
import CalendarReminderMonitor from '../calendar/CalendarReminderMonitor';

/** Dashboard shell: top navbar + role-specific sidebar (drawer on mobile). */
export default function RoleBasedLayout() {
  const { user } = useAuth();
  const [drawer, setDrawer] = useState(false);
  const publicPath = publicProfilePath(user);

  return (
    <div className="flex min-h-screen flex-col">
      <CalendarReminderMonitor />
      <DemoBanner />
      <Navbar />
      <div className="container-page flex flex-1 gap-6 py-6 lg:gap-8 lg:py-8">
        <aside className="dashboard-sidebar sticky top-24 hidden h-[calc(100vh-7.5rem)] w-64 shrink-0 rounded-xl p-3 lg:block">
          <Sidebar user={user} publicPath={publicPath} />
        </aside>

        {drawer && (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Dashboard menu">
            <div className="absolute inset-0 bg-navy/50" onClick={() => setDrawer(false)} aria-hidden="true" />
            <div className="dashboard-sidebar absolute inset-y-0 left-0 w-72 p-4 shadow-lift animate-fade-up">
              <button type="button" onClick={() => setDrawer(false)} className="mb-3 ml-auto block rounded-md p-1.5 text-muted hover:bg-cream hover:text-navy" aria-label="Close dashboard menu">
                <X className="h-5 w-5" />
              </button>
              <Sidebar user={user} publicPath={publicPath} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1">
          <button type="button" onClick={() => setDrawer(true)} className="btn btn-outline btn-sm mb-4 lg:hidden">
            <PanelLeft className="h-4 w-4" aria-hidden="true" /> Dashboard menu
          </button>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
