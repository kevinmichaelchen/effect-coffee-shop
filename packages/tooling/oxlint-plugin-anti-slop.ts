import { eslintCompatPlugin } from "@oxlint/plugins";
import { preferTaggedErrorHandlingRule } from "./vendor/anti-slop/src/effect/rules/prefer-tagged-error-handling.ts";
import { maxTernaryDepthRule } from "./vendor/anti-slop/src/rules/max-ternary-depth.ts";
import { noReprovideAmbientServiceRule } from "./vendor/anti-slop/src/rules/no-reprovide-ambient-service.ts";

// Rules vendored unmodified from k-mistele/anti-slop (see vendor/anti-slop/upstream.json).
// The rest of anti-slop reaches us through @mpsuesser/oxlint-plugin-effect.
export default eslintCompatPlugin({
  meta: { name: "anti-slop" },
  rules: {
    "max-ternary-depth": maxTernaryDepthRule,
    "no-reprovide-ambient-service": noReprovideAmbientServiceRule,
    "prefer-tagged-error-handling": preferTaggedErrorHandlingRule,
  },
});
