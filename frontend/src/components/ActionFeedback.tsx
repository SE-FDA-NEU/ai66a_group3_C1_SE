import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FeedbackContext, type FeedbackMessage } from "../feedback.ts";

type Notice = FeedbackMessage & { id: number };

export default function ActionFeedback({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paused, setPaused] = useState(false);
  const nextId = useRef(0);
  const announce = useCallback((message: FeedbackMessage) => {
    const id = ++nextId.current;
    setPaused(false);
    setNotice({ ...message, id });
    return id;
  }, []);
  const update = useCallback((id: number, message: FeedbackMessage) => {
    // An old request cannot replace a newer action's message.
    setNotice(current => current?.id === id ? { ...message, id } : current);
  }, []);
  const dismiss = useCallback((id?: number) => {
    setNotice(current => id === undefined || current?.id === id ? null : current);
  }, []);
  const value = useMemo(() => ({ announce, update, dismiss }), [announce, update, dismiss]);

  useEffect(() => {
    if (!notice || paused || notice.kind === "pending") return;
    const timer = window.setTimeout(() => dismiss(notice.id), notice.kind === "error" ? 8000 : 4500);
    return () => window.clearTimeout(timer);
  }, [notice, paused, dismiss]);
  useEffect(() => {
    if (!notice) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) dismiss(notice.id);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [notice, dismiss]);

  return <FeedbackContext.Provider value={value}>
    {children}
    {notice ? <div className="action-feedback-anchor">
      <div className={`action-feedback action-feedback--${notice.kind}`} data-testid="action-feedback"
        onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)} onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false);
        }}>
        <span className="action-feedback__icon" aria-hidden="true">
          {notice.kind === "pending" ? <span className="feedback-spinner" /> :
            notice.kind === "success" ? "✓" : notice.kind === "error" ? "!" : "i"}
        </span>
        {/* Detailed errors remain assertive inline; this non-modal summary is polite. */}
        <div className="action-feedback__copy" role="status" aria-atomic="true">
          <strong>{notice.title}</strong>
          {notice.message ? <p>{notice.message}</p> : null}
        </div>
        <button type="button" className="action-feedback__close" aria-label="Dismiss notification"
          onClick={() => dismiss(notice.id)}>×</button>
      </div>
    </div> : null}
  </FeedbackContext.Provider>;
}
