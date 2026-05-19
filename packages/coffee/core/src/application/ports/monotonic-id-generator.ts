import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";

export interface MonotonicIdGenerator<TId> {
  readonly next: Effect.Effect<TId>;
}

export const makePaddedIdFormatter =
  <TId>(prefix: string, fromString: (value: string) => TId) =>
  (currentId: number): TId =>
    fromString(`${prefix}-${String(currentId).padStart(4, "0")}`);

export const makeMonotonicIdGenerator = <TId>(
  formatId: (currentId: number) => TId,
): Effect.Effect<MonotonicIdGenerator<TId>> =>
  Ref.make(0).pipe(
    Effect.map((currentIdRef) => ({
      next: Ref.updateAndGet(currentIdRef, (currentId) => currentId + 1).pipe(Effect.map(formatId)),
    })),
  );
