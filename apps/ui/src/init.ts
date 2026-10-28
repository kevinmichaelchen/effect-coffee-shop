import { Option, Schema } from "effect";
import { Runtime } from "foldkit";
import { Model } from "./model.ts";
import { Message } from "./message.ts";
import { OrdersData, ViewerData, draft } from "./data.ts";
import { FetchViewer } from "./commands.ts";
export const Flags = Schema.Struct({ page: Model.fields.page, theme: Model.fields.theme });
export type Flags = typeof Flags.Type;
export const init: Runtime.ApplicationInit<Model, Message, Flags> = (flags) => ({
  model: {
    ...flags,
    viewer: ViewerData.Loading(),
    orders: OrdersData.Idle(),
    draft,
    displayName: "",
    feedEpoch: 0,
    pending: false,
    error: Option.none(),
    receipt: Option.none(),
  },
  commands: [FetchViewer({})],
});
