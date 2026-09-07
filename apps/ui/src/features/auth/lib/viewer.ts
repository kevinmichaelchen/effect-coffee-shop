import * as Schema from "effect/Schema";

const AnonymousViewer = Schema.Struct({
  kind: Schema.Literal("anonymous"),
}).annotate({ identifier: "AnonymousViewer" });

const AuthenticatedViewer = Schema.Struct({
  displayName: Schema.String,
  kind: Schema.Literals(["customer", "staff"] as const),
  userId: Schema.String,
}).annotate({ identifier: "AuthenticatedViewer" });

export const Viewer = Schema.Union([AnonymousViewer, AuthenticatedViewer]).annotate({
  identifier: "Viewer",
});

export type Viewer = typeof Viewer.Type;
export type AuthenticatedViewer = typeof AuthenticatedViewer.Type;

export const anonymousViewer: Viewer = {
  kind: "anonymous",
};

export function isAuthenticatedViewer(viewer: Viewer): viewer is AuthenticatedViewer {
  return viewer.kind !== "anonymous";
}

export function isStaffViewer(viewer: Viewer): viewer is AuthenticatedViewer {
  return viewer.kind === "staff";
}
