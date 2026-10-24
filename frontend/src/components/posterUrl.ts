/** Reject arbitrary hosts, query strings, user info and non-reviewed sizes. */
export function allowedPosterUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return /^https:\/\/image\.tmdb\.org\/t\/p\/w500\/[A-Za-z0-9_-]{1,128}\.(?:jpg|jpeg|png|webp)$/.test(value) ? value : null;
}
