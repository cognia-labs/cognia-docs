# Cognia documentation

The independent, bilingual documentation site for [Cognia](https://github.com/cognia-labs/cognia). It exports static pages, client-side search, Markdown twins, `llms.txt`, sitemaps and canonical metadata. Production hosting uses Cloudflare Pages with a small compressed-search Worker; no runtime Next.js server is required.

## Develop and verify

Use Node 26 and the packageManager-pinned pnpm:

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm check
pnpm exec playwright install chromium
pnpm test:e2e
```

Development and static preview use port 3001. Browser tests start the production preview on port 3101. `pnpm start` serves the actual `out/` export, clean URLs, redirects, 404s and the compressed search response. Build before running it. `pnpm preview:pages` runs the real Pages runtime on port 8789; `node scripts/check-pages-preview.mjs` verifies its redirects and gzip handling.

`pnpm check` runs formatting, lint, strict type checking, script/unit tests, bilingual content gates, snapshot integrity and the production export. TypeScript's API-compatible package supports ESLint, while the separately pinned native compiler supplies `tsc`. Coverage is not part of ordinary local checks; full-mode PR CI retains the original 90% changed-file thresholds.

## Content ownership

Product guides and the site live here. ADRs, API contracts, plans, research, evidence and operational documents remain in the product repository. Entries listed in `integrations/cognia.json` are read-only publication snapshots with exact source commit, paths, SHA-256 and timestamps. Their edit links point back to the real owner.

Refresh deliberately from a product checkout:

```sh
pnpm publication:import --source-root /path/to/cognia
pnpm artifacts:build
pnpm check
```

The importer reads committed content only. It never copies arbitrary checkout files, follows symlinks, or imports uncommitted edits. `pnpm publication:check` detects edited, missing and injected snapshot files without accessing the product checkout. Normal install, test, build and deploy require no parent configuration, sibling checkout or source download.

The original conflicting virtual-display ADR URL redirects to ADR-0251 in both HTML and Markdown. Keep these redirects when refreshing the source.

## Application help publication

`artifacts/support-docs.json` is the application's versioned offline support corpus. `artifacts/doc-pages.json` lists the published documentation URLs for the product repository's ADR link gate. Rebuild both with `pnpm artifacts:build`; CI checks their deterministic bytes.

After committing a docs update, update the application explicitly:

```sh
pnpm docs:sync --docs-root /path/to/cognia-docs
pnpm docs:check
```

Run these two commands in the product repository. They read committed docs artifacts and save an exact repository revision and hashes. Application builds verify local copies rather than retrieving live website content.

## CI and deployment

CI installs only this repository, runs `pnpm check`, Chromium desktop/mobile journeys and the real Pages local runtime, then uploads a compressed static artifact and browser diagnostics.

The **Deploy docs** workflow accepts `staging` or `production` and an optional dry run. Each matching GitHub Environment needs:

| Kind              | Name                    | Value                                     |
| ----------------- | ----------------------- | ----------------------------------------- |
| Secret            | `CLOUDFLARE_API_TOKEN`  | Token scoped to deploy this Pages project |
| Variable          | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account identifier             |
| Variable          | `CF_DOCS_PAGES_PROJECT` | Existing Pages project name               |
| Variable          | `DOCS_SITE_URL`         | Public HTTPS origin for that environment  |
| Optional variable | `WEB_SITE_URL`          | Public marketing website origin           |

Dry runs list missing keys without printing secrets or uploading. Real deployments fail before installation when required configuration is absent. Production publishes the `main` Pages branch; staging publishes `staging`. Publishing is serialized per environment. Keep `api/search-index.json.gz`, `_worker.js` and `_routes.json` with the complete export; uploading HTML alone breaks oversized search indexes. The build enforces the 25 MiB compressed-asset ceiling.

Before a production cutover, exercise staging URLs and retire the old repository's publishing entry point. Roll back by deploying a previously verified docs commit and, separately, reverting the application's corpus pin. No product Git history needs rewriting.

See [NOTICE](NOTICE) for extraction provenance and [LICENSE](LICENSE) for AGPL-3.0.
