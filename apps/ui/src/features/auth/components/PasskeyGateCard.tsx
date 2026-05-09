import { Alert } from "#shared/ui/retroui/Alert.tsx";
import { Button } from "#shared/ui/retroui/Button.tsx";
import { Card } from "#shared/ui/retroui/Card.tsx";
import { Input } from "#shared/ui/retroui/Input.tsx";
import { Label } from "#shared/ui/retroui/Label.tsx";
import { Text } from "#shared/ui/retroui/Text.tsx";

interface PasskeyGateCardProps {
  displayName: string;
  errorMessage: string | null;
  isPending: boolean;
  pendingAction: "create-account" | "sign-in" | "sign-out" | null;
  title: string;
  description: string;
  onCreateAccount: () => Promise<void>;
  onDisplayNameChange: (value: string) => void;
  onSignIn: () => Promise<void>;
}

function getPendingLabel(pendingAction: PasskeyGateCardProps["pendingAction"]): string {
  switch (pendingAction) {
    case "create-account":
      return "Creating account…";
    case "sign-in":
      return "Signing in…";
    default:
      return "Waiting for passkey approval…";
  }
}

function PasskeyNameField(
  inputProps: Pick<PasskeyGateCardProps, "displayName" | "isPending" | "onDisplayNameChange">,
) {
  const { displayName, isPending, onDisplayNameChange } = inputProps;

  return (
    <div className="grid gap-2">
      <Label htmlFor="passkey-display-name">Name on your order</Label>
      <Input
        autoComplete="name"
        disabled={isPending}
        id="passkey-display-name"
        placeholder="Taylor"
        value={displayName}
        onChange={(event) => onDisplayNameChange(event.target.value)}
      />
      <Text as="p" className="text-sm text-muted-foreground">
        New customers register once, then come back with a single passkey tap.
      </Text>
    </div>
  );
}

function PasskeyActions(
  inputProps: Pick<PasskeyGateCardProps, "isPending" | "onCreateAccount" | "onSignIn">,
) {
  const { isPending, onCreateAccount, onSignIn } = inputProps;

  return (
    <div className="flex flex-wrap gap-3">
      <Button disabled={isPending} onClick={() => void onCreateAccount()}>
        Create account with passkey
      </Button>
      <Button disabled={isPending} variant="outline" onClick={() => void onSignIn()}>
        Sign in with passkey
      </Button>
    </div>
  );
}

function PendingPasskeyNotice({
  isPending,
  pendingAction,
}: Pick<PasskeyGateCardProps, "isPending" | "pendingAction">) {
  return isPending ? (
    <Alert className="border-border bg-background" status="info">
      <Alert.Title>{getPendingLabel(pendingAction)}</Alert.Title>
      <Alert.Description>Use your device’s passkey prompt to continue.</Alert.Description>
    </Alert>
  ) : null;
}

function PasskeyError({ errorMessage }: Pick<PasskeyGateCardProps, "errorMessage">) {
  return errorMessage !== null ? (
    <Alert status="warning">
      <Alert.Title>Could not complete passkey flow</Alert.Title>
      <Alert.Description>{errorMessage}</Alert.Description>
    </Alert>
  ) : null;
}

export function PasskeyGateCard(inputProps: PasskeyGateCardProps) {
  const {
    displayName,
    description,
    errorMessage,
    isPending,
    pendingAction,
    title,
    onCreateAccount,
    onDisplayNameChange,
    onSignIn,
  } = inputProps;

  return (
    <Card className="w-full">
      <Card.Header className="border-b border-border">
        <Text as="h3">{title}</Text>
        <Text as="p" className="text-sm text-muted-foreground">
          {description}
        </Text>
      </Card.Header>
      <Card.Content className="grid gap-5">
        <PasskeyNameField
          displayName={displayName}
          isPending={isPending}
          onDisplayNameChange={onDisplayNameChange}
        />
        <PasskeyActions
          isPending={isPending}
          onCreateAccount={onCreateAccount}
          onSignIn={onSignIn}
        />
        <PendingPasskeyNotice isPending={isPending} pendingAction={pendingAction} />
        <PasskeyError errorMessage={errorMessage} />
      </Card.Content>
    </Card>
  );
}
