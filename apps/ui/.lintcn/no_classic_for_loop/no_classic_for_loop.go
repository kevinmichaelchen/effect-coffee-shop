// lintcn:name no-classic-for-loop
// lintcn:description Prefer recursion, for...of, or collection helpers over classic C-style for loops

package no_classic_for_loop

import (
	"strings"

	"github.com/microsoft/typescript-go/shim/ast"
	"github.com/typescript-eslint/tsgolint/internal/rule"
)

var NoClassicForLoopRule = rule.Rule{
	Name: "no-classic-for-loop",
	Run: func(ctx rule.RuleContext, options any) rule.RuleListeners {
		// Numeric kernels (`*.kernel.ts`) are not application code: indexed loops
		// over typed arrays are the algorithm, and the alternatives are 2-12x slower.
		if strings.HasSuffix(ctx.SourceFile.FileName(), ".kernel.ts") {
			return rule.RuleListeners{}
		}
		return rule.RuleListeners{
			ast.KindForStatement: func(node *ast.Node) {
				ctx.ReportNode(node, rule.RuleMessage{
					Id:          "noClassicForLoop",
					Description: "Avoid classic `for (...)` loops in UI application code.",
					Help:        "Prefer recursion, `for...of`, or collection helpers so the iteration model stays explicit and safer.",
				})
			},
		}
	},
}
