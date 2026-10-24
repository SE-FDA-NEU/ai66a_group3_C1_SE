import type { Genre } from "./movies.ts";
import { fallbackErrorMessage, NETWORK_FAILURE_MESSAGE } from "./requestFailure.ts";

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
    body?.error?.message ?? fallbackErrorMessage(response.status),
    response.status,
    body?.error?.code,
  );
}

// A rejected fetch means the API was unreachable; say so and what to do next.
// An aborted request keeps its original error so callers can ignore it.
async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(path, init);
  } catch (error) {
    if (init.signal?.aborted) {
      throw error;
    }
    throw new PreferenceApiError(NETWORK_FAILURE_MESSAGE, 0);
  }
}

async function getGenreList(path: string, signal?: AbortSignal): Promise<Genre[]> {
  const response = await send(path, {
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

export async function savePreferences(
  genreIds: number[],
  signal?: AbortSignal,
): Promise<Genre[]> {
  const response = await send("/api/me/preferences", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ genreIds }),
    signal,
  });

  if (!response.ok) {
    throw await readError(response);
  }

  const body = (await response.json()) as GenreListResponse;
  const saved = body?.data?.genres;
  if (!Array.isArray(saved) || saved.some(genre => !genre ||
      !Number.isInteger(genre.id) || typeof genre.name !== "string") ||
      JSON.stringify(saved.map(genre => genre.id).sort((a, b) => a - b)) !==
      JSON.stringify([...genreIds].sort((a, b) => a - b))) {
    throw new PreferenceApiError("The saved preferences could not be confirmed. Please retry.", response.status);
  }
  return saved;
}
