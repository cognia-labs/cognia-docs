import publication from "@/integrations/cognia.json"

export interface PageOrigin {
  repository: string
  branch: string
  sourcePath: string
  revision?: string
  lastModified?: string
}
const imported = new Map(publication.files.map((file) => [file.path, file]))

export function pageOrigin(contentPath: string): PageOrigin {
  const file = imported.get(contentPath)
  if (file)
    return {
      repository: publication.repository,
      branch: publication.branch,
      sourcePath: file.sourcePath,
      revision: publication.revision,
      lastModified: file.lastModified,
    }
  return {
    repository: "cognia-labs/cognia-docs",
    branch: "main",
    sourcePath: `content/docs/${contentPath}`,
  }
}
