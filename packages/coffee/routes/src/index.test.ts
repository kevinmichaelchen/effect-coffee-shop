import { describe, expect, it } from "vitest";
import { isBackendPath } from "./index.ts";

describe("isBackendPath", () => {
  it("matches each prefix and the paths below it", () => {
    expect(
      ["/api", "/api/menu", "/mcp", "/oauth", "/oauth/token", "/.well-known/x"].map(isBackendPath),
    ).toEqual([true, true, true, true, true, true]);
  });

  it("leaves the app's paths alone, including look-alikes", () => {
    expect(["/", "/orders", "/apiary", "/mcpx"].map(isBackendPath)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });
});
