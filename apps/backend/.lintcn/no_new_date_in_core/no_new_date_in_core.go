// lintcn:name no-new-date-in-core
// lintcn:description Core application and domain code should use effect/DateTime instead of constructing Date directly.

package no_new_date_in_core

import (
	"path/filepath"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/scanner"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

func normalizedFileName(fileName string) string {
	return filepath.ToSlash(fileName)
}

func isCoreApplicationOrDomainFile(fileName string) bool {
	normalized := normalizedFileName(fileName)
	if strings.Contains(normalized, "/vendor/") ||
		strings.Contains(normalized, "/node_modules/") ||
		strings.HasSuffix(normalized, ".test.ts") ||
		strings.HasSuffix(normalized, ".spec.ts") {
		return false
	}

	return strings.Contains(normalized, "packages/coffee/core/src/application/") ||
		strings.Contains(normalized, "packages/coffee/core/src/domain/") ||
		strings.HasPrefix(normalized, "src/application/") ||
		strings.HasPrefix(normalized, "src/domain/")
}

func nodeText(node *ast.Node) string {
	if node == nil {
		return ""
	}
	return scanner.GetTextOfNode(node)
}

func isDateConstructor(node *ast.Node) bool {
	return strings.HasPrefix(strings.TrimSpace(nodeText(node)), "new Date(")
}

var NoNewDateInCoreRule = rule.Rule{
	Name: "no-new-date-in-core",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		if !isCoreApplicationOrDomainFile(ctx.SourceFile.FileName()) {
			return rule.RuleListeners{}
		}

		return rule.RuleListeners{
			ast.KindNewExpression: func(node *ast.Node) {
				if !isDateConstructor(node) {
					return
				}

				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "noNewDateInCore",
					Description: "Use effect/DateTime in core application and domain code instead of constructing Date directly.",
					Help:        "Prefer DateTime.now, DateTime.add, DateTime.make, or an adapter boundary that converts to Date explicitly.",
				})
			},
		}
	},
}
