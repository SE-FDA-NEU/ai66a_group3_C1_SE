// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import App from "../App";

describe("frontend runtime", () => {
  it("mounts the application shell", () => {
    render(<App />);

    expect(
      screen.getByRole("heading", {
        name: "AI Movie Recommendation System",
      }),
    ).toBeInTheDocument();
  });
});