// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider } from "../auth/AuthContext.tsx";
import { useAuth } from "../auth/authState.ts";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}
function pending() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
function Harness() {
  const auth = useAuth();
  return (
    <>
      <p>{auth.status === "authenticated" ? auth.user.email : auth.status}</p>
      <button onClick={() => void auth.refresh()}>Check session</button>
      <button onClick={() => void auth.signIn("b@example.com", "movie123")}>
        Sign in B
      </button>
      <button onClick={() => void auth.signOut()}>Sign out</button>
      <button onClick={auth.handleUnauthorized}>Invalidate</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.each([200, 401])(
  "a late bootstrap HTTP %i cannot overwrite a newly signed-in account",
  async (status) => {
    const old = pending();
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(
        json({ data: { user: { id: "b", email: "b@example.com" } } }),
      );
    render(
      <MemoryRouter>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Check session"));
    fireEvent.click(screen.getByText("Sign in B"));
    await screen.findByText("b@example.com");
    await act(async () => {
      old.resolve(
        status === 200
          ? json({ data: { user: { id: "a", email: "a@example.com" } } })
          : json({}, 401),
      );
    });
    expect(screen.getByText("b@example.com")).toBeInTheDocument();
  },
);

it.each(["Sign out", "Invalidate"])(
  "a late session response cannot restore private identity after %s",
  async (action) => {
    const old = pending();
    vi.spyOn(globalThis, "fetch")
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(
      <MemoryRouter>
        <AuthProvider>
          <Harness />
        </AuthProvider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("Check session"));
    fireEvent.click(screen.getByText(action));
    await screen.findByText("unauthenticated");
    await act(async () => {
      old.resolve(
        json({ data: { user: { id: "a", email: "a@example.com" } } }),
      );
    });
    expect(screen.getByText("unauthenticated")).toBeInTheDocument();
  },
);
