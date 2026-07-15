// Per-domain quiz accuracy aggregation and weakest-domain selection,
// extracted from js/views/progress.js so the comparison rules (unrounded
// accuracy for ties, no flag when everything attempted is perfect) can be
// unit tested without a DOM. No storage or DOM access lives here — the view
// fetches the history and renders; this module only does the math.

// Aggregates quiz history into per-domain stats. Attempts with `total: 0`
// are excluded — they carry no accuracy signal and would otherwise divide
// by zero.
export function computeDomainStats(domains, quizHistory) {
  return domains.map((d) => {
    const attempts = quizHistory.filter((a) => a.domain === d.id && a.total > 0);
    const correct = attempts.reduce((sum, a) => sum + a.score, 0);
    const total = attempts.reduce((sum, a) => sum + a.total, 0);
    return {
      id: d.id,
      name: d.name,
      attemptCount: attempts.length,
      // Unrounded fraction for comparisons; the rounded percent is display-only
      // (two domains that round to the same percent can still differ).
      accuracy: total > 0 ? correct / total : null,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    };
  });
}

// Flags the lowest-accuracy attempted domain, but never when it's perfect —
// there is nothing to "focus on" if every attempted domain is at 100%. A
// single attempted domain below 100% IS flagged: it's the weakest by
// definition, and the user still has something to improve there.
export function weakestDomainId(domainStats) {
  const attempted = domainStats.filter((d) => d.attemptCount > 0);
  if (attempted.length === 0) return null;
  const weakest = attempted.reduce((min, d) => (d.accuracy < min.accuracy ? d : min));
  return weakest.accuracy < 1 ? weakest.id : null;
}
