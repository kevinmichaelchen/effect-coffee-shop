import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "#features/auth/auth-client.ts";
import { viewerQueryKey } from "#features/auth/hooks/useViewerQuery.ts";
import { ordersQueryKey } from "#features/coffee-shop/hooks/useCoffeeQueries.ts";

type PendingAuthAction = "create-account" | "sign-in" | "sign-out" | null;

async function refreshAuthQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: viewerQueryKey }),
    queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  ]);
}

function useAuthActionRunner(
  queryClient: ReturnType<typeof useQueryClient>,
  setErrorMessage: (message: string | null) => void,
  setPendingAction: (action: PendingAuthAction) => void,
) {
  return async function runAuthAction(
    action: Exclude<PendingAuthAction, null>,
    effect: () => Promise<{ readonly ok: boolean; readonly message: string }>,
  ): Promise<void> {
    setPendingAction(action);
    setErrorMessage(null);

    const result = await effect();
    if (result.ok) {
      await refreshAuthQueries(queryClient);
      if (action !== "sign-out" && window.location.pathname === "/login/mcp") {
        window.location.assign("/oauth/coffee/authorize");
      }
    } else setErrorMessage(result.message);
    setPendingAction(null);
  };
}

function getValidatedDisplayName(
  displayName: string,
  setErrorMessage: (message: string | null) => void,
): string | null {
  const trimmedDisplayName = displayName.trim();

  if (trimmedDisplayName.length > 0) {
    return trimmedDisplayName;
  }

  setErrorMessage("Enter the name you want printed on your orders.");
  return null;
}

export function usePasskeyAuth() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAuthAction>(null);
  const runAuthAction = useAuthActionRunner(queryClient, setErrorMessage, setPendingAction);

  async function createAccount(): Promise<void> {
    const validatedDisplayName = getValidatedDisplayName(displayName, setErrorMessage);

    if (validatedDisplayName === null) {
      return;
    }

    await runAuthAction("create-account", async () => authClient.register(validatedDisplayName));
  }

  async function signIn(): Promise<void> {
    await runAuthAction("sign-in", authClient.signIn);
  }

  async function signOut(): Promise<void> {
    await runAuthAction("sign-out", authClient.signOut);
  }

  return {
    createAccount,
    displayName,
    errorMessage,
    isPending: pendingAction !== null,
    pendingAction,
    setDisplayName,
    signIn,
    signOut,
  };
}
