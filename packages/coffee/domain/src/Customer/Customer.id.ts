import * as Schema from "effect/Schema";

/** A signed-in person, by their auth subject id. Customers and staff alike. */
export const CustomerId = Schema.String.check(Schema.isNonEmpty()).pipe(Schema.brand("CustomerId"));
export type CustomerId = typeof CustomerId.Type;
