// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import RequireAuth from "../auth/RequireAuth.tsx";
import ActionFeedback from "../components/ActionFeedback.tsx";
import ProfilePage from "../pages/ProfilePage.tsx";

const before = { genres: [{ id: 28, name: "Action" }, { id: 35, name: "Comedy" }, { id: 878, name: "Science Fiction" }], ratingCount: 2, watchlistCount: 1 };
const after = { genres: [], ratingCount: 0, watchlistCount: 1 };
const success = "Your personalisation profile was reset.";
const json = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(data), { status }));
const rollback = () => json({ error: { code: "SERVICE_UNAVAILABLE", message: "Service is temporarily unavailable", requestId: "req_test" } }, 503);
function auth(id = "a"): AuthContextValue {
  return { status: "authenticated", user: { id, email: `${id}@example.test` },
    refresh: vi.fn(), signIn: vi.fn(), signOut: vi.fn(), handleUnauthorized: vi.fn(),
    recommendationVersion: 0, recommendationScope: id, invalidateRecommendations: vi.fn() };
}
function tree(account = auth(), guarded = false) {
  return <AuthContext.Provider value={account}><ActionFeedback><MemoryRouter initialEntries={["/profile"]}>
    <Link to="/">Leave profile</Link><Routes>
      <Route path="/profile" element={guarded ? <RequireAuth><ProfilePage /></RequireAuth> : <ProfilePage />} />
      <Route path="/" element={<h1>Home</h1>} /><Route path="/login" element={<h1>Sign in</h1>} />
    </Routes></MemoryRouter></ActionFeedback></AuthContext.Provider>;
}
async function openReset() {
  fireEvent.click(await screen.findByRole("button", { name: "Reset personalisation" }));
  return screen.getByRole("dialog");
}
async function submitReset() {
  const dialog = await openReset();
  fireEvent.click(within(dialog).getByRole("button", { name: "Reset personalisation" }));
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("shows actual account data and working feature links", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ data: before }));
  render(tree());
  expect(await screen.findByTestId("profile-ratings-count")).toHaveTextContent("2");
  expect(screen.getByTestId("profile-genres-count")).toHaveTextContent("3");
  expect(screen.getByTestId("profile-watchlist-count")).toHaveTextContent("1");
  expect(screen.getByRole("link", { name: "View watchlist" })).toHaveAttribute("href", "/watchlist");
  expect(screen.getByRole("link", { name: "Change my genres" })).toHaveAttribute("href", "/preferences");
});

it("keeps unavailable data distinct from an empty successful profile and retries", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(rollback).mockImplementation(() => json({ data: after }));
  render(tree());
  await screen.findByText("Profile unavailable");
  expect(screen.queryByTestId("profile-ratings-count")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Refresh profile" }));
  expect(await screen.findByText("No saved genres yet.")).toBeInTheDocument();
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0");
});

it("cancel and Escape send no reset, preserve data and restore keyboard focus", async () => {
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ data: before }));
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  const trigger = screen.getByRole("button", { name: "Reset personalisation" });
  trigger.focus();
  const dialog = await openReset();
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  expect(dialog).toHaveAccessibleDescription(/account and watchlist will be kept/);
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(trigger).toHaveFocus();
  fireEvent.click(trigger);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(trigger).toHaveFocus();
  expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(0);
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("2");
});

it("blocks duplicate pending submissions and refreshes only after committed acknowledgement", async () => {
  let finish!: (response: Response) => void;
  const write = new Promise<Response>(resolve => { finish = resolve; });
  let reads = 0;
  const fetch = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => init?.method === "POST" ? write : json({ data: ++reads === 1 ? before : after }));
  const account = auth();
  render(tree(account));
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  const pending = screen.getByRole("button", { name: "Working..." });
  fireEvent.click(pending);
  expect(pending).toBeDisabled();
  expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  expect(screen.queryByText(success)).not.toBeInTheDocument();
  expect(fetch.mock.calls.filter(([, init]) => init?.method === "POST")).toHaveLength(1);
  await act(async () => finish(new Response(JSON.stringify({ data: { reset: true } }))));
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0"));
  expect(screen.getAllByText(success).length).toBeGreaterThan(0);
  expect(screen.getByTestId("profile-watchlist-count")).toHaveTextContent("1");
  expect(account.invalidateRecommendations).not.toHaveBeenCalled(); // owned by T14
});

it("preserves the displayed summary on explicit rollback, then allows a confirmed retry", async () => {
  let writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => init?.method === "POST" ?
    (++writes === 1 ? rollback() : json({ data: { reset: true } })) : json({ data: writes > 1 ? after : before }));
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  await screen.findByText(/Your displayed profile has not been cleared/);
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("2");
  await submitReset();
  await waitFor(() => expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0"));
  expect(writes).toBe(2);
});

it.each([true, false])("reconciles a lost reset reply without claiming success or replaying the POST (committed=%s)", async committed => {
  let writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "POST") { writes++; return Promise.reject(new TypeError("Response lost")); }
    return json({ data: writes && committed ? after : before });
  });
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  await screen.findByText(/summary shows your current server data/);
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent(committed ? "0" : "2");
  expect(screen.queryByText(success)).not.toBeInTheDocument();
  expect(writes).toBe(1);
  expect(screen.getByRole("button", { name: "Reset personalisation" })).toBeEnabled();
});

it("requires a successful fresh read before retrying an unconfirmed reset", async () => {
  let reads = 0, writes = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
    if (init?.method === "POST") { writes++; return Promise.reject(new TypeError("Response lost")); }
    return ++reads === 2 ? rollback() : json({ data: writes ? after : before });
  });
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  const check = await screen.findByRole("button", { name: "Check current profile" });
  expect(screen.getByRole("button", { name: "Reset personalisation" })).toBeDisabled();
  expect(screen.queryByText(success)).not.toBeInTheDocument();
  fireEvent.click(check);
  await screen.findByText(/summary shows your current server data/);
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0");
  expect(writes).toBe(1);
});

it("keeps an acknowledged reset successful even when the following read fails", async () => {
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => init?.method === "POST" ?
    json({ data: { reset: true } }) : ++reads === 1 ? json({ data: before }) : rollback());
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  await screen.findByText("Profile unavailable");
  expect(screen.getAllByText(success).length).toBeGreaterThan(0);
});

it.each(["GET", "POST"])("passes a protected %s 401 to the existing handler", async method => {
  const account = auth();
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) =>
    (init?.method ?? "GET") === method ? json({}, 401) : json({ data: before }));
  render(tree(account));
  if (method === "POST") { await screen.findByTestId("profile-ratings-count"); await submitReset(); }
  await waitFor(() => expect(account.handleUnauthorized).toHaveBeenCalledOnce());
});

it("never fetches private profile data for a guest and uses the login guard", async () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  render(tree({ ...auth(), status: "unauthenticated" }, true));
  expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("ignores an old account's delayed summary", async () => {
  let finish!: (response: Response) => void;
  const old = new Promise<Response>(resolve => { finish = resolve; });
  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() => old).mockImplementation(() => json({ data: after }));
  const view = render(tree(auth("a")));
  view.rerender(tree(auth("b")));
  await screen.findByText("b@example.test");
  await screen.findByTestId("profile-ratings-count");
  await act(async () => finish(new Response(JSON.stringify({ data: before }))));
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("0");
  expect(screen.queryByText("Action")).not.toBeInTheDocument();
});

it("cleans up pending feedback and ignores a late write after leaving the page", async () => {
  let finish!: (response: Response) => void;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => init?.method === "POST" ?
    new Promise<Response>(resolve => { finish = resolve; }) : json({ data: before }));
  render(tree());
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  expect(screen.getByText("Resetting personalisation…")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Leave profile" }));
  await screen.findByRole("heading", { name: "Home" });
  expect(screen.queryByText("Resetting personalisation…")).not.toBeInTheDocument();
  await act(async () => finish(new Response(JSON.stringify({ data: { reset: true } }))));
  expect(screen.queryByText(success)).not.toBeInTheDocument();
});

it("cannot carry an old account's reset acknowledgement or pending notice into the next account", async () => {
  let finish!: (response: Response) => void;
  let reads = 0;
  vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => init?.method === "POST" ?
    new Promise<Response>(resolve => { finish = resolve; }) : json({ data: ++reads === 1 ? before :
      { genres: [{ id: 35, name: "Comedy" }], ratingCount: 1, watchlistCount: 4 } }));
  const view = render(tree(auth("a")));
  await screen.findByTestId("profile-ratings-count");
  await submitReset();
  view.rerender(tree(auth("b")));
  await waitFor(() => expect(screen.getByTestId("profile-watchlist-count")).toHaveTextContent("4"));
  expect(screen.queryByText("Resetting personalisation…")).not.toBeInTheDocument();
  await act(async () => finish(new Response(JSON.stringify({ data: { reset: true } }))));
  expect(screen.getByTestId("profile-ratings-count")).toHaveTextContent("1");
  expect(screen.queryByText(success)).not.toBeInTheDocument();
});
