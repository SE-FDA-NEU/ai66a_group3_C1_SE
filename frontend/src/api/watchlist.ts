import type { MovieSummary, PageMeta } from "./movies.ts";

export type WatchlistMovie = MovieSummary & { addedAt: string };
export type Membership = { movieId: string; inWatchlist: boolean; addedAt?: string | null };
export type WatchlistPage = { data: { movies: WatchlistMovie[] }; meta: PageMeta };

export class WatchlistApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "WatchlistApiError";
    this.status = status;
    this.code = code;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

async function bodyOf(response: Response): Promise<Record<string, unknown>> {
  let body: unknown;
  try { body = await response.json(); } catch { body = null; }
  if (!response.ok) {
    const error = record(body) && record(body.error) ? body.error : null;
    throw new WatchlistApiError(
      typeof error?.message === "string" ? error.message : "Watchlist is unavailable",
      response.status,
      typeof error?.code === "string" ? error.code : undefined,
    );
  }
  if (!record(body)) throw new WatchlistApiError("Watchlist response could not be confirmed", 0);
  return body;
}

function membershipOf(body: Record<string, unknown>, movieId: string, expected?: boolean): Membership {
  const data = record(body.data) ? body.data : null;
  if (!data || data.movieId !== movieId || typeof data.inWatchlist !== "boolean" ||
      (expected !== undefined && data.inWatchlist !== expected) ||
      (data.inWatchlist && (typeof data.addedAt !== "string" || !Number.isFinite(Date.parse(data.addedAt))))) {
    throw new WatchlistApiError("Watchlist change could not be confirmed", 0);
  }
  return data as Membership;
}

export async function getMembership(movieId: string, signal?: AbortSignal): Promise<Membership> {
  const response = await fetch(`/api/me/watchlist/${encodeURIComponent(movieId)}`,
    { credentials: "include", signal });
  return membershipOf(await bodyOf(response), movieId);
}

export async function setMembership(movieId: string, saved: boolean, signal?: AbortSignal): Promise<Membership> {
  const response = await fetch(`/api/me/watchlist/${encodeURIComponent(movieId)}`,
    { method: saved ? "PUT" : "DELETE", credentials: "include", signal });
  return membershipOf(await bodyOf(response), movieId, saved);
}

export async function getWatchlistPage(page: number, revision?: string, signal?: AbortSignal): Promise<WatchlistPage> {
  const params = new URLSearchParams({ page: String(page), limit: "10" });
  if (revision) params.set("catalogueRevision", revision);
  const response = await fetch(`/api/me/watchlist?${params}`,
    { credentials: "include", signal });
  const body = await bodyOf(response);
  const data = record(body.data) ? body.data : null;
  const meta = record(body.meta) ? body.meta : null;
  if (!data || !Array.isArray(data.movies) || !meta ||
      !Number.isInteger(meta.total) || !Number.isInteger(meta.totalPages) ||
      meta.page !== page || meta.limit !== 10 || typeof meta.catalogueRevision !== "string") {
    throw new WatchlistApiError("Watchlist page could not be confirmed", 0);
  }
  return body as WatchlistPage;
}
