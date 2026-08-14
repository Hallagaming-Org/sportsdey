# Admin exports operations

Admin exports use Cloudflare Queues, D1, and the environment's R2 bucket. No deployment is performed by the implementation work.

## Required resources

- Staging queue: `sportsdey-staging-exports`
- Production queue: `sportsdey-production-exports`
- Queue producer binding: `EXPORT_QUEUE`
- Queue consumer: batch size 10, maximum concurrency 2, maximum retries 3
- Retention schedule: hourly (`0 * * * *`)
- D1 migration: `0027_admin_exports.sql`
- R2 prefixes: `exports/<jobId>/`

Create both queues in Cloudflare before deploying either named environment. Apply the D1 migration before exposing the API routes. Deploy staging first, verify queue consumption and retention with non-production records, then deploy production.

## Writer boundary

`src/utils/exports/writer.ts` implements xlsx, docx, pdf, and streaming ZIP generation. The ZIP endpoint reads successful R2 Chunk files incrementally and does not assemble the complete archive in one Worker buffer.

The ZIP endpoint must stream or incrementally assemble successful R2 Chunk files; it must not load an entire large Export into one Worker buffer.

Document Chunks are capped at 10,000 rows for xlsx/docx and 2,000 rows for pdf because the installed document libraries materialize one Chunk in Worker memory. Partial ZIPs contain `INCOMPLETE_EXPORT.txt` listing failed Chunk indexes.

## Verification

Use an authenticated admin session to check:

1. Source permission denial and owner isolation.
2. Empty-result jobs complete without queue messages.
3. Multi-chunk jobs progress from `queued` to `processing` to a terminal state.
4. Duplicate queue delivery does not process a Chunk twice.
5. Exhausted retries expose a safe error and permit a fresh-snapshot Retry.
6. Expired terminal jobs remove their R2 prefix and D1 records.

The repository currently has unrelated TypeScript errors outside the export modules. Export-only TypeScript diagnostics and the scoped Biome check should remain clean.
