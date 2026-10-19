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
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import {
  AuthContext,
  type AuthContextValue,
  type AuthState,
} from "../auth/authState.ts";
import MovieRating from "../components/MovieRating.tsx";

const A: AuthState = {
  status: "authenticated",
  user: { id: "a", email: "a@example.com" },
};
const B: AuthState = {
  status: "authenticated",
  user: { id: "b", email: "b@example.com" },
};
function json(rating: number | null, movieId = "movie-a") {
  return new Response(JSON.stringify({ data: { movieId, rating } }));
}
function failure(status = 503) {
  return new Response(
    JSON.stringify({
      error: {
        code: "SERVICE_UNAVAILABLE",
        message: "Service is temporarily unavailable",
      },
    }),
    { status },
  );
}
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { resolve, promise };
}
function mount(state: AuthState = A, movieId = "movie-a", strict = false) {
  const unauthorized = vi.fn();
  const refresh = vi.fn().mockResolvedValue(undefined);
  const view = (next: AuthState, movie: string) => {
    const auth: AuthContextValue = {
      ...next,
      refresh,
      signIn: vi.fn(),
      signOut: vi.fn(),
      handleUnauthorized: unauthorized,
      recommendationVersion: 0,
      recommendationScope: "test-scope",
      invalidateRecommendations: vi.fn(),
    };
    const content = (
      <MemoryRouter initialEntries={["/movies/test"]}>
        <AuthContext.Provider value={auth}>
          <Routes>
            <Route
              path="/movies/test"
              element={<MovieRating movieId={movie} />}
            />
            <Route path="/login" element={<h1>Login destination</h1>} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    );
    return strict ? <StrictMode>{content}</StrictMode> : content;
  };
  const rendered = render(view(state, movieId));
  return {
    ...rendered,
    unauthorized,
    refresh,
    change: (next: AuthState, movie = movieId) =>
      rendered.rerender(view(next, movie)),
  };
}
const picker = () =>
  screen.getByRole("combobox", { name: "Your rating (1 to 5)" });
async function ready() {
  await screen.findByRole("combobox", { name: "Your rating (1 to 5)" });
}
function choose(value: number) {
  fireEvent.change(picker(), { target: { value: String(value) } });
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps guests public and routes a rating action to login without private requests", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  mount({ status: "unauthenticated" });
  fireEvent.click(
    screen.getByRole("link", { name: "Sign in to rate this movie" }),
  );
  expect(
    screen.getByRole("heading", { name: "Login destination" }),
  ).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
});

it("checks unknown auth once, waits during checking and supports session retry", () => {
  const fetch = vi.spyOn(globalThis, "fetch");
  const view = mount({ status: "unknown" });
  expect(view.refresh).toHaveBeenCalledTimes(1);
  expect(fetch).not.toHaveBeenCalled();
  view.change({ status: "checking" });
  expect(screen.getByRole("status")).toHaveTextContent("Checking sign-in");
  view.change({ status: "error", message: "Unavailable" });
  fireEvent.click(screen.getByRole("button", { name: "Retry session check" }));
  expect(view.refresh).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});

it("distinguishes unrated from zero and does not require a rating", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(json(null));
  mount();
  await ready();
  expect(screen.getByText("Not rated yet")).toBeInTheDocument();
  expect(picker()).toHaveValue("");
  expect(screen.getByRole("button", { name: "Save rating" })).toBeDisabled();
  expect(screen.getByText(/Ratings are optional/)).toBeInTheDocument();
});

it.each([1, 3, 5])(
  "confirms rating %i only after the save response and prevents double submission",
  async (value) => {
    const put = deferred();
    const fetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(null))
      .mockReturnValueOnce(put.promise);
    mount();
    await ready();
    choose(value);
    const button = screen.getByRole("button", { name: "Save rating" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByText("Not rated yet")).toBeInTheDocument();
    expect(screen.queryByText("Rating saved.")).not.toBeInTheDocument();
    expect(picker()).toBeDisabled();
    expect(fetch).toHaveBeenCalledTimes(2);
    await act(async () => {
      put.resolve(json(value));
    });
    expect(
      screen.getByText(`Your saved rating: ${value}/5`),
    ).toBeInTheDocument();
    expect(screen.getByText("Rating saved.")).toBeInTheDocument();
  },
);

it("preserves committed 3 and draft 5 after failure, then retries the same PUT", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json(3))
    .mockResolvedValueOnce(failure())
    .mockResolvedValueOnce(json(5));
  mount();
  await ready();
  choose(5);
  expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "not confirmed as saved",
  );
  expect(picker()).toHaveValue("5");
  expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  expect(screen.queryByText("Rating saved.")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await screen.findByText("Your saved rating: 5/5");
  const puts = fetch.mock.calls.filter(
    ([, options]) => options?.method === "PUT",
  );
  expect(puts).toHaveLength(2);
  expect(puts.map(([, options]) => options?.body)).toEqual([
    '{"rating":5}',
    '{"rating":5}',
  ]);
});

it("does not report a network failure or malformed acknowledgement as success", async () => {
  const fetch = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json(3))
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(json(null));
  mount();
  await ready();
  choose(5);
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "save could not be confirmed",
  );
  fireEvent.click(screen.getByRole("button", { name: "Retry save" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  await waitFor(() =>
    expect(screen.getByRole("alert")).toHaveTextContent("rating response"),
  );
  expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  expect(picker()).toHaveValue("5");
  expect(screen.queryByText("Rating saved.")).not.toBeInTheDocument();
});

it("retries an initial read error instead of displaying a false unrated state", async () => {
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(failure())
    .mockResolvedValueOnce(json(4));
  mount();
  await screen.findByRole("alert");
  expect(screen.queryByText("Not rated yet")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Retry loading rating" }));
  await screen.findByText("Your saved rating: 4/5");
});

it.each([400, 403, 404])(
  "preserves state and provides recovery for save HTTP %i",
  async (status) => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(3))
      .mockResolvedValueOnce(failure(status));
    mount();
    await ready();
    choose(5);
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    await screen.findByRole("alert");
    expect(picker()).toHaveValue("5");
    expect(screen.getByText("Your saved rating: 3/5")).toBeInTheDocument();
  },
);

it.each(["read", "save"])(
  "uses the central handler and login for a current %s 401",
  async (operation) => {
    const fetch = vi.spyOn(globalThis, "fetch");
    if (operation === "save") fetch.mockResolvedValueOnce(json(3));
    fetch.mockResolvedValueOnce(failure(401));
    const view = mount();
    if (operation === "save") {
      await ready();
      choose(5);
      fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    }
    await screen.findByRole("heading", { name: "Login destination" });
    expect(view.unauthorized).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByText("Your saved rating: 3/5"),
    ).not.toBeInTheDocument();
  },
);

it.each(["account", "movie"])(
  "ignores an old read after a %s switch",
  async (kind) => {
    const old = deferred();
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(json(2, kind === "movie" ? "movie-b" : "movie-a"));
    const view = mount();
    view.change(
      kind === "account" ? B : A,
      kind === "movie" ? "movie-b" : "movie-a",
    );
    await screen.findByText("Your saved rating: 2/5");
    await act(async () => {
      old.resolve(json(5));
    });
    expect(screen.getByText("Your saved rating: 2/5")).toBeInTheDocument();
    expect(view.unauthorized).not.toHaveBeenCalled();
  },
);

it.each([
  ["account", 200],
  ["account", 401],
  ["account", 503],
  ["movie", 200],
  ["movie", 401],
  ["movie", 503],
] as const)(
  "ignores stale save after %s switch with HTTP %i",
  async (kind, status) => {
    const old = deferred();
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json(3))
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(
        json(null, kind === "movie" ? "movie-b" : "movie-a"),
      );
    const view = mount();
    await ready();
    choose(5);
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    view.change(
      kind === "account" ? B : A,
      kind === "movie" ? "movie-b" : "movie-a",
    );
    await screen.findByText("Not rated yet");
    await act(async () => {
      old.resolve(status === 200 ? json(5) : failure(status));
    });
    expect(screen.getByText("Not rated yet")).toBeInTheDocument();
    expect(picker()).toHaveValue("");
    expect(screen.queryByText("Rating saved.")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(view.unauthorized).not.toHaveBeenCalled();
  },
);

it.each(["account", "movie"])(
  "ignores an old read 401 after %s switch",
  async (kind) => {
    const old = deferred();
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(json(2, kind === "movie" ? "movie-b" : "movie-a"));
    const view = mount();
    view.change(
      kind === "account" ? B : A,
      kind === "movie" ? "movie-b" : "movie-a",
    );
    await screen.findByText("Your saved rating: 2/5");
    await act(async () => {
      old.resolve(failure(401));
    });
    expect(view.unauthorized).not.toHaveBeenCalled();
    expect(screen.getByText("Your saved rating: 2/5")).toBeInTheDocument();
  },
);

it("clears private state on logout, even when the same account signs in again", async () => {
  const old = deferred();
  vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(json(3))
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(json(1));
  const view = mount();
  await ready();
  choose(5);
  fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
  view.change({ status: "unauthenticated" });
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  view.change(A);
  await screen.findByText("Your saved rating: 1/5");
  await act(async () => {
    old.resolve(failure(401));
  });
  expect(screen.getByText("Your saved rating: 1/5")).toBeInTheDocument();
  expect(view.unauthorized).not.toHaveBeenCalled();
});

it("cleans up StrictMode's first read and ignores its delayed 401", async () => {
  const old = deferred();
  vi.spyOn(globalThis, "fetch")
    .mockReturnValueOnce(old.promise)
    .mockResolvedValueOnce(json(4));
  const view = mount(A, "movie-a", true);
  await screen.findByText("Your saved rating: 4/5");
  await act(async () => {
    old.resolve(failure(401));
  });
  expect(view.unauthorized).not.toHaveBeenCalled();
  expect(screen.getByText("Your saved rating: 4/5")).toBeInTheDocument();
});
