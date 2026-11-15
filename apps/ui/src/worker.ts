import { isBackendPath } from "@effect-coffee-shop/coffee-routes";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  readonly ASSETS: Fetcher;
  readonly COFFEE: Fetcher;
}

/**
 * The app's Worker: the Vite build, plus the backend's paths forwarded to the
 * Coffee Worker over a service binding. One origin for both, so the session
 * cookie is first-party and reaches every Api call.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    return isBackendPath(pathname) ? env.COFFEE.fetch(request) : env.ASSETS.fetch(request);
  },
};
