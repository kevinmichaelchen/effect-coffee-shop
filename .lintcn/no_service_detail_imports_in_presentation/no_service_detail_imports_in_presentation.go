// lintcn:name no-service-detail-imports-in-presentation
// lintcn:description Keep presentation code coupled to the app facade, not service internals

package no_service_detail_imports_in_presentation

import (
	"path/filepath"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

func normalizeFileName(fileName string) string {
	return filepath.ToSlash(fileName)
}

func isPresentationFile(fileName string) bool {
	normalized := normalizeFileName(fileName)
	if strings.Contains(normalized, "/vendor/") || strings.Contains(normalized, "/node_modules/") {
		return false
	}

	return strings.Contains(normalized, "/src/presentation/")
}

func isServiceDetailImport(specifier string) bool {
	return specifier == "#service/use-cases/index" ||
		strings.HasPrefix(specifier, "#service/use-cases/") ||
		strings.HasPrefix(specifier, "#service/ports/")
}

func importSpecifier(node *ast.Node) (string, bool) {
	if ast.IsImportDeclaration(node) {
		importDeclaration := node.AsImportDeclaration()
		if importDeclaration == nil || importDeclaration.ModuleSpecifier == nil {
			return "", false
		}

		moduleSpecifier := importDeclaration.ModuleSpecifier.AsStringLiteral()
		if moduleSpecifier == nil {
			return "", false
		}

		return moduleSpecifier.Text, true
	}

	if ast.IsExportDeclaration(node) {
		exportDeclaration := node.AsExportDeclaration()
		if exportDeclaration == nil || exportDeclaration.ModuleSpecifier == nil {
			return "", false
		}

		moduleSpecifier := exportDeclaration.ModuleSpecifier.AsStringLiteral()
		if moduleSpecifier == nil {
			return "", false
		}

		return moduleSpecifier.Text, true
	}

	return "", false
}

var NoServiceDetailImportsInPresentationRule = rule.Rule{
	Name: "no-service-detail-imports-in-presentation",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		fileName := ctx.SourceFile.FileName()
		if !isPresentationFile(fileName) {
			return rule.RuleListeners{}
		}

		checkNode := func(node *ast.Node) {
			specifier, ok := importSpecifier(node)
			if !ok || !isServiceDetailImport(specifier) {
				return
			}

			ctx.ReportNode(node, rule.RuleMessage{
				Id:          "dependOnAppFacade",
				Description: "Presentation code must not import service internals directly.",
				Help:        "Depend on #service/CoffeeOrderApp for application flows, and keep transport contracts or boundary errors in dedicated service modules.",
			})
		}

		return rule.RuleListeners{
			ast.KindImportDeclaration: checkNode,
			ast.KindExportDeclaration: checkNode,
		}
	},
}
