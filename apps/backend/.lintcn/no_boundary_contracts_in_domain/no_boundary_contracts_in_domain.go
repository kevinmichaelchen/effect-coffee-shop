// lintcn:name no-boundary-contracts-in-domain
// lintcn:description Keep request and response contracts out of the domain layer

package no_boundary_contracts_in_domain

import (
	"path/filepath"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

var forbiddenDomainContractSuffixes = []string{
	"Request",
	"RequestSchema",
	"Response",
	"ResponseSchema",
	"Query",
	"QuerySchema",
	"Payload",
	"PayloadSchema",
}

func normalizeFileName(fileName string) string {
	return filepath.ToSlash(fileName)
}

func isDomainFile(fileName string) bool {
	normalized := normalizeFileName(fileName)
	if strings.Contains(normalized, "/vendor/") || strings.Contains(normalized, "/node_modules/") {
		return false
	}

	return strings.Contains(normalized, "/src/domain/")
}

func isBoundaryContractName(name string) bool {
	firstRune, _ := utf8.DecodeRuneInString(name)
	if firstRune == utf8.RuneError || !unicode.IsUpper(firstRune) {
		return false
	}

	for _, suffix := range forbiddenDomainContractSuffixes {
		if strings.HasSuffix(name, suffix) {
			return true
		}
	}

	return false
}

func reportIfBoundaryContract(ctx rule.RuleContext, node *ast.Node, name string) {
	if !isBoundaryContractName(name) {
		return
	}

	ctx.ReportNode(node, rule.RuleMessage{
		Id:          "moveBoundaryContractOutOfDomain",
		Description: "Domain files must not declare transport boundary contracts.",
		Help:        "Move request, response, query, and payload contracts into src/application/contracts.ts or a presentation boundary module so the domain stays focused on validated business types.",
	})
}

var NoBoundaryContractsInDomainRule = rule.Rule{
	Name: "no-boundary-contracts-in-domain",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		if !isDomainFile(ctx.SourceFile.FileName()) {
			return rule.RuleListeners{}
		}

		return rule.RuleListeners{
			ast.KindVariableDeclaration: func(node *ast.Node) {
				name := node.AsVariableDeclaration().Name()
				if !ast.IsIdentifier(name) {
					return
				}

				reportIfBoundaryContract(ctx, node, name.AsIdentifier().Text)
			},
			ast.KindTypeAliasDeclaration: func(node *ast.Node) {
				reportIfBoundaryContract(ctx, node, node.AsTypeAliasDeclaration().Name().Text())
			},
			ast.KindInterfaceDeclaration: func(node *ast.Node) {
				reportIfBoundaryContract(ctx, node, node.AsInterfaceDeclaration().Name().Text())
			},
			ast.KindClassDeclaration: func(node *ast.Node) {
				name := node.AsClassDeclaration().Name()
				if name == nil {
					return
				}

				reportIfBoundaryContract(ctx, node, name.Text())
			},
			ast.KindFunctionDeclaration: func(node *ast.Node) {
				name := node.AsFunctionDeclaration().Name()
				if name == nil {
					return
				}

				reportIfBoundaryContract(ctx, node, name.Text())
			},
		}
	},
}
