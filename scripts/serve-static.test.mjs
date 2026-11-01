import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { gzipSync } from "node:zlib"
import { test } from "node:test"
import { createStaticServer } from "./serve-static.mjs"
async function fixture(t, worker = false) {
  const root = mkdtempSync(join(tmpdir(), "docs-preview-"))
  for (const file of ["en/docs/guide.html", "404.html", "md/en/guide.md"]) {
    mkdirSync(join(root, file, ".."), { recursive: true })
    writeFileSync(join(root, file), file)
  }
  writeFileSync(join(root, "_redirects"), "/ /zh/ 302\n/docs/* /zh/docs/:splat 302\n")
  writeFileSync(join(root, ".env"), "must not be served")
  if (worker) {
    mkdirSync(join(root, "api"))
    writeFileSync(
      join(root, "_worker.js"),
      readFileSync(new URL("./build/docs-search-worker.mjs", import.meta.url))
    )
    writeFileSync(
      join(root, "api/search-index.json.gz"),
      gzipSync(JSON.stringify({ en: "Guide", zh: "指南" }))
    )
  }
  const server = createStaticServer(root)
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
    rmSync(root, { recursive: true, force: true })
  })
  return `http://127.0.0.1:${server.address().port}`
}
test("serves clean URLs, Markdown, 404s and Pages redirects", async (t) => {
  const base = await fixture(t)
  assert.equal(await (await fetch(base + "/en/docs/guide")).text(), "en/docs/guide.html")
  const markdown = await fetch(base + "/md/en/guide.md")
  assert.match(markdown.headers.get("content-type"), /text\/markdown/)
  assert.equal((await fetch(base + "/missing")).status, 404)
  const redirect = await fetch(base + "/docs/guide?q=1", { redirect: "manual" })
  assert.equal(redirect.status, 302)
  assert.equal(redirect.headers.get("location"), "/zh/docs/guide?q=1")
})
test("runs the shipped compressed-search response through the Worker", async (t) => {
  const base = await fixture(t, true),
    response = await fetch(base + "/api/search")
  assert.equal(response.headers.get("content-encoding"), "gzip")
  assert.deepEqual(await response.json(), { en: "Guide", zh: "指南" })
  assert.equal((await fetch(base + "/api/search", { method: "HEAD" })).status, 200)
})
test("rejects traversal, hidden assets and unsupported methods", async (t) => {
  const base = await fixture(t)
  assert.equal((await fetch(base + "/%2e%2e%2fpackage.json")).status, 403)
  assert.equal((await fetch(base + "/.env")).status, 403)
  assert.equal((await fetch(base + "/en/docs/guide", { method: "POST" })).status, 405)
  assert.equal(
    (await fetch(base + "/en/docs/guide", { method: "HEAD" })).headers.get("content-length"),
    String("en/docs/guide.html".length)
  )
})

test("rejects a shipped search Worker that differs from the tested implementation", (t) => {
  const root = mkdtempSync(join(tmpdir(), "docs-worker-drift-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  writeFileSync(
    join(root, "_worker.js"),
    "export default { fetch() { return new Response('wrong') } }"
  )
  assert.throws(() => createStaticServer(root), /Worker.*differs/)
})
