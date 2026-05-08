import { createAuthClient } from "better-auth/client";
import { passkeyClient } from "@better-auth/passkey/client";

function omitInferServerPlugin(plugin: ReturnType<typeof passkeyClient>) {
  const { $InferServerPlugin, ...clientPlugin } = plugin;
  void $InferServerPlugin;
  return clientPlugin;
}

const passkeyPlugin = omitInferServerPlugin(passkeyClient());

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [passkeyPlugin],
});
