import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowRight, LayoutDashboard, Loader2 } from 'lucide-react';
import Navbar from '../../components/layout/Navbar';
import Footer from '../../components/layout/Footer';
import DemoBanner from '../../components/layout/DemoBanner';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { dashboardPath, ROLE_LABEL } from '../../utils/format';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export default function UnauthorizedPage({ requiredRoles = [] }) {
  useDocumentTitle('Workspace Access');
  const { user, demoLogin } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);

  const targetRole = requiredRoles[0];

  const handleSwitchRole = async () => {
    if (!targetRole) return;
    setSwitching(true);
    try {
      const switched = await demoLogin(targetRole);
      notify(`Switched to ${ROLE_LABEL[switched.role]} demo account (${switched.name}).`);
      navigate(dashboardPath(switched.role), { replace: true });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <Navbar />
      <main id="main" className="container-page flex flex-1 items-center justify-center py-16">
        <div className="card max-w-lg p-8 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-50 text-amber-700">
            <ShieldAlert className="h-8 w-8" aria-hidden="true" />
          </span>
          <p className="eyebrow mt-4">Role-Restricted Workspace (UI Demo)</p>
          <h1 className="mt-1 font-serif text-2xl font-semibold text-navy">
            {targetRole ? `${ROLE_LABEL[targetRole]} Account Required` : 'Access Restricted'}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You are currently signed in as <strong>{user?.name}</strong> ({ROLE_LABEL[user?.role]}). This workspace is designed for{' '}
            <strong>{requiredRoles.map((r) => ROLE_LABEL[r]).join(' or ')}</strong> accounts.
          </p>
          <p className="mt-2 rounded-lg bg-cream p-3 text-xs text-muted">
            Note: Frontend route guards are a UX convenience only. Real authorization is enforced on the backend.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {user && (
              <Link to={dashboardPath(user.role)} className="btn btn-outline">
                <LayoutDashboard className="h-4 w-4" aria-hidden="true" /> Go to my {ROLE_LABEL[user.role]} dashboard
              </Link>
            )}
            {targetRole && (
              <button
                type="button"
                onClick={handleSwitchRole}
                disabled={switching}
                className="btn btn-primary"
              >
                {switching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
                Switch to Demo {ROLE_LABEL[targetRole]}
              </button>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}

