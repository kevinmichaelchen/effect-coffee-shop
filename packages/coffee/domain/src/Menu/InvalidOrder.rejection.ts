import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";

/** The requested drinks or details break a menu rule; `message` says which. */
export class InvalidOrder extends Domain.Rejection("InvalidOrder", {
  message: Schema.String,
}) {}
