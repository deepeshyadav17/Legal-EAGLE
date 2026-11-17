import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { UserRound, Scale, Building2, Loader2, ArrowRight } from 'lucide-react';
import FormField from '../../components/forms/FormField';
import DemoBadge from '../../components/common/DemoBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { rules } from '../../utils/validators';
import { dashboardPath, ROLE_LABEL } from '../../utils/format';
import { DEMO_ACCOUNTS } from '../../mock/seedData';

const ROLE_CARDS = [
  {
    role: 'client',
    icon: UserRound,
    title: 'Demo Client',
    subtitle: 'Ananya Verma · Save profiles & view permitted contacts',
    email: 'client@demo.legaleagle.in',
  },
  {
    role: 'lawyer',
    icon: Scale,
    title: 'Demo Lawyer',
    subtitle: 'Adv. Aarav Sharma · Edit portfolio & firm membership',
    email: 'lawyer@demo.legaleagle.in',
  },
  {
    role: 'firm',
    icon: Building2,
    title: 'Demo Law Firm',
    subtitle: 'Mehra & Associates · Manage team & invitations',
    email: 'firm@demo.legaleagle.in',
  },
];

const SCHEMA = {
  email: [rules.required('Email'), rules.email()],
  password: [rules.required('Password')],
};

export default function LoginPage() {
  useDocumentTitle('Log In');
  const { login, demoLogin } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [demoLoading, setDemoLoading] = useState('');

  const form = useForm({ email: '', password: '' }, SCHEMA);

  const redirectAfterLogin = (user) => {
    const from = location.state?.from;
    if (from?.pathname && !from.pathname.startsWith('/login')) {
      navigate(from.pathname + (from.search || ''), { replace: true });
    } else {
      navigate(dashboardPath(user.role), { replace: true });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSubmitting(true);
    try {
      const user = await login(form.values.email, form.values.password);
      notify(`Welcome back, ${user.name}.`);
      redirectAfterLogin(user);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (role) => {
    setDemoLoading(role);
    try {
      const user = await demoLogin(role);
      notify(`Signed in to ${ROLE_LABEL[user.role]} demo workspace (${user.name}).`);
      redirectAfterLogin(user);
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setDemoLoading('');
    }
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-8 lg:grid-cols-12 lg:items-start">
        {/* One-Click Demo Role Switcher */}
        <section className="card p-6 sm:p-8 lg:col-span-7" aria-labelledby="demo-login-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DemoBadge />
            <span className="text-xs text-muted">Instant role switching</span>
          </div>
          <h1 id="demo-login-heading" className="mt-3 font-serif text-2xl font-semibold text-navy sm:text-3xl">
            Explore Legal Eagle by Role
          </h1>
          <p className="mt-2 text-sm text-muted">
            Choose a fictional demo account below to immediately test the Client, Lawyer, or Law Firm dashboard experience.
          </p>

          <div className="mt-6 space-y-3">
            {ROLE_CARDS.map(({ role, icon: Icon, title, subtitle, email }) => {
              const busy = demoLoading === role;
              return (
                <button
                  key={role}
                  type="button"
                  disabled={!!demoLoading || submitting}
                  onClick={() => handleDemoLogin(role)}
                  className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-cream/50 p-4 text-left transition hover:border-gold hover:bg-gold-100/50 disabled:opacity-60"
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-navy text-gold">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-navy">{title}</p>
                    <p className="truncate text-xs text-ink">{subtitle}</p>
                    <p className="mt-0.5 text-xs text-muted">{email}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <>
                        Enter <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-line bg-cream p-4 text-xs text-muted">
            <p className="font-semibold text-ink">Available demo emails for manual login:</p>
            <ul className="mt-1.5 space-y-1">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.email}>
                  <button
                    type="button"
                    onClick={() => {
                      form.setField('email', a.email);
                      form.setField('password', 'Password@123');
                    }}
                    className="font-medium text-navy underline-offset-2 hover:underline"
                  >
                    {a.email}
                  </button>{' '}
                  — {a.name} ({ROLE_LABEL[a.role]})
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Standard Email & Password Login Form */}
        <section className="card p-6 sm:p-8 lg:col-span-5" aria-labelledby="login-form-heading">
          <h2 id="login-form-heading" className="font-serif text-xl font-semibold text-navy sm:text-2xl">
            Sign In with Email
          </h2>
          <p className="mt-1 text-xs text-muted">
            Enter a demo account email or an email you registered in this browser.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            <FormField
              label="Email address"
              type="email"
              required
              placeholder="client@demo.legaleagle.in"
              autoComplete="email"
              {...form.field('email')}
            />
            <FormField
              as="password"
              label="Password"
              required
              placeholder="Enter your password"
              autoComplete="current-password"
              hint="Enter your account password (or Password@123 for demo accounts)."
              {...form.field('password')}
            />
            <button type="submit" disabled={submitting || !!demoLoading} className="btn btn-primary w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Log In
            </button>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
            New to Legal Eagle?{' '}
            <Link to="/signup" className="font-semibold text-navy hover:underline">
              Create a demo account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
