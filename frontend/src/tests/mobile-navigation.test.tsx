// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import AppFrame from "../components/AppFrame.tsx";
import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import { ThemeProvider } from "../theme.tsx";

function setup(state: "unknown" | "authenticated" | "unauthenticated" = "authenticated", route = "/popular") {
  let compact = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal("matchMedia", () => ({ matches: compact,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) }));
  const auth: AuthContextValue = {
    ...(state === "authenticated" ? { status: state, user: { id: "nav-user", email: "long-demo-address@example.test" } } : { status: state }),
    refresh: vi.fn(async () => {}), signIn: vi.fn(async () => {}), signOut: vi.fn(async () => {}),
    handleUnauthorized: vi.fn(), recommendationVersion: 0, recommendationScope: "nav-scope",
    invalidateRecommendations: vi.fn(),
  };
  const root = document.createElement("div"); root.id = "root"; document.body.append(root);
  render(<MemoryRouter initialEntries={[route]}><ThemeProvider><AuthContext.Provider value={auth}>
    <AppFrame><h1>Page content</h1><button>Page action</button></AppFrame>
  </AuthContext.Provider></ThemeProvider></MemoryRouter>, { container: root });
  return { auth, root, resize: (matches: boolean) => act(() => { compact = matches; listeners.forEach(fn => fn()); }) };
}

afterEach(() => { cleanup(); document.body.replaceChildren(); document.body.style.overflow = ""; localStorage.clear(); vi.unstubAllGlobals(); });

it("keeps compact navigation closed initially, traps focus and restores focus/scroll on Escape", () => {
  document.body.style.overflow = "auto";
  const { root } = setup();
  const toggle = screen.getByRole("button", { name: "Open navigation" });
  expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument();
  fireEvent.click(toggle);
  const panel = screen.getByRole("dialog", { name: "Explore movies" });
  const close = within(panel).getByRole("button", { name: "Close navigation" });
  const signOut = within(panel).getByRole("button", { name: "Sign out" });
  expect(close).toHaveFocus(); expect(root.inert).toBe(true); expect(document.body.style.overflow).toBe("hidden");
  fireEvent.keyDown(close, { key: "Tab", shiftKey: true }); expect(signOut).toHaveFocus();
  fireEvent.keyDown(signOut, { key: "Tab" }); expect(close).toHaveFocus();
  fireEvent.keyDown(close, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(root.inert).toBe(false); expect(document.body.style.overflow).toBe("auto"); expect(toggle).toHaveFocus();
});

it("closes on the backdrop, current-route selection and route navigation without losing links", () => {
  setup();
  const open = () => fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  open(); fireEvent.click(document.querySelector(".navigation-backdrop")!);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  open(); fireEvent.click(screen.getByRole("link", { name: "Popular movies" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  open(); expect(screen.getAllByRole("link", { name: "My recommendations" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("link", { name: "Search" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  open(); expect(screen.getByRole("link", { name: "Search" })).toHaveAttribute("aria-current", "page");
});

it("restores sessions while the drawer is closed and offers guest actions only after opening", () => {
  const { auth } = setup("unknown", "/");
  expect(auth.refresh).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.getByRole("status")).toHaveTextContent("Checking session");
  expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
});

it("provides real guest destinations and closes after Sign in is selected", () => {
  setup("unauthenticated");
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  expect(screen.queryByRole("link", { name: "Profile" })).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
  fireEvent.click(screen.getByRole("link", { name: "Sign in" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("keeps failed sign-out visible and releases the modal when switching to desktop", async () => {
  const { auth, root, resize } = setup();
  vi.mocked(auth.signOut).mockRejectedValue(new Error("Sign out not confirmed"));
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Sign out not confirmed");
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  resize(false);
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(root.inert).toBe(false);
  expect(document.body.style.overflow).toBe("");
  expect(screen.getAllByRole("navigation", { name: "Main navigation" })).toHaveLength(1);
  expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  resize(true);
  expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
});
