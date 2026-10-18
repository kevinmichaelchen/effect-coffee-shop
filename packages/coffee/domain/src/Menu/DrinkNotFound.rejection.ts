import * as Domain from "alchemy/Domain";
import * as Schema from "effect/Schema";

/** The requested drink is not on the menu. */
export class DrinkNotFound extends Domain.Rejection("DrinkNotFound", {
  drinkId: Schema.String,
}) {}
