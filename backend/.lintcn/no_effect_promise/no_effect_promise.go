// lintcn:name no-effect-promise
// lintcn:description Prefer Effect.tryPromise(...) over Effect.promise(...) so promise rejections stay in the typed error channel

package no_effect_promise

import (
	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

func isEffectPromiseCall(node *ast.Node) bool {
	if !ast.IsPropertyAccessExpression(node) {
		return false
	}

	propertyAccess := node.AsPropertyAccessExpression()
	if propertyAccess == nil {
		return false
	}

	if propertyAccess.Name().Text() != "promise" {
		return false
	}

	calleeObject := propertyAccess.Expression
	return ast.IsIdentifier(calleeObject) && calleeObject.AsIdentifier().Text == "Effect"
}

var NoEffectPromiseRule = rule.Rule{
	Name: "no-effect-promise",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		return rule.RuleListeners{
			ast.KindCallExpression: func(node *ast.Node) {
				callExpression := node.AsCallExpression()
				if callExpression == nil || !isEffectPromiseCall(callExpression.Expression) {
					return
				}

				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "preferTryPromise",
					Description: "Prefer Effect.tryPromise(...) over Effect.promise(...).",
					Help:        "Use Effect.tryPromise so promise rejections are captured in the typed error channel instead of becoming defects.",
				})
			},
		}
	},
}
