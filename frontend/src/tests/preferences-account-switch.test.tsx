// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { AuthContext, type AuthContextValue } from "../auth/authState.ts";
import RequireAuth from "../auth/RequireAuth.tsx";
import PreferencesPage from "../pages/PreferencesPage.tsx";

const accounts = {
  A: { id: "user-a", email: "a@example.com" },
  B: { id: "user-b", email: "b@example.com" },
};

const genres = [
  { id: 28, name: "Action" },
  { id: 35, name: "Comedy" },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;

  const promise = new Promise<Response>((done) => {
    resolve = done;
  });

  return { promise, resolve };
}

function AccountHarness({
  account,
  onUnauthorized,
}: {
  account: "A" | "B";
  onUnauthorized: () => void;
}) {
  const auth: AuthContextValue = {
    status: "authenticated",
    user: accounts[account],
    refresh: async () => {},
    signIn: async () => {},
    signOut: async () => {},
    handleUnauthorized: onUnauthorized,
    recommendationVersion: 0,
    recommendationScope: "test-scope",
    invalidateRecommendations: () => {},
  };

  return (
    <AuthContext.Provider value={auth}>
      <Routes>
        <Route
          path="/preferences"
          element={
            <RequireAuth>
              <PreferencesPage />
            </RequireAuth>
          }
        />
        <Route
          path="/recommendations"
          element={<h1>Recommendations</h1>}
        />
      </Routes>
    </AuthContext.Provider>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("S3-T05 account-scoped preference requests", () => {
  it("ignores an old GET response after switching from A to B", async () => {
    const oldGet = deferredResponse();
    let currentAccount: "A" | "B" = "A";

    vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const path = String(input);

      if (path === "/api/genres") {
        return Promise.resolve(
          jsonResponse({ data: { genres } }),
        );
      }

      if (path === "/api/me/preferences") {
        return currentAccount === "A"
          ? oldGet.promise
          : Promise.resolve(
              jsonResponse({
                data: { genres: [genres[1]] },
              }),
            );
      }

      throw new Error(`Unexpected request: ${path}`);
    });

    const onUnauthorized = vi.fn();

    const view = render(
      <MemoryRouter initialEntries={["/preferences"]}>
        <AccountHarness
          account="A"
          onUnauthorized={onUnauthorized}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText("Loading genres..."),
    ).toBeInTheDocument();

    currentAccount = "B";

    view.rerender(
      <MemoryRouter initialEntries={["/preferences"]}>
        <AccountHarness
          account="B"
          onUnauthorized={onUnauthorized}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Comedy",
      }),
    ).toBeChecked();

    await act(async () => {
      oldGet.resolve(
        jsonResponse({
          data: { genres: [genres[0]] },
        }),
      );
    });

    expect(
      screen.getByRole("checkbox", {
        name: "Comedy",
      }),
    ).toBeChecked();

    expect(
      screen.getByRole("checkbox", {
        name: "Action",
      }),
    ).not.toBeChecked();

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it.each([200, 401])(
    "ignores an old PUT response with status %i after switching accounts",
    async (status) => {
      const oldPut = deferredResponse();
      let currentAccount: "A" | "B" = "A";

      const onUnauthorized = vi.fn();

      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((input, init) => {
          const path = String(input);
          const method = init?.method ?? "GET";

          if (path === "/api/genres") {
            return Promise.resolve(
              jsonResponse({ data: { genres } }),
            );
          }

          if (
            path === "/api/me/preferences" &&
            method === "GET"
          ) {
            return Promise.resolve(
              jsonResponse({
                data: {
                  genres:
                    currentAccount === "A"
                      ? [genres[0]]
                      : [genres[1]],
                },
              }),
            );
          }

          if (
            path === "/api/me/preferences" &&
            method === "PUT"
          ) {
            return oldPut.promise;
          }

          throw new Error(
            `Unexpected request: ${method} ${path}`,
          );
        });

      const view = render(
        <MemoryRouter initialEntries={["/preferences"]}>
          <AccountHarness
            account="A"
            onUnauthorized={onUnauthorized}
          />
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("checkbox", {
          name: "Action",
        }),
      ).toBeChecked();

      fireEvent.click(
        screen.getByRole("button", {
          name: "Save preferences",
        }),
      );

      await waitFor(() => {
        expect(
          fetchMock.mock.calls.some(
            ([input, init]) =>
              String(input) === "/api/me/preferences" &&
              init?.method === "PUT",
          ),
        ).toBe(true);
      });

      currentAccount = "B";

      view.rerender(
        <MemoryRouter initialEntries={["/preferences"]}>
          <AccountHarness
            account="B"
            onUnauthorized={onUnauthorized}
          />
        </MemoryRouter>,
      );

      expect(
        await screen.findByRole("checkbox", {
          name: "Comedy",
        }),
      ).toBeChecked();

      await act(async () => {
        if (status === 200) {
          oldPut.resolve(
            jsonResponse({
              data: { genres: [genres[0]] },
            }),
          );
        } else {
          oldPut.resolve(
            jsonResponse(
              {
                error: {
                  code: "AUTHENTICATION_REQUIRED",
                  message: "Authentication required",
                },
              },
              401,
            ),
          );
        }
      });

      // The old response must not navigate or log out B.
      expect(
        screen.getByRole("checkbox", {
          name: "Comedy",
        }),
      ).toBeChecked();

      expect(
        screen.queryByRole("heading", {
          name: "Recommendations",
        }),
      ).not.toBeInTheDocument();

      expect(onUnauthorized).not.toHaveBeenCalled();
    },
  );

  it("still handles a 401 from the current account", async () => {
    const onUnauthorized = vi.fn();

    vi.spyOn(globalThis, "fetch").mockImplementation(
      (input, init) => {
        const path = String(input);
        const method = init?.method ?? "GET";

        if (path === "/api/genres") {
          return Promise.resolve(
            jsonResponse({ data: { genres } }),
          );
        }

        if (
          path === "/api/me/preferences" &&
          method === "GET"
        ) {
          return Promise.resolve(
            jsonResponse({
              data: { genres: [genres[0]] },
            }),
          );
        }

        if (
          path === "/api/me/preferences" &&
          method === "PUT"
        ) {
          return Promise.resolve(
            jsonResponse(
              {
                error: {
                  code: "AUTHENTICATION_REQUIRED",
                  message: "Authentication required",
                },
              },
              401,
            ),
          );
        }

        throw new Error(
          `Unexpected request: ${method} ${path}`,
        );
      },
    );

    render(
      <MemoryRouter initialEntries={["/preferences"]}>
        <AccountHarness
          account="A"
          onUnauthorized={onUnauthorized}
        />
      </MemoryRouter>,
    );

    expect(
      await screen.findByRole("checkbox", {
        name: "Action",
      }),
    ).toBeChecked();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Save preferences",
      }),
    );

    await waitFor(() => {
      expect(onUnauthorized).toHaveBeenCalledOnce();
    });
  });
});
