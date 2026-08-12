/**
 * Adapts effect-typed-id factories to application boundary schemas.
 *
 * @module
 */
import type { TypeIdFactory, TypeIdOf } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";

export const makeTypeIdSchema = <const Name extends string>(
  factory: TypeIdFactory<Name>,
): Schema.refine<TypeIdOf<Name>, Schema.String> =>
  Schema.String.pipe(Schema.refine((input): input is TypeIdOf<Name> => factory.is(input)));
