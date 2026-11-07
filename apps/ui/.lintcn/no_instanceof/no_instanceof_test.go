package no_instanceof

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoInstanceof(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoInstanceofRule,
		[]rule_tester.ValidTestCase{
			{Code: `declare const value: { readonly _tag: "A" } | { readonly _tag: "B" }; const isA = value._tag === "A";`},
			{Code: `const instanceofLabel = "instanceof";`},
		},
		[]rule_tester.InvalidTestCase{
			{
				Code:   `declare const cause: unknown; const isError = cause instanceof Error;`,
				Errors: []rule_tester.InvalidTestCaseError{{MessageId: "noInstanceof"}},
			},
		},
	)
}
