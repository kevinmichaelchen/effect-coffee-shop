import { definePlugin, defineRule, type Context, type ESTree, type Visitor } from "@oxlint/plugins";

// House rules that no published Oxlint plugin covers. They are syntactic, so
// they run in Oxlint's JS plugin host next to the Effect style plugin. Both
// profiles in `oxlint.profiles.ts` load this file as the `house` plugin.

const none: Visitor = {};

const isIgnoredPath = (filename: string): boolean =>
  filename.includes("/vendor/") || filename.includes("/node_modules/");

const isTestPath = (filename: string): boolean =>
  filename.includes("/test/") || filename.endsWith(".test.ts") || filename.endsWith(".spec.ts");

const importsEffect = /["']effect["'/]/u;

// Effect style rules apply to production files that import from `effect`.
const isEffectFile = (context: Context): boolean =>
  !isIgnoredPath(context.filename) &&
  !isTestPath(context.filename) &&
  importsEffect.test(context.sourceCode.text);

const inEffectFiles = (context: Context, listeners: Visitor): Visitor =>
  isEffectFile(context) ? listeners : none;

const inPaths = (context: Context, paths: ReadonlyArray<string>, listeners: Visitor): Visitor =>
  !isIgnoredPath(context.filename) && paths.some((path) => context.filename.includes(path))
    ? listeners
    : none;

const isNamed = (node: ESTree.Node | null | undefined, name: string): boolean =>
  node?.type === "Identifier" && node.name === name;

// `Object.property(...)`, or any `Object.*(...)` when `property` is omitted.
const isMemberCall = (
  node: ESTree.Node | null | undefined,
  objectName: string,
  property?: string,
): node is ESTree.CallExpression =>
  node?.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  isNamed(node.callee.object, objectName) &&
  (property === undefined || isNamed(node.callee.property, property));

const isEffectCall = (node: ESTree.Node): boolean => isMemberCall(node, "Effect");

const isMethodPipeCall = (node: ESTree.Node): boolean =>
  node.type === "CallExpression" &&
  node.callee.type === "MemberExpression" &&
  !node.callee.computed &&
  isNamed(node.callee.property, "pipe");

const hasAncestor = (node: ESTree.Node, matches: (ancestor: ESTree.Node) => boolean): boolean => {
  const parent: ESTree.Node | null = node.parent;
  return parent !== null && (matches(parent) || hasAncestor(parent, matches));
};

const isConstDeclarator = (node: ESTree.VariableDeclarator): boolean =>
  node.parent.type === "VariableDeclaration" && node.parent.kind === "const";

const boundaryContractSuffixes = [
  "Request",
  "RequestSchema",
  "Response",
  "ResponseSchema",
  "Query",
  "QuerySchema",
  "Payload",
  "PayloadSchema",
];

const isBoundaryContractName = (name: string): boolean =>
  /^\p{Lu}/u.test(name) && boundaryContractSuffixes.some((suffix) => name.endsWith(suffix));

const sentinelNameParts = ["status", "state", "phase", "mode", "kind", "tag"];

const snakeCaseToolId = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/u;

const isStringLiteral = (node: ESTree.Node | null | undefined): node is ESTree.StringLiteral =>
  node?.type === "Literal" && typeof node.value === "string";

// The literal text of a string or substitution-free template, if it is one.
const staticString = (node: ESTree.Node): string | undefined =>
  isStringLiteral(node)
    ? node.value
    : node.type === "TemplateLiteral" && node.quasis.length === 1
      ? (node.quasis[0]?.value.cooked ?? undefined)
      : undefined;

const noInOperator = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow the `in` operator." },
    messages: {
      inOperator:
        "The `in` operator probes for a key instead of establishing a contract. Decode with Schema at the boundary or narrow on a discriminant such as `_tag`.",
    },
  },
  create: (context) => ({
    BinaryExpression: (node) => {
      if (node.operator === "in") context.report({ node, messageId: "inOperator" });
    },
  }),
});

const noInstanceof = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow `instanceof`." },
    messages: {
      noInstanceof:
        "`instanceof` probes a prototype instead of establishing a contract, and fails across realms (workers, iframes, duplicated packages). Decode at the boundary with Schema (Schema.instanceOf for host classes, a Struct for error-like values) or narrow on a `_tag` discriminant.",
    },
  },
  create: (context) => ({
    BinaryExpression: (node) => {
      if (node.operator === "instanceof") context.report({ node, messageId: "noInstanceof" });
    },
  }),
});

const noClassicForLoop = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow classic C-style `for (...)` loops." },
    messages: {
      noClassicForLoop:
        "Avoid classic `for (...)` loops. Prefer recursion, `for...of`, or collection helpers so iteration stays explicit and less mutation-heavy.",
    },
  },
  // Numeric kernels (`*.kernel.ts`) are not application code: indexed loops
  // over typed arrays are the algorithm, and the alternatives are 2-12x slower.
  create: (context) =>
    context.filename.endsWith(".kernel.ts")
      ? none
      : {
          ForStatement: (node) => {
            context.report({ node, messageId: "noClassicForLoop" });
          },
        },
});

const mcpToolNameSnakeCase = defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require MCP tool ids passed to Tool.make(...) to be snake_case literals.",
    },
    messages: {
      toolNameLiteral:
        'MCP tool ids passed to Tool.make(...) must be string literals. Use a literal snake_case wire id such as "place_order" so the protocol name stays stable for clients and agents.',
      toolNameSnakeCase:
        'MCP tool id "{{id}}" should be snake_case. Use lowercase words joined with underscores, for example "place_order" or "list_orders".',
    },
  },
  create: (context) => ({
    CallExpression: (node) => {
      const [first] = node.arguments;
      if (!isMemberCall(node, "Tool", "make") || first === undefined) return;
      const id = staticString(first);
      if (id === undefined) context.report({ node: first, messageId: "toolNameLiteral" });
      else if (!snakeCaseToolId.test(id))
        context.report({ node: first, messageId: "toolNameSnakeCase", data: { id } });
    },
  }),
});

const noBoundaryContractsInDomain = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Keep request and response contracts out of the domain layer." },
    messages: {
      moveBoundaryContractOutOfDomain:
        "Domain files must not declare transport boundary contracts. Move request, response, query, and payload contracts into packages/coffee/application/src/contracts.ts or a presentation boundary module so the domain stays focused on validated business types.",
    },
  },
  create: (context) => {
    const check = (node: ESTree.Node, id: ESTree.Node | null): void => {
      if (id?.type === "Identifier" && isBoundaryContractName(id.name))
        context.report({ node, messageId: "moveBoundaryContractOutOfDomain" });
    };
    return inPaths(context, ["packages/coffee/domain/src/"], {
      VariableDeclarator: (node) => check(node, node.id),
      TSTypeAliasDeclaration: (node) => check(node, node.id),
      TSInterfaceDeclaration: (node) => check(node, node.id),
      ClassDeclaration: (node) => check(node, node.id),
      FunctionDeclaration: (node) => check(node, node.id),
    });
  },
});

const noNewDateInCore = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Core application and domain code uses effect/DateTime, not `new Date`." },
    messages: {
      noNewDateInCore:
        "Use effect/DateTime in core application and domain code instead of constructing Date directly. Prefer DateTime.now, DateTime.add, DateTime.make, or an adapter boundary that converts to Date explicitly.",
    },
  },
  create: (context) =>
    isTestPath(context.filename)
      ? none
      : inPaths(context, ["packages/coffee/application/src/", "packages/coffee/domain/src/"], {
          NewExpression: (node) => {
            if (isNamed(node.callee, "Date"))
              context.report({ node, messageId: "noNewDateInCore" });
          },
        }),
});

const noEffectCallInEffectArg = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow Effect calls nested as arguments of Effect calls." },
    messages: {
      noEffectCallInEffectArg:
        "Avoid Effect calls nested as arguments (Effect.xx(Effect.yy(...))): they hide sequencing. Build the inner Effect first, then use pipe/Effect.flatMap/Effect.andThen to keep a single flat pipeline.",
    },
  },
  create: (context) =>
    inEffectFiles(context, {
      CallExpression: (node) => {
        if (isEffectCall(node) && node.arguments.some((argument) => isEffectCall(argument)))
          context.report({ node, messageId: "noEffectCallInEffectArg" });
      },
    }),
});

const noInlineRuntimeProvide = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow Effect.provide inside a yielded pipe chain." },
    messages: {
      noInlineRuntimeProvide:
        "Do not inline runtime provisioning inside local helper Effect code: inline provide chains hide dependency assembly. Provide the dependency once at the owning boundary, then yield the runtime or service directly.",
    },
  },
  create: (context) =>
    inEffectFiles(context, {
      CallExpression: (node) => {
        const inline =
          isMemberCall(node, "Effect", "provide") &&
          node.arguments.length === 1 &&
          hasAncestor(node, (parent) => parent.type === "YieldExpression" && parent.delegate) &&
          hasAncestor(node, isMethodPipeCall);
        if (inline) context.report({ node, messageId: "noInlineRuntimeProvide" });
      },
    }),
});

const noModelOverlayCast = defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow `const x = value as T` overlays." },
    messages: {
      noModelOverlayCast:
        "Avoid `as` assertions on decoded model flow: assertions hide schema drift and allow untyped overlays. Decode with the correct schema type and read fields directly.",
    },
  },
  create: (context) =>
    inEffectFiles(context, {
      VariableDeclarator: (node) => {
        const init = node.init;
        const overlays =
          init?.type === "TSAsExpression" &&
          context.sourceCode.getText(init.typeAnnotation) !== "const";
        if (isConstDeclarator(node) && overlays)
          context.report({ node, messageId: "noModelOverlayCast" });
      },
    }),
});

const noNestedEffectGen = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow Effect.gen nested inside Effect.gen." },
    messages: {
      noNestedEffectGen:
        "Avoid nested Effect.gen: nested generators hide sequencing. Flatten to a single Effect.gen per method or a single flat pipeline.",
    },
  },
  create: (context) =>
    inEffectFiles(context, {
      CallExpression: (node) => {
        const nested =
          isMemberCall(node, "Effect", "gen") &&
          hasAncestor(node, (parent) => isMemberCall(parent, "Effect", "gen"));
        if (nested) context.report({ node, messageId: "noNestedEffectGen" });
      },
    }),
});

const noStringSentinelConst = defineRule({
  meta: {
    type: "suggestion",
    docs: { description: "Disallow string constants named like a status, state, mode or tag." },
    messages: {
      noStringSentinelConst:
        "Avoid string status constants: they encode control flow and force defensive branching. Use tagged unions, Option/Either, or meaningful domain values instead of string tokens.",
    },
  },
  create: (context) =>
    inEffectFiles(context, {
      VariableDeclarator: (node) => {
        const name = node.id.type === "Identifier" ? node.id.name.toLowerCase() : "";
        const sentinel =
          isStringLiteral(node.init) && sentinelNameParts.some((part) => name.includes(part));
        if (isConstDeclarator(node) && sentinel)
          context.report({ node, messageId: "noStringSentinelConst" });
      },
    }),
});

export const rules = {
  "mcp-tool-name-snake-case": mcpToolNameSnakeCase,
  "no-boundary-contracts-in-domain": noBoundaryContractsInDomain,
  "no-classic-for-loop": noClassicForLoop,
  "no-effect-call-in-effect-arg": noEffectCallInEffectArg,
  "no-in-operator": noInOperator,
  "no-inline-runtime-provide": noInlineRuntimeProvide,
  "no-instanceof": noInstanceof,
  "no-model-overlay-cast": noModelOverlayCast,
  "no-nested-effect-gen": noNestedEffectGen,
  "no-new-date-in-core": noNewDateInCore,
  "no-string-sentinel-const": noStringSentinelConst,
};

export default definePlugin({ meta: { name: "house" }, rules });
