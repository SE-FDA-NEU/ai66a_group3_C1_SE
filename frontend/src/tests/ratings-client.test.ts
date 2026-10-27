import { afterEach, expect, it, vi } from "vitest";
import {
  getRating,
  RatingApiError,
  saveRating,
  type RatingValue,
} from "../api/ratings.ts";

function response(rating: unknown, movieId = "movie-a", status = 200) {
  return new Response(JSON.stringify({ data: { movieId, rating } }), {
    status,
  });
}
afterEach(() => vi.restoreAllMocks());

it.each([null, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5])(
  "reads committed rating %s with cookies and cancellation",
  async (rating) => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(rating, "movie/a"));
    const signal = new AbortController().signal;
    expect(await getRating("movie/a", signal)).toEqual({
      movieId: "movie/a",
      rating,
    });
    expect(fetch).toHaveBeenCalledWith("/api/me/ratings/movie%2Fa", {
      credentials: "include",
      signal,
    });
  },
);

it.each([0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const)(
  "writes strict rating %s without account identifiers",
  async (rating) => {
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(response(rating));
    await expect(saveRating("movie-a", rating)).resolves.toEqual({
      movieId: "movie-a",
      rating,
    });
    expect(fetch).toHaveBeenCalledWith(
      "/api/me/ratings/movie-a",
      expect.objectContaining({
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating }),
      }),
    );
  },
);

it.each([0, 6, -1, 3.25, "5", true, false, null, undefined, NaN, Infinity])(
  "rejects invalid draft %s before a request",
  async (value) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    await expect(
      saveRating("movie-a", value as RatingValue),
    ).rejects.toMatchObject({ status: 400, code: "VALIDATION_ERROR" });
    expect(fetch).not.toHaveBeenCalled();
  },
);

it.each([0, 6, 3.25, "5", true, undefined])(
  "rejects an invalid successful read %s",
  async (value) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(response(value));
    await expect(getRating("movie-a")).rejects.toBeInstanceOf(RatingApiError);
  },
);

it("rejects success for the wrong movie and a null save acknowledgement", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(response(5, "other"))
    .mockResolvedValueOnce(response(null));
  await expect(getRating("movie-a")).rejects.toBeInstanceOf(RatingApiError);
  await expect(saveRating("movie-a", 5)).rejects.toBeInstanceOf(RatingApiError);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it.each([400, 401, 403, 404, 503])(
  "preserves HTTP %s and the public error code",
  async (status) => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "TEST_ERROR", message: "Safe message" },
        }),
        { status },
      ),
    );
    await expect(getRating("movie-a")).rejects.toMatchObject({
      status,
      code: "TEST_ERROR",
      message: "Safe message",
    });
  },
);

it("handles non-JSON errors and malformed successful responses safely", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response("not JSON", { status: 503 }))
    .mockResolvedValueOnce(new Response("not JSON"));
  await expect(getRating("movie-a")).rejects.toMatchObject({ status: 503 });
  await expect(saveRating("movie-a", 5)).rejects.toBeInstanceOf(RatingApiError);
});

it("does not confirm a different rating than the submitted value", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(response(2));
  await expect(saveRating("movie-a", 5)).rejects.toBeInstanceOf(RatingApiError);
});
