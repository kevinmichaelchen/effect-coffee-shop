// lintcn:name mcp-tool-name-snake-case
// lintcn:description Require MCP tool ids passed to Tool.make(...) to be string literals in snake_case

package mcp_tool_name_snake_case

import (
	"fmt"
	"regexp"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

var snakeCaseToolID = regexp.MustCompile(`^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$`)

func isToolMakeCall(node *ast.Node) bool {
	if !ast.IsPropertyAccessExpression(node) {
		return false
	}

	propertyAccess := node.AsPropertyAccessExpression()
	if propertyAccess == nil {
		return false
	}

	if propertyAccess.Name().Text() != "make" {
		return false
	}

	calleeObject := propertyAccess.Expression
	return ast.IsIdentifier(calleeObject) && calleeObject.AsIdentifier().Text == "Tool"
}

var McpToolNameSnakeCaseRule = rule.Rule{
	Name: "mcp-tool-name-snake-case",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		return rule.RuleListeners{
			ast.KindCallExpression: func(node *ast.Node) {
				callExpression := node.AsCallExpression()
				if callExpression == nil || !isToolMakeCall(callExpression.Expression) {
					return
				}

				if len(callExpression.Arguments.Nodes) == 0 {
					return
				}

				firstArg := ast.SkipParentheses(callExpression.Arguments.Nodes[0])
				if firstArg == nil {
					return
				}

				if !ast.IsStringLiteral(firstArg) && firstArg.Kind != ast.KindNoSubstitutionTemplateLiteral {
					ctx.ReportNode(firstArg, rule.RuleMessage{
						Id:          "toolNameLiteral",
						Description: "MCP tool ids passed to Tool.make(...) must be string literals.",
						Help:        "Use a literal snake_case wire id such as \"place_order\" so the protocol name stays stable for clients and agents.",
					})
					return
				}

				toolID := firstArg.Text()
				if snakeCaseToolID.MatchString(toolID) {
					return
				}

				ctx.ReportNode(firstArg, rule.RuleMessage{
					Id:          "toolNameSnakeCase",
					Description: fmt.Sprintf("MCP tool id %q should be snake_case.", toolID),
					Help:        "Use lowercase words joined with underscores, for example \"place_order\" or \"list_orders\".",
				})
			},
		}
	},
}
