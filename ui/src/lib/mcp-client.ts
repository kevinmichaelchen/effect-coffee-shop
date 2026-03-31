const protocolVersion = "2025-06-18";

interface JsonRpcError {
  readonly code: number;
  readonly message: string;
}

interface JsonRpcSuccess<Result> {
  readonly result: Result;
}

interface JsonRpcFailure {
  readonly error: JsonRpcError;
}

interface McpInitializeResult {
  readonly protocolVersion: string;
}

interface McpToolsResult {
  readonly tools: readonly McpToolDefinition[];
}

interface McpTextContent {
  readonly text?: string;
  readonly type?: string;
}

export interface McpToolDefinition {
  readonly description?: string;
  readonly inputSchema?: unknown;
  readonly name: string;
}

export interface McpToolCallResult {
  readonly content?: readonly McpTextContent[];
  readonly isError?: boolean;
  readonly structuredContent?: unknown;
}

export interface PromptToolDefinition {
  readonly description: string;
  readonly name: string;
  readonly parameters: unknown;
}

export class CoffeeMcpClient {
  private readonly endpoint: string;
  private requestId = 1;
  private sessionId: string | null = null;
  private toolCache: readonly PromptToolDefinition[] | null = null;

  constructor(endpoint = "/mcp") {
    this.endpoint = endpoint;
  }

  async getPromptTools(): Promise<readonly PromptToolDefinition[]> {
    if (this.toolCache !== null) {
      return this.toolCache;
    }

    await this.initialize();
    const result = await this.request<McpToolsResult>("tools/list");
    this.toolCache = result.tools.map(toPromptTool);
    return this.toolCache;
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<McpToolCallResult> {
    await this.initialize();
    return this.request<McpToolCallResult>("tools/call", {
      arguments: compactToolArguments(arguments_),
      name,
    });
  }

  private async initialize(): Promise<void> {
    if (this.sessionId !== null) {
      return;
    }

    const result = await this.request<McpInitializeResult>("initialize", {
      capabilities: {},
      clientInfo: {
        name: "onion-ui",
        version: "0.1.0",
      },
      protocolVersion,
    });

    if (result.protocolVersion !== protocolVersion) {
      throw new Error(`Unsupported MCP protocol version: ${result.protocolVersion}`);
    }
  }

  private async request<Result>(method: string, params?: unknown): Promise<Result> {
    const response = await fetch(this.endpoint, {
      body: JSON.stringify({
        id: this.requestId++,
        jsonrpc: "2.0",
        method,
        params,
      }),
      headers: this.makeHeaders(),
      method: "POST",
    });

    this.sessionId = response.headers.get("Mcp-Session-Id") ?? this.sessionId;
    const payload = (await response.json()) as JsonRpcFailure | JsonRpcSuccess<Result>;
    if ("error" in payload) {
      throw new Error(payload.error.message);
    }

    return payload.result;
  }

  private makeHeaders(): Headers {
    const headers = new Headers({
      "content-type": "application/json",
    });

    if (this.sessionId !== null) {
      headers.set("Mcp-Session-Id", this.sessionId);
    }

    return headers;
  }
}

function toPromptTool(tool: McpToolDefinition): PromptToolDefinition {
  return {
    description: tool.description ?? "No description provided.",
    name: tool.name,
    parameters: tool.inputSchema ?? {},
  };
}

function compactToolArguments(arguments_: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(arguments_).filter(([, value]) => value !== null && value !== undefined),
  );
}
