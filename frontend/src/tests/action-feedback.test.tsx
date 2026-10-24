// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRef } from "react";
import ActionFeedback from "../components/ActionFeedback.tsx";
import { useFeedback } from "../feedback.ts";

function Actions() {
  const feedback = useFeedback();
  const pending = useRef(0);
  return <>
    <input aria-label="Keep typing" />
    <button onClick={() => { pending.current = feedback.announce({ kind: "pending", title: "Saving to server" }); }}>Save</button>
    <button onClick={() => feedback.update(pending.current, { kind: "success", title: "Confirmed by server" })}>Resolve</button>
    <button onClick={() => feedback.update(pending.current, { kind: "error", title: "Not confirmed" })}>Reject</button>
    <button onClick={() => feedback.announce({ kind: "info", title: "Newer action" })}>Newer</button>
    <button onClick={() => feedback.dismiss(pending.current)}>Old cleanup</button>
  </>;
}
function open() { render(<ActionFeedback><Actions /></ActionFeedback>); }
afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keeps a pending message until acknowledgement and does not steal focus", () => {
  vi.useFakeTimers(); open();
  const input = screen.getByRole("textbox"); input.focus();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(input).toHaveFocus();
  expect(screen.queryByText("Confirmed by server")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(60_000));
  expect(screen.getByRole("status")).toHaveTextContent("Saving to server");
  fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
  expect(screen.getByRole("status")).toHaveTextContent("Confirmed by server");
  act(() => vi.advanceTimersByTime(4500));
  expect(screen.queryByTestId("action-feedback")).not.toBeInTheDocument();
});

it("does not turn a failed request into success and leaves a polite non-modal summary", () => {
  vi.useFakeTimers(); open();
  fireEvent.click(screen.getByText("Save")); fireEvent.click(screen.getByText("Reject"));
  expect(screen.getByTestId("action-feedback")).toHaveClass("action-feedback--error");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(screen.queryByText("Confirmed by server")).not.toBeInTheDocument();
  act(() => vi.advanceTimersByTime(7999));
  expect(screen.getByRole("status")).toHaveTextContent("Not confirmed");
  act(() => vi.advanceTimersByTime(1));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("ignores old completions and old component cleanup after a newer action", () => {
  open(); fireEvent.click(screen.getByText("Save")); fireEvent.click(screen.getByText("Newer"));
  fireEvent.click(screen.getByText("Resolve")); fireEvent.click(screen.getByText("Reject"));
  fireEvent.click(screen.getByText("Old cleanup"));
  expect(screen.getByRole("status")).toHaveTextContent("Newer action");
  expect(screen.getAllByTestId("action-feedback")).toHaveLength(1);
});

it("can dismiss with Escape or its keyboard-accessible close button", () => {
  open(); fireEvent.click(screen.getByText("Newer"));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  fireEvent.click(screen.getByText("Save"));
  fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  // A dismissed pending request does not resurrect its toast later.
  fireEvent.click(screen.getByText("Resolve"));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});

it("pauses auto-dismiss while the close control has keyboard focus", () => {
  vi.useFakeTimers(); open(); fireEvent.click(screen.getByText("Newer"));
  const close = within(screen.getByTestId("action-feedback")).getByRole("button");
  act(() => close.focus());
  act(() => vi.advanceTimersByTime(20_000));
  expect(screen.getByRole("status")).toBeInTheDocument();
  act(() => screen.getByRole("textbox").focus());
  act(() => vi.advanceTimersByTime(4500));
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
