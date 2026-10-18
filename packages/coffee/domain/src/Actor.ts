import * as Schema from "effect/Schema";
import { CustomerId } from "./Customer/Customer.id.ts";

/**
 * Who is acting: a customer, a barista (staff), or the system. Staff
 * authority comes from deployment configuration, never from the session.
 */
export const Actor = Schema.Struct({
  kind: Schema.Literals(["customer", "staff", "system"]),
  userId: CustomerId,
  displayName: Schema.String,
}).annotate({ identifier: "Actor" });
export type Actor = typeof Actor.Type;

export const isStaff = (actor: Actor): boolean => actor.kind === "staff" || actor.kind === "system";

export const systemActor: Actor = {
  kind: "system",
  userId: CustomerId.make("system"),
  displayName: "System Operator",
};
