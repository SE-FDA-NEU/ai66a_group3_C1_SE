import { useState } from "react";
import { allowedPosterUrl } from "./posterUrl.ts";

function PosterImage({ url, title, eager }: { url: string | null; title: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className="movie-poster">
    {url && !failed ? <img src={url} alt={`Poster for ${title}`} loading={eager ? "eager" : "lazy"}
      decoding="async" width="500" height="750" onError={() => setFailed(true)} /> :
      <div className="movie-poster__fallback" role="img" aria-label={`Poster unavailable for ${title}`}>
        <span className="poster-symbol" aria-hidden="true">✦</span><span>Poster unavailable</span>
      </div>}
  </div>;
}

export default function MoviePoster({ movieId, title, posterUrl, eager = false }: {
  movieId: string; title: string; posterUrl?: string | null; eager?: boolean;
}) {
  const url = allowedPosterUrl(posterUrl);
  return <PosterImage key={`${movieId}:${url ?? ""}`} url={url} title={title} eager={eager} />;
}
