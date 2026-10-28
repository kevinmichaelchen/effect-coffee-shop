import { requestJson } from "#shared/lib/http.ts";
import { Viewer } from "#features/auth/lib/viewer.ts";

export const fetchViewer = requestJson({
  path: "/api/me",
  schema: Viewer,
});
