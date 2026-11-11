import type { WatchCountry } from "./api/movies.ts";

export const WATCH_COUNTRY_STORAGE_KEY = "cineai-watch-country";
export const DEFAULT_WATCH_COUNTRY: WatchCountry = "US";
export const WATCH_COUNTRIES: readonly { code: WatchCountry; name: string }[] = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "SG", name: "Singapore" },
];

export function isWatchCountry(value: unknown): value is WatchCountry {
  return WATCH_COUNTRIES.some(country => country.code === value);
}

export function countryName(code: WatchCountry): string {
  return WATCH_COUNTRIES.find(country => country.code === code)?.name ?? code;
}

// Storage may be blocked or hold a corrupt value; both fall back to the default.
export function readWatchCountry(): WatchCountry {
  try {
    const stored = localStorage.getItem(WATCH_COUNTRY_STORAGE_KEY);
    return isWatchCountry(stored) ? stored : DEFAULT_WATCH_COUNTRY;
  } catch {
    return DEFAULT_WATCH_COUNTRY;
  }
}

export function writeWatchCountry(code: WatchCountry): void {
  try { localStorage.setItem(WATCH_COUNTRY_STORAGE_KEY, code); } catch { /* optional */ }
}

export const PROVIDER_LOGO_PREFIX = "https://image.tmdb.org/t/p/w92/";

export function validLogoUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith(PROVIDER_LOGO_PREFIX)
    && value.length > PROVIDER_LOGO_PREFIX.length && !/[\s"'<>\\]/.test(value) ? value : null;
}

// Mirrors the backend contract: TMDb's own HTTPS watch page for this country.
// The movie's numeric TMDb ID is not exposed, so only the path shape is checked.
export function validWatchOptionsUrl(value: unknown, country: WatchCountry): string | null {
  if (typeof value !== "string" || value.includes("#")
    || [...value].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127)) return null;
  try {
    const url = new URL(value);
    const query = [...url.searchParams.entries()];
    if (url.protocol !== "https:" || !["themoviedb.org", "www.themoviedb.org"].includes(url.hostname)
      || url.username || url.password || (url.port !== "" && url.port !== "443")
      || url.hash || query.length !== 1 || query[0][0] !== "locale" || query[0][1] !== country
      || !/^\/movie\/\d+(?:-[A-Za-z0-9-]+)?\/watch$/.test(url.pathname)) return null;
    return value;
  } catch {
    return null;
  }
}
