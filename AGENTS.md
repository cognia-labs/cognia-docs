# Cognia documentation

This independent repository owns the public docs site and product guides. ADRs, API contracts and research stay in cognia-labs/cognia. Follow the root manifests for commands.

- Use Node 26 and packageManager-pinned pnpm. Normal install/dev/test/build/deploy must require no parent configuration, sibling checkout or source download.
- Preserve Next.js static export and the Pages compressed-search Worker. Read the installed Next.js guides before framework changes. The exported artifact is out/.
- ADRs and generated API reference listed in integrations/cognia.json are read-only publication snapshots. Refresh with pnpm publication:import --source-root <cognia checkout>; never edit imported files directly.
- Keep source and co-located tests together. UI text belongs in both messages/en.json and messages/zh-CN.json. Run pnpm check and production Playwright tests. Do not run local coverage without an explicit user request; full-mode CI retains 90% changed-file thresholds.
- Use the existing Prettier and ESLint configuration. Keep scratch output in .cache/. Never commit secrets or build outputs.
- Main-app Support Agent consumers use the committed artifacts/support-docs.json at an exact commit. Rebuild it with pnpm artifacts:build and verify with pnpm artifacts:check.
