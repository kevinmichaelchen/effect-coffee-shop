package no_classic_for_loop

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoClassicForLoop(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoClassicForLoopRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		Code: `
const values = [1, 2, 3];
for (const value of values) {
	console.log(value);
}
		`,
	},
	{
		Code: `
const walk = (index: number): number =>
	index >= 3 ? index : walk(index + 1);
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		Code: `
for (let index = 0; index < 3; index += 1) {
	console.log(index);
}
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "noClassicForLoop"},
		},
	},
}
