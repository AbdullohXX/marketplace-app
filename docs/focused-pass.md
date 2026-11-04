> Historical audit. The later implementation and deployment status is in [workspace-release.md](workspace-release.md).

# Focused UI and reliability pass — 4 November 2026

## Direction and five observed issues
Live mobile screenshot: ../before-mobile.png. Existing inventory and seller names were retained; imagery remains the project's illustrative SVG assets, not verified product photography. Green/cream palette and editorial heading type remain recognizable; product names/prices use sans-serif, consistent square images, 44px save/add targets, readable tabular prices and predictable bottom actions.

Five observed issues: inventory below hero and editorial carousel; tiny seller labels and prices; cramped 32px product actions; placeholder-only main search; seller discovery link incorrectly targeting analytics. Fixed with compact mobile hero, inventory before editorial content, clearer cards, persistent search label and correct shop link. Shared styles applied before page-specific changes. No new urgency badges or fabricated ratings were added.

| Page | Objective / essential information | Primary action | Friction and change |
|---|---|---|---|
| Home | Find relevant inventory / category and price | Explore collection | Long introductory stack; shorten hero and move editorial content after catalog |
| Search | Narrow inventory / result count, seller, sort, price | Search / clear filters | Placeholder-only label and URL state partly ignored; persistent label, reset, restore seller/sort |
| Product | Decide whether to buy / price, availability, seller | Add to bag | Small price hierarchy; larger price and full-width mobile action, no obstructive sticky bar |
| Dashboard | Understand demo performance / booked values and order counts | Manage listings | Technical introduction and no task entry; plain-language copy, management link, wrapping metric values |

## Journey trace and boundaries
Buyer: catalog API -> PostgreSQL approved products -> product API joins SQL details/Mongo reviews -> browser cart -> POST orders -> validated input -> transaction locks products in ID order -> authoritative price/stock -> order, seller orders, items, pending payment/payout -> response -> browser receipt. Added expectedTotal to prevent silently accepting changed prices. Added optional Idempotency-Key replay storage under a transaction-level advisory lock; same key/payload replays the committed response, different payload conflicts. Browser retains a key and payload hash in session storage until acknowledged success. No address or email is stored in that retry record. Existing clients without keys retain legacy behavior.

Seller: there is no seller sign-in or seller-specific private workspace. The supported substitute is administrator token -> create/load/edit listing -> guarded API -> PostgreSQL product -> public catalog if approved. Existing protected load UI is retained. Handling orders/fulfillment is still absent. Adding seller access without identity/ownership would be unsafe; it is not presented as completed.

## Checks actually performed
12 tests pass: domain validation, SQL-authoritative pricing, split orders, stock/unapproved rollback, catalog filtering, admin authorization, completed-checkout replay and changed-total rollback. Tests use substitutes, not a real PostgreSQL concurrency simulation. Existing disposable-database integration test is available but not run: only .env.example exists locally.

Browser: Chrome live-before mobile capture and local-after screenshots for home/search/product/dashboard at 360/390/768/1440. All 16 combinations show no document overflow or rendered error messages. Long product titles, 100,000,000 UZS prices and 2x CSS zoom at 360px were injected; final document overflow false. CSS zoom is a stress approximation, not native browser zoom certification. Search dialog focus restoration was corrected; the bulk check reads it too early (before native close event), and a separate delayed check observed focus restored. Full keyboard tab cycling, screen-reader testing and contrast audit remain incomplete. Reduced-motion CSS remains, but no full motion audit was performed. Missing-image fallback added; forced missing-image, empty-list and loading-failure journeys not comprehensively exercised.

Screenshot evidence: ../evidence/after-home-390.png, after-product-390.png, after-dashboard-1440.png and the other width/page variants. Browser result JSON includes the premature focus observation; it must not be read as an end-to-end pass. Some full-page captures show unloaded lazy images below the viewport; these are not evidence of broken assets.

## Performance / monitoring
Three sequential read samples per endpoint from this machine, no load generation:
| Endpoint | Range ms | Response bytes |
|---|---:|---:|
| health | 547-752 | 60 |
| products | 549-902 | 4089 |
| product 1 | 545-551 | 783 |
| sales stats | 665-681 | 1127 |
Raw: ../evidence/live-read-baseline.json. Includes network latency and unknown shared-service load. No comparable changed-backend measurements or EXPLAIN plans: preview proxies existing read endpoints, and updated backend is not deployed. No percentage speedup claimed. Prior directory aggregation removes client fanout by inspection, pending real SQL verification.

Added server-generated X-Request-ID and structured method/route/status/duration logs. Error logs correlate IDs without query values, request bodies or tokens. Database pool remains capped at 10. No cache added; private product reads remain no-store.

## Migration and operation
Apply the additive checkout_requests table definition in sql/01_schema.sql to an isolated development database first. Existing setup includes it; do not invoke the full demo seeding setup against production merely to migrate. The table holds UUID key, SHA-256 fingerprint, JSON response and timestamp; no credentials. Retain keys across the promised retry window; no automatic deletion policy yet. Rollback application code can leave the table in place. No new environment variables. Changes not deployed.

## Applicable edge cases / remaining priorities
1. Critical before deployment: real PostgreSQL tests for simultaneous same-key submissions, final-item competition, response lost after commit and price changes. Current unit tests cover sequential replay and rollback only. Refresh after an uncertain commit can still be obstructed by changed stock; a dedicated checkout recovery endpoint/UI is needed.
2. Implement seller identity, object-level authorization, order queue and fulfillment states before claiming a complete seller journey. Token invalidation is applicable; expiring customer sessions are not currently implemented. Admin missing/wrong token tested.
3. Browser journey through persisted checkout/admin edit on isolated DB; refresh/saved-state checks, contrast and keyboard/touch matrix, native zoom and network failure tests.
4. Collect query plans, same-environment baseline/retest and real-user vitals; add retention policy for checkout request records and migrations independent of demo seeds.
Payment callbacks, image uploads and background job retries are not applicable: none exists. Cash-on-delivery records are pending demonstration rows, not payment settlement. Subscriptions and team roles remain out of scope.
