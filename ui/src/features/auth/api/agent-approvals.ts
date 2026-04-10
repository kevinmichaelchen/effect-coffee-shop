import * as Schema from "effect/Schema";

const AgentApprovalErrorSchema = Schema.Struct({
  error: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
}).annotate({ identifier: "AgentApprovalError" });

const PendingAgentApprovalSchema = Schema.Struct({
  agent_id: Schema.Union([Schema.String, Schema.Null]),
  agent_name: Schema.Union([Schema.String, Schema.Null]),
  approval_id: Schema.String,
  binding_message: Schema.Union([Schema.String, Schema.Null]),
  capabilities: Schema.Array(Schema.String),
  created_at: Schema.String,
  expires_in: Schema.Number,
  method: Schema.String,
}).annotate({ identifier: "PendingAgentApproval" });

const PendingAgentApprovalsSchema = Schema.Struct({
  requests: Schema.Array(PendingAgentApprovalSchema),
}).annotate({ identifier: "PendingAgentApprovals" });

const AgentApprovalResolutionSchema = Schema.Struct({
  status: Schema.Literals(["approved", "denied"] as const),
}).annotate({ identifier: "AgentApprovalResolution" });

type AgentApprovalError = typeof AgentApprovalErrorSchema.Type;
export type PendingAgentApproval = typeof PendingAgentApprovalSchema.Type;
type AgentApprovalResolution = typeof AgentApprovalResolutionSchema.Type;

async function readJson<S extends Schema.Decoder<unknown>>(
  response: Response,
  schema: S,
): Promise<S["Type"]> {
  const value = Schema.decodeUnknownSync(Schema.UnknownFromJsonString)(await response.text());
  return Schema.decodeUnknownPromise(schema)(value);
}

function readApprovalErrorMessage(error: AgentApprovalError): string {
  return error.message ?? error.error ?? "Agent approval request failed.";
}

async function throwApprovalError(response: Response): Promise<never> {
  const fallback = `${response.status} ${response.statusText}`;
  const message = await readJson(response, AgentApprovalErrorSchema)
    .then(readApprovalErrorMessage)
    .catch(() => fallback);

  throw new Error(message);
}

async function request<S extends Schema.Decoder<unknown>>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<S["Type"]> {
  const response = await fetch(path, init);

  if (!response.ok) {
    return throwApprovalError(response);
  }

  return readJson(response, schema);
}

export async function fetchPendingAgentApprovals(): Promise<readonly PendingAgentApproval[]> {
  const result = await request("/api/auth/agent/ciba/pending", PendingAgentApprovalsSchema);
  return result.requests;
}

export async function resolveAgentApproval(input: {
  readonly action: "approve" | "deny";
  readonly agentId: string;
  readonly userCode: string;
}): Promise<AgentApprovalResolution> {
  return request("/api/auth/agent/approve-capability", AgentApprovalResolutionSchema, {
    body: JSON.stringify({
      action: input.action,
      agent_id: input.agentId,
      user_code: input.userCode,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}
