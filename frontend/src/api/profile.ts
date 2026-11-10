import type { Genre } from "./movies.ts";
import { fallbackErrorMessage } from "./requestFailure.ts";

export type ProfileSummary = { genres: Genre[]; ratingCount: number; watchlistCount: number };
export const PROFILE_TIMEOUT_MS = 15_000;

export class ProfileApiError extends Error {
  status: number;
  code?: string;
  outcome: "rejected" | "unknown";
  constructor(message: string, status: number, code?: string,
    outcome: "rejected" | "unknown" = "unknown") {
    super(message);
    this.name = "ProfileApiError";
    this.status = status;
    this.code = code;
    this.outcome = outcome;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function request<T>(path: string, method: "GET" | "POST", parse: (body: unknown) => T,
  signal?: AbortSignal): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timer = setTimeout(abort, PROFILE_TIMEOUT_MS);
  try {
    const response = await fetch(path, {
      method, credentials: "include", cache: "no-store", signal: controller.signal,
      ...(method === "POST" ? {
        headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: true }),
      } : {}),
    });
    // A protected request must expire the session even if a proxy loses its body.
    if (response.status === 401)
      throw new ProfileApiError("Authentication required", 401, "AUTHENTICATION_REQUIRED", "rejected");
    let body: unknown;
    try { body = await response.json(); }
    catch { throw new ProfileApiError("The server response could not be confirmed.", response.status); }
    if (controller.signal.aborted) throw new ProfileApiError("The server response could not be confirmed.", 0);
    if (!response.ok) {
      const error = record(body) && record(body.error) ? body.error : null;
      const expected: Record<number, string> = {
        400: "VALIDATION_ERROR", 403: "ORIGIN_NOT_ALLOWED", 503: "SERVICE_UNAVAILABLE",
      };
      // Only the documented backend error envelope confirms a rejection/rollback.
      // HTML/gateway errors and malformed acknowledgements remain ambiguous.
      const rejected = error && typeof error.code === "string" && error.code === expected[response.status] &&
        typeof error.message === "string" && typeof error.requestId === "string" &&
        error.requestId.startsWith("req_");
      throw new ProfileApiError(typeof error?.message === "string" ? error.message :
        fallbackErrorMessage(response.status), response.status,
      typeof error?.code === "string" ? error.code : undefined, rejected ? "rejected" : "unknown");
    }
    if (response.status !== 200)
      throw new ProfileApiError("The server response could not be confirmed.", response.status);
    return parse(body);
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof ProfileApiError) throw error;
    throw new ProfileApiError("We couldn't confirm the server response. Check your connection and refresh the profile.", 0);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function getProfile(signal?: AbortSignal): Promise<ProfileSummary> {
  return request("/api/me/profile", "GET", body => {
    const data = record(body) && record(body.data) ? body.data : null;
    if (!data || !Array.isArray(data.genres) || data.genres.some(genre =>
      !record(genre) || !Number.isInteger(genre.id) || (genre.id as number) <= 0 ||
      typeof genre.name !== "string" || !genre.name.trim()) ||
      new Set(data.genres.map(genre => genre.id)).size !== data.genres.length ||
      !Number.isSafeInteger(data.ratingCount) || (data.ratingCount as number) < 0 ||
      !Number.isSafeInteger(data.watchlistCount) || (data.watchlistCount as number) < 0) {
      throw new ProfileApiError("The profile response could not be confirmed. Please refresh.", 0);
    }
    return data as ProfileSummary;
  }, signal);
}

export function resetProfile(signal?: AbortSignal): Promise<void> {
  return request("/api/me/profile/reset", "POST", body => {
    if (!record(body) || !record(body.data) || body.data.reset !== true)
      throw new ProfileApiError("The reset response could not be confirmed.", 0);
  }, signal);
}
