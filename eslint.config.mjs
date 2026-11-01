import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"
import nextTypescript from "eslint-config-next/typescript"
import prettier from "eslint-config-prettier"

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Preserve the parent repository's existing vendored-UI policy.
  {
    files: ["components/ui/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  globalIgnores([
    ".next/**",
    ".source/**",
    "out/**",
    ".cache/**",
    ".wrangler/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
    "video/**",
    "public/**",
    "content/generated/**",
  ]),
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "scripts/**/*.mjs"],
    rules: { "@typescript-eslint/no-explicit-any": "off" },
  },
])
