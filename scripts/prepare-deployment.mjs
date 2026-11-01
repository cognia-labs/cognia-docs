#!/usr/bin/env node
/** Validate deploy inputs without leaking credentials or publishing placeholder origins. */
import { appendFileSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
function publicOrigin(value) {
  try {
    const url = new URL(value)
    return (
      url.protocol === "https:" &&
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    )
  } catch {
    return false
  }
}
export function prepareDeployment(env) {
  const environment = env.DEPLOY_ENVIRONMENT ?? "staging"
  if (!["staging", "production"].includes(environment))
    throw new Error("DEPLOY_ENVIRONMENT must be staging or production")
  const missing = []
  if (!publicOrigin(env.NEXT_PUBLIC_DOCS_SITE_URL))
    missing.push("DOCS_SITE_URL (public HTTPS origin)")
  if (env.NEXT_PUBLIC_WEB_SITE_URL && !publicOrigin(env.NEXT_PUBLIC_WEB_SITE_URL))
    missing.push("WEB_SITE_URL (public HTTPS origin)")
  if (!/^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID ?? ""))
    missing.push("CLOUDFLARE_ACCOUNT_ID")
  if (!/^[a-z0-9][a-z0-9-]*$/.test(env.CF_DOCS_PAGES_PROJECT ?? ""))
    missing.push("CF_DOCS_PAGES_PROJECT")
  if (!env.CLOUDFLARE_API_TOKEN?.trim()) missing.push("CLOUDFLARE_API_TOKEN (environment secret)")
  return {
    ready: missing.length === 0,
    missing,
    environment,
    branch: environment === "production" ? "main" : "staging",
  }
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const result = prepareDeployment(process.env)
  if (process.env.GITHUB_OUTPUT)
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      `ready=${result.ready}\npages_branch=${result.branch}\n`
    )
  const summary = `## Docs deployment: ${result.environment}\n\n${result.ready ? "Configuration is complete." : "Missing configuration:\n" + result.missing.map((name) => `- ${name}`).join("\n")}\n`
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary)
  console.log(summary)
  if (!result.ready && process.env.DRY_RUN !== "true") process.exitCode = 1
}
