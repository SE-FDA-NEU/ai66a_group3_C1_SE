import { useState } from "react";

import { allowedBackdropUrl } from "./backdropUrl.ts";

type MovieBackdropHeroProps = {
  title: string;
  backdropUrl?: string | null;
};

function MovieBackdropHero({ title, backdropUrl }: MovieBackdropHeroProps) {
  const imageUrl = allowedBackdropUrl(backdropUrl);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <header className="movie-detail__hero">
      {imageUrl && !imageFailed && (
        <img
          className={`movie-detail__hero-image${imageLoaded ? " movie-detail__hero-image--loaded" : ""}`}
          src={imageUrl}
          alt=""
          aria-hidden="true"
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            setImageLoaded(false);
            setImageFailed(true);
          }}
        />
      )}
      <div className="movie-detail__hero-content">
        <p className="eyebrow">Movie details</p>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

export default MovieBackdropHero;
