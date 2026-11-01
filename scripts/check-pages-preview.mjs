#!/usr/bin/env node
/** Exercise the real Pages redirect/asset/Worker boundary after the export is built. */
import assert from "node:assert/strict"
import { setTimeout } from "node:timers/promises"
const origin = process.env.PAGES_PREVIEW_URL ?? "http://127.0.0.1:8789"
let available = false
for (let attempt = 0; attempt < 80; attempt++) {
  try {
    if ((await fetch(origin + "/en")).ok) {
      available = true
      break
    }
  } catch {}
  await setTimeout(500)
}
assert.ok(available, "Pages preview did not become ready")
const root = await fetch(origin + "/", { redirect: "manual" })
assert.equal(root.status, 302)
assert.equal(root.headers.get("location"), "/zh/")
for (const route of [
  "/en/docs/getting-started",
  "/zh/docs/getting-started",
  "/md/en/getting-started.md",
  "/llms.txt",
])
  assert.equal((await fetch(origin + route)).status, 200, route)
assert.equal((await fetch(origin + "/en/docs/this-page-does-not-exist")).status, 404)
const old = await fetch(origin + "/en/docs/adr/0242-macos-screen-off-virtual-display", {
  redirect: "manual",
})
assert.equal(old.status, 301)
const search = await fetch(origin + "/api/search")
assert.equal(search.status, 200)
assert.equal(search.headers.get("content-encoding"), "gzip")
const index = await search.json()
assert.ok(index.docs && index.index, "Complete search JSON must survive Pages gzip handling")
console.log(
  "[pages-preview] redirects, locales, deep links, Markdown, 404 and compressed search passed"
)
