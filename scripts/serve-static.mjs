#!/usr/bin/env node
/** Serve the actual export, including Pages redirects and the compressed-search Worker. */
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { dirname, extname, join, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import searchWorker from "./build/docs-search-worker.mjs"

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".gz": "application/gzip",
}
export function createStaticServer(directory) {
  const root = resolve(directory)
  const shippedWorker = join(root, "_worker.js")
  if (
    existsSync(shippedWorker) &&
    !readFileSync(shippedWorker).equals(
      readFileSync(new URL("./build/docs-search-worker.mjs", import.meta.url))
    )
  )
    throw new Error(
      "Shipped search Worker differs from the tested implementation; rebuild the export"
    )
  const redirects = existsSync(join(root, "_redirects"))
    ? readFileSync(join(root, "_redirects"), "utf8")
        .split("\n")
        .filter((line) => line.trim() && !line.trim().startsWith("#"))
        .map((line) => line.trim().split(/\s+/))
    : []
  function asset(pathname) {
    const path = resolve(root, pathname.replace(/^\/+/, "") || "index.html")
    if (
      !path.startsWith(root + sep) ||
      pathname.includes("\0") ||
      pathname.split("/").some((part) => part.startsWith("."))
    )
      return { status: 403 }
    const file = [path, path + ".html", join(path, "index.html")].find(
      (candidate) => existsSync(candidate) && statSync(candidate).isFile()
    )
    return file
      ? { status: 200, file }
      : {
          status: 404,
          file: existsSync(join(root, "404.html")) ? join(root, "404.html") : undefined,
        }
  }
  return createServer(async (request, response) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        response.writeHead(405, { Allow: "GET, HEAD" })
        response.end()
        return
      }
      let url, pathname
      try {
        url = new URL(request.url, "http://localhost")
        pathname = decodeURIComponent(url.pathname)
      } catch {
        response.writeHead(400)
        response.end()
        return
      }
      for (const [from, to, code] of redirects) {
        const star = from.endsWith("*") && pathname.startsWith(from.slice(0, -1))
        if (pathname === from || star) {
          const target = star ? to.replace(":splat", pathname.slice(from.length - 1)) : to
          response.writeHead(Number(code) || 302, { Location: target + url.search })
          response.end()
          return
        }
      }
      if (
        (pathname === "/api/search" || pathname === "/api/search/") &&
        existsSync(join(root, "_worker.js"))
      ) {
        const result = await searchWorker.fetch(new Request(url, { method: request.method }), {
          ASSETS: {
            async fetch(req) {
              const found = asset(new URL(req.url).pathname)
              return new Response(found.file ? readFileSync(found.file) : null, {
                status: found.status,
              })
            },
          },
        })
        const body = request.method === "HEAD" ? null : Buffer.from(await result.arrayBuffer())
        response.writeHead(result.status, Object.fromEntries(result.headers))
        response.end(body)
        return
      }
      const found = asset(pathname)
      if (!found.file) {
        response.writeHead(found.status)
        response.end()
        return
      }
      response.writeHead(found.status, {
        "Content-Type": TYPES[extname(found.file)] ?? "application/octet-stream",
        "Content-Length": statSync(found.file).size,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": pathname.startsWith("/_next/static/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=0, must-revalidate",
      })
      if (request.method === "HEAD") response.end()
      else
        createReadStream(found.file)
          .on("error", () => response.destroy())
          .pipe(response)
    } catch (error) {
      console.error(error)
      if (!response.headersSent) response.writeHead(500)
      response.end()
    }
  })
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2)
  const port = Number(process.env.PORT ?? (args[0] === "--port" ? args[1] : 3001))
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535")
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../out")
  if (!existsSync(join(root, "en.html")))
    throw new Error("Missing static export; run pnpm build first")
  createStaticServer(root).listen(port, "127.0.0.1", () =>
    console.log(`[docs-preview] http://127.0.0.1:${port}`)
  )
}
