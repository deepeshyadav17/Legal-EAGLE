/**
 * Static reference data. Icons are mapped in utils/practiceIcons.js so this
 * file stays serialisable and can be replaced by GET /api/practice-areas.
 */
export const PRACTICE_AREAS = [
  { slug: 'criminal', name: 'Criminal Law', description: 'Bail, trials, FIRs and criminal defence.' },
  { slug: 'civil', name: 'Civil Law', description: 'Civil suits, recovery and injunctions.' },
  { slug: 'family', name: 'Family Law', description: 'Custody, guardianship and maintenance.' },
  { slug: 'divorce', name: 'Divorce & Matrimonial Law', description: 'Divorce, alimony and matrimonial disputes.' },
  { slug: 'property', name: 'Property Law', description: 'Title, tenancy, RERA and land disputes.' },
  { slug: 'corporate', name: 'Corporate Law', description: 'Company formation, contracts and compliance.' },
  { slug: 'cyber', name: 'Cyber Law', description: 'Online fraud, data and IT Act matters.' },
  { slug: 'consumer', name: 'Consumer Law', description: 'Consumer commission complaints and claims.' },
  { slug: 'employment', name: 'Employment Law', description: 'Workplace, wages and termination issues.' },
  { slug: 'ip', name: 'Intellectual Property Law', description: 'Trademarks, copyright and patents.' },
  { slug: 'tax', name: 'Tax Law', description: 'GST, income tax assessments and appeals.' },
  { slug: 'immigration', name: 'Immigration Law', description: 'Visas, OCI, passports and citizenship.' },
];

export const CITIES = ['Jaipur', 'Delhi', 'Gurugram', 'Mumbai', 'Pune', 'Bengaluru'];

export const EXPERIENCE_OPTIONS = [0, 2, 5, 10, 15, 20, 25];

export const practiceName = (slug) =>
  PRACTICE_AREAS.find((p) => p.slug === slug)?.name ?? slug;
