import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { parse } from "yaml"
const read = (name) =>
  parse(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), "utf8"))
test("CI proves independent install, build, browser and real Pages behavior", () => {
  const workflow = read("ci.yml"),
    steps = workflow.jobs.docs.steps,
    runs = steps
      .map((s) => s.run)
      .filter(Boolean)
      .join("\n")
  assert.match(runs, /pnpm install --frozen-lockfile/)
  assert.match(runs, /pnpm check/)
  assert.match(runs, /pnpm test:e2e/)
  assert.match(runs, /check-pages-preview/)
  assert.equal(steps.filter((s) => s.uses?.startsWith("actions/checkout")).length, 1)
  assert.match(workflow.jobs["changed-coverage"].steps.at(-1).run, /coverage:changed/)
})
test("deploy validates before install, uses protected environment secrets and serializes publishing", () => {
  const workflow = read("deploy.yml"),
    job = workflow.jobs.deploy,
    steps = job.steps
  assert.equal(workflow.concurrency["cancel-in-progress"], false)
  assert.equal(job.environment, "${{ inputs.environment }}")
  const prepare = steps.findIndex((s) => s.id === "prepare"),
    install = steps.findIndex((s) => s.run === "pnpm install --frozen-lockfile")
  assert.ok(prepare >= 0 && prepare < install)
  const publish = steps.find((s) => s.run?.includes("wrangler pages deploy"))
  assert.equal(publish.if, "inputs.dry_run != true")
  assert.equal(publish.env.CLOUDFLARE_API_TOKEN, "${{ secrets.CLOUDFLARE_API_TOKEN }}")
})
