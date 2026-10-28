import * as Domain from "@alchemy.run/domain";
import * as Schema from "effect/Schema";
import { CustomerId } from "./Customer.id.ts";

/**
 * A customer, as a key: views about one customer (their orders) are keyed by
 * it. It decides nothing yet; identity and sign-in live in the auth system.
 */
export class Customer extends Domain.Aggregate("Customer", {
  id: CustomerId,
  state: Schema.Struct({}),
  initial: {},
  commands: [],
  decide: {},
  evolve: {},
}) {}
