import * as Schema from "effect/Schema";

const AnonymousViewerSchema = Schema.Struct({
  kind: Schema.Literal("anonymous"),
}).annotate({ identifier: "AnonymousViewer" });

const AuthenticatedViewerSchema = Schema.Struct({
  displayName: Schema.String,
  kind: Schema.Literals(["customer", "staff"] as const),
  userId: Schema.String,
}).annotate({ identifier: "AuthenticatedViewer" });

export const ViewerSchema = Schema.Union([
  AnonymousViewerSchema,
  AuthenticatedViewerSchema,
]).annotate({
  identifier: "Viewer",
});

export type Viewer = typeof ViewerSchema.Type;
export type AuthenticatedViewer = typeof AuthenticatedViewerSchema.Type;

export const anonymousViewer: Viewer = {
  kind: "anonymous",
};

export function isAuthenticatedViewer(viewer: Viewer): viewer is AuthenticatedViewer {
  return viewer.kind !== "anonymous";
}

export function isStaffViewer(viewer: Viewer): viewer is AuthenticatedViewer {
  return viewer.kind === "staff";
}
