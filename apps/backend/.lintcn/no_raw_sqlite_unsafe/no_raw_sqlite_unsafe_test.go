package no_raw_sqlite_unsafe

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoRawSqliteUnsafe(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoRawSqliteUnsafeRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		FileName: "packages/coffee/external/sqlite/src/sql/SqlCheckoutSessionRepository.ts",
		Code: `
yield* createCheckoutSession(sqlClient, row);
		`,
	},
	{
		FileName: "packages/coffee/external/sqlite/src/sql/queries/.generated/CheckoutSessionQueries.ts",
		Code: `
yield* sqlClient.unsafe("select 1");
		`,
	},
	{
		FileName: "packages/coffee/external/d1/src/D1CheckoutSessionRepository.ts",
		Code: `
yield* sqlClient.unsafe("select 1");
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		FileName: "packages/coffee/external/sqlite/src/sql/SqlCheckoutSessionRepository.ts",
		Code: `
yield* sqlClient.unsafe("select 1");
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "noRawSqliteUnsafe"},
		},
	},
}
