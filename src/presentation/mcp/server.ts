import * as BunServices from "@effect/platform-bun/BunServices"
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer"
import * as BunRuntime from "@effect/platform-bun/BunRuntime"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as McpSchema from "effect/unstable/ai/McpSchema"
import * as McpServer from "effect/unstable/ai/McpServer"
import * as Tool from "effect/unstable/ai/Tool"
import * as Toolkit from "effect/unstable/ai/Toolkit"
import * as HttpRouter from "effect/unstable/http/HttpRouter"
import { InMemoryCoffeeAppLive } from "../../external/live.ts"
import { MenuRepository } from "../../service/ports/MenuRepository.ts"
import { OrderRepository } from "../../service/ports/OrderRepository.ts"
import {
  cancelOrder,
  getOrder,
  listMenu,
  listOrders,
  markReady,
  pickUpOrder,
  placeOrder,
  startBrewing
} from "../../service/use-cases/index.ts"
import { prettyJson } from "../shared/json.ts"
import { CoffeeOrderSchema, PlaceOrderRequestSchema } from "../../domain/order.ts"
import { AppErrorSchema } from "./schemas.ts"

const PlaceOrderTool = Tool.make("place_order", {
  description: "Create a new coffee order",
  parameters: PlaceOrderRequestSchema,
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const GetOrderTool = Tool.make("get_order", {
  description: "Fetch one order by id",
  parameters: Schema.Struct({
    orderId: Schema.String
  }),
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const ListOrdersTool = Tool.make("list_orders", {
  description: "List orders, optionally filtered by status",
  parameters: Schema.Struct({
    status: Schema.optionalKey(Schema.String)
  }),
  success: Schema.Array(CoffeeOrderSchema),
  failure: AppErrorSchema
})

const StartBrewingTool = Tool.make("start_brewing", {
  description: "Move an order from pending to brewing",
  parameters: Schema.Struct({
    orderId: Schema.String
  }),
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const MarkReadyTool = Tool.make("mark_ready", {
  description: "Move an order from brewing to ready",
  parameters: Schema.Struct({
    orderId: Schema.String
  }),
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const PickUpOrderTool = Tool.make("pick_up_order", {
  description: "Move an order from ready to picked-up",
  parameters: Schema.Struct({
    orderId: Schema.String
  }),
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const CancelOrderTool = Tool.make("cancel_order", {
  description: "Cancel a pending or brewing order",
  parameters: Schema.Struct({
    orderId: Schema.String
  }),
  success: CoffeeOrderSchema,
  failure: AppErrorSchema
})

const CoffeeToolkit = Toolkit.make(
  PlaceOrderTool,
  GetOrderTool,
  ListOrdersTool,
  StartBrewingTool,
  MarkReadyTool,
  PickUpOrderTool,
  CancelOrderTool
)

const CoffeeToolkitLive = McpServer.toolkit(CoffeeToolkit).pipe(
  Layer.provideMerge(
    CoffeeToolkit.toLayer(
      Effect.gen(function*() {
        const menuRepository = yield* MenuRepository
        const orderRepository = yield* OrderRepository

        return CoffeeToolkit.of({
          place_order: (input) =>
            placeOrder(input).pipe(
              Effect.provideService(MenuRepository, menuRepository),
              Effect.provideService(OrderRepository, orderRepository)
            ),
          get_order: ({ orderId }) =>
            getOrder(orderId).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            ),
          list_orders: ({ status }) =>
            listOrders(status === undefined ? {} : { status }).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            ),
          start_brewing: ({ orderId }) =>
            startBrewing(orderId).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            ),
          mark_ready: ({ orderId }) =>
            markReady(orderId).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            ),
          pick_up_order: ({ orderId }) =>
            pickUpOrder(orderId).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            ),
          cancel_order: ({ orderId }) =>
            cancelOrder(orderId).pipe(
              Effect.provideService(OrderRepository, orderRepository)
            )
        })
      })
    )
  )
)

const MenuResource = McpServer.resource({
  uri: "coffee://menu",
  name: "Coffee Menu",
  description: "The current in-memory coffee menu",
  mimeType: "application/json",
  content: listMenu().pipe(Effect.map(prettyJson))
})

const OpenOrdersResource = McpServer.resource({
  uri: "coffee://orders/open",
  name: "Open Orders",
  description: "Orders that have not been picked up or cancelled",
  mimeType: "application/json",
  content: listOrders({}).pipe(
    Effect.map((orders) =>
      orders.filter((order) => order.status !== "picked-up" && order.status !== "cancelled")
    ),
    Effect.map(prettyJson)
  )
})

const orderIdParam = McpSchema.param("orderId", Schema.String)

const OrderResource = McpServer.resource`coffee://orders/${orderIdParam}`({
  name: "Coffee Order",
  description: "One coffee order by id",
  mimeType: "application/json",
  completion: {
    orderId: () => listOrders({}).pipe(Effect.map((orders) => orders.map((order) => order.id)))
  },
  content: Effect.fn("CoffeeMcp.orderResource")(function*(_uri, orderId) {
    const order = yield* getOrder(orderId)
    return prettyJson(order)
  })
})

const RecommendDrinkPrompt = McpServer.prompt({
  name: "recommend-drink",
  description: "Suggest a drink from the available menu",
  parameters: {
    occasion: Schema.String
  },
  completion: {
    occasion: () => Effect.succeed(["morning rush", "afternoon break", "late night", "decaf"])
  },
  content: Effect.fn("CoffeeMcp.recommendDrinkPrompt")(function*({ occasion }) {
    const menu = yield* listMenu()
    return `Recommend one drink for "${occasion}" from this menu:\n${prettyJson(menu)}`
  })
})

const SummarizeOpenOrdersPrompt = McpServer.prompt({
  name: "summarize-open-orders",
  description: "Summarize the current open order queue",
  parameters: {
    focus: Schema.String
  },
  completion: {
    focus: () => Effect.succeed(["kitchen", "pickup", "operations"])
  },
  content: Effect.fn("CoffeeMcp.summarizeOpenOrdersPrompt")(function*({ focus }) {
    const openOrders = yield* listOrders({}).pipe(
      Effect.map((orders) =>
        orders.filter((order) => order.status !== "picked-up" && order.status !== "cancelled")
      )
    )
    return `Summarize the open order queue for ${focus}:\n${prettyJson(openOrders)}`
  })
})

const CoffeeMcpFeaturesLive = Layer.mergeAll(
  MenuResource,
  OpenOrdersResource,
  OrderResource,
  RecommendDrinkPrompt,
  SummarizeOpenOrdersPrompt,
  CoffeeToolkitLive
).pipe(
  Layer.provide(InMemoryCoffeeAppLive)
)

export const CoffeeMcpStdioLive = CoffeeMcpFeaturesLive.pipe(
  Layer.provide(McpServer.layerStdio({
    name: "Coffee Orders MCP",
    version: "0.1.0"
  })),
  Layer.provide(BunServices.layer)
)

export const CoffeeMcpHttpLive = CoffeeMcpFeaturesLive.pipe(
  Layer.provide(McpServer.layerHttp({
    name: "Coffee Orders MCP",
    version: "0.1.0",
    path: "/mcp"
  }))
)

export const runCoffeeMcpStdio = Layer.launch(CoffeeMcpStdioLive).pipe(BunRuntime.runMain)

export const makeCoffeeMcpHttpServer = (port: number) =>
  HttpRouter.serve(CoffeeMcpHttpLive).pipe(
    Layer.provideMerge(BunHttpServer.layer({ port }))
  )
