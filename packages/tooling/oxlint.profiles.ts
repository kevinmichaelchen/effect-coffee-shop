import effectStyle from "@mpsuesser/oxlint-plugin-effect";
import { strict as effectTsgo } from "@effect/tsgo/oxlint-presets";
import { defineConfig, type OxlintConfig } from "oxlint";

// Shared Oxlint policy. Run it through `effect-tsgo --tsrs-lint oxlint`, which
// hosts the Effect language-service rules (`effecttsgo/*`) on tsrs types.
//
// File and function size are deliberately not linted: deep modules are
// preferred over many small files. Fallow health watches complexity instead,
// and Fallow boundaries own every import rule between and out of zones.

const testFiles = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/test/**/*.ts",
  "**/testing/**/*.ts",
  "**/test-support.ts",
];

// Local rules for AGENTS.md bans that no published plugin covers.
const house = { name: "house", specifier: "./oxlint-plugin-house.ts" };

const shared = defineConfig({
  extends: [effectTsgo],
  plugins: ["oxc", "typescript", "unicorn", "import", "promise", "node", "vitest"],
  categories: {
    correctness: "error",
    suspicious: "error",
    perf: "error",
  },
  options: {
    typeAware: true,
    typeCheck: true,
    maxWarnings: 0,
    reportUnusedDisableDirectives: "error",
  },
  ignorePatterns: ["dist/**"],
  rules: {
    // Unsafe TypeScript escape hatches.
    "typescript/no-explicit-any": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/no-unsafe-type-assertion": "error",
    "typescript/no-unnecessary-type-assertion": "error",
    "typescript/no-non-null-assertion": "error",
    "typescript/no-generated-empty-object-type": "error",

    // Control flow the type checker can prove.
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/no-unnecessary-condition": "error",
    "typescript/strict-boolean-expressions": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/promise-function-async": "error",
    "typescript/restrict-template-expressions": "error",

    // Imports stay explicit under verbatimModuleSyntax.
    "typescript/consistent-type-imports": "error",
    "typescript/no-import-type-side-effects": "error",

    // Opt-in Effect rules beyond the strict preset. Library-publishing rules
    // (api-stability-leak, missing-pipeable-signature) and native-helper
    // preferences (prefer-effect-array/string/record) stay off.
    "effecttsgo/deterministic-keys": "error",
    "effecttsgo/effect-do-notation": "error",
    "effecttsgo/extends-native-error": "error",
    "effecttsgo/global-console-in-effect": "error",
    "effecttsgo/global-date-in-effect": "error",
    "effecttsgo/global-fetch-in-effect": "error",
    "effecttsgo/global-random-in-effect": "error",
    "effecttsgo/global-timers-in-effect": "error",
    "effecttsgo/crypto-random-uuid-in-effect": "error",
    "effecttsgo/process-env-in-effect": "error",
    "effecttsgo/instance-of-schema": "error",
    "effecttsgo/missing-effect-service-dependency": "error",
    "effecttsgo/nested-effect-gen-yield": "error",
    "effecttsgo/new-promise": "error",
    "effecttsgo/prefer-schema-over-json": "error",
    "effecttsgo/prefer-schema-tagged-error": "error",
    "effecttsgo/prefer-schema-type-property": "error",
    "effecttsgo/schema-union-of-literals": "error",
    "effecttsgo/service-not-as-class": "error",
    "effecttsgo/unnecessary-arrow-block": "error",
    "effecttsgo/unsafe-effect-type-assertion": "error",
    "effecttsgo/effect-try-without-catch": "error",
    "effecttsgo/type-union-to-schema-union": "error",
    "effecttsgo/map-map-error-to-map-both": "error",
    "effecttsgo/provide-merge-all-to-array": "error",

    // AGENTS.md: no `in`, `instanceof` or classic `for (...)` loops.
    "house/no-in-operator": "error",
    "house/no-instanceof": "error",
    "house/no-classic-for-loop": "error",

    // AGENTS.md: no imperative bit-twiddling or counters.
    "no-bitwise": "error",
    "no-plusplus": "error",
    "no-param-reassign": "error",
    "no-var": "error",
    "prefer-const": "error",
    eqeqeq: "error",

    // Effect and Foldkit idioms that these suspicious rules misread.
    // `_tag` discriminants, and Elm-style `message`/`model` re-binding.
    "no-underscore-dangle": "off",
    "no-shadow": "off",
    // Conflicts with Effect's `return yield* new Err()` guard idiom.
    "typescript/consistent-return": "off",

    "vitest/no-focused-tests": "error",
    "vitest/expect-expect": "off",
    "vitest/no-standalone-expect": [
      "error",
      {
        additionalTestBlockFunctions: [
          "it.effect",
          "it.live",
          "it.scoped",
          "it.scopedLive",
          "test",
        ],
      },
    ],
  },
  overrides: [
    {
      files: testFiles,
      rules: {
        // Tests and test adapters are their own composition roots.
        "effecttsgo/strict-effect-provide": "off",
        "no-restricted-properties": [
          "error",
          {
            property: "only",
            message: "Focused tests must not be committed, including Effect test wrappers.",
          },
        ],
      },
    },
  ],
});

// Backend packages additionally enforce the house Effect style from AGENTS.md
// (no try/catch, no imperative loops, Effect services over globals, ...).
export const backend: OxlintConfig = {
  ...shared,
  extends: [...shared.extends, effectStyle.configs.recommended],
  jsPlugins: [...effectStyle.configs.recommended.jsPlugins, house],
  rules: {
    ...shared.rules,
    "house/mcp-tool-name-snake-case": "error",
    "house/no-boundary-contracts-in-domain": "error",
    "house/no-new-date-in-core": "error",
    "house/no-effect-call-in-effect-arg": "error",
    "house/no-inline-runtime-provide": "error",
    "house/no-model-overlay-cast": "error",
    "house/no-nested-effect-gen": "error",
    "house/no-string-sentinel-const": "error",
    // AGENTS.md prefers Effect.promise unless a rejection is a typed domain error.
    "effect/effect-promise-vs-trypromise": "off",
  },
  overrides: [
    ...shared.overrides,
    {
      files: testFiles,
      rules: {
        "effect/avoid-process-env": "off",
      },
    },
    {
      // The plugin adapts Oxlint's ESTree, whose fields are nullable and
      // whose literals are discriminated by `typeof`.
      files: ["**/oxlint-plugin-house.ts"],
      rules: {
        "effect/prefer-option-over-null": "off",
        "effect/prefer-effect-is": "off",
        "effect/no-runtime-typeof": "off",
      },
    },
    {
      // The Effect pipeline-shape rules cover the coffee packages and
      // http-routing; the cache service and infra programs are exempt.
      files: ["**/turbo-cache/**", "**/infra/**"],
      rules: {
        "house/no-inline-runtime-provide": "off",
        "house/no-nested-effect-gen": "off",
      },
    },
  ],
};

// UI packages focus on boundary safety and unsafe TypeScript escape hatches.
// They take only the type-assertion rules of the Effect style plugin (the ones
// it adopted from dmmulroy/anti-slop), not its backend service preferences.
// Its `unknown`-contract rules (no-unknown-parameters/returns,
// no-unsafe-dictionary-type, no-runtime-typeof) stay backend-only: in the UI
// they fire only on the worker and model-output decoders, where `unknown`
// input is the boundary. no-module-mocking stays off until the Foldkit tests
// stop using `vi.mock`.
export const ui: OxlintConfig = {
  ...shared,
  jsPlugins: [...effectStyle.configs.recommended.jsPlugins, house],
  rules: {
    ...shared.rules,
    "effect/no-chained-type-assertions": "error",
    "effect/no-known-value-widening": "error",
    "effect/no-reflect-apply": "error",
    "effect/no-reflect-get": "error",
    "effect/no-widen-then-assert": "error",
    "effect/require-safety-comment-for-type-assertion": "error",
    // Shipped UI code logs through Effect or not at all; scripts may print.
    "no-console": "error",
    // Stylesheets and polyfills are imported for their side effects.
    "import/no-unassigned-import": ["error", { allow: ["**/*.css"] }],
  },
  overrides: [
    ...shared.overrides,
    {
      // Local verification scripts report to the terminal.
      files: ["**/scripts/**"],
      rules: { "no-console": "off" },
    },
  ],
};
