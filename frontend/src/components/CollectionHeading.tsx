import type { ReactNode } from "react";

export default function CollectionHeading({ kind, eyebrow, title, description, children }: {
  kind: "popular" | "search" | "watchlist";
  eyebrow: string; title: string; description: string; children?: ReactNode;
}) {
  return <header className="collection-heading" data-kind={kind}>
    <span className="collection-heading__icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {kind === "search" ? <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></> :
          kind === "watchlist" ? <path d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V21l-6-4-6 4Z" /> :
            <><path d="M13 3c1 5-3 5-1 9 1-1 2-2 2-4 5 4 5 8 2 11-4 4-11 1-10-5 .3-2 1.5-4 3-5-1 4 1 5 2 5-2-5 3-6 2-11Z" /></>}
      </svg>
    </span>
    <div className="collection-heading__copy">
      <p className="eyebrow">{eyebrow}</p><h1>{title}</h1>
      <p className="muted">{description}</p>
    </div>
    {children ? <div className="collection-heading__action">{children}</div> : null}
  </header>;
}
