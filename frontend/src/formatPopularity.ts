export const POPULARITY_LABEL = "TMDb popularity";
export const POPULARITY_UNAVAILABLE = "Information unavailable";

const popularityFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  useGrouping: false,
});

// Presentation only: the API value is never rounded or mutated, and 0 is valid.
export function formatPopularityScore(score: unknown): string {
  return typeof score === "number" && Number.isFinite(score)
    ? popularityFormat.format(score)
    : POPULARITY_UNAVAILABLE;
}
