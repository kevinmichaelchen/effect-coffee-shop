package no_new_date_in_core

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoNewDateInCore(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoNewDateInCoreRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		FileName: "packages/coffee/core/src/application/use-cases/checkoutSession.ts",
		Code: `
const expiresAt = DateTime.add(now, { minutes: 15 });
		`,
	},
	{
		FileName: "packages/coffee/core/src/application/use-cases/checkoutSession.test.ts",
		Code: `
const now = new Date();
		`,
	},
	{
		FileName: "apps/ui/src/features/coffee-shop/lib/coffee.ts",
		Code: `
const createdAt = new Date(value);
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		FileName: "packages/coffee/core/src/application/use-cases/checkoutSession.ts",
		Code: `
const expiresAt = new Date(Date.now() + 900000);
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "noNewDateInCore"},
		},
	},
	{
		FileName: "packages/coffee/core/src/domain/checkout-session.ts",
		Code: `
const expiresAt = new Date();
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "noNewDateInCore"},
		},
	},
}
