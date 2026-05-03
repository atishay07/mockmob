import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "dist/**",
    "artifacts/**",
    ".turbo/**",
    ".vercel/**",
    ".claude/**",
    ".claude/worktrees/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
