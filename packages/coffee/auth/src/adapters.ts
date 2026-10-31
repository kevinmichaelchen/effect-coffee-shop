import { AuthRateLimitStoreLive } from "./persistence/rate-limit-store.ts";
import { Persistence } from "@yielded/auth";
import * as PasskeyProtocol from "@yielded/auth-simplewebauthn/Server";
import * as WebCrypto from "@yielded/auth/WebCrypto";
import * as Layer from "effect/Layer";
import { AuthStorageLive } from "./persistence/live.ts";

/** Host choices selected at the composition root; auth workflows consume their services. */
export const AuthAdaptersLive = {
  passkeys: PasskeyProtocol.layer,
  storage: AuthStorageLive,
  rateLimits: Persistence.keyValueRateLimiterStore.pipe(Layer.provide(AuthRateLimitStoreLive)),
  crypto: WebCrypto.layer,
};
export type AuthAdapters = typeof AuthAdaptersLive;
