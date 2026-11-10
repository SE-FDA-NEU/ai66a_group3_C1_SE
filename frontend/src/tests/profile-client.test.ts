import { afterEach, expect, it, vi } from "vitest";
import { getProfile, resetProfile, PROFILE_TIMEOUT_MS } from "../api/profile.ts";

const summary = { genres: [{ id: 28, name: "Action" }], ratingCount: 2, watchlistCount: 1 };
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

it("reads the account summary with cookies and validates its shape", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: summary })));
  expect(await getProfile()).toEqual(summary);
  expect(fetch.mock.calls[0][0]).toBe("/api/me/profile");
  expect(fetch.mock.calls[0][1]?.credentials).toBe("include");
});

it.each([
  {}, { data: { ...summary, ratingCount: -1 } }, { data: { ...summary, watchlistCount: 1.5 } },
  { data: { ...summary, genres: [summary.genres[0], summary.genres[0]] } },
  { data: { ...summary, genres: [{ id: "28", name: "Action" }] } },
])("rejects an unconfirmed summary instead of inventing zero data: %j", async body => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));
  await expect(getProfile()).rejects.toMatchObject({ outcome: "unknown" });
});

it("sends the exact reset body and accepts only a real acknowledgement", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { reset: true } })));
  await resetProfile();
  expect(fetch.mock.calls[0][0]).toBe("/api/me/profile/reset");
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" }, body: '{"confirm":true}' });
});

it.each([{}, { data: { reset: false } }, { data: { reset: "true" } }])(
  "treats a malformed 2xx acknowledgement as ambiguous: %j", async body => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(resetProfile()).rejects.toMatchObject({ outcome: "unknown" });
  },
);

it("distinguishes a documented rollback from a gateway error", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({ error: {
    code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId: "req_test",
  } }), { status: 503 })).mockResolvedValueOnce(new Response("gateway unavailable", { status: 503 }));
  await expect(resetProfile()).rejects.toMatchObject({ status: 503, outcome: "rejected" });
  await expect(resetProfile()).rejects.toMatchObject({ status: 503, outcome: "unknown" });
});

it("does not interpret an incomplete error envelope as proof of rollback", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: {
    message: "Unknown", requestId: "req_test",
  } }), { status: 502 }));
  await expect(resetProfile()).rejects.toMatchObject({ outcome: "unknown" });
});

it("does not confuse 202 Accepted with a committed 200 reset", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: { reset: true } }), { status: 202 }));
  await expect(resetProfile()).rejects.toMatchObject({ outcome: "unknown", status: 202 });
});

it("preserves 401 for the protected-request handler even without JSON", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("expired", { status: 401 }));
  await expect(resetProfile()).rejects.toMatchObject({ status: 401 });
});

it("bounds a stalled request and classifies timeout as unknown", async () => {
  vi.useFakeTimers();
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const result = expect(resetProfile()).rejects.toMatchObject({ outcome: "unknown", status: 0 });
  await vi.advanceTimersByTimeAsync(PROFILE_TIMEOUT_MS);
  await result;
});

it("relays caller cancellation without turning it into a new reset result", async () => {
  const controller = new AbortController();
  vi.spyOn(globalThis, "fetch").mockImplementation((_url, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  }));
  const result = expect(getProfile(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  controller.abort();
  await result;
});
