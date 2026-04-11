import * as Schema from "effect/Schema";
import { requestJson } from "#shared/lib/http.ts";

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

function readApprovalErrorMessage(error: AgentApprovalError): string {
  return error.message ?? error.error ?? "Agent approval request failed.";
}

export async function fetchPendingAgentApprovals(): Promise<readonly PendingAgentApproval[]> {
  const result = await requestJson({
    errorSchema: AgentApprovalErrorSchema,
    path: "/api/auth/agent/ciba/pending",
    readErrorMessage: readApprovalErrorMessage,
    schema: PendingAgentApprovalsSchema,
  });
  return result.requests;
}

export async function resolveAgentApproval(input: {
  readonly action: "approve" | "deny";
  readonly agentId: string;
  readonly userCode: string;
}): Promise<AgentApprovalResolution> {
  return requestJson({
    errorSchema: AgentApprovalErrorSchema,
    init: {
      body: JSON.stringify({
        action: input.action,
        agent_id: input.agentId,
        user_code: input.userCode,
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    },
    path: "/api/auth/agent/approve-capability",
    readErrorMessage: readApprovalErrorMessage,
    schema: AgentApprovalResolutionSchema,
  });
}
