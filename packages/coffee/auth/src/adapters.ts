import { AuthRateLimitStoreLive } from "./persistence/rate-limit-store.ts";
import { Persistence } from "@yielded/auth";
import * as PasskeyProtocol from "@yielded/auth-simplewebauthn/Server";
import * as WebCrypto from "@yielded/crypto/WebCrypto";
import * as KdfAdmission from "@yielded/crypto/KdfAdmission";
import * as Layer from "effect/Layer";
import { AuthStorageLive } from "./persistence/live.ts";

/** Host choices selected at the composition root; auth workflows consume their services. */
export const AuthAdaptersLive = {
  passkeys: PasskeyProtocol.layer,
  storage: AuthStorageLive,
  rateLimits: Persistence.keyValueRateLimiterStore.pipe(Layer.provide(AuthRateLimitStoreLive)),
  crypto: Layer.merge(
    WebCrypto.layerCryptoWeb,
    WebCrypto.layer(globalThis.crypto.subtle).pipe(Layer.provide(KdfAdmission.layer())),
  ),
};
export type AuthAdapters = typeof AuthAdaptersLive;
