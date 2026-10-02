// lintcn:name no-raw-sqlite-unsafe
// lintcn:description SQLite SQL code should use Effect SQL tagged templates instead of sqlClient.unsafe.

package no_raw_sqlite_unsafe

import (
	"path/filepath"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

func normalizedFileName(fileName string) string {
	return filepath.ToSlash(fileName)
}

func isHandwrittenSqliteSqlFile(fileName string) bool {
	normalized := normalizedFileName(fileName)
	if strings.Contains(normalized, "/vendor/") ||
		strings.Contains(normalized, "/node_modules/") ||
		// The migration runner executes reviewed migration files verbatim.
		strings.HasSuffix(normalized, "/src/sql/migrate.ts") ||
		strings.HasSuffix(normalized, ".test.ts") ||
		strings.HasSuffix(normalized, ".spec.ts") {
		return false
	}

	return strings.Contains(normalized, "packages/coffee/external/sqlite/src/sql/")
}

func isUnsafeCall(node *ast.Node) bool {
	if node == nil || !ast.IsCallExpression(node) {
		return false
	}

	callee := node.AsCallExpression().Expression
	return ast.IsPropertyAccessExpression(callee) &&
		callee.AsPropertyAccessExpression().Name().Text() == "unsafe"
}

var NoRawSqliteUnsafeRule = rule.Rule{
	Name: "no-raw-sqlite-unsafe",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		if !isHandwrittenSqliteSqlFile(ctx.SourceFile.FileName()) {
			return rule.RuleListeners{}
		}

		return rule.RuleListeners{
			ast.KindCallExpression: func(node *ast.Node) {
				if !isUnsafeCall(node) {
					return
				}

				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "noRawSqliteUnsafe",
					Description: "Use Effect SQL tagged templates instead of raw .unsafe calls in SQLite SQL code.",
					Help:        "Add a query to src/sql/queries written as sql`...` so parameters stay bound.",
				})
			},
		}
	},
}
