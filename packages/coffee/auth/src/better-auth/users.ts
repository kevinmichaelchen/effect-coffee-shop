import * as Schema from "effect/Schema";

const syntheticEmailDomain = "users.coffee.invalid";

export const provisionalUserPrefix = "passkey-signup-";

const PasskeyRegistrationContextSchema = Schema.Struct({
  displayName: Schema.String,
});
const DisplayNameSchema = Schema.Trim.check(
  Schema.isNonEmpty({ message: "displayName must not be blank" }),
);

const decodeJsonString = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown));
const decodePasskeyRegistrationShape = Schema.decodeUnknownSync(PasskeyRegistrationContextSchema);
const decodeDisplayName = Schema.decodeUnknownSync(DisplayNameSchema);

export function getDisplayName(context: string | null | undefined): string {
  const parsed = decodePasskeyRegistrationShape(decodeJsonString(context ?? '{"displayName":""}'));
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
  readonly context: string | null | undefined;
  readonly userId: string;
}) {
  return {
    email: createSyntheticEmail(input.userId),
    id: input.userId,
    name: getDisplayName(input.context),
  };
}
