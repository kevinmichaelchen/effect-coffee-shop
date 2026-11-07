// lintcn:name no-instanceof
// lintcn:description Disallow `instanceof`. Decode with Schema (Schema.instanceOf, a TaggedError's `_tag`, Schema.is) or branch on a discriminant instead of probing prototypes.

package no_instanceof

import (
	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

var NoInstanceofRule = rule.Rule{
	Name: "no-instanceof",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		return rule.RuleListeners{
			ast.KindBinaryExpression: func(node *ast.Node) {
				binExpr := node.AsBinaryExpression()
				if binExpr == nil || binExpr.OperatorToken == nil {
					return
				}
				if binExpr.OperatorToken.Kind != ast.KindInstanceOfKeyword {
					return
				}
				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "noInstanceof",
					Description: "`instanceof` probes a prototype instead of establishing a contract, and fails across realms (workers, iframes, duplicated packages).",
					Help:        "Decode at the boundary with Schema (Schema.instanceOf for host classes, a Struct for error-like values) or narrow on a `_tag` discriminant.",
				})
			},
		}
	},
}
