import { describe, expect, it } from "vitest";
import { sharedRuntime } from "./shared-runtime";

/**
 * The exported HTML's behaviour is authored as a JavaScript *string*, so the
 * TypeScript compiler never parses it. A syntax error there type-checks and
 * lints clean, ships, and silently breaks every generated surprise at open
 * time. Parsing it here is the only thing that catches that.
 */
describe("exported HTML runtime", () => {
  it("parses as valid JavaScript", () => {
    expect(() => new Function(sharedRuntime)).not.toThrow();
  });
});
