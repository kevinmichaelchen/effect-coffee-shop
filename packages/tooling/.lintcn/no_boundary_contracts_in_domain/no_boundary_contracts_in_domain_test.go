package no_boundary_contracts_in_domain

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoBoundaryContractsInDomain(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoBoundaryContractsInDomainRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		FileName: "packages/coffee/domain/src/order.ts",
		Code: `
export const CoffeeOrderSchema = Schema.Struct({});
export type CoffeeOrder = typeof CoffeeOrderSchema.Type;
		`,
	},
	{
		FileName: "packages/coffee/application/src/contracts.ts",
		Code: `
export const PlaceOrderRequestSchema = Schema.Struct({});
export type PlaceOrderRequest = typeof PlaceOrderRequestSchema.Type;
		`,
	},
	{
		FileName: "packages/coffee/domain/src/errors.ts",
		Code: `
export class InvalidOrderInputError extends Error {}
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		FileName: "packages/coffee/domain/src/order.ts",
		Code: `
export const PlaceOrderRequestSchema = Schema.Struct({});
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "moveBoundaryContractOutOfDomain"},
		},
	},
	{
		FileName: "packages/coffee/domain/src/order.ts",
		Code: `
export type ListOrdersRequest = {};
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "moveBoundaryContractOutOfDomain"},
		},
	},
	{
		FileName: "packages/coffee/domain/src/http.ts",
		Code: `
export interface OrderResponse {}
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "moveBoundaryContractOutOfDomain"},
		},
	},
	{
		FileName: "packages/coffee/domain/src/order.ts",
		Code: `
const placeOrderPayload = {};
export const SubmitOrderPayloadSchema = Schema.Struct(placeOrderPayload);
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "moveBoundaryContractOutOfDomain"},
		},
	},
}
