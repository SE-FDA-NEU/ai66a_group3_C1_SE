import { useId, useState } from "react";
import type { RatingValue } from "../api/ratings.ts";

export default function StarRating({ value, onChange, disabled = false }: {
  value: RatingValue | null; onChange: (rating: RatingValue) => void; disabled?: boolean;
}) {
  const name = useId();
  const [preview, setPreview] = useState<RatingValue | null>(null);
  const shown = preview ?? value ?? 0;
  return <fieldset className="star-rating" disabled={disabled}>
    <legend>Your rating (0.5 to 5)</legend>
    <div className="star-rating__choices" onMouseLeave={() => setPreview(null)}>
      {([1, 2, 3, 4, 5] as const).map(star => <div key={star} className="star-rating__star">
        <span className="star-rating__glyph" aria-hidden="true">★</span>
        <span className="star-rating__fill" aria-hidden="true"
          style={{ clipPath: `inset(0 ${100 - Math.min(1, Math.max(0, shown - star + 1)) * 100}% 0 0)` }}>★</span>
        {[star - 0.5, star].map((rating, half) => <label key={rating}
          className={`star-rating__choice star-rating__choice--${half === 0 ? "half" : "whole"}`}
          onMouseEnter={() => !disabled && setPreview(rating as RatingValue)}>
          <input type="radio" name={name} value={rating} checked={value === rating}
            aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}
            onFocus={() => setPreview(rating as RatingValue)} onBlur={() => setPreview(null)}
            onChange={() => onChange(rating as RatingValue)} />
        </label>)}
      </div>)}
    </div>
    <p className="star-rating__selection">{value === null ? "Choose 0.5 to 5 stars" : `Selected rating: ${value}/5`}</p>
  </fieldset>;
}
