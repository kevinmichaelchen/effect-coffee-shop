// lintcn:name no-redundant-in-check
// lintcn:description Flag `"y" in x` checks where the type of x already has y as a required property in all union constituents

package no_redundant_in_check

import (
	"fmt"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/checker"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

func propertyExistsInAllConstituents(tc *checker.Checker, t *checker.Type, propName string) bool {
	parts := utils.UnionTypeParts(t)
	if len(parts) == 0 {
		return false
	}
	for _, part := range parts {
		if part == nil {
			return false
		}
		flags := checker.Type_flags(part)

		if flags&(checker.TypeFlagsAny|checker.TypeFlagsUnknown) != 0 {
			return false
		}
		if flags&checker.TypeFlagsTypeParameter != 0 {
			constraint := checker.Checker_getBaseConstraintOfType(tc, part)
			if constraint == nil {
				return false
			}
			if !propertyExistsInAllConstituents(tc, constraint, propName) {
				return false
			}
			continue
		}
		if flags&(checker.TypeFlagsNull|checker.TypeFlagsUndefined|checker.TypeFlagsVoid) != 0 {
			return false
		}

		prop := checker.Checker_getPropertyOfType(tc, part, propName)
		if prop == nil {
			apparent := checker.Checker_getApparentType(tc, part)
			if apparent != nil && apparent != part {
				prop = checker.Checker_getPropertyOfType(tc, apparent, propName)
			}
		}
		if prop == nil {
			return false
		}
		if prop.Flags&ast.SymbolFlagsOptional != 0 {
			return false
		}
	}
	return true
}

var NoRedundantInCheckRule = rule.Rule{
	Name: "no-redundant-in-check",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		return rule.RuleListeners{
			ast.KindBinaryExpression: func(node *ast.Node) {
				binExpr := node.AsBinaryExpression()
				if binExpr == nil || binExpr.OperatorToken == nil {
					return
				}
				if binExpr.OperatorToken.Kind != ast.KindInKeyword {
					return
				}

				left := ast.SkipParentheses(binExpr.Left)
				right := ast.SkipParentheses(binExpr.Right)
				if left == nil || right == nil {
					return
				}

				if left.Kind != ast.KindStringLiteral && left.Kind != ast.KindNoSubstitutionTemplateLiteral {
					return
				}
				propName := left.Text()
				if propName == "" {
					return
				}

				rightType := ctx.TypeChecker.GetTypeAtLocation(right)
				if rightType == nil {
					return
				}

				constraint, isTypeParam := utils.GetConstraintInfo(ctx.TypeChecker, rightType)
				if isTypeParam {
					if constraint == nil {
						return
					}
					rightType = constraint
				}

				if utils.IsTypeAnyType(rightType) || utils.IsTypeUnknownType(rightType) {
					return
				}

				if propertyExistsInAllConstituents(ctx.TypeChecker, rightType, propName) {
					typeStr := ctx.TypeChecker.TypeToString(rightType)
					ctx.ReportNode(node, rule.RuleMessage{
						Id: "redundantInCheck",
						Description: fmt.Sprintf(
							"Property `%s` already exists in type `%s`. This `in` check is redundant because the property is always present.",
							propName, typeStr,
						),
					})
				}
			},
		}
	},
}
