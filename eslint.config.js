// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // supabase/functions/** is Deno code (a separate runtime/type system, Deno.serve, npm:
  // specifiers) deployed independently of this Vite/Node project — not part of its TS program.
  { ignores: ["dist/**", "node_modules/**", "eslint.config.js", "supabase/functions/**"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.app.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": [
        "warn",
        { allowExpressions: true },
      ],
    },
  },
  {
    files: ["vite.config.ts", "vitest.config.ts", "playwright.config.ts", "e2e/**/*.ts"],
    languageOptions: {
      parserOptions: {
        project: ["./tsconfig.node.json"],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
);
