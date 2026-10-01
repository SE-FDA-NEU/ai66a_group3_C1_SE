// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";
import { AuthProvider } from "../auth/AuthContext";
import RequireAuth from "../auth/RequireAuth";
import { useAuth } from "../auth/authState";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

describe("S13 authentication UI", () => {
  it("renders the login route", () => {
    window.history.pushState({}, "", "/login");
    render(<App />);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("opens recommendations after a successful login", async () => {
    window.history.pushState({}, "", "/login");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } }),
      );

    render(<App />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "viewer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recommendations");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/login",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("shows the exact invalid-credentials message", async () => {
    window.history.pushState({}, "", "/login");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } }, 401),
    );

    render(<App />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "viewer@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-pass" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it("restores the authenticated session on the recommendations route", async () => {
    window.history.pushState({}, "", "/recommendations");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } }),
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Recommendations" })).toBeInTheDocument();
    expect(screen.getByText("viewer@example.com")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recommendations");
  });

  it("redirects unauthenticated users from recommendations to login", async () => {
    window.history.pushState({}, "", "/recommendations");
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" } }, 401),
    );

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs out and opens the home route", async () => {
    window.history.pushState({}, "", "/recommendations");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse({ data: { user: { id: "user-1", email: "viewer@example.com" } } }),
      )
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })))
      .mockImplementationOnce(() =>
        jsonResponse({
          data: { movies: [] },
          meta: { count: 0, limit: 10, catalogueRevision: "revision-test" },
        }),
      );

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(await screen.findByRole("heading", { name: "Find your next movie" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });
});

describe("S12 registration UI", () => {
  function renderRegistration() {
    window.history.pushState({}, "", "/register");
    render(<App />);
  }

  it("shows invalid email validation without calling the API", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderRegistration();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "invalid-email" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the seven-character password validation without calling the API", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderRegistration();

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie12" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("shows the duplicate message and retains the email", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ error: { code: "EMAIL_ALREADY_REGISTERED" } }, 409),
    );
    renderRegistration();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "USER@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This email is already registered");
    expect(screen.getByLabelText("Email")).toHaveValue("USER@example.com");
  });

  it("navigates to login only after a 201 response", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
      jsonResponse({ data: { user: { id: "user-1", email: "user@example.com" } } }, 201),
    );
    renderRegistration();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie123" } });
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));

    expect(
      await screen.findByRole("heading", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe("/login");
  });

  it("prevents duplicate submissions while the request is pending", async () => {
    let resolveRequest: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, "fetch").mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    renderRegistration();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "movie123" } });
    const button = screen.getByRole("button", { name: "Create account" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    resolveRequest(new Response(JSON.stringify({ error: { message: "Try again" } }), { status: 503 }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Service is temporarily unavailable"));
  });
});

describe("T10 route guards and stale account state", () => {
  const userA = { data: { user: { id: "user-a", email: "a@example.com" } } };
  const unauthenticated = {
    error: { code: "AUTHENTICATION_REQUIRED", message: "Authentication required" },
  };

  it.each(["/recommendations", "/preferences", "/profile"])(
    "redirects an unsigned visitor from %s to login",
    async (path) => {
      window.history.pushState({}, "", path);
      vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse(unauthenticated, 401));

      render(<App />);

      await waitFor(() => expect(window.location.pathname).toBe("/login"));
      expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    },
  );

  it.each(["/", "/movies/1", "/login", "/register"])(
    "does not check the session on public route %s",
    async (path) => {
      window.history.pushState({}, "", path);
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation(() => jsonResponse({ error: { message: "Movie not found" } }, 404));

      render(<App />);

      await waitFor(() => expect(window.location.pathname).toBe(path));
      expect(fetchSpy).not.toHaveBeenCalledWith("/api/auth/me", expect.anything());
    },
  );

  it("renders a guarded route for a signed-in account", async () => {
    window.history.pushState({}, "", "/profile");
    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse(userA));

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/profile");
  });

  it("shows an error, not the page, when the session check fails with a server error", async () => {
    window.history.pushState({}, "", "/recommendations");
    vi.spyOn(globalThis, "fetch").mockImplementation(() =>
      jsonResponse({ error: { message: "Service is temporarily unavailable" } }, 503),
    );

    render(<App />);

    expect(await screen.findByRole("alert")).toHaveTextContent("Service is temporarily unavailable");
    expect(screen.queryByRole("heading", { name: "Recommendations" })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe("/recommendations");
  });

  it("does not reuse the old account after sign-out when returning to a guarded route", async () => {
    function Probe() {
      const auth = useAuth();
      return <button onClick={() => void auth.signOut()}>sign out</button>;
    }

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse(userA))
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })));

    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <AuthProvider>
          <Routes>
            <Route path="/secret" element={<RequireAuth><Probe /></RequireAuth>} />
            <Route path="/" element={<Link to="/secret">back to secret</Link>} />
            <Route path="/login" element={<h1>Login page</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("sign out"));
    fireEvent.click(await screen.findByText("back to secret"));

    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
    expect(screen.queryByText("sign out")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("clears account-keyed component state when the account changes", async () => {
    const accounts = [
      { id: "user-a", email: "a@example.com" },
      { id: "user-b", email: "b@example.com" },
    ];

    function Probe() {
      const auth = useAuth();
      const [note, setNote] = useState("");
      return (
        <div>
          <input aria-label="note" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={() => void auth.signIn("b@example.com", "movie123")}>switch</button>
        </div>
      );
    }

    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => jsonResponse({ data: { user: accounts[0] } }))
      .mockImplementationOnce(() => jsonResponse({ data: { user: accounts[1] } }));

    render(
      <MemoryRouter>
        <AuthProvider>
          <RequireAuth>
            <Probe />
          </RequireAuth>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByLabelText("note"), { target: { value: "account A draft" } });
    fireEvent.click(screen.getByText("switch"));

    await waitFor(() => expect(screen.getByLabelText("note")).toHaveValue(""));
  });

  it("redirects to login when a protected API call reports 401", async () => {
    function Probe() {
      const auth = useAuth();
      return <button onClick={auth.handleUnauthorized}>expire</button>;
    }

    vi.spyOn(globalThis, "fetch").mockImplementation(() => jsonResponse(userA));

    render(
      <MemoryRouter initialEntries={["/secret"]}>
        <AuthProvider>
          <Routes>
            <Route path="/secret" element={<RequireAuth><Probe /></RequireAuth>} />
            <Route path="/login" element={<h1>Login page</h1>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByText("expire"));

    expect(await screen.findByRole("heading", { name: "Login page" })).toBeInTheDocument();
  });
});
