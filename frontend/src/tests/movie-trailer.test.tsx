// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { MovieTrailer } from "../components/MovieTrailer.tsx";

const trailer = {
  site: "YouTube", key: "AbCdEf123_-", type: "Trailer", official: true,
  name: "Official trailer", language: "en", publishedAt: null,
  url: "https://www.youtube.com/watch?v=AbCdEf123_-",
} as const;
const props = { movieId: "movie-a", title: "Movie A", trailer };

// jsdom does not implement the native top-layer API. Real modal keyboard and
// iframe focus behaviour are exercised by the Playwright suite.
const prototype = HTMLDialogElement.prototype;
const originalShow = Object.getOwnPropertyDescriptor(prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(prototype, "close");
beforeAll(() => {
  Object.defineProperty(prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(prototype, "showModal", originalShow);
  else delete (prototype as Partial<HTMLDialogElement>).showModal;
  if (originalClose) Object.defineProperty(prototype, "close", originalClose);
  else delete (prototype as Partial<HTMLDialogElement>).close;
});

afterEach(cleanup);

describe("embedded official trailer", () => {
  it.each([
    null, undefined, { ...trailer, official: false }, { ...trailer, type: "Teaser" },
    { ...trailer, site: "Other" }, { ...trailer, key: "../bad-key" },
    { ...trailer, url: "https://evil.example/watch?v=AbCdEf123_-" },
    { ...trailer, url: "https://www.youtube.com/watch?v=ABCDEFGHIJK" },
  ])("has no player or action for unavailable/unapproved data %j", value => {
    render(<MovieTrailer {...props} trailer={value as typeof props.trailer} />);
    expect(screen.getByText("Trailer unavailable")).toBeVisible();
    expect(screen.queryByRole("button")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("loads an allowlisted player only after a click, then removes it and restores focus", () => {
    const previousOverflow = document.body.style.overflow;
    render(<MovieTrailer {...props} />);
    const button = screen.getByRole("button", { name: "Watch trailer" });
    expect(screen.queryByRole("link")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    button.focus();
    fireEvent.click(button);
    expect(screen.getByRole("dialog", { name: "Movie A" })).toBeVisible();
    const frame = screen.getByTitle("Official trailer for Movie A");
    expect(frame).toHaveAttribute("src", "https://www.youtube.com/embed/AbCdEf123_-?autoplay=0&playsinline=1&rel=0");
    expect(frame).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(frame).toHaveAttribute("allowfullscreen");
    expect(frame.getAttribute("allow")).not.toContain("autoplay");
    expect(screen.getByRole("button", { name: "Close trailer" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.click(screen.getByRole("button", { name: "Close trailer" }));
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(button).toHaveFocus();
    expect(document.body.style.overflow).toBe(previousOverflow);
  });

  it("handles the native Escape/cancel event and reopens a fresh player", () => {
    render(<MovieTrailer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch trailer" }));
    const firstFrame = document.querySelector("iframe");
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { bubbles: true, cancelable: true }));
    expect(document.querySelector("iframe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Watch trailer" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(document.querySelector("iframe")).not.toBe(firstFrame);
  });

  it("unmounts an old movie's playing frame on movie/video changes", () => {
    const { rerender } = render(<MovieTrailer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch trailer" }));
    rerender(<MovieTrailer movieId="movie-b" title="Movie B" trailer={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Trailer unavailable")).toBeVisible();
    expect(document.body.style.overflow).not.toBe("hidden");
    rerender(<MovieTrailer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch trailer" }));
    rerender(<MovieTrailer {...props} trailer={{ ...trailer, key: "ABCDEFGHIJK", url: "https://www.youtube.com/watch?v=ABCDEFGHIJK" }} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("restores the previous scroll policy when an open player is unmounted", () => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "scroll";
    const { unmount } = render(<MovieTrailer {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Watch trailer" }));
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.querySelector("iframe")).toBeNull();
    expect(document.body.style.overflow).toBe("scroll");
    document.body.style.overflow = previous;
  });
});
