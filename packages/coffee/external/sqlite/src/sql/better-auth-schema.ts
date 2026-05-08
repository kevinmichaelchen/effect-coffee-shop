import { agentAuth } from "@better-auth/agent-auth";
import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import { sqlfuBetterAuthAdapter } from "sqlfu/better-auth";

const unavailableCapabilityExecutor = async () => {
  throw new Error("This Better Auth config is only for SQLFu schema generation.");
};

const auth = betterAuth({
  appName: "Effect Coffee Shop",
  basePath: "/api/auth",
  baseURL: "http://localhost",
  database: sqlfuBetterAuthAdapter(),
  plugins: [
    agentAuth({
      approvalMethods: ["device_authorization"],
      capabilities: [],
      deviceAuthorizationPage: "/device/capabilities",
      modes: ["delegated"],
      onExecute: unavailableCapabilityExecutor,
      providerDescription:
        "Coffee ordering capabilities for delegated AI agents acting on behalf of a signed-in customer.",
      providerName: "Effect Coffee Shop",
    }),
    passkey({
      registration: {
        requireSession: false,
      },
      rpName: "Effect Coffee Shop",
    }),
  ],
  secret: "schema-generation-only-secret-0001",
  telemetry: {
    enabled: false,
  },
});

export default auth;
