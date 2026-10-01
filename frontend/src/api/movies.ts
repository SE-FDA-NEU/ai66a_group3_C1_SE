export type Genre = {
  id: number;
  name: string;
};

export type MovieSummary = {
  id: string;
  title: string;
  releaseYear: number | null;
  genres: Genre[];
  popularityScore: number | null;
};

export type MovieDetail = MovieSummary & {
  overview: string | null;
  voteAverage: number | null;
  voteCount: number | null;
};

type MovieListResponse = {
  data: {
    movies: MovieSummary[];
  };
};

type MovieDetailResponse = {
  data: {
    movie: MovieDetail;
  };
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
  };
};

export class MovieApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "MovieApiError";
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<MovieApiError> {
  let body: ApiErrorResponse | null = null;

  try {
    body = (await response.json()) as ApiErrorResponse;
  } catch {
    // Keep a safe fallback when the server returns a non-JSON body.
  }

  return new MovieApiError(
    body?.error?.message ?? "Something went wrong",
    response.status,
    body?.error?.code,
  );
}

export async function listMovies(limit = 10): Promise<MovieSummary[]> {
  const response = await fetch(`/api/movies?limit=${limit}`);

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as MovieListResponse;
  return body.data.movies;
}

export async function getMovie(movieId: string): Promise<MovieDetail> {
  const response = await fetch(`/api/movies/${encodeURIComponent(movieId)}`);

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as MovieDetailResponse;
  return body.data.movie;
}
