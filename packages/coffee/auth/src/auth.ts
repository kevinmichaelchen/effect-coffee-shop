import { Auth, Passkey, Sessions } from "@yielded/auth";
import { CoffeeAuthApi, passkeyNamespace, Registration } from "./contract.ts";

export const CoffeeAuth = Auth.make(CoffeeAuthApi, {
  sessions: Sessions.stateful({ idleTimeout: "7 days", maxAge: "30 days" }),
  strategies: {
    passkey: Passkey.make({ namespace: passkeyNamespace }),
    registration: Passkey.makeRegistration({
      namespace: passkeyNamespace,
      registration: Registration,
    }),
  },
  defaultStrategy: "passkey",
});

export const authenticationRequirement = Sessions.AuthenticationRequirement.make({
  maximumAgeMillis: 300_000,
  alternatives: [
    { factors: ["possession"], minimumCredentials: 1, userVerified: true, phishingResistant: true },
  ],
});
