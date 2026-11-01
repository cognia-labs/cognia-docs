import nextJest from "next/jest.js"

const createJestConfig = nextJest({ dir: "./" })
const coverageFiles = process.env.COGNIA_COVERAGE_FILES
  ? JSON.parse(process.env.COGNIA_COVERAGE_FILES)
  : null

export default createJestConfig({
  testEnvironment: "jsdom",
  ...(coverageFiles
    ? {
        collectCoverageFrom: coverageFiles,
        coverageThreshold: Object.fromEntries(
          coverageFiles.map((path) => [
            `./${path}`,
            { lines: 90, branches: 90, functions: 90, statements: 90 },
          ])
        ),
      }
    : {}),
  ...(process.env.DOCS_CI_REPORTS === "true" ? { reporters: ["default", "jest-junit"] } : {}),
  clearMocks: true,
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  testMatch: ["<rootDir>/{app,components,hooks,lib,content}/**/*.test.{ts,tsx}"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/", "/out/", "/.cache/"],
  cacheDirectory: "<rootDir>/.cache/jest",
})
