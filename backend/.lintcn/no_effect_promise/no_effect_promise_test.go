package no_effect_promise

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoEffectPromise(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoEffectPromiseRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		Code: `
declare const Effect: { tryPromise(fn: () => Promise<unknown>): unknown };
Effect.tryPromise(() => Promise.resolve());
		`,
	},
	{
		Code: `
declare const Fx: { promise(fn: () => Promise<unknown>): unknown };
Fx.promise(() => Promise.resolve());
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		Code: `
declare const Effect: { promise(fn: () => Promise<unknown>): unknown };
Effect.promise(() => Promise.resolve());
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "preferTryPromise"},
		},
	},
}
