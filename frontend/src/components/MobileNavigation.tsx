import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";

/** Mounted only at the compact breakpoint; desktop keeps ordinary navigation. */
export default function MobileNavigation({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [openedAt, setOpenedAt] = useState(location);
  const expanded = open && openedAt === location;
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expanded) return;
    const root = document.getElementById("root");
    const previousInert = root?.inert ?? false;
    const previousOverflow = document.body.style.overflow;
    const returnFocus = trigger.current;
    if (root) root.inert = true;
    document.body.style.overflow = "hidden";
    const controls = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      "a[href], button:not(:disabled), [tabindex='0']",
    ) ?? []);
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setOpen(false); }
      if (event.key === "Tab") {
        const items = controls();
        const first = items[0], last = items.at(-1);
        if (!first || !last) { event.preventDefault(); return; }
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) controls()[0]?.focus();
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("focusin", containFocus);
      if (root) root.inert = previousInert;
      document.body.style.overflow = previousOverflow;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [expanded]);

  return <>
    <button ref={trigger} className="navigation-toggle button-secondary" type="button"
      aria-label="Open navigation" aria-expanded={expanded} aria-controls={expanded ? id : undefined}
      onClick={() => { setOpenedAt(location); setOpen(true); }}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    {expanded && createPortal(<div className="navigation-backdrop" onClick={event => {
      if (event.target === event.currentTarget) setOpen(false);
    }}>
      <div id={id} ref={panel} className="navigation-drawer" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <div className="navigation-drawer__heading">
          <div><span className="eyebrow">CineAI</span><h2 id={`${id}-title`}>Explore movies</h2></div>
          <button type="button" className="button-secondary navigation-close" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button>
        </div>
        <div className="navigation-drawer__body" onClick={event => {
          // Close even when selecting the current route; mutations keep their
          // pending/error feedback visible until they actually navigate.
          if (event.target instanceof Element && event.target.closest("a[href]")) setOpen(false);
        }}>{children}</div>
      </div>
    </div>, document.body)}
  </>;
}
