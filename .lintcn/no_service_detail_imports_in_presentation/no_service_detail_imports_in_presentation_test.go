package no_service_detail_imports_in_presentation

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoServiceDetailImportsInPresentation(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoServiceDetailImportsInPresentationRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		FileName: "src/presentation/http/api.ts",
		Code: `
import { CoffeeOrderApp } from "#service/CoffeeOrderApp";
import { ListOrdersRequestSchema } from "#service/contracts";
import { InternalAppError } from "#service/errors";
		`,
	},
	{
		FileName: "src/service/use-cases/placeOrder.ts",
		Code: `
import { OrderRepository } from "#service/ports/OrderRepository";
		`,
	},
	{
		FileName: "src/presentation/mcp/server.ts",
		Code: `
export { CoffeeOrderApp } from "#service/CoffeeOrderApp";
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		FileName: "src/presentation/http/api.ts",
		Code: `
import { listMenu } from "#service/use-cases/index";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "dependOnAppFacade"},
		},
	},
	{
		FileName: "src/presentation/mcp/actions.ts",
		Code: `
import { OrderRepository } from "#service/ports/OrderRepository";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "dependOnAppFacade"},
		},
	},
	{
		FileName: "src/presentation/http/adapter.ts",
		Code: `
export { placeOrder } from "#service/use-cases/placeOrder";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "dependOnAppFacade"},
		},
	},
}
