import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Google Apps Script (entry points appear unused to ESLint)
    "docs/google-sheets-sync.js",
    // Marp CLI config (CommonJS)
    "marp.config.js",
  ]),
]);

export default eslintConfig;
