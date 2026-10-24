import { Link } from "react-router-dom";
import type { MovieSummary } from "../api/movies.ts";
import { formatPopularityScore } from "../formatPopularity.ts";
import { allowedPosterUrl } from "./posterUrl.ts";
import MoviePoster from "./MoviePoster.tsx";
import type { ListViewContext } from "../navigation/listViewState.ts";
import { movieDetailReturnState } from "../navigation/movieDetailReturn.ts";

export default function PopularSpotlight({ movie, returnTo, returnContext }: {
  movie: MovieSummary; returnTo: string; returnContext: ListViewContext;
}) {
  const poster = allowedPosterUrl(movie.posterUrl);
  return <section className="popular-spotlight" aria-label="Most popular movie spotlight">
    {poster ? <img className="popular-spotlight__backdrop" src={poster} alt="" aria-hidden="true" /> : null}
    <div className="popular-spotlight__copy">
      <p className="spotlight-badge"><span aria-hidden="true">✦</span> #1 in this catalogue</p>
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
  </section>;
}
