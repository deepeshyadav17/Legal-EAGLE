/** Profile completion scoring used by dashboards (pure functions). */
export function lawyerCompletion(l) {
  const checks = [
    ['Profile photo', !!l.photo],
    ['Professional headline', !!l.headline && l.headline.length > 8],
    ['About section (60+ chars)', (l.about || '').length >= 60],
    ['City', !!l.city],
    ['Practice areas', l.practiceAreas?.length > 0],
    ['Education', l.education?.length > 0],
    ['Work experience', l.experience?.length > 0],
    ['Qualifications', l.qualifications?.length > 0],
    ['Achievements', l.achievements?.length > 0],
    ['Contact phone', !!l.contact?.phone],
  ];
  return summarize(checks);
}

export function firmCompletion(f) {
  const checks = [
    ['Firm logo', !!f.logo],
    ['Cover image', !!f.cover],
    ['About the firm (80+ chars)', (f.about || '').length >= 80],
    ['Address', !!f.address],
    ['Establishment year', !!f.established],
    ['Practice areas', f.practiceAreas?.length > 0],
    ['Official email', !!f.email],
    ['Phone', !!f.phone],
    ['At least one active lawyer', (f.activeMemberCount ?? 0) > 0],
  ];
  return summarize(checks);
}

function summarize(checks) {
  const done = checks.filter(([, ok]) => ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter(([, ok]) => !ok).map(([label]) => label),
  };
}
