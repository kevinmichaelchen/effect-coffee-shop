import { Badge } from "#shared/ui/retroui/Badge.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";
import type { AuthenticatedViewer } from "#features/auth/lib/viewer.ts";

interface SessionCardProps {
  viewer: AuthenticatedViewer;
  isPending: boolean;
  onSignOut: () => Promise<void>;
}

export function SessionCard(inputProps: SessionCardProps) {
  const { isPending, viewer, onSignOut } = inputProps;

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
        </div>
        <Button disabled={isPending} variant="outline" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </Card.Content>
    </Card>
  );
}
