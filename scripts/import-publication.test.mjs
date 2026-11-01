import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { checkPublication, importPublication, isImportedPath } from "./import-publication.mjs"
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "publication-")),
    source = join(root, "source"),
    target = join(root, "target")
  t.after(() => rmSync(root, { recursive: true, force: true }))
  mkdirSync(source)
  mkdirSync(target)
  const git = (args) => execFileSync("git", ["-C", source, ...args], { stdio: "pipe" })
  git(["init", "-q", "-b", "fixture"])
  git(["config", "user.name", "Fixture"])
  git(["config", "user.email", "fixture@example.invalid"])
  for (const lang of ["en", "zh"]) {
    const dir = join(source, `docs/content/docs/${lang}/adr`)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "meta.json"), "{}")
    writeFileSync(join(dir, "0001-example.md"), "# Example\n[Plan](../../../../plans/example.md)\n")
  }
  writeFileSync(join(source, "private.txt"), "never imported")
  git(["add", "--", "docs", "private.txt"])
  git(["commit", "-q", "-m", "test: add source fixture"])
  return { source, target, git }
}
test("imports committed, bounded sources with provenance and rewritten plan links", (t) => {
  const { source, target } = fixture(t),
    manifest = importPublication(source, target)
  assert.equal(manifest.files.length, 4)
  assert.equal(checkPublication(target).revision, manifest.revision)
  const content = readFileSync(join(target, "content/docs/en/adr/0001-example.md"), "utf8")
  assert.ok(content.includes(`/blob/${manifest.revision}/docs/plans/example.md`))
  writeFileSync(join(source, "docs/content/docs/en/adr/0001-example.md"), "uncommitted")
  importPublication(source, target)
  assert.equal(readFileSync(join(target, "content/docs/en/adr/0001-example.md"), "utf8"), content)
})
test("normal build verification rejects edited and injected mirror files without a source checkout", (t) => {
  const { source, target } = fixture(t)
  importPublication(source, target)
  writeFileSync(join(target, "content/docs/en/adr/0001-example.md"), "tampered")
  assert.throws(() => checkPublication(target), /Read-only/)
  importPublication(source, target)
  writeFileSync(join(target, "content/docs/en/adr/extra.md"), "injected")
  assert.throws(() => checkPublication(target), /paths/)
})
test("a refresh removes records deleted from the committed source", (t) => {
  const { source, target, git } = fixture(t)
  importPublication(source, target)
  git(["rm", "docs/content/docs/en/adr/0001-example.md"])
  git(["commit", "-q", "-m", "test: retire source record"])
  const manifest = importPublication(source, target)
  assert.equal(manifest.files.length, 3)
  checkPublication(target)
})
test("rejects path traversal and symlinks in imported sources", (t) => {
  for (const p of [
    "../private",
    "en/adr/../../private",
    "/en/adr/x.md",
    "en/adr//x.md",
    "en/other.md",
  ])
    assert.equal(isImportedPath(p), false)
  const { source, target, git } = fixture(t)
  symlinkSync("../../../../private.txt", join(source, "docs/content/docs/en/adr/link.md"))
  git(["add", "docs/content/docs/en/adr/link.md"])
  git(["commit", "-q", "-m", "test: add unsupported symlink"])
  assert.throws(() => importPublication(source, target), /Unsupported publication/)
})
