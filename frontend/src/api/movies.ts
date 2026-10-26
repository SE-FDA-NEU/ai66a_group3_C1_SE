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
  // Additive rollout: older backend responses may omit this image field.
  posterUrl?: string | null;
};

export type MovieDetail = MovieSummary & {
  overview: string | null;
  voteAverage: number | null;
  voteCount: number | null;
  // Older detail deployments may omit this additive field during rollout.
  backdropUrl?: string | null;
};

export type CatalogueSort = "title_asc" | "title_desc";

export type PageMeta = {
  count: number;
  limit: number;
  page: number;
  total: number;
  totalPages: number;
  unfilteredTotal: number;
  catalogueRevision: string;
};

type MovieListResponse = {
  data: {
    movies: MovieSummary[];
  };
  meta: PageMeta;
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

export async function searchMovies(query: string, signal?: AbortSignal): Promise<MovieSummary[]> {
  const params = new URLSearchParams({ q: query.trim() });
  const response = await fetch(`/api/movies/search?${params}`, { signal });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as { data: { movies: MovieSummary[] } };
  return body.data.movies;
}

export async function listMoviePage(
  kind: "catalogue" | "popular",
  page: number,
  revision?: string,
  signal?: AbortSignal,
  sort: CatalogueSort = "title_asc",
): Promise<MovieListResponse> {
  const params = new URLSearchParams({ limit: "10" });
  if (page !== 1) params.set("page", String(page));
  if (revision) params.set("catalogueRevision", revision);
  if (kind === "catalogue" && sort === "title_desc") params.set("sort", sort);
  const path = kind === "popular" ? "/api/movies/popular" : "/api/movies";
  const response = await fetch(`${path}?${params}`, { signal });
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as MovieListResponse;
  if (!body.meta) throw new MovieApiError("Invalid movie response", 0);
  const received = body.meta as Partial<PageMeta>;
  return { ...body, meta: {
    count: body.data.movies.length, limit: 10, page: 1,
    total: body.data.movies.length, totalPages: body.data.movies.length ? 1 : 0,
    unfilteredTotal: body.data.movies.length, catalogueRevision: "", ...received,
  } };
}

export async function listPopularMovies(limit = 10): Promise<MovieSummary[]> {
  const response = await fetch(`/api/movies/popular?limit=${limit}`);

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
