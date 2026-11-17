import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { UserRound, Scale, Building2, Loader2 } from 'lucide-react';
import FormField from '../../components/forms/FormField';
import PracticeAreaPicker from '../../components/forms/PracticeAreaPicker';
import DemoBadge from '../../components/common/DemoBadge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useForm } from '../../hooks/useForm';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { rules } from '../../utils/validators';
import { CITIES, PRACTICE_AREAS } from '../../mock/referenceData';
import { cn, dashboardPath, ROLE_LABEL } from '../../utils/format';

const ROLES = [
  { role: 'client', label: 'Client', icon: UserRound, desc: 'Find & bookmark lawyers and firms' },
  { role: 'lawyer', label: 'Lawyer', icon: Scale, desc: 'Create an advocate portfolio' },
  { role: 'firm', label: 'Law Firm', icon: Building2, desc: 'Register chambers & manage team' },
];

const cityOptions = CITIES.map((c) => ({ value: c, label: c }));
const practiceOptions = PRACTICE_AREAS.map((p) => ({ value: p.slug, label: p.name }));

const INITIAL_VALUES = {
  name: '',
  firmName: '',
  representative: '',
  email: '',
  phone: '',
  city: '',
  practiceArea: '',
  practiceAreas: [],
  password: '',
  confirmPassword: '',
};

function schemaForRole(role) {
  const base = {
    email: [rules.required('Email address'), rules.email()],
    password: [rules.required('Password'), rules.password()],
    confirmPassword: [
      rules.required('Confirm password'),
      rules.matches('password', 'Passwords do not match.'),
    ],
  };
  if (role === 'client') {
    return {
      name: [rules.required('Full name'), rules.minLength(2, 'Full name')],
      ...base,
    };
  }
  if (role === 'lawyer') {
    return {
      name: [rules.required('Full name'), rules.minLength(2, 'Full name')],
      ...base,
      phone: [rules.required('Phone number'), rules.phone()],
      city: [rules.required('City')],
      practiceArea: [rules.required('Primary practice area')],
    };
  }
  return {
    firmName: [rules.required('Firm name'), rules.minLength(3, 'Firm name')],
    representative: [rules.required('Representative name')],
    ...base,
    city: [rules.required('City')],
    practiceAreas: [rules.required('At least one practice area')],
  };
}

export default function SignupPage() {
  useDocumentTitle('Create Account');
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = ['client', 'lawyer', 'firm'].includes(searchParams.get('role'))
    ? searchParams.get('role')
    : 'client';
  const [role, setRole] = useState(initialRole);
  const [submitting, setSubmitting] = useState(false);

  const { register } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();

  const schema = useMemo(() => schemaForRole(role), [role]);
  const form = useForm(INITIAL_VALUES, schema);

  const selectRole = (nextRole) => {
    setRole(nextRole);
    setSearchParams({ role: nextRole }, { replace: true });
    form.setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.validateAll()) return;
    setSubmitting(true);
    try {
      const user = await register(role, form.values);
      notify(`${ROLE_LABEL[role]} demo account created for ${user.name}.`);
      navigate(dashboardPath(user.role), { replace: true });
    } catch (err) {
      notify(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page py-12 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DemoBadge />
            <span className="text-xs text-muted">Role-based registration</span>
          </div>
          <h1 className="mt-3 font-serif text-2xl font-semibold text-navy sm:text-3xl">
            Create Your Legal Eagle Account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Select your account type below. The registration form adapts to your role.
          </p>

          {/* Role Selector */}
          <div role="tablist" aria-label="Select account role" className="mt-6 grid gap-3 sm:grid-cols-3">
            {ROLES.map(({ role: r, label, icon: Icon, desc }) => {
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectRole(r)}
                  className={cn(
                    'flex flex-col items-start rounded-2xl border p-4 text-left transition',
                    active
                      ? 'border-navy bg-navy text-white shadow-sm'
                      : 'border-line bg-cream/50 text-ink hover:border-gold',
                  )}
                >
                  <Icon className={cn('h-5 w-5', active ? 'text-gold' : 'text-navy')} aria-hidden="true" />
                  <span className="mt-2 font-semibold">{label}</span>
                  <span className={cn('mt-0.5 text-xs', active ? 'text-white/75' : 'text-muted')}>{desc}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-4">
            {role === 'client' && (
              <FormField
                label="Full name"
                required
                placeholder="e.g. Priya Malhotra"
                {...form.field('name')}
              />
            )}

            {role === 'lawyer' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Full name"
                    required
                    placeholder="e.g. Adv. Siddharth Rao"
                    {...form.field('name')}
                  />
                  <FormField
                    label="Phone number"
                    type="tel"
                    required
                    placeholder="+91 90000 12345"
                    {...form.field('phone')}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    as="select"
                    label="City"
                    required
                    placeholder="Select city"
                    options={cityOptions}
                    {...form.field('city')}
                  />
                  <FormField
                    as="select"
                    label="Primary practice area"
                    required
                    placeholder="Select specialization"
                    options={practiceOptions}
                    {...form.field('practiceArea')}
                  />
                </div>
              </>
            )}

            {role === 'firm' && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    label="Law firm name"
                    required
                    placeholder="e.g. Rao & Partners LLP"
                    {...form.field('firmName')}
                  />
                  <FormField
                    label="Representative name"
                    required
                    placeholder="e.g. Siddharth Rao"
                    {...form.field('representative')}
                  />
                </div>
                <FormField
                  as="select"
                  label="Primary city"
                  required
                  placeholder="Select city"
                  options={cityOptions}
                  {...form.field('city')}
                />
                <PracticeAreaPicker
                  label="Firm practice areas *"
                  value={form.values.practiceAreas}
                  onChange={(next) => form.setField('practiceAreas', next)}
                  error={form.errors.practiceAreas}
                />
              </>
            )}

            <FormField
              label={role === 'firm' ? 'Official firm email' : 'Email address'}
              type="email"
              required
              placeholder="name@example.com"
              autoComplete="email"
              {...form.field('email')}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                as="password"
                label="Password"
                required
                placeholder="Min 8 chars, letters & numbers"
                autoComplete="new-password"
                {...form.field('password')}
              />
              <FormField
                as="password"
                label="Confirm password"
                required
                placeholder="Repeat password"
                autoComplete="new-password"
                {...form.field('confirmPassword')}
              />
            </div>

            <p className="rounded-xl bg-cream p-3 text-xs text-muted">
              Demo notice: Your new profile will be saved in this browser’s local demo database. Passwords are validated for format only and never stored.
            </p>

            <button type="submit" disabled={submitting} className="btn btn-primary w-full">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Create {ROLE_LABEL[role]} Account
            </button>
          </form>

          <p className="mt-6 border-t border-line pt-4 text-center text-sm text-muted">
            Already have an account or want to use a pre-populated profile?{' '}
            <Link to="/login" className="font-semibold text-navy hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

