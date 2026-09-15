// lintcn:name no-redundant-type-assertion
// lintcn:severity warn
// lintcn:description Disallow redundant type assertions where the expression already has the asserted type or is a nullable union of it

package no_redundant_type_assertion

import (
	"fmt"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/checker"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

var NoRedundantTypeAssertionRule = rule.Rule{
	Name: "no-redundant-type-assertion",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		checkAssertion := func(node *ast.Node) {
			if node == nil {
				return
			}
			if ast.IsConstAssertion(node) {
				return
			}

			expression := node.Expression()
			typeAnnotation := node.Type()
			if expression == nil || typeAnnotation == nil {
				return
			}

			expressionType := ctx.TypeChecker.GetTypeAtLocation(expression)
			assertedType := ctx.TypeChecker.GetTypeAtLocation(typeAnnotation)
			if expressionType == nil || assertedType == nil {
				return
			}

			if utils.IsTypeAnyType(expressionType) || utils.IsTypeUnknownType(expressionType) {
				return
			}
			if utils.IsTypeAnyType(assertedType) || utils.IsTypeUnknownType(assertedType) {
				return
			}

			removeRange := node.Loc.WithPos(expression.End())
			if node.Kind == ast.KindTypeAssertionExpression {
				removeRange = node.Loc.WithEnd(expression.Pos())
			}

			if expressionType == assertedType {
				ctx.ReportNodeWithFixes(node, rule.RuleMessage{
					Id: "redundantAssertion",
					Description: fmt.Sprintf(
						"Type assertion to '%s' is redundant because the expression already has that type. Remove the assertion.",
						ctx.TypeChecker.TypeToString(assertedType),
					),
				}, func() []rule.RuleFix {
					return []rule.RuleFix{rule.RuleFixRemoveRange(removeRange)}
				})
				return
			}

			expressionParts := utils.UnionTypeParts(expressionType)
			if len(expressionParts) <= 1 {
				return
			}

			hasNull := false
			hasUndefined := false
			nonNullableParts := make([]*checker.Type, 0, len(expressionParts))
			for _, part := range expressionParts {
				if part == nil {
					continue
				}
				if utils.IsTypeFlagSet(part, checker.TypeFlagsNull) {
					hasNull = true
				} else if utils.IsTypeFlagSet(part, checker.TypeFlagsUndefined) {
					hasUndefined = true
				} else {
					nonNullableParts = append(nonNullableParts, part)
				}
			}

			if !hasNull && !hasUndefined {
				return
			}

			assertedParts := utils.UnionTypeParts(assertedType)
			if len(nonNullableParts) != len(assertedParts) {
				return
			}

			assertedSet := make(map[*checker.Type]bool, len(assertedParts))
			for _, p := range assertedParts {
				assertedSet[p] = true
			}
			for _, p := range nonNullableParts {
				if !assertedSet[p] {
					return
				}
			}

			nullableDesc := "undefined"
			if hasNull && hasUndefined {
				nullableDesc = "null | undefined"
			} else if hasNull {
				nullableDesc = "null"
			}

			higherPrecedenceThanUnary := ast.GetExpressionPrecedence(expression) > ast.OperatorPrecedenceUnary

			ctx.ReportNodeWithSuggestions(node, rule.RuleMessage{
				Id: "useNonNullAssertion",
				Description: fmt.Sprintf(
					"Use a `!` non-null assertion or a type guard to narrow away %s instead of `as %s`.",
					nullableDesc,
					ctx.TypeChecker.TypeToString(assertedType),
				),
			}, func() []rule.RuleSuggestion {
				var fixes []rule.RuleFix
				if higherPrecedenceThanUnary {
					fixes = []rule.RuleFix{
						rule.RuleFixRemoveRange(removeRange),
						rule.RuleFixInsertAfter(expression, "!"),
					}
				} else {
					fixes = []rule.RuleFix{
						rule.RuleFixRemoveRange(removeRange),
						rule.RuleFixInsertBefore(ctx.SourceFile, expression, "("),
						rule.RuleFixInsertAfter(expression, ")!"),
					}
				}
				return []rule.RuleSuggestion{{
					Message: rule.RuleMessage{
						Id:          "replaceWithNonNull",
						Description: "Replace with `!` non-null assertion.",
					},
					FixesArr: fixes,
				}}
			})
		}

		return rule.RuleListeners{
			ast.KindAsExpression:            checkAssertion,
			ast.KindTypeAssertionExpression: checkAssertion,
		}
	},
}
