package linteffect

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
)

func TestNoIfStatementRuleCoversApplicationEffectFiles(t *testing.T) {
	runLintEffectRuleTester(t, &NoIfStatementRule,
		[]rule_tester.ValidTestCase{
			{
				FileName: "src/presentation/http/api.test.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("ignored test file");
}
        `,
			},
			{
				FileName: "test/contracts/repository-contract.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("ignored test directory");
}
        `,
			},
			{
				FileName: "src/vendor/generated.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("ignored vendor file");
}
        `,
			},
		},
		[]rule_tester.InvalidTestCase{
			{
				FileName: "src/presentation/http/api.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("presentation code is linted");
}
        `,
				Errors: []rule_tester.InvalidTestCaseError{
					{MessageId: "noIfStatement"},
				},
			},
			{
				FileName: "src/external/sql/repository.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("external code is linted");
}
        `,
				Errors: []rule_tester.InvalidTestCaseError{
					{MessageId: "noIfStatement"},
				},
			},
			{
				FileName: "src/application/use-cases/placeOrder.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("use case code is linted");
}
        `,
				Errors: []rule_tester.InvalidTestCaseError{
					{MessageId: "noIfStatement"},
				},
			},
			{
				FileName: "src/application/CoffeeOrderApp.ts",
				Code: `
"effect";
declare const ready: boolean;
if (ready) {
  console.log("application app code is linted");
}
        `,
				Errors: []rule_tester.InvalidTestCaseError{
					{MessageId: "noIfStatement"},
				},
			},
		},
	)
}

func TestNoManualEffectChannelsRuleCoversApplicationEffectFiles(t *testing.T) {
	runLintEffectRuleTester(t, &NoManualEffectChannelsRule,
		[]rule_tester.ValidTestCase{
			{
				FileName: "src/presentation/http/api.test.ts",
				Code: `
"effect";
type Ignored = Effect.Effect<string>;
        `,
			},
		},
		[]rule_tester.InvalidTestCase{
			{
				FileName: "src/presentation/assistant/handler.ts",
				Code: `
"effect";
type CoffeeAppRunner = <A, E>(effect: Effect.Effect<A, E, CoffeeOrderApp>) => Promise<A>;
        `,
				Errors: []rule_tester.InvalidTestCaseError{
					{MessageId: "noManualEffectChannels"},
				},
			},
		},
	)
}
