import { PasskeyGateCard } from "#features/auth/components/PasskeyGateCard.tsx";
import { SessionCard } from "#features/auth/components/SessionCard.tsx";
import type { AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { PageHeader } from "#features/coffee-shop/components/PageHeader.tsx";
import { Alert } from "#shared/ui/retroui/Alert.tsx";
import type { ThemePreference } from "#shared/hooks/useThemePreference.ts";
import type { NavigationLinkProps } from "#features/coffee-shop/components/PageHeader.tsx";
import type { usePasskeyAuth } from "#features/auth/hooks/usePasskeyAuth.ts";
import type { ReactNode } from "react";

export function WorkspaceWarning({ message }: { message: string | null }) {
  return message === null ? null : (
    <Alert status="warning">
      <Alert.Title>Workspace warning</Alert.Title>
      <Alert.Description>{message}</Alert.Description>
    </Alert>
  );
}

export function WorkspaceAuthGate(inputProps: {
  auth: ReturnType<typeof usePasskeyAuth>;
  description: string;
  title: string;
  viewer: AuthenticatedViewer | null;
}) {
  const { auth, description, title, viewer } = inputProps;

  return viewer !== null ? (
    <SessionCard isPending={auth.isPending} viewer={viewer} onSignOut={auth.signOut} />
  ) : (
    <PasskeyGateCard
      description={description}
      displayName={auth.displayName}
      errorMessage={auth.errorMessage}
      isPending={auth.isPending}
      pendingAction={auth.pendingAction}
      title={title}
      onCreateAccount={auth.createAccount}
      onDisplayNameChange={auth.setDisplayName}
      onSignIn={auth.signIn}
    />
  );
}

export function WorkspaceHeader(inputProps: {
  activeOrders: number;
  children: ReactNode;
  footerLabel: string;
  navLinks: readonly NavigationLinkProps[];
  theme: ThemePreference;
  title: string;
  totalOrders: number;
  onToggleTheme: () => void;
}) {
  const {
    activeOrders,
    children,
    footerLabel,
    navLinks,
    theme,
    title,
    totalOrders,
    onToggleTheme,
  } = inputProps;

  return (
    <>
      <PageHeader
        activeOrders={activeOrders}
        badgeLabel="Coffee shop"
        footerLabel={footerLabel}
        navLinks={navLinks}
        theme={theme}
        title={title}
        totalOrders={totalOrders}
        onToggleTheme={onToggleTheme}
      />
      {children}
    </>
  );
}
