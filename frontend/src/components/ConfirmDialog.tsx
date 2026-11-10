import { useEffect, useId, useRef, type ReactNode } from "react";

/** Reusable visual primitive only: consumers own their real mutation and state. */
export default function ConfirmDialog({ open, title, children, confirmLabel, pending = false, onCancel, onConfirm }: {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; pending?: boolean;
  onCancel: () => void; onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement;
    const focusInside = () => (panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)") ?? panel.current)?.focus();
    focusInside();
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target)) focusInside();
    };
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("focusin", containFocus);
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, [open]);
  useEffect(() => {
    if (open && pending) panel.current?.focus();
  }, [open, pending]);
  if (!open) return null;
  return <div className="dialog-backdrop"><div className="confirmation-dialog" ref={panel}
    role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId} tabIndex={-1}
    onKeyDown={event => {
      if (event.key === "Escape" && !pending) { event.preventDefault(); onCancel(); }
      if (event.key === "Tab") {
        const controls = panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex='0']");
        if (!controls?.length) { event.preventDefault(); return; }
        const first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
      }
    }}>
    <h2 id={titleId}>{title}</h2><div id={bodyId}>{children}</div>
    <div className="detail-actions">
      <button type="button" className="button-secondary" onClick={onCancel} disabled={pending}>Cancel</button>
      <button type="button" onClick={onConfirm} disabled={pending}>{pending ? "Working..." : confirmLabel}</button>
    </div>
  </div></div>;
}
