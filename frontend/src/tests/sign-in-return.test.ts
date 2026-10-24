import { describe, expect, it } from "vitest";
import { signInDestination, signInReturnState } from "../navigation/signInReturn.ts";

describe("explicit protected sign-in destinations", () => {
  it.each(["/preferences", "/recommendations?page=2&genreId=28#results", "/profile"])(
    "retains an intentional internal destination %s", destination => {
      const state = { signInReturnTo: destination };
      expect(signInDestination(state)).toBe(destination);
      expect(signInReturnState(state)).toEqual(state);
    },
  );
  it.each([
    undefined, null, {}, { returnTo: "/preferences" }, { signInReturnTo: 42 },
    ...["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/login", "/register",
      "javascript:alert(1)", "/preferences\n", "/preferences other", "/unknown",
      "/recommendations?x=" + "a".repeat(2048)].map(signInReturnTo => ({ signInReturnTo })),
  ])("lands on Home for absent or unsafe state %j", state => {
    expect(signInDestination(state)).toBe("/");
    expect(signInReturnState(state)).toBeUndefined();
  });
});
