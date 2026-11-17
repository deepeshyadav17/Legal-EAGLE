import { Link, useLocation } from 'react-router-dom';
import { Mail, Phone, Lock, EyeOff, Info, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAsync } from '../../hooks/useAsync';
import { getLawyerContact } from '../../services/lawyerService';
import { LineSkeleton } from '../common/LoadingSkeleton';
import DemoBadge from '../common/DemoBadge';

/**
 * Contact block. The visibility decision is returned by the (mock) service
 * to mirror future server-side enforcement; the UI never decides on its own.
 */
export default function ContactSection({ lawyerId, lawyerName }) {
  const { user } = useAuth();
  const location = useLocation();
  const { data, loading } = useAsync(() => getLawyerContact(lawyerId, user), [lawyerId, user?.id]);

  const body = () => {
    if (loading) return <LineSkeleton lines={2} />;
    switch (data?.status) {
      case 'visible':
        return (
          <>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-cream text-navy"><Mail className="h-4 w-4" aria-hidden="true" /></span>
                <a href={`mailto:${data.contact.email}`} className="break-all font-medium text-navy hover:underline">{data.contact.email}</a>
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-cream text-navy"><Phone className="h-4 w-4" aria-hidden="true" /></span>
                <a href={`tel:${data.contact.phone.replace(/\s/g, '')}`} className="font-medium text-navy hover:underline">{data.contact.phone}</a>
              </li>
            </ul>
            {data.owner && (
              <p className="mt-4 flex gap-2 rounded-lg bg-cream p-3 text-xs text-muted">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                You are viewing your own profile. Clients {data.visibility === 'clients' ? 'can' : 'cannot'} currently see these details.
              </p>
            )}
            <p className="mt-3 text-xs text-muted">Fictional demo contact details.</p>
          </>
        );
      case 'login_required':
        return (
          <Gate icon={Lock} text="Log in with a client account to view contact details, where the lawyer has enabled them.">
            <Link to="/login" state={{ from: location }} className="btn btn-primary w-full">Log in to view</Link>
          </Gate>
        );
      case 'clients_only':
        return <Gate icon={ShieldCheck} text="Contact details are shared only with client accounts." />;
      case 'hidden':
        return <Gate icon={EyeOff} text={`${lawyerName} has chosen not to display contact details publicly.`} />;
      default:
        return null;
    }
  };

  return (
    <section className="card p-6" aria-labelledby="contact-heading">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 id="contact-heading" className="text-lg font-semibold">Contact Information</h2>
        <DemoBadge label="Demo" />
      </div>
      {body()}
    </section>
  );
}

function Gate({ icon: Icon, text, children }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-cream/60 p-5 text-center">
      <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-white text-gold-600 shadow-sm">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <p className="text-sm text-ink">{text}</p>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
