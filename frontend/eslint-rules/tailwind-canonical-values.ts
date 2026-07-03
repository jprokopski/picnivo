import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ESLint, Rule } from "eslint";

// eslint-plugin-tailwindcss (v4 alpha/4.0.6) doesn't cover these
// conversions yet, only VS Code's Tailwind CSS IntelliSense does:
//   - arbitrary pixel values on spacing-scale utilities -> bare scale number
//     (max-w-[1000px] -> max-w-250, since --spacing defaults to 0.25rem/4px)
//   - arbitrary CSS-var values -> the bare utility for a theme-aliased token
//     (bg-(--card) -> bg-card, because @theme declares --color-card: var(--card))
//   - the legacy v3 important-modifier prefix -> the v4 suffix position
//     (!h-10.5 -> h-10.5!, since v4 moved `!` to the end of the class name)
// This local rule fills that gap so `eslint` (not just the editor) surfaces
// and can --fix every instance across the codebase.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STYLES_CSS_PATH = path.resolve(__dirname, "../src/styles.css");

const SPACING_SCALE_PREFIXES = [
  "min-w",
  "max-w",
  "min-h",
  "max-h",
  "size",
  "translate-x",
  "translate-y",
  "scroll-mx",
  "scroll-my",
  "scroll-mt",
  "scroll-mr",
  "scroll-mb",
  "scroll-ml",
  "scroll-px",
  "scroll-py",
  "scroll-pt",
  "scroll-pr",
  "scroll-pb",
  "scroll-pl",
  "gap-x",
  "gap-y",
  "gap",
  "space-x",
  "space-y",
  "inset-x",
  "inset-y",
  "inset",
  "px",
  "py",
  "pt",
  "pr",
  "pb",
  "pl",
  "p",
  "mx",
  "my",
  "mt",
  "mr",
  "mb",
  "ml",
  "m",
  "w",
  "h",
  "top",
  "right",
  "bottom",
  "left",
  "indent",
];

// Utility prefixes that resolve against Tailwind's color palette / @theme
// --color-* namespace.
const COLOR_UTILITY_PREFIXES = [
  "bg",
  "text",
  "border",
  "ring",
  "fill",
  "stroke",
  "from",
  "via",
  "to",
];

// Utility prefixes that resolve against the @theme --radius-* namespace.
const RADIUS_UTILITY_PREFIXES = ["rounded"];

type ThemeNamespace = "color" | "radius";
type ThemeAliasMap = Map<string, { namespace: ThemeNamespace; suffix: string }>;

// Only an *exact* `--namespace-suffix: var(--raw-name);` alias counts —
// e.g. `--radius-sm: calc(var(--radius) - 4px)` is NOT an alias of `--r-sm`
// despite the similar name, so it must never be "canonicalized".
function loadThemeAliasMap(): ThemeAliasMap {
  const css = fs.readFileSync(STYLES_CSS_PATH, "utf8");
  const aliasMap: ThemeAliasMap = new Map();
  const re = /--(color|radius)-([\w-]+):\s*var\(--([\w-]+)\)\s*;/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css))) {
    const [, namespace, suffix, rawVar] = match;
    aliasMap.set(rawVar, { namespace: namespace as ThemeNamespace, suffix });
  }
  return aliasMap;
}

let themeAliasMap: ThemeAliasMap | null = null;
function getThemeAliasMap(): ThemeAliasMap {
  themeAliasMap ??= loadThemeAliasMap();
  return themeAliasMap;
}

function splitVariants(token: string): { variants: string; base: string } {
  const lastColon = token.lastIndexOf(":");
  return lastColon === -1
    ? { variants: "", base: token }
    : {
        variants: token.slice(0, lastColon + 1),
        base: token.slice(lastColon + 1),
      };
}

function canonicalizeBase(
  base: string,
  aliasMap: ThemeAliasMap,
): string | null {
  // Legacy v3 `!` prefix (e.g. `!h-10.5`) -> v4 suffix position
  // (`h-10.5!`). Recurse first so a compound case like `!max-w-[1000px]`
  // also picks up the arbitrary-value canonicalization below.
  if (base.startsWith("!") && !base.endsWith("!")) {
    const rest = base.slice(1);
    const canonicalRest = canonicalizeBase(rest, aliasMap) ?? rest;
    return `${canonicalRest}!`;
  }

  const zMatch = /^z-\[(\d+)\]$/.exec(base);
  if (zMatch) return `z-${zMatch[1]}`;

  for (const prefix of SPACING_SCALE_PREFIXES) {
    const match = new RegExp(`^${prefix}-\\[(\\d+)px\\]$`).exec(base);
    if (!match) continue;
    const px = Number(match[1]);
    return px % 4 === 0 ? `${prefix}-${px / 4}` : null;
  }

  const varMatch = /^([a-z-]+)-\(--([\w-]+)\)$/.exec(base);
  if (varMatch) {
    const [, utilityPrefix, rawVar] = varMatch;
    const alias = aliasMap.get(rawVar);
    if (!alias) return null;
    if (
      alias.namespace === "color" &&
      COLOR_UTILITY_PREFIXES.includes(utilityPrefix)
    ) {
      return `${utilityPrefix}-${alias.suffix}`;
    }
    if (
      alias.namespace === "radius" &&
      RADIUS_UTILITY_PREFIXES.includes(utilityPrefix)
    ) {
      return `${utilityPrefix}-${alias.suffix}`;
    }
  }
  return null;
}

// Minimal shapes for the JSX AST nodes this rule inspects. ESLint's core
// `Rule.Node` type (from the `estree` package) doesn't include JSX, so these
// are declared locally rather than pulling in `@typescript-eslint/utils`.
interface StringLiteralNode extends Rule.NodeParentExtension {
  type: "Literal";
  value: string;
  range: [number, number];
}

interface TemplateLiteralNode {
  type: "TemplateLiteral";
  expressions: unknown[];
  quasis: Array<{ value: { raw: string }; range: [number, number] }>;
}

interface JSXExpressionContainerNode {
  type: "JSXExpressionContainer";
  expression: TemplateLiteralNode | { type: string };
}

interface JSXAttributeNode extends Rule.NodeParentExtension {
  type: "JSXAttribute";
  name: { name: string };
  value: StringLiteralNode | JSXExpressionContainerNode | null;
}

function checkClassString(
  context: Rule.RuleContext,
  node: Rule.Node,
  rawValue: string,
  valueStart: number,
): void {
  const aliasMap = getThemeAliasMap();
  const sourceCode = context.sourceCode;
  let offset = valueStart;
  for (const chunk of rawValue.split(/(\s+)/)) {
    if (chunk.length > 0 && !/\s/.test(chunk)) {
      const { variants, base } = splitVariants(chunk);
      const canonicalBase = canonicalizeBase(base, aliasMap);
      if (canonicalBase) {
        const replacement = variants + canonicalBase;
        const start = offset;
        const end = offset + chunk.length;
        context.report({
          node,
          loc: {
            start: sourceCode.getLocFromIndex(start),
            end: sourceCode.getLocFromIndex(end),
          },
          messageId: "canonical",
          data: { original: chunk, replacement },
          fix: (fixer) => fixer.replaceTextRange([start, end], replacement),
        });
      }
    }
    offset += chunk.length;
  }
}

const preferCanonicalClass: Rule.RuleModule = {
  meta: {
    type: "suggestion",
    fixable: "code",
    schema: [],
    messages: {
      canonical:
        "'{{original}}' can be written as the canonical '{{replacement}}'.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node: unknown) {
        const attribute = node as JSXAttributeNode;
        if (attribute.name.name !== "className" || !attribute.value) return;
        const { value } = attribute;
        if (value.type === "Literal" && typeof value.value === "string") {
          checkClassString(
            context,
            value as unknown as Rule.Node,
            value.value,
            value.range[0] + 1,
          );
        } else if (
          value.type === "JSXExpressionContainer" &&
          value.expression.type === "TemplateLiteral" &&
          (value.expression as TemplateLiteralNode).expressions.length === 0
        ) {
          const quasi = (value.expression as TemplateLiteralNode).quasis[0];
          checkClassString(
            context,
            value as unknown as Rule.Node,
            quasi.value.raw,
            quasi.range[0] + 1,
          );
        }
      },
    } as Rule.RuleListener;
  },
};

const plugin: ESLint.Plugin = {
  rules: {
    "prefer-canonical-class": preferCanonicalClass,
  },
};

export default plugin;
