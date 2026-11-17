import { getDb, delay } from './mockDb';
import { firmAffiliation, firmSummary, lawyerSummary } from './selectors';
import { PRACTICE_AREAS, practiceName } from '../mock/referenceData';

/**
 * Search service (mock).
 * Future endpoints:
 *  GET /api/search/lawyers?q=&practice=&city=&minExp=&maxExp=&page=&pageSize=
 *  GET /api/search/firms?q=&practice=&city=&page=&pageSize=
 *  GET /api/discover (homepage samples + practice-area counts)
 */
export const PAGE_SIZE = 6;

const norm = (s) => (s || '').toString().toLowerCase().trim();

function paginate(items, page, pageSize) {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  return { items: items.slice((current - 1) * pageSize, current * pageSize), total, page: current, totalPages };
}

const matchesKeyword = (term, fields) => !term || fields.some((f) => norm(f).includes(term));

export async function searchLawyers({ q, practice, city, minExp, maxExp, page = 1, pageSize = PAGE_SIZE } = {}) {
  await delay();
  const db = getDb();
  const term = norm(q);
  const min = minExp !== undefined && minExp !== '' ? Number(minExp) : null;
  const max = maxExp !== undefined && maxExp !== '' ? Number(maxExp) : null;

  const results = db.lawyers
    .filter((l) => {
      const firm = firmAffiliation(db, l.id);
      return (
        matchesKeyword(term, [l.name, l.headline, l.city, firm?.name, ...l.practiceAreas.map(practiceName)]) &&
        (!practice || l.practiceAreas.includes(practice)) &&
        (!city || l.city === city) &&
        (min === null || l.experienceYears >= min) &&
        (max === null || l.experienceYears <= max)
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name)) // neutral alphabetical order — no rankings
    .map((l) => lawyerSummary(db, l));

  return paginate(results, page, pageSize);
}

export async function searchFirms({ q, practice, city, page = 1, pageSize = PAGE_SIZE } = {}) {
  await delay();
  const db = getDb();
  const term = norm(q);
  const results = db.firms
    .filter(
      (f) =>
        matchesKeyword(term, [f.name, f.city, f.about, ...f.practiceAreas.map(practiceName)]) &&
        (!practice || f.practiceAreas.includes(practice)) &&
        (!city || f.city === city),
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => firmSummary(db, f));
  return paginate(results, page, pageSize);
}

/** Homepage discovery data: neutral samples, not rankings. */
export async function getDiscoverData() {
  await delay(250);
  const db = getDb();
  const counts = Object.fromEntries(
    PRACTICE_AREAS.map((p) => [p.slug, db.lawyers.filter((l) => l.practiceAreas.includes(p.slug)).length]),
  );
  return {
    practiceCounts: counts,
    lawyers: [...db.lawyers].sort((a, b) => (b.joinedAt > a.joinedAt ? 1 : -1)).slice(0, 4).map((l) => lawyerSummary(db, l)),
    firms: db.firms.slice(0, 3).map((f) => firmSummary(db, f)),
    totals: { lawyers: db.lawyers.length, firms: db.firms.length, practiceAreas: PRACTICE_AREAS.length },
  };
}
