import type { Genre, MovieSummary } from "./movies.ts";

export type RecommendationMovie = MovieSummary & {
  reason: {
    matchedGenres: Genre[];
  };
};

export type RecommendationResult = {
  movies: RecommendationMovie[];
  mode: "popular" | "personalised";
  personalised: boolean;
  noMatch: boolean;
};

type RecommendationResponse = {
  data: RecommendationResult;
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
    body?.error?.message ?? "Something went wrong",
    response.status,
    body?.error?.code,
  );
}

export async function getRecommendations(
  limit = 10,
  signal?: AbortSignal,
): Promise<RecommendationResult> {
  const response = await fetch(`/api/me/recommendations?limit=${limit}`, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as RecommendationResponse;
  return body.data;
}
