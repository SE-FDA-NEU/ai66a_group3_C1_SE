import type { MovieDetail } from "../api/movies.ts";
import { ExternalTrailerLink } from "./MediaPatterns.tsx";

type Trailer = MovieDetail["trailer"];

function officialTrailerUrl(trailer: Trailer): string | null {
  if (!trailer || trailer.site !== "YouTube" || trailer.type !== "Trailer"
      || trailer.official !== true || !/^[A-Za-z0-9_-]{11}$/.test(trailer.key)) {
    return null;
  }
  const url = `https://www.youtube.com/watch?v=${trailer.key}`;
  return trailer.url === url ? url : null;
}

export function MovieTrailer({ trailer }: { trailer?: Trailer }) {
  const url = officialTrailerUrl(trailer);
  return <section className="movie-trailer" aria-labelledby="movie-trailer-title">
    <div>
      <p className="eyebrow">Official video</p>
      <h2 id="movie-trailer-title">Trailer</h2>
      <p className="muted">{url
        ? "Watch the official trailer on YouTube."
        : "No official trailer is available for this movie."}</p>
    </div>
    <ExternalTrailerLink url={url} />
  </section>;
}
