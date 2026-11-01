// Codegen: turn the bilingual Fumadocs source tree into a compact, bundled
// retrieval corpus for the in-app Support Agent. The main app is a static
// export, so runtime filesystem reads are unavailable; the generated JSON is
// loaded only when a Support session needs documentation.

import { existsSync, mkdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { Command, CommanderError } from "commander"
import { globSync } from "glob"
import matter from "gray-matter"
import writeFileAtomic from "write-file-atomic"
import { z } from "zod"
import { urlsForContentPath } from "../gates/check-docs-links.mjs"

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, "..", "..")
const DOCS_ROOT = path.join(REPO_ROOT, "content", "docs")
const OUT_FILE = path.join(REPO_ROOT, "artifacts", "support-docs.json")
const MAX_DOCUMENT_CHARS = 2_400

function markdownFiles(root) {
  return globSync("**/*.{md,mdx}", { cwd: root, nodir: true }).sort()
}

function cleanMarkdown(markdown) {
  return markdown
    .replace(/^\s*(?:import|export)\s.+$/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[{}*_~>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function extractDocument(relativePath, source) {
  const { data, content } = matter(source)
  const heading = content.match(/^\s*#\s+(.+)$/m)?.[1]
  const title = cleanMarkdown(String(data?.title ?? heading ?? path.basename(relativePath)))
  const description = typeof data?.description === "string" ? cleanMarkdown(data.description) : ""
  const body = cleanMarkdown(content)
  const text = [description, body].filter(Boolean).join(" ").slice(0, MAX_DOCUMENT_CHARS).trim()
  return { path: relativePath.split(path.sep).join(path.posix.sep), title, text }
}

export function buildCorpus(root = DOCS_ROOT) {
  return Object.fromEntries(
    ["en", "zh"].map((locale) => {
      const localeRoot = path.join(root, locale)
      const documents = markdownFiles(localeRoot).map((relativePath) =>
        extractDocument(relativePath, readFileSync(path.join(localeRoot, relativePath), "utf8"))
      )
      return [locale, documents]
    })
  )
}

export function renderCorpusModule(corpus) {
  return `${JSON.stringify({ schemaVersion: 1, locales: corpus })}\n`
}

export function writeCorpusIfChanged(
  root = DOCS_ROOT,
  output = OUT_FILE,
  rendered = renderCorpusModule(buildCorpus(root))
) {
  if (existsSync(output) && readFileSync(output, "utf8") === rendered) return false
  mkdirSync(path.dirname(output), { recursive: true })
  writeFileAtomic.sync(output, rendered)
  return true
}

const cliSchema = z.object({ check: z.boolean().default(false) })

function createProgram() {
  return new Command()
    .name("pnpm artifacts:build")
    .description("Build or verify the bundled Support Agent documentation corpus.")
    .configureOutput({ writeErr: () => {} })
    .showHelpAfterError()
    .exitOverride()
    .option("--check", "Verify the generated corpus without writing it.")
}

export function parseArgs(argv) {
  const program = createProgram()
  try {
    program.parse(argv, { from: "user" })
  } catch (error) {
    if (error instanceof CommanderError && error.code === "commander.helpDisplayed") return null
    throw error
  }
  return cliSchema.parse(program.opts())
}

export function renderPageIndex(root = DOCS_ROOT) {
  const urls = [...new Set(markdownFiles(root).flatMap((file) => urlsForContentPath(file)))].sort()
  return JSON.stringify({ schemaVersion: 1, urls }) + "\n"
}

export function writePublicationArtifacts(
  { check = false } = {},
  root = DOCS_ROOT,
  output = OUT_FILE
) {
  const corpus = renderCorpusModule(buildCorpus(root))
  const pages = renderPageIndex(root)
  const indexPath = path.join(path.dirname(output), "doc-pages.json")
  const same = (file, text) => existsSync(file) && readFileSync(file, "utf8") === text
  if (check) {
    if (!same(output, corpus) || !same(indexPath, pages))
      throw new Error("Documentation artifacts are stale; run pnpm artifacts:build")
    return false
  }
  const changed = writeCorpusIfChanged(root, output, corpus)
  const pagesChanged = !same(indexPath, pages)
  if (pagesChanged) writeFileAtomic.sync(indexPath, pages)
  return changed || pagesChanged
}
function main(argv) {
  const options = parseArgs(argv)
  if (!options) return
  const changed = writePublicationArtifacts(options)
  console.log(`${changed ? "Generated" : "Verified"} documentation corpus and page index`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
}
