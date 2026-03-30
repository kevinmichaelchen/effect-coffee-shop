package no_platform_imports_in_inner_layers

import (
	"testing"

	"github.com/typescript-eslint/tsgolint/internal/rule_tester"
	"github.com/typescript-eslint/tsgolint/internal/rules/fixtures"
)

func TestNoPlatformImportsInInnerLayers(t *testing.T) {
	t.Parallel()
	rule_tester.RunRuleTester(
		fixtures.GetRootDir(),
		"tsconfig.minimal.json",
		t,
		&NoPlatformImportsInInnerLayersRule,
		validCases,
		invalidCases,
	)
}

var validCases = []rule_tester.ValidTestCase{
	{
		FileName: "src/service/use-cases/listMenu.ts",
		Code: `
import * as Effect from "effect/Effect";
import type { Menu } from "#domain/menu";
		`,
	},
	{
		FileName: "src/runtime/bun/live.ts",
		Code: `
import * as BunServices from "@effect/platform-bun/BunServices";
import * as Layer from "effect/Layer";
		`,
	},
	{
		FileName: "src/presentation/http/main.ts",
		Code: `
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
		`,
	},
}

var invalidCases = []rule_tester.InvalidTestCase{
	{
		FileName: "src/external/sql/live.ts",
		Code: `
import * as BunServices from "@effect/platform-bun/BunServices";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "movePlatformImportToRuntimeBoundary"},
		},
	},
	{
		FileName: "src/service/use-cases/placeOrder.ts",
		Code: `
import { readFileSync } from "node:fs";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "movePlatformImportToRuntimeBoundary"},
		},
	},
	{
		FileName: "src/presentation/mcp/server.ts",
		Code: `
export { SqliteClient } from "#effect-smol/sql/sqlite-bun";
		`,
		Errors: []rule_tester.InvalidTestCaseError{
			{MessageId: "movePlatformImportToRuntimeBoundary"},
		},
	},
}
