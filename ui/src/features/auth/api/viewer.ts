import * as Schema from "effect/Schema";
import { ViewerSchema, type Viewer } from "#features/auth/lib/viewer.ts";

async function readJson<S extends Schema.Decoder<unknown>>(
  response: Response,
  schema: S,
): Promise<S["Type"]> {
  const value = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(await response.text());
  return Schema.decodeUnknownPromise(schema)(value);
}

export async function fetchViewer(): Promise<Viewer> {
  const response = await fetch("/api/me");

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return readJson(response, ViewerSchema);
}
