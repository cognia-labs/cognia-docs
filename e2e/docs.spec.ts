import { expect, test } from "@playwright/test"
import { mkdirSync } from "node:fs"
import publication from "../integrations/cognia.json"

test("localized home pages render from the static export", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/zh\/?$/)
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cognia")
  await page.goto("/en")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Cognia")
})
test("guides expose local ownership, Markdown and correct language navigation", async ({
  page,
  request,
}, info) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  await page.goto("/en/docs/getting-started")
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("Getting Started")
  await expect(page.getByRole("link", { name: "Edit this page on GitHub" })).toHaveAttribute(
    "href",
    "https://github.com/cognia-labs/cognia-docs/edit/main/content/docs/en/getting-started.mdx"
  )
  const markdown = page.getByRole("link", { name: "View Markdown" })
  await expect(markdown).toHaveAttribute("href", "/md/en/getting-started.md")
  const response = await request.get("/md/en/getting-started.md")
  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain("Getting Started")
  await expect(page.getByRole("link", { name: "中文版本" })).toHaveAttribute(
    "href",
    "/zh/docs/getting-started"
  )
  if (info.project.name === "chromium") {
    mkdirSync(".cache/screenshots", { recursive: true })
    await page.screenshot({ path: ".cache/screenshots/docs-guide.png" })
  }
  expect(errors).toEqual([])
})
test("imported ADRs retain their real source owner", async ({ page }) => {
  await page.goto("/en/docs/adr/0242-the-browser-companion-names-the-capabilities-it-adds")
  await expect(page.getByRole("link", { name: "Edit this page on GitHub" })).toHaveAttribute(
    "href",
    `https://github.com/cognia-labs/cognia/edit/${publication.revision}/docs/content/docs/en/adr/0242-the-browser-companion-names-the-capabilities-it-adds.md`
  )
})
test("shared pages remain available in both languages", async ({ page }) => {
  for (const lang of ["en", "zh"]) {
    await page.goto(`/${lang}/docs/plugin-dev/api-overview`)
    await expect(page.getByRole("heading", { level: 1 }).first()).not.toBeEmpty()
    await expect(page.getByRole("link", { name: "Edit this page on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/cognia-labs/cognia-docs/edit/main/content/docs/plugin-dev/api-overview.mdx"
    )
  }
})
test("the complete compressed static index supports browser search", async ({ page }) => {
  await page.goto("/en/docs/getting-started")
  await page
    .getByRole("button", { name: /search/i })
    .first()
    .click()
  const input = page.getByRole("combobox")
  await expect(input).toBeVisible()
  await input.fill("Getting Started")
  await expect(page.getByRole("option").first()).toBeVisible({ timeout: 45_000 })
  await expect(page.getByRole("option").first()).toContainText(/Getting|Started/i)
})
test("404, preserved ADR redirects and machine-readable surfaces survive extraction", async ({
  page,
  request,
}) => {
  const missing = await page.goto("/en/docs/this-page-does-not-exist")
  expect(missing?.status()).toBe(404)
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible()
  const old = await request.get("/en/docs/adr/0242-macos-screen-off-virtual-display", {
    maxRedirects: 0,
  })
  expect(old.status()).toBe(301)
  for (const route of [
    "/llms.txt",
    "/en/llms-full.txt",
    "/zh/llms-full.txt",
    "/sitemap.xml",
    "/robots.txt",
  ]) {
    const response = await request.get(route)
    expect(response.ok(), route).toBe(true)
    expect((await response.body()).length).toBeGreaterThan(30)
  }
})
