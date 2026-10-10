import { Schema as AuthSchema } from "@yielded/auth";
import { AuthPersistence } from "@yielded/auth-persistence";
import { storageTables, type StorageTable } from "@yielded/auth-persistence/Adapter";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import { authenticationRequirement, CoffeeAuth } from "../auth.ts";

const textColumn = (name: string) =>
  ({ name, type: "text" }) satisfies StorageTable["columns"][string];

export const subjects = AuthPersistence.table({
  name: "coffee_auth_subjects",
  columns: {
    id: textColumn("id"),
    active: { name: "active", type: "boolean" },
    securityRevision: textColumn("security_revision"),
    displayName: textColumn("display_name"),
  },
  unique: [["id"]],
});

const passkeyFlows = AuthPersistence.table({
  name: "coffee_auth_passkey_flows",
  columns: {
    ...R.map(storageTables.passkeyFlows.columns, (column, key) => ({
      ...column,
      name: key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    })),
    applicationSnapshot: { ...textColumn("application_snapshot"), nullable: true },
  },
  unique: storageTables.passkeyFlows.unique,
});

const Persistence = AuthPersistence.make(CoffeeAuth);
export const storage = Persistence.managed({
  prefix: "coffee_auth",
  subjects: {
    table: subjects,
    id: "id",
    status: "active",
    activeValue: true,
    securityRevision: "securityRevision",
    idCodec: AuthSchema.SubjectId,
    requirements: () => Effect.succeed(authenticationRequirement),
  },
  tables: { passkeyFlows },
});
