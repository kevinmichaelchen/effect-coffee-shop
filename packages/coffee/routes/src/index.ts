/**
 * The paths the Coffee backend serves; every other path is the app. The
 * server, the app's Worker, its Vite dev server and the stack all read this
 * list, so a new backend path is added here once.
 *
 * @module
 */

export const backendPrefixes = ["/api", "/mcp", "/oauth", "/.well-known"] as const;

/** The path is `prefix` itself or below it (Effect RPC clients post to `prefix/`). */
export const isOrStartsWith = (path: string, prefix: string) =>
  path === prefix || path.startsWith(`${prefix}/`);

/** The backend serves this path; the app serves the rest. */
export const isBackendPath = (path: string) =>
  backendPrefixes.some((prefix) => isOrStartsWith(path, prefix));
