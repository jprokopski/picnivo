import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tailwindcss from "eslint-plugin-tailwindcss";
import eslintConfigPrettier from "eslint-config-prettier";
import localTailwind from "./eslint-rules/tailwind-canonical-values.ts";

export default tseslint.config(
  {
    ignores: [
      ".output/",
      "node_modules/",
      "src/routeTree.gen.ts",
      "src/api/picnivo-api.ts",
      "src/locales/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  tailwindcss.configs.recommended,
  {
    settings: {
      tailwindcss: {
        cssConfigPath: "src/styles.css",
      },
    },
    rules: {
      // False positives on non-literal args (e.g. cn(...inputs)) and
      // library-owned hook classnames (e.g. Sonner's "toaster").
      "tailwindcss/no-custom-classname": "off",
    },
  },
  {
    plugins: {
      local: localTailwind,
    },
    rules: {
      "local/prefer-canonical-class": "warn",
    },
  },
  {
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  eslintConfigPrettier,
);
