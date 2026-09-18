import effect from "@mpsuesser/oxlint-plugin-effect";
import policy from "./.oxlintrc.json";

export default {
  extends: [effect.configs.recommended],
  ...policy,
  rules: {
    ...policy.rules,
    // AGENTS.md prefers Effect.promise unless a rejection is a typed domain error.
    "effect/effect-promise-vs-trypromise": "off",
  },
};
