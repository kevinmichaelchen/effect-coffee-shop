import { RuleTester } from "oxlint/plugins-dev";
import { describe, it } from "vitest";

// The vendored tests call `tester.run` on import; route them through Vitest.
RuleTester.describe = describe;
RuleTester.it = it;

await import("./vendor/anti-slop/src/effect/rules/prefer-tagged-error-handling.test.ts");
await import("./vendor/anti-slop/src/rules/max-ternary-depth.test.ts");
await import("./vendor/anti-slop/src/rules/no-reprovide-ambient-service.test.ts");
