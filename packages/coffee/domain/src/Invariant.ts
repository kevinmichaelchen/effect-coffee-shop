import * as Schema from "effect/Schema";

/**
 * A state the model's own rules make impossible, such as a reply to an
 * accepted command finding nothing to reply with. Raising it is a bug: the
 * command rolls back instead of committing.
 */
export class InvariantViolation extends Schema.TaggedError<
  InvariantViolation,
  { readonly brand: unique symbol }
>()("InvariantViolation", { message: Schema.String }) {}

export const invariantViolated = (message: string): never => {
  throw new InvariantViolation({ message });
};
