/**
 * Selects generated SQLite order list queries from domain filters.
 *
 * @module
 */
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type { ListOrdersFilters } from "@effect-coffee-shop/coffee-core/domain/order";
import { SqlOrderModel } from "./models.ts";
import { listOrders } from "./queries/.generated/list-orders.sql.ts";
import { listOrdersByOwner } from "./queries/.generated/list-orders-by-owner.sql.ts";
import { listOrdersByOwnerAndStatus } from "./queries/.generated/list-orders-by-owner-and-status.sql.ts";
import { listOrdersByStatus } from "./queries/.generated/list-orders-by-status.sql.ts";

const decodeSqlOrders = Schema.decodeUnknownEffect(Schema.Array(SqlOrderModel));

export const listSqlOrderRows = Effect.fnUntraced(function* (filters: ListOrdersFilters = {}) {
  return yield* Option.match(Option.fromUndefinedOr(filters.ownerUserId), {
    onNone: () =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () => listOrders(),
        onSome: (status) => listOrdersByStatus({ status }),
      }),
    onSome: (ownerUserId) =>
      Option.match(Option.fromUndefinedOr(filters.status), {
        onNone: () => listOrdersByOwner({ ownerUserId }),
        onSome: (status) =>
          listOrdersByOwnerAndStatus({
            ownerUserId,
            status,
          }),
      }),
  }).pipe(Effect.flatMap(decodeSqlOrders));
});
