import { useEffect, useId, useState } from "react";

import {
  getMovie, type MovieDetail, type ProviderGroupKey, type ProviderStatus,
  type WatchCountry, type WatchProvider,
} from "../api/movies.ts";
import {
  countryName, isWatchCountry, validLogoUrl, validWatchOptionsUrl, WATCH_COUNTRIES,
  writeWatchCountry,
} from "../watchCountry.ts";

const GROUPS: readonly { key: ProviderGroupKey; label: string }[] = [
  { key: "flatrate", label: "Stream" },
  { key: "rent", label: "Rent" },
  { key: "buy", label: "Buy" },
  { key: "free", label: "Free" },
  { key: "ads", label: "With ads" },
];
const STATUSES: readonly ProviderStatus[] = ["not_checked", "success", "no_data", "error", "stale"];

type Availability = {
  status: ProviderStatus;
  checkedAt: string | null;
  groups: { key: ProviderGroupKey; label: string; providers: WatchProvider[] }[];
  link: string | null;
};
type View = { state: "ready"; availability: Availability } | { state: "failed" };

// Reduces an API movie to one country's display data. A response whose region
// does not match the request is rejected so it can never sit under another label.
function toAvailability(movie: MovieDetail, country: WatchCountry): Availability {
  const providers = movie.providers;
  if (providers != null && providers.country !== country) throw new Error("Region mismatch");
  const status = providers && STATUSES.includes(providers.status) ? providers.status : "no_data";
  const groups = GROUPS.map(({ key, label }) => {
    const raw = providers?.groups?.[key];
    const list = Array.isArray(raw) ? raw : [];
    return {
      key, label,
      providers: list.filter(item => item && Number.isInteger(item.id)
        && typeof item.name === "string" && item.name.trim() !== "")
        .map(item => ({ id: item.id, name: item.name, logoUrl: validLogoUrl(item.logoUrl) })),
    };
  }).filter(group => group.providers.length > 0);
  const hasMemberships = status === "success" || status === "stale";
  return {
    status,
    checkedAt: typeof providers?.checkedAt === "string" ? providers.checkedAt : null,
    groups: hasMemberships ? groups : [],
    link: validWatchOptionsUrl(movie.watchOptionsUrl, country),
  };
}

function formatChecked(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function ProviderBadge({ provider }: { provider: WatchProvider }) {
  const [broken, setBroken] = useState(false);
  return <li className="provider-badge">
    {provider.logoUrl && !broken ? <img className="provider-badge__logo" src={provider.logoUrl}
      alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer"
      onError={() => setBroken(true)} /> : null}
    <span className="provider-badge__name">{provider.name}</span>
  </li>;
}

function Results({ availability, country }: { availability: Availability; country: WatchCountry }) {
  const name = countryName(country);
  const checked = formatChecked(availability.checkedAt);
  const { status, groups } = availability;
  let message: string | null = null;
  if (groups.length === 0) {
    message = status === "not_checked" ? `Viewing availability has not been checked for ${name} yet.`
      : status === "error" ? `Viewing availability could not be checked for ${name}. Try again later.`
        : `Viewing availability is not available for ${name}.`;
  }
  return <>
    {status === "stale" ? <p className="provider-warning" role="note">
      Showing the last successful check{checked ? ` on ${checked}` : ""}. The latest refresh failed,
      so this may be out of date.</p> : null}
    {message ? <p className="provider-message muted">{message}</p> : null}
    {groups.map(group => <section className="provider-group" key={group.key}
      aria-label={`${group.label} in ${name}`}>
      <h3 className="provider-group__title">{group.label}</h3>
      <ul className="provider-group__list">
        {group.providers.map(provider => <ProviderBadge key={provider.id} provider={provider} />)}
      </ul>
    </section>)}
    {status === "success" && checked && groups.length > 0
      ? <p className="provider-checked muted">Last checked {checked}.</p> : null}
  </>;
}

type Props = { movieId: string; initialCountry: WatchCountry; initialMovie: MovieDetail };

// Views are keyed by country; the parent keys this component by movie, so movie
// and country together identify every request and cached result.
function MovieWatchProviders({ movieId, initialCountry, initialMovie }: Props) {
  const headingId = useId();
  const hintId = useId();
  const selectId = useId();
  const [country, setCountry] = useState<WatchCountry>(initialCountry);
  const [views, setViews] = useState<Partial<Record<WatchCountry, View>>>(() => {
    try {
      return { [initialCountry]: { state: "ready", availability: toAvailability(initialMovie, initialCountry) } };
    } catch {
      return { [initialCountry]: { state: "failed" } };
    }
  });
  const [request, setRequest] = useState<{ country: WatchCountry; attempt: number } | null>(null);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    const target = request.country;
    getMovie(movieId, target, controller.signal).then(movie => {
      if (controller.signal.aborted) return;
      // Validate outside the state updater so a mismatched region becomes a failure.
      const availability = toAvailability(movie, target);
      setViews(current => ({ ...current, [target]: { state: "ready", availability } }));
    }).catch(() => {
      if (controller.signal.aborted) return;
      setViews(current => ({ ...current, [target]: { state: "failed" } }));
    });
    return () => controller.abort();
  }, [movieId, request]);

  function load(target: WatchCountry, discard: boolean) {
    if (discard) setViews(current => ({ ...current, [target]: undefined }));
    setRequest(previous => ({ country: target, attempt: (previous?.attempt ?? 0) + 1 }));
  }

  function select(value: string) {
    if (!isWatchCountry(value)) return;
    setCountry(value);
    writeWatchCountry(value);
    if (views[value]?.state !== "ready") load(value, true);
  }

  const name = countryName(country);
  const view = views[country];
  const link = view?.state === "ready" ? view.availability.link : null;

  return <section className="movie-providers" aria-labelledby={headingId}>
    <div className="movie-providers__header">
      <h2 id={headingId}>Where to watch in {name}</h2>
      <div className="movie-providers__selector">
        <label htmlFor={selectId}>Country</label>
        <select id={selectId} value={country} onChange={event => select(event.target.value)}>
          {WATCH_COUNTRIES.map(option => <option key={option.code} value={option.code}>
            {option.name} ({option.code})</option>)}
        </select>
      </div>
    </div>
    <div className="movie-providers__content" aria-live="polite">
      {!view ? <p role="status" className="muted">Loading availability for {name}…</p>
        : view.state === "failed" ? <div role="alert" className="provider-failure">
          <p>Viewing availability could not be loaded for {name}.</p>
          <button type="button" className="button-secondary" onClick={() => load(country, true)}>Retry</button>
        </div> : <Results key={country} availability={view.availability} country={country} />}
    </div>
    {link ? <p className="provider-action">
      <a className="button-link" href={link} target="_blank" rel="noopener noreferrer"
        aria-describedby={hintId}>View watch options on TMDb ↗</a>
      <span id={hintId} className="provider-hint muted">Opens TMDb for {name} in a new tab.</span>
    </p> : null}
    <p className="provider-note muted">
      Availability depends on the selected market and each service&apos;s access conditions.
      Watch provider data comes from TMDb, powered by JustWatch.
    </p>
  </section>;
}

export default MovieWatchProviders;
