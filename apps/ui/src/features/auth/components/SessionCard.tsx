import { Badge } from "#shared/ui/retroui/Badge.tsx";
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
    <Card className="w-full border-border">
      <Card.Content className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
        <div className="grid gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-none px-2.5 py-1" size="sm" variant="solid">
              Signed in
            </Badge>
            <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              {viewer.kind}
            </Text>
          </div>
          <Text as="h3">{viewer.displayName}</Text>
          <Text as="p" className="text-sm text-muted-foreground">
            Orders placed here are scoped to your account.
          </Text>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Text as="p" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
              User ID
            </Text>
            <code className="rounded border border-border bg-muted px-2 py-1 font-mono text-xs">
              {viewer.userId}
            </code>
            {canCopyUserId ? (
              <Button
                className="min-w-24 justify-center"
                size="sm"
                variant="outline"
                onClick={copyUserId}
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy ID"}
              </Button>
            ) : null}
          </div>
        </div>
        <Button disabled={isPending} variant="outline" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </Card.Content>
    </Card>
  );
}
