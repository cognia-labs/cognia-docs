import assert from "node:assert/strict"
import { test } from "node:test"
import { prepareDeployment } from "./prepare-deployment.mjs"
const valid = {
  DEPLOY_ENVIRONMENT: "staging",
  NEXT_PUBLIC_DOCS_SITE_URL: "https://docs.example.org",
  NEXT_PUBLIC_WEB_SITE_URL: "https://example.org",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CF_DOCS_PAGES_PROJECT: "cognia-docs",
  CLOUDFLARE_API_TOKEN: "private-token-never-logged",
}
test("maps staging and production explicitly without exposing secrets", () => {
  assert.equal(prepareDeployment(valid).branch, "staging")
  assert.equal(prepareDeployment({ ...valid, DEPLOY_ENVIRONMENT: "production" }).branch, "main")
  assert.ok(!JSON.stringify(prepareDeployment(valid)).includes(valid.CLOUDFLARE_API_TOKEN))
})
test("reports missing configuration and rejects unsafe canonical origins", () => {
  assert.equal(prepareDeployment({}).ready, false)
  for (const url of [
    "http://docs.example.org",
    "https://localhost",
    "https://user:pass@docs.example.org",
    "https://docs.example.org/path",
    "https://docs.example.org?token=x",
    "https://docs.example.org#x",
  ])
    assert.equal(prepareDeployment({ ...valid, NEXT_PUBLIC_DOCS_SITE_URL: url }).ready, false)
  assert.equal(prepareDeployment({ ...valid, NEXT_PUBLIC_WEB_SITE_URL: undefined }).ready, true)
  assert.throws(() => prepareDeployment({ DEPLOY_ENVIRONMENT: "unknown" }), /staging or production/)
})
