import { requestJson } from "#shared/lib/http.ts";
import { ViewerSchema, type Viewer } from "#features/auth/lib/viewer.ts";

export async function fetchViewer(): Promise<Viewer> {
  return requestJson({
    path: "/api/me",
    schema: ViewerSchema,
  });
}
