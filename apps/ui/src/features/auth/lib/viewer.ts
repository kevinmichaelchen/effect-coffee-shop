import {
  type ActorSummary,
  ActorSummary as ViewerSchema,
} from "@effect-coffee-shop/coffee-http/contract";

/** The UI calls the contract's account summary its viewer: who the page shows. */
export const Viewer = ViewerSchema;
export type Viewer = ActorSummary;
export type AuthenticatedViewer = Exclude<Viewer, { kind: "anonymous" }>;

export const anonymousViewer: Viewer = {
  kind: "anonymous",
};
