#!/usr/bin/env node
/** Preserve the product repository's full-mode, per-changed-file 90% CI coverage gate. */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

export function coverageFiles(paths) {
  return [...new Set(paths)]
    .filter(
      (path) =>
        /^(components|hooks|lib)\/.+\.tsx?$/.test(path) &&
        !path.startsWith("components/ui/") &&
        !/\.(test|spec|stories|d)\.tsx?$/.test(path)
    )
    .sort()
}
export function needsFullCoverage(paths, force = false) {
  return (
    force ||
    paths.some(
      (path) =>
        /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.json|next\.config\.ts|jest\.config\.mjs|jest\.setup\.ts)$/.test(
          path
        ) ||
        path.startsWith("scripts/") ||
        path.startsWith(".github/")
    )
  )
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..")
  const base = process.env.COVERAGE_BASE_SHA
  if (!base || !/^[a-f0-9]{40}$/.test(base))
    throw new Error("Set COVERAGE_BASE_SHA to the full Git base commit SHA")
  const paths = execFileSync(
    "git",
    ["diff", "--name-only", "--diff-filter=ACMR", `${base}...HEAD`],
    { cwd: root, encoding: "utf8" }
  )
    .trim()
    .split("\n")
    .filter(Boolean)
  if (!needsFullCoverage(paths, process.env.COVERAGE_FULL === "true")) {
    console.log("[coverage] incremental PR: full-mode coverage was not requested")
  } else {
    const files = coverageFiles(paths).filter((path) => existsSync(join(root, path)))
    if (!files.length) console.log("[coverage] no changed authored source files")
    else {
      const result = spawnSync(
        "pnpm",
        [
          "test",
          "--coverage",
          "--coverageReporters=text-summary",
          "--coverageReporters=json-summary",
          "--coverageDirectory=.cache/coverage",
        ],
        {
          cwd: root,
          stdio: "inherit",
          env: { ...process.env, COGNIA_COVERAGE_FILES: JSON.stringify(files) },
        }
      )
      if (result.error) throw result.error
      process.exitCode = result.status ?? 1
    }
  }
}
