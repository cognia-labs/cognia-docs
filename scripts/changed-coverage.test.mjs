import assert from "node:assert/strict"
import test from "node:test"
import { coverageFiles, needsFullCoverage } from "./changed-coverage.mjs"

test("changed coverage selects authored source while excluding vendor and non-runtime files", () => {
  assert.deepEqual(
    coverageFiles([
      "hooks/use-reduced-motion.ts",
      "components/reveal.tsx",
      "components/reveal.tsx",
      "components/ui/button.tsx",
      "hooks/use-reduced-motion.test.tsx",
      "lib/types.d.ts",
      "app/page.tsx",
      "content/en.ts",
    ]),
    ["components/reveal.tsx", "hooks/use-reduced-motion.ts"]
  )
})
test("full-mode coverage follows shared configuration changes or explicit full validation", () => {
  assert.equal(needsFullCoverage(["components/reveal.tsx"]), false)
  assert.equal(needsFullCoverage(["components/reveal.tsx"], true), true)
  for (const path of [
    "package.json",
    "pnpm-lock.yaml",
    "jest.config.mjs",
    "scripts/build-evidence.mjs",
    ".github/workflows/ci.yml",
  ])
    assert.equal(needsFullCoverage([path]), true, path)
})
