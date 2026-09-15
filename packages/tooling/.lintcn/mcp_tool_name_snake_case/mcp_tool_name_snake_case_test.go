package mcp_tool_name_snake_case

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestMcpToolNameSnakeCase(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&McpToolNameSnakeCaseRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
Tool.make("place_order", {});
		`,
	},
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
Tool.make("list_orders", {});
		`,
	},
	{
		Code: "declare const Tool: { make(name: string, options: unknown): unknown };\n" +
			"Tool.make(`mark_ready`, {});\n",
	},
	{
		Code: `
declare const Toolkit: { make(name: string, options: unknown): unknown };
Toolkit.make("PlaceOrder", {});
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
Tool.make("placeOrder", {});
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "toolNameSnakeCase"},
		},
	},
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
Tool.make("place-order", {});
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "toolNameSnakeCase"},
		},
	},
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
Tool.make("PlaceOrder", {});
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "toolNameSnakeCase"},
		},
	},
	{
		Code: `
declare const Tool: { make(name: string, options: unknown): unknown };
declare const toolName: string;
Tool.make(toolName, {});
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "toolNameLiteral"},
		},
	},
}
