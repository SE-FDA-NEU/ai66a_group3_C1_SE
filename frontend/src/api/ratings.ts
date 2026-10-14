export type RatingValue = 1 | 2 | 3 | 4 | 5;

export type RatingData = {
  movieId: string;
  rating: RatingValue | null;
};

export class RatingApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RatingApiError";
    this.status = status;
    this.code = code;
  }
}

export function isRatingValue(value: unknown): value is RatingValue {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readRating(
  response: Response,
  movieId: string,
  saving: boolean,
): Promise<RatingData> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const error = isRecord(body) && isRecord(body.error) ? body.error : null;
    throw new RatingApiError(
      typeof error?.message === "string"
        ? error.message
        : "Rating service is unavailable",
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  const data = isRecord(body) && isRecord(body.data) ? body.data : null;
  if (
    !data ||
    data.movieId !== movieId ||
    !(isRatingValue(data.rating) || (!saving && data.rating === null))
  ) {
    throw new RatingApiError(
      "The rating response could not be confirmed. Please retry.",
      response.status,
    );
  }
  return { movieId, rating: data.rating as RatingValue | null };
}

export async function getRating(
  movieId: string,
  signal?: AbortSignal,
): Promise<RatingData> {
  const response = await fetch(
    `/api/me/ratings/${encodeURIComponent(movieId)}`,
    {
      credentials: "include",
      signal,
    },
  );
  return readRating(response, movieId, false);
}

export async function saveRating(
  movieId: string,
  rating: RatingValue,
  signal?: AbortSignal,
): Promise<RatingData> {
  if (!isRatingValue(rating)) {
    throw new RatingApiError(
      "Choose a whole-number rating from 1 to 5",
      400,
      "VALIDATION_ERROR",
    );
  }
  const response = await fetch(
    `/api/me/ratings/${encodeURIComponent(movieId)}`,
    {
      method: "PUT",
      credentials: "include",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    },
  );
  const data = await readRating(response, movieId, true);
  if (data.rating !== rating) {
    throw new RatingApiError(
      "The saved rating did not match the submitted value. Please retry.",
      response.status,
    );
  }
  return data;
}
