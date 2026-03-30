package no_process_env

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoProcessEnv(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoProcessEnvRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		Code: `
declare const Config: { string(name: string): unknown };
Config.string("PORT");
		`,
	},
	{
		Code: `
declare const runtime: { env: Record<string, string | undefined> };
runtime.env.PORT;
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		Code: `
process.env.PORT;
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "preferEffectConfig"},
		},
	},
	{
		Code: `
const port = process.env["PORT"];
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "preferEffectConfig"},
		},
	},
}
