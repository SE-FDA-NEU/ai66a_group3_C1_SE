// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import ConfirmDialog from "../components/ConfirmDialog.tsx";
import { ExternalTrailerLink, ProviderBadges } from "../components/MediaPatterns.tsx";

afterEach(cleanup);

function DialogExample() {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)}>Open example</button>
    <ConfirmDialog open={open} title="Example confirmation" confirmLabel="Confirm example"
      onCancel={() => setOpen(false)} onConfirm={() => setOpen(false)}>Example description, no API mutation.</ConfirmDialog></>;
}

it("dialog labels, traps focus and restores the trigger after cancelling", () => {
  render(<DialogExample />);
  const trigger = screen.getByRole("button", { name: "Open example" });
  trigger.focus(); fireEvent.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Example confirmation" });
  expect(dialog).toHaveAccessibleDescription("Example description, no API mutation.");
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  trigger.focus();
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
  expect(screen.getByRole("button", { name: "Confirm example" })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Tab" });
  expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  fireEvent.keyDown(dialog, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(trigger).toHaveFocus();
});

it("pending confirmation cannot submit or cancel twice", () => {
  const cancel = vi.fn(), confirm = vi.fn();
  render(<ConfirmDialog open pending title="Pending example" confirmLabel="Confirm"
    onCancel={cancel} onConfirm={confirm}>Waiting for consumer's request.</ConfirmDialog>);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Working..." }));
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(cancel).not.toHaveBeenCalled(); expect(confirm).not.toHaveBeenCalled();
});

it.each([null, undefined, "javascript:alert(1)", "https://evil.invalid/watch?v=ABCDEFGHIJK", "https://www.youtube.com/watch?v=short"])(
  "unsafe/unavailable media has no actionable link: %s", url => {
    render(<ExternalTrailerLink url={url} />);
    expect(screen.getByText("Trailer unavailable")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  },
);

it("safe trailer pattern opens a validated URL without opener access or autoplay", () => {
  render(<ExternalTrailerLink url="https://www.youtube.com/watch?v=ABCDEFGHIJK" />);
  const link = screen.getByRole("link", { name: /Watch trailer.*new tab/ });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noopener noreferrer");
  expect(document.querySelector("iframe")).toBeNull();
});

it("provider style examples are non-clickable, deduplicated name badges", () => {
  render(<ProviderBadges names={["Example Stream", "Example Rent", "Example Stream"]} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
