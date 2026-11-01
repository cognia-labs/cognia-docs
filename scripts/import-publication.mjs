#!/usr/bin/env node
/** Import only committed ADRs and generated reference pages; builds verify local copies. */
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const SOURCE_PREFIX = "docs/content/docs/"
const REPOSITORY = "cognia-labs/cognia"
const MANIFEST = "integrations/cognia.json"
const SCOPES = ["en/adr/", "zh/adr/", "plugin-dev/api-reference.generated.mdx"]
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex")
export function isImportedPath(path) {
  return (
    typeof path === "string" &&
    /^[a-zA-Z0-9_./-]+$/.test(path) &&
    !path.split("/").some((p) => !p || p === "." || p === "..") &&
    (path.startsWith("en/adr/") || path.startsWith("zh/adr/") || path === SCOPES[2])
  )
}
function git(root, args, binary = false) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: binary ? undefined : "utf8",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  })
}
export function collectPublication(sourceRoot) {
  const revision = git(sourceRoot, ["rev-parse", "HEAD"]).trim()
  const rows = git(sourceRoot, [
    "ls-tree",
    "-r",
    "--format=%(objectmode) %(path)",
    revision,
    "--",
    ...SCOPES.map((p) => SOURCE_PREFIX + p),
  ])
    .trim()
    .split("\n")
    .filter(Boolean)
  const files = rows
    .map((row) => {
      const space = row.indexOf(" ")
      const mode = row.slice(0, space),
        sourcePath = row.slice(space + 1)
      const path = sourcePath.slice(SOURCE_PREFIX.length)
      if (!isImportedPath(path) || mode !== "100644")
        throw new Error(`Unsupported publication source: ${sourcePath}`)
      const original = git(sourceRoot, ["show", `${revision}:${sourcePath}`], true)
      const text = original
        .toString()
        .replace(
          /\]\(\.\.\/\.\.\/\.\.\/\.\.\/plans\/([^)]*)\)/g,
          `](https://github.com/${REPOSITORY}/blob/${revision}/docs/plans/$1)`
        )
      const bytes = Buffer.from(text)
      const lastModified = git(sourceRoot, [
        "log",
        "-1",
        "--format=%cI",
        revision,
        "--",
        sourcePath,
      ]).trim()
      return {
        path,
        sourcePath,
        sha256: digest(bytes),
        sourceSha256: digest(original),
        lastModified,
        bytes,
      }
    })
    .sort((a, b) => a.path.localeCompare(b.path, "en"))
  for (const locale of ["en", "zh"])
    if (!files.some((f) => f.path === `${locale}/adr/meta.json`))
      throw new Error(`Missing ${locale} ADR catalog`)
  return { schemaVersion: 1, repository: REPOSITORY, branch: "dev", revision, files }
}
function readManifest(root) {
  const manifest = JSON.parse(readFileSync(join(root, MANIFEST), "utf8"))
  if (
    manifest.schemaVersion !== 1 ||
    manifest.repository !== REPOSITORY ||
    manifest.branch !== "dev" ||
    !/^[a-f0-9]{40}$/.test(manifest.revision ?? "") ||
    !Array.isArray(manifest.files) ||
    manifest.files.length === 0
  )
    throw new Error("Invalid publication manifest")
  const paths = new Set()
  for (const file of manifest.files) {
    if (
      !isImportedPath(file.path) ||
      paths.has(file.path) ||
      file.sourcePath !== SOURCE_PREFIX + file.path ||
      !/^[a-f0-9]{64}$/.test(file.sha256 ?? "") ||
      !/^[a-f0-9]{64}$/.test(file.sourceSha256 ?? "") ||
      !Number.isFinite(Date.parse(file.lastModified))
    )
      throw new Error("Invalid publication manifest file")
    paths.add(file.path)
  }
  return manifest
}
export function importPublication(sourceRoot, root = ROOT) {
  const publication = collectPublication(resolve(sourceRoot))
  const old = existsSync(join(root, MANIFEST)) ? readManifest(root) : { files: [] }
  const incoming = new Set(publication.files.map((file) => file.path))
  for (const file of old.files)
    if (!incoming.has(file.path)) rmSync(join(root, "content/docs", file.path), { force: true })
  for (const file of publication.files) {
    const target = join(root, "content/docs", file.path)
    mkdirSync(dirname(target), { recursive: true })
    if (!existsSync(target) || !readFileSync(target).equals(file.bytes))
      writeFileSync(target, file.bytes)
  }
  mkdirSync(join(root, "integrations"), { recursive: true })
  const manifest = {
    ...publication,
    files: publication.files.map(({ bytes: _bytes, ...entry }) => entry),
  }
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + "\n")
  return manifest
}
export function checkPublication(root = ROOT) {
  const manifest = readManifest(root)
  const expected = new Set(manifest.files.map((file) => file.path))
  const found = new Set()
  function walk(directory, prefix) {
    if (!existsSync(directory)) return
    for (const name of readdirSync(directory)) {
      const path = join(directory, name),
        relative = prefix + name
      if (lstatSync(path).isSymbolicLink()) throw new Error(`Publication symlink: ${relative}`)
      if (lstatSync(path).isDirectory()) walk(path, relative + "/")
      else found.add(relative)
    }
  }
  for (const locale of ["en", "zh"])
    walk(join(root, "content/docs", locale, "adr"), `${locale}/adr/`)
  if (existsSync(join(root, "content/docs", SCOPES[2]))) found.add(SCOPES[2])
  if (expected.size !== found.size || [...found].some((path) => !expected.has(path)))
    throw new Error("Publication paths differ from the manifest")
  for (const file of manifest.files)
    if (digest(readFileSync(join(root, "content/docs", file.path))) !== file.sha256)
      throw new Error(`Read-only publication changed: ${file.path}`)
  return manifest
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2)
  let result
  if (args.length === 1 && args[0] === "--check") result = checkPublication()
  else if (args.length === 2 && args[0] === "--source-root") result = importPublication(args[1])
  else
    throw new Error(
      "Usage: pnpm publication:import --source-root <cognia checkout> or pnpm publication:check"
    )
  console.log(
    `[publication] ${result.repository}@${result.revision}: ${result.files.length} immutable files`
  )
}
