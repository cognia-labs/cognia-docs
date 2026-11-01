import { docsSourcePath } from "./last-modified"

describe("docsSourcePath", () => {
  it("anchors a localized page under the content root", () => {
    expect(docsSourcePath("en/getting-started.mdx")).toBe("content/docs/en/getting-started.mdx")
  })

  it("keeps the extension fumadocs reported instead of assuming .mdx", () => {
    expect(docsSourcePath("en/adr/0001-backup-schema-v3.md")).toBe(
      "docs/content/docs/en/adr/0001-backup-schema-v3.md"
    )
  })

  it("resolves locale-shared pages, which have no language segment", () => {
    // `content/docs/plugin-dev/` is shared across locales; rebuilding this
    // path from `lang + slug` used to point at a file that doesn't exist.
    expect(docsSourcePath("plugin-dev/api-overview.mdx")).toBe(
      "content/docs/plugin-dev/api-overview.mdx"
    )
  })

  it("resolves the root index page", () => {
    expect(docsSourcePath("index.mdx")).toBe("content/docs/index.mdx")
  })
})

describe("source-aware build timestamps", () => {
  async function load(git: ReturnType<typeof jest.fn>) {
    jest.resetModules()
    jest.doMock("node:child_process", () => ({ execFileSync: git }))
    return import("./last-modified")
  }
  it("uses imported timestamps without invoking a local or sibling Git repository", async () => {
    const git = jest.fn()
    const { getDocsLastModified } = await load(git)
    const value = getDocsLastModified(
      "en/adr/0242-the-browser-companion-names-the-capabilities-it-adds.md"
    )
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(git).not.toHaveBeenCalled()
  })
  it("queries authored paths in this repository and memoizes repeated reads", async () => {
    const git = jest
      .fn()
      .mockReturnValueOnce("/docs-checkout\n")
      .mockReturnValue("2026-11-01T10:00:00+08:00\n")
    const { getDocsLastModified } = await load(git)
    expect(getDocsLastModified("en/getting-started.mdx")).toBe("2026-11-01T10:00:00+08:00")
    expect(getDocsLastModified("en/getting-started.mdx")).toBe("2026-11-01T10:00:00+08:00")
    expect(git).toHaveBeenCalledTimes(2)
    expect(git).toHaveBeenLastCalledWith(
      "git",
      ["log", "-1", "--format=%cI", "--", "content/docs/en/getting-started.mdx"],
      expect.objectContaining({ cwd: "/docs-checkout" })
    )
  })
  it("caches unavailable Git metadata while imported pages keep their timestamp", async () => {
    const git = jest.fn(() => {
      throw new Error("Git unavailable")
    })
    const { getDocsLastModified } = await load(git)
    expect(getDocsLastModified("en/getting-started.mdx")).toBeNull()
    expect(getDocsLastModified("zh/getting-started.mdx")).toBeNull()
    expect(git).toHaveBeenCalledTimes(1)
    expect(
      getDocsLastModified("en/adr/0242-the-browser-companion-names-the-capabilities-it-adds.md")
    ).not.toBeNull()
  })
  it("hides absent history and caches a failed per-file lookup", async () => {
    const git = jest
      .fn()
      .mockReturnValueOnce("/docs-checkout")
      .mockImplementation(() => {
        throw new Error("History unavailable")
      })
    const { getDocsLastModified } = await load(git)
    expect(getDocsLastModified("en/missing.mdx")).toBeNull()
    expect(getDocsLastModified("en/missing.mdx")).toBeNull()
    expect(git).toHaveBeenCalledTimes(2)
  })
})

it("treats an empty Git root or missing per-file history as unavailable metadata", async () => {
  for (const responses of [["  "], ["/docs-checkout", "  "]]) {
    jest.resetModules()
    const git = jest.fn()
    for (const value of responses) git.mockReturnValueOnce(value)
    jest.doMock("node:child_process", () => ({ execFileSync: git }))
    const { getDocsLastModified } = await import("./last-modified")
    expect(getDocsLastModified("en/absent.mdx")).toBeNull()
  }
})
