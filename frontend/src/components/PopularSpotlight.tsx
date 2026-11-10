import { useState } from "react";
import { Link } from "react-router-dom";
import type { MovieSummary } from "../api/movies.ts";
import { formatPopularityScore } from "../formatPopularity.ts";
import { allowedBackdropUrl } from "./backdropUrl.ts";
import MoviePoster from "./MoviePoster.tsx";
import type { ListViewContext } from "../navigation/listViewState.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";

function Backdrop({ movie }: { movie: MovieSummary }) {
  const [failed, setFailed] = useState(false);
  const url = allowedBackdropUrl(movie.backdropUrl);
  return url && !failed ? <img className="popular-spotlight__backdrop" src={url}
    alt="" aria-hidden="true" onError={() => setFailed(true)} /> : null;
}

export default function PopularSpotlight({ movies, startRank, activeMovieId, onSelect, returnTo, returnContext }: {
  movies: MovieSummary[]; startRank: number; activeMovieId?: string;
  onSelect: (movieId: string) => void; returnTo: string; returnContext: ListViewContext;
}) {
  const picks = movies.slice(0, 3);
  const index = Math.max(0, picks.findIndex(movie => movie.id === activeMovieId));
  const movie = picks[index];
  if (!movie) return null;
  const move = (step: number) => onSelect(picks[(index + step + picks.length) % picks.length].id);
  return <section className="popular-spotlight" aria-label="Popular movie spotlight"
    aria-roledescription="carousel" onKeyDown={event => {
      if (picks.length < 2 || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault(); move(event.key === "ArrowRight" ? 1 : -1);
    }}>
    <Backdrop key={`${movie.id}:${movie.backdropUrl}`} movie={movie} />
    {picks.length > 1 ? <button type="button" className="spotlight-arrow spotlight-arrow--previous"
      aria-label="Previous featured movie" onClick={() => move(-1)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m14 5-7 7 7 7" /></svg>
    </button> : null}
    <div className="popular-spotlight__copy">
      <p className="spotlight-badge"><span aria-hidden="true">✦</span> #{startRank + index} in this catalogue</p>
      <p className="popular-spotlight__genres">{movie.genres.map(genre => genre.name).join(" · ")}
        {movie.releaseYear !== null ? ` · ${movie.releaseYear}` : ""}</p>
      <h2>{movie.title}</h2>
      <p className="popular-spotlight__score">TMDb popularity <strong>{formatPopularityScore(movie.popularityScore)}</strong></p>
      <Link className="button-link" to={`/movies/${encodeURIComponent(movie.id)}`}
        state={movieDetailReturnState(returnTo, returnContext)} aria-label={`Explore featured movie ${movie.title}`}>
        View details <span aria-hidden="true">↗</span>
      </Link>
    </div>
    <div className="popular-spotlight__poster" aria-hidden="true"><MoviePoster {...movie} movieId={movie.id} eager /></div>
    {picks.length > 1 ? <button type="button" className="spotlight-arrow spotlight-arrow--next"
      aria-label="Next featured movie" onClick={() => move(1)}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 5 7 7-7 7" /></svg>
    </button> : null}
    <div className="spotlight-pagination">
      <span className="spotlight-pagination__label">On this page</span>
      {picks.length > 1 ? <div className="spotlight-dots" role="group" aria-label="Featured movie selection">
        {picks.map((pick, position) => <button type="button" key={pick.id}
          aria-label={`Show featured movie ${position + 1}: ${pick.title}`} aria-pressed={position === index}
          onClick={() => onSelect(pick.id)}><span /></button>)}
      </div> : null}
      <span className="spotlight-pagination__count" role="status" aria-live="polite" aria-atomic="true">
        <span className="sr-only">Featured movie </span>{index + 1} / {picks.length}
      </span>
    </div>
  </section>;
}
