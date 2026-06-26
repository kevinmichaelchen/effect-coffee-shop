/**
 * Adapts effect-typed-id factories to application boundary schemas.
 *
 * @module
 */
import type { TypeIdFactory, TypeIdFrom } from "@just-be/effect-typed-id";
import * as Schema from "effect/Schema";

export const makeTypeIdSchema = <const Name extends string>(
  factory: TypeIdFactory<Name>,
): Schema.refine<TypeIdFrom<TypeIdFactory<Name>>, Schema.String> =>
  Schema.String.pipe(
    Schema.refine((input): input is TypeIdFrom<TypeIdFactory<Name>> => factory.is(input)),
  );
