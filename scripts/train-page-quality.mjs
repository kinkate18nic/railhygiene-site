const RATING_COMPONENTS = [
  "generalCoach",
  "coachFloor",
  "toilet",
  "dustbin",
];

function positiveCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function reportDates(stats) {
  return Object.keys(stats?.feedbacksByDate || {})
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort();
}

export function ratingObservationCount(stats) {
  return RATING_COMPONENTS.reduce(
    (total, component) => total + positiveCount(stats?.ratingCounts?.[component]),
    0,
  );
}

export function ratedCategoryCount(stats) {
  return RATING_COMPONENTS.filter(
    (component) => positiveCount(stats?.ratingCounts?.[component]) > 0,
  ).length;
}

export function statusObservationCount(stats) {
  return Object.values(stats?.statusCounts || {}).reduce(
    (total, statuses) =>
      total +
      Object.values(statuses || {}).reduce(
        (statusTotal, count) => statusTotal + positiveCount(count),
        0,
      ),
    0,
  );
}

export function issueFlagCount(stats) {
  return Object.values(stats?.booleanCounts || {}).reduce(
    (total, count) => total + positiveCount(count),
    0,
  );
}

export function trainPageQuality(stats) {
  const feedbackCount = positiveCount(stats?.feedbackCount);
  const ratings = ratingObservationCount(stats);
  const ratedCategories = ratedCategoryCount(stats);
  const conditionObservations = statusObservationCount(stats);
  const issueFlags = issueFlagCount(stats);
  const coachCount = Object.keys(stats?.coachStats || {}).length;
  const dateCount = reportDates(stats).length;
  const hasUsableEvidence = ratings + conditionObservations + issueFlags > 0;

  const indexEligible = feedbackCount > 0 && hasUsableEvidence;
  const hasSupportingDepth =
    conditionObservations > 0 || coachCount >= 2 || dateCount >= 2;
  const adEligible =
    indexEligible &&
    feedbackCount >= 2 &&
    ratedCategories >= 2 &&
    hasSupportingDepth;

  return {
    feedbackCount,
    ratingObservationCount: ratings,
    ratedCategoryCount: ratedCategories,
    conditionObservationCount: conditionObservations,
    issueFlagCount: issueFlags,
    coachCount,
    dateCount,
    indexEligible,
    adEligible,
  };
}
