/**
 * Derived-data helpers shared by the mock services (simulates server-side joins).
 * Contact details are intentionally excluded from every public shape.
 */

export function activeMembershipForLawyer(db, lawyerId) {
  return db.memberships.find((m) => m.lawyerId === lawyerId && m.status === 'active') || null;
}

export function activeMemberIds(db, firmId) {
  return db.memberships.filter((m) => m.firmId === firmId && m.status === 'active').map((m) => m.lawyerId);
}

export function firmAffiliation(db, lawyerId) {
  const m = activeMembershipForLawyer(db, lawyerId);
  if (!m) return null;
  const firm = db.firms.find((f) => f.id === m.firmId);
  return firm ? { id: firm.id, name: firm.name, logo: firm.logo } : null;
}

export function consultationInfoForLawyer(db, lawyerId) {
  const s = db.consultationSettings?.find((c) => c.lawyerId === lawyerId);
  if (!s) {
    return {
      fee: 1500,
      currency: 'INR',
      availableModes: ['ONLINE', 'IN_PERSON'],
      bookingLeadTime: 2,
      officeLocation: 'District Court Chambers',
    };
  }
  return {
    fee: s.fee,
    currency: s.currency || 'INR',
    availableModes: [...(s.availableModes || ['ONLINE'])],
    bookingLeadTime: s.bookingLeadTime ?? 2,
    officeLocation: s.officeLocation || '',
  };
}

/** Card-level public summary of a lawyer. */
export function lawyerSummary(db, l) {
  const consultation = consultationInfoForLawyer(db, l.id);
  return {
    id: l.id,
    name: l.name,
    headline: l.headline,
    photo: l.photo,
    city: l.city,
    experienceYears: l.experienceYears,
    practiceAreas: [...l.practiceAreas],
    firm: firmAffiliation(db, l.id),
    consultationFee: consultation.fee,
    availableModes: consultation.availableModes,
  };
}

/** Full public lawyer profile (no contact details). */
export function lawyerPublic(db, l) {
  // eslint-disable-next-line no-unused-vars
  const { contact, ...rest } = l;
  return {
    ...structuredClone(rest),
    firm: firmAffiliation(db, l.id),
    consultation: consultationInfoForLawyer(db, l.id),
  };
}

/** Card-level public summary of a firm with derived member count. */
export function firmSummary(db, f) {
  return {
    id: f.id,
    name: f.name,
    logo: f.logo,
    city: f.city,
    established: f.established,
    practiceAreas: [...f.practiceAreas],
    activeMemberCount: activeMemberIds(db, f.id).length,
  };
}
