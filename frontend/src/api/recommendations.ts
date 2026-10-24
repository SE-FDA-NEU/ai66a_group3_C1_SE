import type { Genre, MovieSummary, PageMeta } from "./movies.ts";
import { fallbackErrorMessage, NETWORK_FAILURE_MESSAGE } from "./requestFailure.ts";

export type RecommendationMovie = MovieSummary & {
  reason: {
    matchedGenres: Genre[];
  };
  ratingAdjustment?: number;
  adjustedScore?: number | null;
  basis?: "baseline" | "rating_signals" | "rating_unavailable";
};

export type RecommendationResult = {
  movies: RecommendationMovie[];
  mode: "popular" | "personalised";
  personalised: boolean;
  noMatch: boolean;
};

type RecommendationResponse = {
  data: RecommendationResult;
  meta: PageMeta;
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class RecommendationApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "RecommendationApiError";
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<RecommendationApiError> {
  let body: ApiErrorResponse | null = null;

  try {
    body = (await response.json()) as ApiErrorResponse;
  } catch {
    // Keep a safe fallback when the server returns a non-JSON body.
  }

  return new RecommendationApiError(
    body?.error?.message ?? fallbackErrorMessage(response.status),
    response.status,
    body?.error?.code,
  );
}

export async function getRecommendations(
  limit = 10,
  signal?: AbortSignal,
): Promise<RecommendationResult> {
  let response: Response;

  try {
    response = await fetch(`/api/me/recommendations?limit=${limit}`, {
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new RecommendationApiError(NETWORK_FAILURE_MESSAGE, 0);
  }

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as RecommendationResponse;
  return body.data;
}

export async function getRecommendationPage(
  page: number,
  genreId?: number,
  revision?: string,
  signal?: AbortSignal,
): Promise<RecommendationResponse> {
  const params = new URLSearchParams({ limit: "10" });
  if (page !== 1) params.set("page", String(page));
  if (genreId !== undefined) params.set("genreId", String(genreId));
  if (revision) params.set("catalogueRevision", revision);
  let response: Response;
  try {
    response = await fetch(`/api/me/recommendations?${params}`, {
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new RecommendationApiError(NETWORK_FAILURE_MESSAGE, 0);
  }
  if (!response.ok) throw await readError(response);
  const body = (await response.json()) as RecommendationResponse;
  const received = body.meta as Partial<PageMeta> | undefined;
  return { ...body, meta: {
    count: body.data.movies.length, limit: 10, page,
    total: body.data.movies.length, totalPages: body.data.movies.length ? 1 : 0,
    unfilteredTotal: body.data.movies.length, catalogueRevision: "",
    ...received,
  } };
}
