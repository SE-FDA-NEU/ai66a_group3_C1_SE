// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import ActionFeedback from "../components/ActionFeedback.tsx";
import ProfilePage from "../pages/ProfilePage.tsx";

// S4-T15 #210: a profile response that was requested before a completed reset
// must never put the old summary back, and reset stays blocked until a read ends.
const before = { genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }], ratingCount: 2, watchlistCount: 1 };
const after = { genres: [], ratingCount: 0, watchlistCount: 1 };
const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
const unavailable = () => json({ error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId: "req_test" } }, 503);
function deferred() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>(done => { resolve = done; });
  return { promise, finish: (data: unknown) => resolve(new Response(JSON.stringify({ data }))) };
}
function auth(id = "a"): AuthContextValue {
  return { status: "authenticated", user: { id, email: `${id}@example.test` },
    refresh: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handleUnauthorized: vi.fn(),
    recommendationVersion: 0, recommendationScope: id, invalidateRecommendations: vi.fn() };
}
function tree(account = auth()) {
  return <AuthContext.Provider value={account}><ActionFeedback><MemoryRouter initialEntries={["/profile"]}>
    <Link to="/">Leave profile</Link><Link to="/profile">Open profile</Link>
    <Routes><Route path="/profile" element={<ProfilePage />} /><Route path="/" element={<h1>Home</h1>} /></Routes>
  </MemoryRouter></ActionFeedback></AuthContext.Provider>;
}
const posts = (
  fetchSpy: { mock: { calls: Parameters<typeof globalThis.fetch>[] } },
) => fetchSpy.mock.calls.filter(([, init]) => init?.method === "POST");
const resetTrigger = () => screen.getByRole("button", { name: "Reset personalisation" });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("keeps reset unavailable until the first profile read has finished", async () => {
  const first = deferred();
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => first.promise);
  render(tree());
  expect(await screen.findByText("Loading your profile…")).toBeInTheDocument();
  expect(resetTrigger()).toBeDisabled();
  fireEvent.click(resetTrigger());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(posts(fetch)).toHaveLength(0);
  await act(async () => first.finish(before));
  await waitFor(() => expect(resetTrigger()).toBeEnabled());
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("2");
});

it("keeps reset unavailable while a retry read of a failed profile is unfinished", async () => {
  const retry = deferred();
  let reads = 0;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => ++reads === 1 ? unavailable() : retry.promise);
  render(tree());
  fireEvent.click(await screen.findByRole("button", { name: "Refresh profile" }));
  expect(await screen.findByText("Loading your profile…")).toBeInTheDocument();
  expect(resetTrigger()).toBeDisabled();
  fireEvent.click(resetTrigger());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(posts(fetch)).toHaveLength(0);
  await act(async () => retry.finish(before));
  await waitFor(() => expect(resetTrigger()).toBeEnabled());
});

it("a read already in flight when the reset is confirmed cannot restore the old summary", async () => {
  const inFlight = deferred();
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "POST") return json({ data: { reset: true } });
    const read = ++reads;
    return read === 1 ? json({ data: before }) : read === 2 ? inFlight.promise : json({ data: after });
  });
  const view = render(tree(auth("a")));
  await screen.findByTestId("profile-ratings-count");
  fireEvent.click(resetTrigger());
  const dialog = screen.getByRole("dialog");
  // Same account, new handler identity: the page restarts its read while the dialog is open.
  view.rerender(tree(auth("a")));
  await waitFor(() => expect(reads).toBe(2));
  fireEvent.click(within(dialog).getByRole("button", { name: "Reset personalisation" }));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0"));
  await act(async () => inFlight.finish(before)); // the stale pre-reset reply arrives last
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0");
  expect(screen.getByTestId("profile-genres-count")).toHaveTextContent("0");
  expect(screen.queryByText("Action")).not.toBeInTheDocument();
  expect(screen.getByText("No saved genres yet.")).toBeInTheDocument();
});

it("a reply requested by an earlier visit to the page cannot overwrite a completed reset", async () => {
  const stale = deferred();
  const signals: AbortSignal[] = [];
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "POST") return json({ data: { reset: true } });
    signals.push(init!.signal as AbortSignal);
    const read = ++reads;
    return read === 1 ? stale.promise : read === 2 ? json({ data: before }) : json({ data: after });
  });
  render(tree());
  await waitFor(() => expect(reads).toBe(1));
  fireEvent.click(screen.getByRole("link", { name: "Leave profile" }));
  await screen.findByRole("heading", { name: "Home" });
  expect(signals[0].aborted).toBe(true);
  fireEvent.click(screen.getByRole("link", { name: "Open profile" }));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("2"));
  fireEvent.click(resetTrigger());
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset personalisation" }));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0"));
  await act(async () => stale.finish(before)); // the first visit's reply finally arrives
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0");
  expect(screen.queryByText("Action")).not.toBeInTheDocument();
  expect(screen.getByText("No saved genres yet.")).toBeInTheDocument();
});
