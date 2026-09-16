// lintcn:name no-type-assertion
// lintcn:severity warn
// lintcn:description Flag all type assertions (as X) and show the actual expression type so agents can remove them
//
// Safety: every checker API call is guarded against nil returns.
// expandTypeStructure skips nil slice elements. unwrapAssertionChain
// has a 64-step cap to prevent infinite loops on malformed AST.

package no_type_assertion

import (
	"fmt"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/microsoft/typescript-go/shim/checker"
	"github.com/microsoft/typescript-go/shim/compiler"
	"github.com/typescript-eslint/tsgolint/internal/rule"
	"github.com/typescript-eslint/tsgolint/internal/utils"
)

func safeTypeString(c *checker.Checker, t *checker.Type) string {
	if c == nil || t == nil {
		return "unknown"
	}
	return c.TypeToString(t)
}

func formatType(c *checker.Checker, program *compiler.Program, t *checker.Type) string {
	if c == nil || t == nil {
		return "unknown"
	}

	name := c.TypeToString(t)

	if utils.IsTypeAnyType(t) || utils.IsTypeUnknownType(t) {
		return name
	}
	if utils.IsTypeFlagSet(t, checker.TypeFlagsNever) {
		return name
	}

	parts := utils.UnionTypeParts(t)
	if len(parts) > 1 {
		anyExpanded := false
		expandedParts := make([]string, len(parts))
		for i, part := range parts {
			if part == nil {
				expandedParts[i] = "unknown"
				continue
			}
			expandedParts[i] = formatType(c, program, part)
			if expandedParts[i] != safeTypeString(c, part) {
				anyExpanded = true
			}
		}
		if anyExpanded {
			return fmt.Sprintf("%s (%s)", name, strings.Join(expandedParts, " | "))
		}
		return name
	}

	expanded := expandTypeStructure(c, program, t)
	if expanded == "" || expanded == name {
		return name
	}
	return fmt.Sprintf("%s (%s)", name, expanded)
}

func expandTypeStructure(c *checker.Checker, program *compiler.Program, t *checker.Type) string {
	if c == nil || t == nil {
		return ""
	}

	if !utils.IsObjectType(t) {
		return ""
	}

	if program != nil && t.Symbol() != nil && utils.IsSymbolFromDefaultLibrary(program, t.Symbol()) {
		return ""
	}

	props := checker.Checker_getPropertiesOfType(c, t)
	callSigs := c.GetCallSignatures(t)
	indexInfos := checker.Checker_getIndexInfosOfType(c, t)

	if len(props) == 0 && len(callSigs) == 0 && len(indexInfos) == 0 {
		return ""
	}
	if len(props) > 20 {
		return ""
	}

	var parts []string

	for _, idx := range indexInfos {
		if idx == nil {
			continue
		}
		keyStr := safeTypeString(c, idx.KeyType())
		valStr := safeTypeString(c, idx.ValueType())
		if idx.IsReadonly() {
			parts = append(parts, fmt.Sprintf("readonly [key: %s]: %s", keyStr, valStr))
		} else {
			parts = append(parts, fmt.Sprintf("[key: %s]: %s", keyStr, valStr))
		}
	}

	for _, sig := range callSigs {
		if sig == nil {
			continue
		}
		retType := checker.Checker_getReturnTypeOfSignature(c, sig)
		retStr := safeTypeString(c, retType)
		params := checker.Signature_parameters(sig)
		paramParts := make([]string, len(params))
		for i, p := range params {
			if p == nil {
				paramParts[i] = "arg: unknown"
				continue
			}
			pType := checker.Checker_getTypeOfSymbol(c, p)
			paramParts[i] = fmt.Sprintf("%s: %s", p.Name, safeTypeString(c, pType))
		}
		parts = append(parts, fmt.Sprintf("(%s) => %s", strings.Join(paramParts, ", "), retStr))
	}

	for _, prop := range props {
		if prop == nil {
			continue
		}
		propType := checker.Checker_getTypeOfSymbol(c, prop)
		propStr := safeTypeString(c, propType)
		optional := ""
		if prop.Flags&ast.SymbolFlagsOptional != 0 {
			optional = "?"
		}
		parts = append(parts, fmt.Sprintf("%s%s: %s", prop.Name, optional, propStr))
	}

	return "{ " + strings.Join(parts, "; ") + " }"
}

func unwrapAssertionChain(ctx rule.RuleContext, expr *ast.Node) *checker.Type {
	if expr == nil {
		return nil
	}
	inner := ast.SkipParentheses(expr)
	if inner == nil {
		return nil
	}
	start := inner
	for steps := 0; steps < 64; steps++ {
		if inner.Kind != ast.KindAsExpression && inner.Kind != ast.KindTypeAssertionExpression {
			break
		}
		next := inner.Expression()
		if next == nil {
			break
		}
		inner = ast.SkipParentheses(next)
		if inner == nil {
			break
		}
	}
	if inner == start {
		return nil
	}
	t := ctx.TypeChecker.GetTypeAtLocation(inner)
	if t == nil {
		return nil
	}
	if utils.IsTypeAnyType(t) || utils.IsTypeUnknownType(t) {
		return nil
	}
	return t
}

var NoTypeAssertionRule = rule.Rule{
	Name: "no-type-assertion",
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

			assertedStr := formatType(ctx.TypeChecker, ctx.Program, assertedType)

			if utils.IsTypeAnyType(expressionType) || utils.IsTypeUnknownType(expressionType) {
				originalType := unwrapAssertionChain(ctx, expression)

				if utils.IsTypeAnyType(expressionType) && originalType == nil {
					return
				}

				if originalType != nil {
					originalStr := formatType(ctx.TypeChecker, ctx.Program, originalType)
					ctx.ReportNode(node, rule.RuleMessage{
						Id: "typeAssertionFromAny",
						Description: fmt.Sprintf(
							"Type assertion `as %s` from `%s`. The original expression type is `%s`. Consider narrowing the type instead.",
							assertedStr, safeTypeString(ctx.TypeChecker, expressionType), originalStr,
						),
					})
				} else {
					ctx.ReportNode(node, rule.RuleMessage{
						Id: "typeAssertionFromAny",
						Description: fmt.Sprintf(
							"Type assertion `as %s` from `%s`. Consider adding a type annotation at the source instead.",
							assertedStr, safeTypeString(ctx.TypeChecker, expressionType),
						),
					})
				}
				return
			}

			expressionStr := formatType(ctx.TypeChecker, ctx.Program, expressionType)

			if expressionType == assertedType {
				ctx.ReportNode(node, rule.RuleMessage{
					Id: "typeAssertionRedundant",
					Description: fmt.Sprintf(
						"Type assertion `as %s` is redundant, the expression already has this type. Remove the assertion.",
						safeTypeString(ctx.TypeChecker, assertedType),
					),
				})
				return
			}

			ctx.ReportNode(node, rule.RuleMessage{
				Id: "typeAssertion",
				Description: fmt.Sprintf(
					"Type assertion `as %s`. The expression type is `%s`. Try removing the assertion or narrowing the type instead.",
					assertedStr, expressionStr,
				),
			})
		}

		return rule.RuleListeners{
			ast.KindAsExpression:            checkAssertion,
			ast.KindTypeAssertionExpression: checkAssertion,
		}
	},
}
