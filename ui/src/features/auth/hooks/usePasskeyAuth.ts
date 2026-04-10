import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authClient } from "#features/auth/auth-client.ts";
import { viewerQueryKey } from "#features/auth/hooks/useViewerQuery.ts";
import { ordersQueryKey } from "#features/coffee-shop/hooks/useCoffeeQueries.ts";

type PendingAuthAction = "create-account" | "sign-in" | "sign-out" | null;

function getErrorMessage(error: { message?: string | undefined } | null): string {
  return error?.message ?? "Authentication failed.";
}

function readThrownMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication failed.";
}

async function refreshAuthQueries(queryClient: ReturnType<typeof useQueryClient>): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: viewerQueryKey }),
    queryClient.invalidateQueries({ queryKey: ordersQueryKey }),
  ]);
}

function toRegistrationContext(displayName: string): string {
  return JSON.stringify({ displayName });
}

async function signInWithPasskey(): Promise<void> {
  const result = await authClient.signIn.passkey();

  if (result.error !== null) {
    throw new Error(getErrorMessage(result.error));
  }
}

async function registerPasskey(displayName: string): Promise<void> {
  const registration = await authClient.passkey.addPasskey({
    name: `${displayName}'s passkey`,
    context: toRegistrationContext(displayName),
  });

  if (registration.error !== null) {
    throw new Error(getErrorMessage(registration.error));
  }

  const session = await authClient.getSession();

  if (session.data === null) {
    await signInWithPasskey();
  }
}

function useAuthActionRunner(
  queryClient: ReturnType<typeof useQueryClient>,
  setErrorMessage: (message: string | null) => void,
  setPendingAction: (action: PendingAuthAction) => void,
) {
  return async function runAuthAction(
    action: Exclude<PendingAuthAction, null>,
    effect: () => Promise<void>,
  ): Promise<void> {
    setPendingAction(action);
    setErrorMessage(null);

    try {
      await effect();
      await refreshAuthQueries(queryClient);
    } catch (error) {
      setErrorMessage(readThrownMessage(error));
    } finally {
      setPendingAction(null);
    }
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

    await runAuthAction("create-account", async () => registerPasskey(validatedDisplayName));
  }

  async function signIn(): Promise<void> {
    await runAuthAction("sign-in", signInWithPasskey);
  }

  async function signOut(): Promise<void> {
    await runAuthAction("sign-out", async () => {
      const result = await authClient.signOut();

      if (result.error !== null) {
        throw new Error(getErrorMessage(result.error));
      }
    });
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
