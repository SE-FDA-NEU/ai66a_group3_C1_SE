/** Tested patterns for later feature owners; no unfinished media is mounted. */
export function ExternalTrailerLink({ url }: { url?: string | null }) {
  const allowed = typeof url === "string" && /^https:\/\/www\.youtube\.com\/watch\?v=[A-Za-z0-9_-]{11}$/.test(url);
  return allowed ? <a className="button-link" href={url!} target="_blank" rel="noopener noreferrer">
    Watch trailer <span className="sr-only">(YouTube, opens in a new tab)</span>
  </a> : <p className="muted">Trailer unavailable</p>;
}

export function ProviderBadges({ names }: { names: string[] }) {
  return <ul className="provider-badges" aria-label="Viewing providers">
    {[...new Set(names)].map(name => <li key={name}>{name}</li>)}
  </ul>;
}
