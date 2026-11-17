/**
 * Fictional seed data for Demo Mode.
 * All names, institutions, organisations, e-mails (example.com) and phone
 * numbers are invented. No real person is represented.
 */

const CURRENT_YEAR = 2026;

const STATE_BAR = {
  Jaipur: 'Bar Council of Rajasthan',
  Delhi: 'Bar Council of Delhi',
  Gurugram: 'Bar Council of Punjab & Haryana',
  Mumbai: 'Bar Council of Maharashtra & Goa',
  Pune: 'Bar Council of Maharashtra & Goa',
  Bengaluru: 'Karnataka State Bar Council',
};

const LAW_SCHOOLS = [
  'Aravali Institute of Legal Studies, Jaipur',
  'Capital Law University, Delhi',
  'Western India School of Law, Mumbai',
  'Deccan Institute of Legal Studies, Pune',
  'Northern Plains Law College, Chandigarh',
  'Coastal National Law Academy, Goa',
];

const PG_SPECIAL = {
  criminal: 'Criminal Law & Criminology',
  civil: 'Constitutional & Civil Law',
  family: 'Family & Personal Laws',
  divorce: 'Family & Personal Laws',
  property: 'Real Estate & Property Law',
  corporate: 'Corporate & Commercial Law',
  cyber: 'Technology & Cyber Law',
  consumer: 'Consumer Protection Law',
  employment: 'Labour & Employment Law',
  ip: 'Intellectual Property Rights',
  tax: 'Taxation Law',
  immigration: 'International & Immigration Law',
};

const ACHIEVEMENT_POOL = {
  criminal: ['Panel Speaker, Regional Workshop on Bail Jurisprudence', 'Volunteer Counsel, District Legal Aid Camp'],
  civil: ['Contributor, Bar Association Civil Procedure Handbook', 'Pro bono Counsel, Community Legal Literacy Drive'],
  family: ['Trained Family Mediator, Court-annexed Mediation Programme', 'Speaker, Women’s Legal Rights Awareness Session'],
  divorce: ['Certified Mediator, Matrimonial Dispute Resolution Course', 'Author, Article on Maintenance Law Reforms'],
  property: ['Speaker, Seminar on RERA Compliance for Homebuyers', 'Author, Guide to Property Title Verification'],
  corporate: ['Guest Lecturer, Corporate Governance Module', 'Author, Startup Compliance Checklist (Bar Journal)'],
  cyber: ['Speaker, Cyber Safety Awareness Programme', 'Author, Article on Digital Personal Data Protection'],
  consumer: ['Volunteer, Consumer Rights Awareness Week', 'Author, Handbook on E-commerce Consumer Complaints'],
  employment: ['Panel Member, HR Compliance Roundtable', 'Author, Article on Workplace Policy Drafting'],
  ip: ['Speaker, Trademark Basics for MSMEs Workshop', 'Author, Article on Copyright in Digital Media'],
  tax: ['Speaker, GST Update Seminar for Traders', 'Author, Article on Faceless Assessment Procedures'],
  immigration: ['Speaker, Overseas Education & Visa Awareness Session', 'Author, Guide to OCI Documentation'],
};

const LAWYER_ROWS = [
  // id, name, city, years, practices, visibility
  ['l1', 'Aarav Sharma', 'Jaipur', 9, ['criminal', 'civil'], 'clients'],
  ['l2', 'Kavya Mehra', 'Jaipur', 18, ['criminal', 'property'], 'clients'],
  ['l3', 'Rohan Bhatt', 'Jaipur', 6, ['civil', 'property'], 'clients'],
  ['l4', 'Sneha Agarwal', 'Jaipur', 4, ['criminal', 'consumer'], 'hidden'],
  ['l5', 'Ishaan Joshi', 'Jaipur', 3, ['civil', 'consumer'], 'clients'],
  ['l6', 'Meera Rathore', 'Jaipur', 21, ['family', 'divorce', 'civil'], 'clients'],
  ['l7', 'Nikhil Choudhary', 'Jaipur', 7, ['divorce', 'family'], 'clients'],
  ['l8', 'Aditi Kapoor', 'Delhi', 16, ['corporate', 'tax'], 'clients'],
  ['l9', 'Karan Sethi', 'Delhi', 11, ['ip', 'corporate'], 'hidden'],
  ['l10', 'Pooja Nair', 'Delhi', 5, ['tax', 'corporate'], 'clients'],
  ['l11', 'Rahul Bansal', 'Delhi', 13, ['criminal', 'civil'], 'clients'],
  ['l12', 'Tanvi Saxena', 'Delhi', 2, ['consumer', 'cyber'], 'clients'],
  ['l13', 'Devansh Arora', 'Gurugram', 10, ['cyber', 'ip'], 'clients'],
  ['l14', 'Riya Khanna', 'Gurugram', 6, ['cyber', 'consumer'], 'clients'],
  ['l15', 'Manav Gupta', 'Gurugram', 8, ['employment', 'corporate'], 'clients'],
  ['l16', 'Farah Qureshi', 'Mumbai', 15, ['corporate', 'employment', 'immigration'], 'clients'],
  ['l17', 'Aniket Deshmukh', 'Mumbai', 19, ['criminal', 'property'], 'hidden'],
  ['l18', 'Lakshmi Iyer', 'Mumbai', 12, ['property', 'consumer', 'civil'], 'clients'],
  ['l19', 'Zubin Patel', 'Mumbai', 4, ['immigration', 'employment'], 'clients'],
  ['l20', 'Neha Kulkarni', 'Pune', 9, ['family', 'divorce', 'property'], 'clients'],
  ['l21', 'Sameer Kohli', 'Gurugram', 1, ['criminal', 'cyber'], 'clients'],
  ['l22', 'Gauri Sinha', 'Delhi', 7, ['immigration', 'family'], 'clients'],
];

const FIRMS = [
  {
    id: 'f1', name: 'Mehra & Associates', city: 'Jaipur', address: 'C-Scheme, Jaipur, Rajasthan',
    established: 2004, practiceAreas: ['criminal', 'civil', 'property', 'consumer'],
    about: 'Mehra & Associates is a Jaipur-based litigation practice handling criminal, civil and property matters before district courts and the High Court. The firm focuses on clear communication with clients and well-documented case preparation.',
    email: 'office@mehra-associates.example.com', phone: '+91 90000 10001', website: 'mehra-associates.example.com',
  },
  {
    id: 'f2', name: 'Kapoor Legal LLP', city: 'Delhi', address: 'Connaught Place, New Delhi',
    established: 1998, practiceAreas: ['corporate', 'tax', 'ip'],
    about: 'Kapoor Legal LLP advises businesses on corporate structuring, taxation and intellectual property. The team supports startups, family-owned businesses and established companies with transactional and advisory work.',
    email: 'contact@kapoorlegal.example.com', phone: '+91 90000 10002', website: 'kapoorlegal.example.com',
  },
  {
    id: 'f3', name: 'Rathore Family Law Chambers', city: 'Jaipur', address: 'Malviya Nagar, Jaipur, Rajasthan',
    established: 2011, practiceAreas: ['family', 'divorce', 'civil'],
    about: 'Rathore Family Law Chambers works on matrimonial, custody and maintenance matters with an emphasis on mediation where appropriate and sensitive handling of family disputes.',
    email: 'chambers@rathorefamilylaw.example.com', phone: '+91 90000 10003', website: 'rathorefamilylaw.example.com',
  },
  {
    id: 'f4', name: 'Sterling Law Partners', city: 'Mumbai', address: 'Bandra Kurla Complex, Mumbai',
    established: 2008, practiceAreas: ['corporate', 'employment', 'immigration'],
    about: 'Sterling Law Partners provides corporate, employment and immigration advisory services to organisations and individuals, including policy drafting and cross-border mobility documentation.',
    email: 'hello@sterlinglaw.example.com', phone: '+91 90000 10004', website: 'sterlinglaw.example.com',
  },
  {
    id: 'f5', name: 'Arora Cyber & Tech Law', city: 'Gurugram', address: 'Cyber City, Gurugram, Haryana',
    established: 2016, practiceAreas: ['cyber', 'ip', 'consumer'],
    about: 'Arora Cyber & Tech Law focuses on technology-related legal matters including IT Act issues, data protection compliance, online fraud complaints and digital IP.',
    email: 'team@aroracyberlaw.example.com', phone: '+91 90000 10005', website: 'aroracyberlaw.example.com',
  },
  {
    id: 'f6', name: 'Deshmukh & Iyer Advocates', city: 'Mumbai', address: 'Fort, Mumbai, Maharashtra',
    established: 2001, practiceAreas: ['criminal', 'property', 'consumer', 'civil'],
    about: 'Deshmukh & Iyer Advocates is a Mumbai litigation practice appearing in criminal, property and consumer matters, with a long-standing focus on trial preparation and documentation.',
    email: 'office@deshmukhiyer.example.com', phone: '+91 90000 10006', website: 'deshmukhiyer.example.com',
  },
];

const ACTIVE_MEMBERS = {
  f1: ['l2', 'l3', 'l4'],
  f2: ['l8', 'l9', 'l10'],
  f3: ['l6', 'l7'],
  f4: ['l16', 'l19'],
  f5: ['l13', 'l14'],
  f6: ['l17', 'l18'],
};

const firmOf = (lawyerId) =>
  Object.keys(ACTIVE_MEMBERS).find((fid) => ACTIVE_MEMBERS[fid].includes(lawyerId));

const slugEmail = (name) => name.toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.');

function buildLawyer([id, name, city, years, practices, visibility], idx) {
  const n = idx + 1;
  const enrolYear = CURRENT_YEAR - years;
  const firmId = firmOf(id);
  const firm = FIRMS.find((f) => f.id === firmId);
  const primary = practices[0];
  const school = LAW_SCHOOLS[idx % LAW_SCHOOLS.length];
  const pgSchool = LAW_SCHOOLS[(idx + 2) % LAW_SCHOOLS.length];

  const education = [
    {
      id: `${id}-ed1`, institution: school, degree: 'B.A. LL.B. (Hons.)',
      field: 'Law', startYear: enrolYear - 5, endYear: enrolYear,
    },
  ];
  if (years >= 6) {
    education.unshift({
      id: `${id}-ed2`, institution: pgSchool, degree: 'LL.M.',
      field: PG_SPECIAL[primary], startYear: enrolYear + 1, endYear: enrolYear + 2,
    });
  }

  const experience = [];
  const currentStart = Math.max(enrolYear, CURRENT_YEAR - Math.ceil(years / 2));
  experience.push({
    id: `${id}-ex1`,
    organization: firm ? firm.name : 'Independent Practice',
    designation: firm ? (years >= 12 ? 'Partner' : years >= 6 ? 'Senior Associate' : 'Associate') : 'Advocate',
    startDate: `${currentStart}-0${(n % 9) + 1}`,
    endDate: '',
    description: `Handling ${practices.map((p) => PG_SPECIAL[p].toLowerCase()).join(' and ')} matters, including drafting, client advisory and appearances before courts and tribunals in ${city}.`,
  });
  if (currentStart > enrolYear) {
    experience.push({
      id: `${id}-ex2`,
      organization: `Chambers of a Senior Advocate, ${city}`,
      designation: 'Junior Associate',
      startDate: `${enrolYear}-07`,
      endDate: `${currentStart}-0${(n % 9) + 1}`,
      description: 'Assisted in research, drafting pleadings and preparing case briefs across civil and criminal matters.',
    });
  }

  const qualifications = [
    {
      id: `${id}-q1`, title: 'Enrolled Advocate', issuer: STATE_BAR[city],
      issueDate: `${enrolYear}-08`,
    },
  ];
  if (years >= 5) {
    qualifications.push({
      id: `${id}-q2`, title: `Certificate Course in ${PG_SPECIAL[practices[1] ?? primary]}`,
      issuer: 'Institute for Continuing Legal Education (fictional)', issueDate: `${enrolYear + 3}-03`,
    });
  }

  const achievements = ACHIEVEMENT_POOL[primary].slice(0, years >= 8 ? 2 : 1).map((title, i) => ({
    id: `${id}-a${i + 1}`,
    title,
    description: 'Listed for informational purposes only; not an endorsement or indicator of case outcomes.',
    date: `${CURRENT_YEAR - 1 - i * 2}-${String(((n + i) % 12) + 1).padStart(2, '0')}`,
  }));

  const designationWord = experience[0].designation;
  return {
    id,
    name,
    headline: `${designationWord} · ${PG_SPECIAL[primary]}${firm ? ` at ${firm.name}` : ''}`,
    city,
    experienceYears: years,
    practiceAreas: practices,
    about: `${name.split(' ')[0]} is an advocate based in ${city} with ${years} year${years === 1 ? '' : 's'} of practice, primarily in ${PG_SPECIAL[primary].toLowerCase()}. Their work involves understanding each client’s situation, explaining legal options in plain language and preparing matters carefully. (Fictional demo profile.)`,
    photo: '',
    languages: idx % 3 === 0 ? ['English', 'Hindi'] : idx % 3 === 1 ? ['English', 'Hindi', 'Rajasthani'] : ['English', 'Hindi', 'Marathi'],
    education,
    experience,
    qualifications,
    achievements,
    contact: {
      email: `${slugEmail(name)}@example.com`,
      phone: `+91 90000 2${String(n).padStart(4, '0')}`,
    },
    contactVisibility: visibility, // 'clients' | 'hidden'
    joinedAt: `2025-${String((n % 12) + 1).padStart(2, '0')}-10`,
  };
}

const lawyers = LAWYER_ROWS.map(buildLawyer);

let mCounter = 0;
const membership = (firmId, lawyerId, status, initiatedBy) => ({
  id: `m${++mCounter}`,
  firmId,
  lawyerId,
  status, // 'active' | 'pending' | 'rejected' | 'declined' | 'removed' | 'withdrawn' | 'left' | 'cancelled'
  initiatedBy, // 'firm' (invitation) | 'lawyer' (join request)
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-15T10:00:00.000Z',
});

const memberships = [
  ...Object.entries(ACTIVE_MEMBERS).flatMap(([fid, ids]) => ids.map((lid) => membership(fid, lid, 'active', 'firm'))),
  membership('f1', 'l1', 'pending', 'firm'), // invitation awaiting demo lawyer
  membership('f1', 'l5', 'pending', 'lawyer'), // join request awaiting demo firm
  membership('f1', 'l21', 'pending', 'lawyer'),
  membership('f5', 'l12', 'pending', 'lawyer'),
  membership('f2', 'l22', 'pending', 'lawyer'),
  membership('f4', 'l15', 'pending', 'firm'),
];

const firms = FIRMS.map((f) => ({ ...f, logo: '', cover: '' }));

const clients = [
  {
    id: 'c1', name: 'Ananya Verma', email: 'client@demo.legaleagle.in', city: 'Jaipur',
    saved: { lawyers: ['l2'], firms: ['f3'] },
    recent: [],
  },
];

/** Demo accounts. No passwords are stored anywhere. */
const users = [
  { id: 'u1', role: 'client', name: 'Ananya Verma', email: 'client@demo.legaleagle.in', profileId: 'c1' },
  { id: 'u2', role: 'lawyer', name: 'Aarav Sharma', email: 'lawyer@demo.legaleagle.in', profileId: 'l1' },
  { id: 'u3', role: 'firm', name: 'Mehra & Associates', email: 'firm@demo.legaleagle.in', profileId: 'f1', representative: 'Kavya Mehra' },
  { id: 'u4', role: 'lawyer', name: 'Manav Gupta', email: 'lawyer2@demo.legaleagle.in', profileId: 'l15' },
];

export const DEMO_ACCOUNTS = users.map(({ role, name, email }) => ({ role, name, email }));

/* ---------- Consultation Settings & Availability Seed ---------- */

const OFFICE_BY_CITY = {
  Jaipur: 'Chamber 204, C-Scheme Legal Complex, Ashok Marg, Jaipur',
  Delhi: 'Suite 12, Connaught Place Bar Chambers, New Delhi',
  Gurugram: '4th Floor, DLF Cyber Park Chambers, Phase III, Gurugram',
  Mumbai: '301 Heritage Law Chambers, Fort, Mumbai',
  Pune: '2nd Floor, Shivajinagar District Court Road, Pune',
  Bengaluru: 'Suite 8, MG Road Advocates Arcade, Bengaluru',
};

const FEE_TIERS = [1200, 1500, 1800, 2000, 2500, 3000];

const consultationSettings = lawyers.map((l, idx) => {
  const fee = l.id === 'l1' ? 1500 : l.id === 'l2' ? 2500 : FEE_TIERS[idx % FEE_TIERS.length];
  const modes = idx % 5 === 3 ? ['ONLINE'] : idx % 7 === 4 ? ['IN_PERSON'] : ['ONLINE', 'IN_PERSON'];
  return {
    lawyerId: l.id,
    fee,
    currency: 'INR',
    availableModes: modes,
    bookingLeadTime: 2, // minimum hours in advance
    workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'],
    workingHours: { start: '10:00', end: '18:00' },
    blockedDates: ['2026-11-15'],
    officeLocation: OFFICE_BY_CITY[l.city] || `${l.city} District Court Chambers`,
  };
});

// Generate 1-hour slots across November 2026 (including Nov 10 & Nov 12 from specification)
const SEED_DATES = [
  '2026-11-04',
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
  '2026-11-12',
  '2026-11-13',
  '2026-11-14',
  '2026-11-16',
  '2026-11-17',
  '2026-11-18',
  '2026-11-19',
  '2026-11-20',
];

const DEFAULT_HOURS = [
  ['10:00', '11:00'],
  ['11:00', '12:00'],
  ['15:00', '16:00'],
  ['16:00', '17:00'],
  ['17:00', '18:00'],
];

const availabilitySlots = [];
lawyers.forEach((l, lIdx) => {
  const datesForLawyer = lIdx < 6 ? SEED_DATES : SEED_DATES.filter((_, dIdx) => (dIdx + lIdx) % 2 === 0);
  datesForLawyer.forEach((date, dIdx) => {
    const hours = DEFAULT_HOURS.filter((_, hIdx) => (lIdx + dIdx + hIdx) % 5 !== 4);
    hours.forEach(([startTime, endTime]) => {
      const id = `slot_${l.id}_${date}_${startTime.replace(':', '')}`;
      availabilitySlots.push({
        id,
        lawyerId: l.id,
        date,
        startTime,
        endTime,
        timezone: 'Asia/Kolkata',
        status: 'AVAILABLE',
        reservedUntil: null,
        bookingId: null,
      });
    });
  });
});

function ensureSlot(lawyerId, date, startTime, endTime, status = 'AVAILABLE', bookingId = null) {
  const id = `slot_${lawyerId}_${date}_${startTime.replace(':', '')}`;
  let slot = availabilitySlots.find((s) => s.id === id);
  if (!slot) {
    slot = {
      id,
      lawyerId,
      date,
      startTime,
      endTime,
      timezone: 'Asia/Kolkata',
      status,
      reservedUntil: null,
      bookingId,
    };
    availabilitySlots.push(slot);
  } else {
    slot.status = status;
    slot.bookingId = bookingId;
  }
  return slot;
}

// Ensure specific demo scenario slots exist and have the right statuses:
// Scenario 1: Awaiting Lawyer Approval (Client c1 -> Lawyer l1 on 2026-11-10 16:00-17:00)
const slot1 = ensureSlot('l1', '2026-11-10', '16:00', '17:00', 'AWAITING_APPROVAL', 'bk_1001');
ensureSlot('l1', '2026-11-10', '10:00', '11:00', 'AVAILABLE');
ensureSlot('l1', '2026-11-10', '11:00', '12:00', 'AVAILABLE');
ensureSlot('l1', '2026-11-10', '15:00', '16:00', 'AVAILABLE');

// Scenario 2: Lawyer Proposed Reschedule (Client c1 -> Lawyer l2: original 2026-11-10 16:00 released, proposed 2026-11-12 17:00-18:00 held as PROPOSED)
const slot2Orig = ensureSlot('l2', '2026-11-10', '16:00', '17:00', 'AVAILABLE', null);
const slot2Prop = ensureSlot('l2', '2026-11-12', '17:00', '18:00', 'PROPOSED', 'bk_1002');

// Scenario 3: Confirmed Upcoming Appointment (Client c1 -> Lawyer l1 on 2026-11-11 11:00-12:00)
const slot3 = ensureSlot('l1', '2026-11-11', '11:00', '12:00', 'CONFIRMED', 'bk_1003');

// Scenario 4: Declined & Refunded Booking (Client c1 -> Lawyer l3 on 2026-11-09 15:00-16:00)
const slot4 = ensureSlot('l3', '2026-11-09', '15:00', '16:00', 'AVAILABLE', null);

// Scenario 5: Completed Past Consultation (Client c1 -> Lawyer l6 on 2026-10-28 10:00-11:00)
const slot5 = ensureSlot('l6', '2026-10-28', '10:00', '11:00', 'CONFIRMED', 'bk_1005');

// Scenario 6: Awaiting Lawyer Approval for Firm Member l2 (Mehra & Associates f1)
const slot6 = ensureSlot('l2', '2026-11-14', '11:00', '12:00', 'AWAITING_APPROVAL', 'bk_1006');

const bookings = [
  {
    id: 'bk_1001',
    clientId: 'c1',
    lawyerId: 'l1',
    firmId: null,
    originalSlotId: slot1.id,
    finalSlotId: slot1.id,
    mode: 'ONLINE',
    consultationFee: 1500,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 1500,
    currency: 'INR',
    bookingStatus: 'AWAITING_LAWYER',
    paymentId: 'pay_1001',
    responseDeadline: '2026-11-09T18:00:00.000Z',
    holdExpiresAt: null,
    clientNotes: 'Seeking initial consultation regarding a civil recovery notice received last week.',
    meetingLink: null,
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (10 Nov 2026, 4:00 PM – 5:00 PM)', at: '2026-11-02T09:10:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹1,500 · TXN-LE-90811)', at: '2026-11-02T09:12:00.000Z' },
      { step: 'AWAITING_LAWYER', label: 'Sent to Adv. Aarav Sharma — Awaiting Lawyer Approval', at: '2026-11-02T09:12:05.000Z' },
    ],
    createdAt: '2026-11-02T09:10:00.000Z',
    updatedAt: '2026-11-02T09:12:05.000Z',
  },
  {
    id: 'bk_1002',
    clientId: 'c1',
    lawyerId: 'l2',
    firmId: 'f1',
    originalSlotId: slot2Orig.id,
    finalSlotId: slot2Prop.id,
    mode: 'IN_PERSON',
    consultationFee: 2500,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 2500,
    currency: 'INR',
    bookingStatus: 'RESCHEDULE_PROPOSED',
    paymentId: 'pay_1002',
    responseDeadline: '2026-11-10T12:00:00.000Z',
    holdExpiresAt: null,
    clientNotes: 'Property title verification and RERA compliance discussion.',
    meetingLink: null,
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (10 Nov 2026, 4:00 PM – 5:00 PM)', at: '2026-11-01T14:00:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹2,500 · TXN-LE-90452)', at: '2026-11-01T14:03:00.000Z' },
      { step: 'AWAITING_LAWYER', label: 'Awaiting Lawyer Approval', at: '2026-11-01T14:03:02.000Z' },
      { step: 'RESCHEDULE_PROPOSED', label: 'Lawyer Proposed New Time (12 Nov 2026, 5:00 PM – 6:00 PM)', at: '2026-11-02T08:30:00.000Z' },
    ],
    createdAt: '2026-11-01T14:00:00.000Z',
    updatedAt: '2026-11-02T08:30:00.000Z',
  },
  {
    id: 'bk_1003',
    clientId: 'c1',
    lawyerId: 'l1',
    firmId: null,
    originalSlotId: slot3.id,
    finalSlotId: slot3.id,
    mode: 'ONLINE',
    consultationFee: 1500,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 1500,
    currency: 'INR',
    bookingStatus: 'CONFIRMED',
    paymentId: 'pay_1003',
    responseDeadline: null,
    holdExpiresAt: null,
    clientNotes: 'Follow-up review of drafted agreement clauses.',
    meetingLink: 'https://meet.legaleagle.example.com/session-bk_1003',
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (11 Nov 2026, 11:00 AM – 12:00 PM)', at: '2026-10-30T11:00:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹1,500 · TXN-LE-89910)', at: '2026-10-30T11:02:00.000Z' },
      { step: 'AWAITING_LAWYER', label: 'Awaiting Lawyer Approval', at: '2026-10-30T11:02:02.000Z' },
      { step: 'BOOKING_CONFIRMED', label: 'Confirmed by Adv. Aarav Sharma', at: '2026-10-30T15:20:00.000Z' },
    ],
    createdAt: '2026-10-30T11:00:00.000Z',
    updatedAt: '2026-10-30T15:20:00.000Z',
  },
  {
    id: 'bk_1004',
    clientId: 'c1',
    lawyerId: 'l3',
    firmId: 'f1',
    originalSlotId: slot4.id,
    finalSlotId: slot4.id,
    mode: 'ONLINE',
    consultationFee: 1800,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 1800,
    currency: 'INR',
    bookingStatus: 'REFUNDED',
    paymentId: 'pay_1004',
    responseDeadline: null,
    holdExpiresAt: null,
    clientNotes: 'Tenancy agreement dispute consultation.',
    meetingLink: null,
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (9 Nov 2026, 3:00 PM – 4:00 PM)', at: '2026-10-29T10:00:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹1,800 · TXN-LE-88204)', at: '2026-10-29T10:01:00.000Z' },
      { step: 'AWAITING_LAWYER', label: 'Awaiting Lawyer Approval', at: '2026-10-29T10:01:02.000Z' },
      { step: 'BOOKING_DECLINED', label: 'Declined by Adv. Rohan Bhatt (Out-of-station High Court hearing)', at: '2026-10-29T13:15:00.000Z' },
      { step: 'REFUND_INITIATED', label: 'Full Refund Initiated (₹1,800)', at: '2026-10-29T13:15:05.000Z' },
      { step: 'REFUND_COMPLETED', label: 'Full Refund Completed (₹1,800 credited)', at: '2026-10-30T09:00:00.000Z' },
    ],
    createdAt: '2026-10-29T10:00:00.000Z',
    updatedAt: '2026-10-30T09:00:00.000Z',
  },
  {
    id: 'bk_1005',
    clientId: 'c1',
    lawyerId: 'l6',
    firmId: 'f3',
    originalSlotId: slot5.id,
    finalSlotId: slot5.id,
    mode: 'IN_PERSON',
    consultationFee: 3000,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 3000,
    currency: 'INR',
    bookingStatus: 'COMPLETED',
    paymentId: 'pay_1005',
    responseDeadline: null,
    holdExpiresAt: null,
    clientNotes: 'Family settlement deed advisory.',
    meetingLink: null,
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (28 Oct 2026, 10:00 AM – 11:00 AM)', at: '2026-10-25T10:00:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹3,000 · TXN-LE-87119)', at: '2026-10-25T10:02:00.000Z' },
      { step: 'BOOKING_CONFIRMED', label: 'Confirmed by Adv. Meera Rathore', at: '2026-10-25T12:00:00.000Z' },
      { step: 'COMPLETED', label: 'Consultation Completed', at: '2026-10-28T11:05:00.000Z' },
    ],
    createdAt: '2026-10-25T10:00:00.000Z',
    updatedAt: '2026-10-28T11:05:00.000Z',
  },
  {
    id: 'bk_1006',
    clientId: 'c1',
    lawyerId: 'l2',
    firmId: 'f1',
    originalSlotId: slot6.id,
    finalSlotId: slot6.id,
    mode: 'ONLINE',
    consultationFee: 2500,
    platformFee: 0,
    taxAmount: 0,
    totalAmount: 2500,
    currency: 'INR',
    bookingStatus: 'AWAITING_LAWYER',
    paymentId: 'pay_1006',
    responseDeadline: '2026-11-12T18:00:00.000Z',
    holdExpiresAt: null,
    clientNotes: 'Follow-up on encumbrance certificate documents.',
    meetingLink: null,
    officeLocation: OFFICE_BY_CITY.Jaipur,
    timeline: [
      { step: 'SLOT_SELECTED', label: 'Slot Selected (14 Nov 2026, 11:00 AM – 12:00 PM)', at: '2026-11-02T10:00:00.000Z' },
      { step: 'PAYMENT_SUCCESS', label: 'Payment Verified (₹2,500 · TXN-LE-90944)', at: '2026-11-02T10:02:00.000Z' },
      { step: 'AWAITING_LAWYER', label: 'Awaiting Lawyer Approval', at: '2026-11-02T10:02:05.000Z' },
    ],
    createdAt: '2026-11-02T10:00:00.000Z',
    updatedAt: '2026-11-02T10:02:05.000Z',
  },
];

const payments = [
  {
    id: 'pay_1001',
    bookingId: 'bk_1001',
    clientId: 'c1',
    lawyerId: 'l1',
    amount: 1500,
    currency: 'INR',
    status: 'PAID',
    transactionReference: 'TXN-LE-90811',
    paidAt: '2026-11-02T09:12:00.000Z',
    createdAt: '2026-11-02T09:10:00.000Z',
  },
  {
    id: 'pay_1002',
    bookingId: 'bk_1002',
    clientId: 'c1',
    lawyerId: 'l2',
    amount: 2500,
    currency: 'INR',
    status: 'PAID',
    transactionReference: 'TXN-LE-90452',
    paidAt: '2026-11-01T14:03:00.000Z',
    createdAt: '2026-11-01T14:00:00.000Z',
  },
  {
    id: 'pay_1003',
    bookingId: 'bk_1003',
    clientId: 'c1',
    lawyerId: 'l1',
    amount: 1500,
    currency: 'INR',
    status: 'PAID',
    transactionReference: 'TXN-LE-89910',
    paidAt: '2026-10-30T11:02:00.000Z',
    createdAt: '2026-10-30T11:00:00.000Z',
  },
  {
    id: 'pay_1004',
    bookingId: 'bk_1004',
    clientId: 'c1',
    lawyerId: 'l3',
    amount: 1800,
    currency: 'INR',
    status: 'REFUNDED',
    transactionReference: 'TXN-LE-88204',
    paidAt: '2026-10-29T10:01:00.000Z',
    createdAt: '2026-10-29T10:00:00.000Z',
  },
  {
    id: 'pay_1005',
    bookingId: 'bk_1005',
    clientId: 'c1',
    lawyerId: 'l6',
    amount: 3000,
    currency: 'INR',
    status: 'PAID',
    transactionReference: 'TXN-LE-87119',
    paidAt: '2026-10-25T10:02:00.000Z',
    createdAt: '2026-10-25T10:00:00.000Z',
  },
  {
    id: 'pay_1006',
    bookingId: 'bk_1006',
    clientId: 'c1',
    lawyerId: 'l2',
    amount: 2500,
    currency: 'INR',
    status: 'PAID',
    transactionReference: 'TXN-LE-90944',
    paidAt: '2026-11-02T10:02:00.000Z',
    createdAt: '2026-11-02T10:00:00.000Z',
  },
];

const rescheduleProposals = [
  {
    id: 'prop_1002',
    bookingId: 'bk_1002',
    lawyerId: 'l2',
    originalSlotId: slot2Orig.id,
    proposedSlotId: slot2Prop.id,
    reason: 'Unfortunately, I am unavailable at the originally requested time due to an extended High Court hearing. Please consider this alternative one-hour slot.',
    status: 'PENDING', // 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED'
    expiresAt: '2026-11-10T12:00:00.000Z',
    createdAt: '2026-11-02T08:30:00.000Z',
  },
];

const refunds = [
  {
    id: 'ref_1004',
    bookingId: 'bk_1004',
    paymentId: 'pay_1004',
    clientId: 'c1',
    lawyerId: 'l3',
    amount: 1800,
    currency: 'INR',
    reason: 'Lawyer declined booking request: Out-of-station High Court hearing.',
    status: 'REFUNDED', // 'REFUND_INITIATED' | 'REFUNDED'
    initiatedAt: '2026-10-29T13:15:05.000Z',
    completedAt: '2026-10-30T09:00:00.000Z',
  },
];

const notifications = [
  {
    id: 'notif_1',
    recipientId: 'u2', // Lawyer Aarav Sharma (l1)
    bookingId: 'bk_1001',
    type: 'NEW_BOOKING_REQUEST',
    title: 'New Consultation Request',
    message: 'Ananya Verma has requested a one-hour consultation on 10 November 2026 from 4:00 PM to 5:00 PM. Payment has been received and the request is awaiting your response.',
    isRead: false,
    createdAt: '2026-11-02T09:12:05.000Z',
  },
  {
    id: 'notif_2',
    recipientId: 'u1', // Client Ananya Verma (c1)
    bookingId: 'bk_1002',
    type: 'RESCHEDULE_PROPOSED',
    title: 'New Consultation Time Proposed',
    message: 'Advocate Kavya Mehra proposed a new consultation time: 12 November 2026, 5:00 PM – 6:00 PM. Accept the new slot or reject it for a full refund.',
    isRead: false,
    createdAt: '2026-11-02T08:30:00.000Z',
  },
  {
    id: 'notif_3',
    recipientId: 'u1', // Client Ananya Verma (c1)
    bookingId: 'bk_1001',
    type: 'PAYMENT_SUCCESS',
    title: 'Payment Successful — Awaiting Lawyer Approval',
    message: 'Payment of ₹1,500 received for booking bk_1001 with Advocate Aarav Sharma. Your request is awaiting lawyer approval.',
    isRead: false,
    createdAt: '2026-11-02T09:12:00.000Z',
  },
  {
    id: 'notif_4',
    recipientId: 'u1',
    bookingId: 'bk_1003',
    type: 'BOOKING_CONFIRMED',
    title: 'Consultation Confirmed',
    message: 'Your consultation with Advocate Aarav Sharma is confirmed for 11 November 2026, from 11:00 AM to 12:00 PM.',
    isRead: true,
    createdAt: '2026-10-30T15:20:00.000Z',
  },
  {
    id: 'notif_5',
    recipientId: 'u1',
    bookingId: 'bk_1004',
    type: 'REFUND_COMPLETED',
    title: 'Full Refund Completed',
    message: 'Your refund of ₹1,800 for booking bk_1004 with Advocate Rohan Bhatt has been completed.',
    isRead: true,
    createdAt: '2026-10-30T09:00:00.000Z',
  },
];

export const seed = {
  users,
  lawyers,
  firms,
  memberships,
  clients,
  consultationSettings,
  availabilitySlots,
  bookings,
  payments,
  rescheduleProposals,
  refunds,
  notifications,
};
