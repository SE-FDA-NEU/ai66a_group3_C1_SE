import { useId, useState } from "react";
import type { RatingValue } from "../api/ratings.ts";

export default function StarRating({ value, onChange, disabled = false }: {
  value: RatingValue | null; onChange: (rating: RatingValue) => void; disabled?: boolean;
}) {
  const name = useId();
  const [preview, setPreview] = useState<RatingValue | null>(null);
  const shown = preview ?? value ?? 0;
  return <fieldset className="star-rating" disabled={disabled}>
    <legend>Your rating (1 to 5)</legend>
    <div className="star-rating__choices" onMouseLeave={() => setPreview(null)}>
      {([1, 2, 3, 4, 5] as const).map(rating => <label key={rating}
        className={`star-rating__choice${rating <= shown ? " star-rating__choice--filled" : ""}`}
        onMouseEnter={() => !disabled && setPreview(rating)}>
        <input type="radio" name={name} value={rating} checked={value === rating}
          aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}
          onFocus={() => setPreview(rating)} onBlur={() => setPreview(null)}
          onChange={() => onChange(rating)} />
        <span aria-hidden="true">★</span>
      </label>)}
    </div>
    <p className="star-rating__selection">{value === null ? "Choose 1 to 5 stars" : `Selected rating: ${value}/5`}</p>
  </fieldset>;
}
