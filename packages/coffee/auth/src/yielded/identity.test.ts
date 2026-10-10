/* oxlint-disable effect/avoid-native-object-helpers -- The actor port accepts a native ReadonlySet. */
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { actorFromIdentity, CoffeeAuthIdentity } from "./identity.ts";

describe("Yielded identity boundary", () => {
  it.effect("preserves opaque IDs and deployment-owned staff authority", () =>
    Effect.gen(function* () {
      const identity = yield* Schema.decodeUnknownEffect(CoffeeAuthIdentity)({
        subjectId: "opaque-AbC-123",
        displayName: "Alice",
        role: "staff",
        kind: "system",
      });
      expect(yield* actorFromIdentity(identity, new Set())).toEqual({
        userId: "opaque-AbC-123",
        displayName: "Alice",
        kind: "customer",
      });
      expect(yield* actorFromIdentity(identity, new Set([identity.subjectId]))).toHaveProperty(
        "kind",
        "staff",
      );
      expect(yield* actorFromIdentity(identity, new Set(["opaque-abc-123"]))).toHaveProperty(
        "kind",
        "customer",
      );
    }),
  );
});
