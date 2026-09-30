// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../App";

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
        jsonResponse({
          data: {
            user: { id: "user-1", email: "viewer@example.com" },
          },
        }),
      )
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            user: { id: "user-1", email: "viewer@example.com" },
          },
        }),
      );

    render(<App />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "movie123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Recommendations" }),
    ).toBeInTheDocument();
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
      jsonResponse(
        {
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email or password is incorrect",
            requestId: "req_test",
          },
        },
        401,
      ),
    );

    render(<App />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "viewer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong-pass" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent("Email or password is incorrect");
  });

  it("signs out and opens the home route", async () => {
    window.history.pushState({}, "", "/recommendations");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementationOnce(() =>
        jsonResponse({
          data: {
            user: { id: "user-1", email: "viewer@example.com" },
          },
        }),
      )
      .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 204 })));

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: "Sign out" }));

    await waitFor(() => {
      expect(window.location.pathname).toBe("/");
    });
    expect(screen.getByRole("heading", { name: "Find your next movie" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/logout",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
  });

  it("restores the authenticated session on the recommendations route", async () => {
  window.history.pushState({}, "", "/recommendations");

  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
    jsonResponse({
      data: {
        user: {
          id: "user-1",
          email: "viewer@example.com",
        },
      },
    }),
  );

  render(<App />);

  expect(
    await screen.findByRole("heading", { name: "Recommendations" }),
  ).toBeInTheDocument();

  expect(screen.getByText("viewer@example.com")).toBeInTheDocument();

  expect(window.location.pathname).toBe("/recommendations");
  });

  it("redirects unauthenticated users from recommendations to login", async () => {
  window.history.pushState({}, "", "/recommendations");

  vi.spyOn(globalThis, "fetch").mockImplementationOnce(() =>
    jsonResponse(
      {
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication required",
          requestId: "req_test",
        },
      },
      401,
    ),
  );

  render(<App />);

  await waitFor(() => {
    expect(window.location.pathname).toBe("/login");
  });

  expect(
    screen.getByRole("heading", { name: "Sign in" }),
  ).toBeInTheDocument();
  });
});
