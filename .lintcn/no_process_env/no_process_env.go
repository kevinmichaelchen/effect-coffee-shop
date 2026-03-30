// lintcn:name no-process-env
// lintcn:description Prefer Effect Config over process.env so runtime configuration stays typed and injectable

package no_process_env

import (
	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

func isProcessEnv(node *ast.Node) bool {
	if !ast.IsPropertyAccessExpression(node) {
		return false
	}

	propertyAccess := node.AsPropertyAccessExpression()
	if propertyAccess == nil {
		return false
	}

	if propertyAccess.Name().Text() != "env" {
		return false
	}

	object := propertyAccess.Expression
	return ast.IsIdentifier(object) && object.AsIdentifier().Text == "process"
}

var NoProcessEnvRule = rule.Rule{
	Name: "no-process-env",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		return rule.RuleListeners{
			ast.KindPropertyAccessExpression: func(node *ast.Node) {
				if !isProcessEnv(node) {
					return
				}

				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "preferEffectConfig",
					Description: "Prefer Effect Config over process.env.",
					Help:        "Use effect/Config so configuration stays typed, testable, and injectable instead of reading process.env directly.",
				})
			},
		}
	},
}
