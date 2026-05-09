import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type { AuthenticatedViewer } from "#features/auth/lib/viewer.ts";
import { useState } from "react";

interface SessionCardProps {
  viewer: AuthenticatedViewer;
  isPending: boolean;
  onSignOut: () => Promise<void>;
}

function getCopyLabel(copyState: "idle" | "copied" | "failed"): string {
  switch (copyState) {
    case "copied":
      return "Copied";
    case "failed":
      return "Copy failed";
    default:
      return "Copy ID";
  }
}

function SessionIdentity({ viewer }: { viewer: AuthenticatedViewer }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500" />
        <Text as="p" className="text-sm text-muted-foreground">
          Signed in · {viewer.kind}
        </Text>
      </div>
      <Text as="h3">{viewer.displayName}</Text>
      <Text as="p" className="text-sm text-muted-foreground">
        Orders placed here are scoped to your account.
      </Text>
    </>
  );
}

function UserIdRow(inputProps: {
  canCopyUserId: boolean;
  copyState: "idle" | "copied" | "failed";
  userId: string;
  onCopyUserId: () => void;
}) {
  const { canCopyUserId, copyState, userId, onCopyUserId } = inputProps;

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
        User ID
      </Text>
      <code className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
        {userId}
      </code>
      {canCopyUserId ? (
        <Button
          className="min-w-24 justify-center"
          size="sm"
          variant="outline"
          onClick={onCopyUserId}
        >
          {getCopyLabel(copyState)}
        </Button>
      ) : null}
    </div>
  );
}

export function SessionCard(inputProps: SessionCardProps) {
  const { isPending, viewer, onSignOut } = inputProps;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const canCopyUserId = navigator.clipboard?.writeText !== undefined;

  const copyUserId = () => {
    if (!canCopyUserId) {
      return;
    }

    void navigator.clipboard.writeText(viewer.userId).then(
      () => setCopyState("copied"),
      () => setCopyState("failed"),
    );
  };

  return (
    <Card className="w-full">
      <Card.Content className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1.5">
          <SessionIdentity viewer={viewer} />
          <UserIdRow
            canCopyUserId={canCopyUserId}
            copyState={copyState}
            userId={viewer.userId}
            onCopyUserId={copyUserId}
          />
        </div>
        <Button disabled={isPending} variant="outline" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </Card.Content>
    </Card>
  );
}
