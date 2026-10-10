import type { Genre } from "./movies.ts";

type GenreListResponse = {
  data: {
    genres: Genre[];
  };
};

type ApiErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class PreferenceApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "PreferenceApiError";
    this.status = status;
    this.code = code;
  }
}

async function readError(response: Response): Promise<PreferenceApiError> {
  let body: ApiErrorResponse | null = null;

  try {
    body = (await response.json()) as ApiErrorResponse;
  } catch {
    // Keep a safe fallback when the server returns a non-JSON body.
  }

  return new PreferenceApiError(
    body?.error?.message ?? "Something went wrong",
    response.status,
    body?.error?.code,
  );
}

async function getGenreList(path: string, signal?: AbortSignal): Promise<Genre[]> {
  const response = await fetch(path, {
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as GenreListResponse;
  return body.data.genres;
}

export function listGenres(signal?: AbortSignal): Promise<Genre[]> {
  return getGenreList("/api/genres", signal);
}

export function getPreferences(signal?: AbortSignal): Promise<Genre[]> {
  return getGenreList("/api/me/preferences", signal);
}
