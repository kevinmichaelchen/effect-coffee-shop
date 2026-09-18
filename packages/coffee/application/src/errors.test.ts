import { assert, describe, it } from "@effect/vitest";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Result from "effect/Result";
import { PersistenceError } from "./errors.ts";

describe("PersistenceError.refail", () => {
  it.effect("maps typed failures to PersistenceError", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.fail("database unavailable").pipe(
        PersistenceError.refail("Failed to load"),
        Effect.exit,
      );

      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        const failure = Cause.findError(exit.cause);
        assert.isTrue(Result.isSuccess(failure));
        if (Result.isSuccess(failure)) {
          assert.deepStrictEqual(
            failure.success,
            new PersistenceError({ message: "Failed to load", cause: "database unavailable" }),
          );
        }
      }
    }),
  );

  it.effect("preserves interruption", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.interrupt.pipe(
        PersistenceError.refail("Failed to load"),
        Effect.exit,
      );

      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        assert.isTrue(Cause.hasInterruptsOnly(exit.cause));
      }
    }),
  );

  it.effect("preserves defects", () =>
    Effect.gen(function* () {
      const defect = { message: "driver defect" };
      const exit = yield* Effect.die(defect).pipe(
        PersistenceError.refail("Failed to load"),
        Effect.exit,
      );

      assert.isTrue(Exit.isFailure(exit));
      if (Exit.isFailure(exit)) {
        const foundDefect = Cause.findDefect(exit.cause);
        assert.isTrue(Result.isSuccess(foundDefect));
        if (Result.isSuccess(foundDefect)) {
          assert.strictEqual(foundDefect.success, defect);
        }
      }
    }),
  );
});
