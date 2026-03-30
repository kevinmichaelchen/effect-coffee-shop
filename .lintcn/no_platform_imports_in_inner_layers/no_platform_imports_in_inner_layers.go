// lintcn:name no-platform-imports-in-inner-layers
// lintcn:description Keep Bun, Node, and platform-specific SQL adapters at the outer runtime boundary

package no_platform_imports_in_inner_layers

import (
	"path/filepath"
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

var platformImportPrefixes = []string{
	"@effect/platform-bun",
	"@effect/platform-node",
	"bun:",
	"node:",
	"#effect-smol/sql/",
}

func normalizeFileName(fileName string) string {
	return filepath.ToSlash(fileName)
}

func isRuntimeBoundaryFile(fileName string) bool {
	normalized := normalizeFileName(fileName)

	if strings.Contains(normalized, "/src/runtime/") {
		return true
	}

	if !strings.Contains(normalized, "/src/presentation/") {
		return false
	}

	return strings.HasSuffix(normalized, "/main.ts") || strings.HasSuffix(normalized, "-main.ts")
}

func isInnerSourceFile(fileName string) bool {
	normalized := normalizeFileName(fileName)
	if strings.Contains(normalized, "/vendor/") || strings.Contains(normalized, "/node_modules/") {
		return false
	}

	return strings.Contains(normalized, "/src/") && !isRuntimeBoundaryFile(normalized)
}

func isPlatformImport(specifier string) bool {
	for _, prefix := range platformImportPrefixes {
		if strings.HasPrefix(specifier, prefix) {
			return true
		}
	}

	return false
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

var NoPlatformImportsInInnerLayersRule = rule.Rule{
	Name: "no-platform-imports-in-inner-layers",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		fileName := ctx.SourceFile.FileName()
		if !isInnerSourceFile(fileName) {
			return rule.RuleListeners{}
		}

		checkNode := func(node *ast.Node) {
			specifier, ok := importSpecifier(node)
			if !ok || !isPlatformImport(specifier) {
				return
			}

			ctx.ReportNode(node, rule.RuleMessage{
				Id:          "movePlatformImportToRuntimeBoundary",
				Description: "Inner layers must not import platform-specific modules.",
				Help:        "Move Bun, Node, and concrete SQL adapter wiring to src/runtime/** or presentation *-main.ts entrypoints. Inner layers should depend on abstract services and ports instead.",
			})
		}

		return rule.RuleListeners{
			ast.KindImportDeclaration: checkNode,
			ast.KindExportDeclaration: checkNode,
		}
	},
}
