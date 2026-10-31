// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import SearchPage from "../pages/SearchPage.tsx";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("react-router-dom", async () => ({
  ...await vi.importActual("react-router-dom"), useNavigate: () => navigate,
}));

beforeEach(() => navigate.mockReset());
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState({}, "", "/"); });

it.each([
  ["/", false], ["/search?q=new", false], ["/search?q=moon&page=2", false], ["/", true],
])("ignores an old search reply when browser navigation reaches %s before React commits (conflict=%s)",
  async (nextUrl, conflict) => {
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>(resolve => { finish = resolve; });
    vi.spyOn(globalThis, "fetch").mockReturnValueOnce(pending)
      .mockImplementation(() => new Promise<Response>(() => {}));
    window.history.replaceState({}, "", "/search?q=moon");
    render(<MemoryRouter initialEntries={["/search?q=moon"]}><SearchPage /></MemoryRouter>);
    expect(screen.getByText("Loading movies...")).toBeVisible();
    // BrowserRouter changes browser history before a concurrent route render
    // commits. The departing Search component can still be mounted in that gap.
    window.history.pushState({}, "", nextUrl);
    await act(async () => finish(new Response(JSON.stringify(conflict
      ? { error: { code: "CATALOGUE_CHANGED", message: "Snapshot changed" } }
      : { data: { movies: [{ id: "old", title: "Stale movie", genres: [], releaseYear: 2026,
        popularityScore: 1 }] }, meta: { page: 1, limit: 10, count: 1, total: 1, totalPages: 1,
        unfilteredTotal: 1, catalogueRevision: "revision-a" } }), { status: conflict ? 409 : 200 })));
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.queryByText("Stale movie")).toBeNull();
  });
