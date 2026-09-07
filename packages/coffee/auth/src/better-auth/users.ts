import * as Schema from "effect/Schema";

const syntheticEmailDomain = "users.coffee.invalid";

export const provisionalUserPrefix = "passkey-signup-";

const PasskeyRegistrationContext = Schema.Struct({
  displayName: Schema.String,
});
const DisplayName = Schema.Trim.check(
  Schema.isNonEmpty({ message: "displayName must not be blank" }),
);

const decodeJsonString = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const decodePasskeyRegistrationContext = Schema.decodeUnknownSync(PasskeyRegistrationContext);
const decodeDisplayName = Schema.decodeUnknownSync(DisplayName);

// oxlint-disable-next-line effect/prefer-option-over-null -- Better Auth SDK represents absent secrets and registration context with nullish values.
export function getDisplayName(context: string | null | undefined): string {
  const parsed = decodePasskeyRegistrationContext(
    decodeJsonString(context ?? '{"displayName":""}'),
  );
  return decodeDisplayName(parsed.displayName);
}

function createSyntheticEmail(userId: string): string {
  return `${userId}@${syntheticEmailDomain}`;
}

export function createProvisionalUser(displayName: string) {
  const userId = `${provisionalUserPrefix}${crypto.randomUUID()}`;
  return {
    displayName,
    id: userId,
    name: displayName,
  };
}

export function createRegisteredUser(input: {
  // oxlint-disable-next-line effect/prefer-option-over-null -- Better Auth SDK represents absent secrets and registration context with nullish values.
  readonly context: string | null | undefined;
  readonly userId: string;
}) {
  return {
    email: createSyntheticEmail(input.userId),
    id: input.userId,
    name: getDisplayName(input.context),
  };
}
