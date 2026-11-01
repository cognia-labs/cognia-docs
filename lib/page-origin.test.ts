import { pageOrigin } from "./page-origin"

describe("page ownership", () => {
  it("edits product guides in the standalone docs repository", () => {
    expect(pageOrigin("en/getting-started.mdx")).toEqual({
      repository: "cognia-labs/cognia-docs",
      branch: "main",
      sourcePath: "content/docs/en/getting-started.mdx",
    })
  })
  it("keeps imported ADR ownership and immutable provenance in the product repository", () => {
    const origin = pageOrigin("en/adr/0242-the-browser-companion-names-the-capabilities-it-adds.md")
    expect(origin.repository).toBe("cognia-labs/cognia")
    expect(origin.branch).toBe("dev")
    expect(origin.sourcePath).toBe(
      "docs/content/docs/en/adr/0242-the-browser-companion-names-the-capabilities-it-adds.md"
    )
    expect(origin.revision).toMatch(/^[a-f0-9]{40}$/)
    expect(Number.isFinite(Date.parse(origin.lastModified!))).toBe(true)
  })
  it("preserves the shared content path without adding a language prefix", () => {
    expect(pageOrigin("plugin-dev/api-overview.mdx").sourcePath).toBe(
      "content/docs/plugin-dev/api-overview.mdx"
    )
  })
})
