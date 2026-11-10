import { useEffect, useId, useRef, useState } from "react";
import type { MovieDetail } from "../api/movies.ts";

type Trailer = MovieDetail["trailer"];

function officialVideoId(trailer: Trailer): string | null {
  if (!trailer || trailer.site !== "YouTube" || trailer.type !== "Trailer"
    || trailer.official !== true || typeof trailer.key !== "string"
    || !/^[A-Za-z0-9_-]{11}$/.test(trailer.key)) return null;
  return trailer.url === `https://www.youtube.com/watch?v=${trailer.key}` ? trailer.key : null;
}

function TrailerDialog({ id, videoId, title, onClose }: {
  id: string; videoId: string; title: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const done = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialog.current!;
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    // The native modal makes the rest of the page inert and contains keyboard
    // focus, including focus inside the cross-origin video frame.
    node.showModal();
    close.current?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      node.close();
      document.body.style.overflow = overflow;
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  return <dialog className="trailer-dialog" id={id} ref={dialog}
    aria-labelledby={titleId} aria-modal="true"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      if (event.shiftKey && event.target === close.current) {
        event.preventDefault(); done.current?.focus();
      } else if (!event.shiftKey && event.target === done.current) {
        event.preventDefault(); close.current?.focus();
      }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right
        || event.clientY < box.top || event.clientY > box.bottom) onClose();
    }}>
    <header className="trailer-dialog__header">
      <div><p className="eyebrow">Official trailer</p><h2 id={titleId}>{title}</h2></div>
      <button ref={close} type="button" className="button-secondary trailer-dialog__close"
        aria-label="Close trailer" title="Close trailer" onClick={onClose}>
        <span aria-hidden="true">×</span>
      </button>
    </header>
    <iframe className="trailer-dialog__frame"
      title={`Official trailer for ${title}`}
      src={`https://www.youtube.com/embed/${videoId}?autoplay=0&playsinline=1&rel=0`}
      allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen
      referrerPolicy="strict-origin-when-cross-origin" />
    <footer className="trailer-dialog__footer">
      <p className="trailer-dialog__hint">If this video is unavailable, try again later.</p>
      <button ref={done} type="button" className="button-secondary" onClick={onClose}>Back to details</button>
    </footer>
  </dialog>;
}

function TrailerControl({ videoId, title }: { videoId: string | null; title: string }) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  return <div className="movie-trailer">
    {videoId ? <button type="button" className="movie-trailer__button" aria-haspopup="dialog"
      aria-controls={open ? dialogId : undefined} onClick={() => setOpen(true)}>
      <span aria-hidden="true">▶</span> Watch trailer
    </button> : <p className="movie-trailer__unavailable">Trailer unavailable</p>}
    {videoId && open && <TrailerDialog id={dialogId} videoId={videoId} title={title}
      onClose={() => setOpen(false)} />}
  </div>;
}

export function MovieTrailer({ movieId, title, trailer }: {
  movieId: string; title: string; trailer?: Trailer;
}) {
  const videoId = officialVideoId(trailer);
  // Reset playback synchronously when the movie or selected video changes.
  return <TrailerControl key={`${movieId}:${videoId ?? "unavailable"}`}
    videoId={videoId} title={title} />;
}
