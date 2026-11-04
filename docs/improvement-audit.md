> Historical audit. The later implementation and deployment status is in [workspace-release.md](workspace-release.md).

# Savdo improvement audit — 4 November 2026

## Confirmed product and stack
Source inspection: Express 5, Node 24 in Render, plain JavaScript ES modules and CSS, PostgreSQL via pg, MongoDB via the official driver. No React, Supabase, payment gateway, image upload service, customer sessions or seller identity system. Illustrative homewares, bags and stationery are sold through a demonstration multi-seller checkout in whole UZS. English interface; green/cream brand; Arial body and Georgia editorial headings. Preserve these conventions.

Anonymous visitors browse, review and place demo orders. Saved products and receipts live in browser storage. Product writes use an administrator bearer token. Dashboard aggregates are public demo information, not an authenticated seller workspace. There is no private order-read API. Account recovery, seller onboarding, fulfillment updates, billing and messaging are absent, not broken existing features.

## Prioritized findings
| Priority / journey | Observed evidence | Impact | Fix / effort and dependencies | Acceptance |
|---|---|---|---|---|
| P1 administration | manage() accepts a product ID but never loads existing values | Editing requires manually reconstructing every field | Implemented protected read endpoint and Load existing product; small, existing admin token | Missing/wrong token rejected before DB access; drafts load; 404 and invalid ID handled; errors preserve fields |
| P1 shop | shop() fetched only first 12 products, no pagination | Later inventory inaccessible | Implemented URL pagination; small, existing catalog API | Previous/next preserve seller; page reload retains selection; empty page can return to page 1 |
| P1 checkout retries | Server transaction exists, no idempotency key | A lost response followed by retry may create duplicate orders | Next: durable request key with unique constraint and replay; medium, migration and concurrency tests | Same key returns same order; altered payload rejected; concurrent requests decrement stock once |
| P1 identity | No seller accounts or object-level seller permissions | Cannot offer a private professional workspace safely | Next: identity and store ownership before seller-scoped writes; large | Seller A cannot read/write B's private data; admin separately authorized |
| P2 directories | pages.js made one product request per category/shop; each product request ran list+count queries | Unnecessary request fanout and full product payloads | Implemented aggregate counts and bounded preview ID arrays on existing directory APIs; small | Only active approved products counted; no per-tile fetch; empty directories remain usable |
| P2 search | Earlier local patch cancels superseded requests and versions responses | Prevent stale results while typing | Included existing local improvement | Latest query wins, including after dialog close/reopen |
| P2 visual interactions | Earlier local patch added animation and focus treatment | Clearer feedback and keyboard visibility | Retained reveal, dialog, page, hover and cart feedback; reduced-motion handling | Manual desktop/mobile and assistive technology review still needed |
| P2 saved list | Requests up to 50 full detail records including reviews | Excess payload; transient failure silently drops cards | Next: bounded batch summaries with explicit unavailable state; medium | Removed products distinguished from request errors |
| P2 operations | Render runs db:setup on every startup | Startup couples service availability to demo seed/schema execution | Next: separate versioned migrations and explicit demo seed command; medium | Restart does not reseed; migration/rollback tested on disposable database |
| P3 seller dashboard | Aggregate charts and token-only product editor | Useful demonstration, not full SaaS workflow | Propose authenticated inventory table, order work queue and store settings after identity | Real ownership, persisted states and useful empty/error states |

## Implemented scope
Admin read endpoint uses the same server-side permission guard as writes, selects explicit fields, parameterizes IDs, excludes archived records and sets Cache-Control: no-store. The editor fills persistent labeled inputs, preserves them after request failure, disables load/save during loading, and reports the loaded publication state. Authorization remains administrator-wide; this does not add seller roles.

Directory aggregates keep existing API fields and add product_count/preview_ids. SQL joins only active approved inventory. Output preview arrays are capped to two category images and three shop images. This removes client request fanout by code inspection; no latency improvement percentage is claimed. Aggregate computation still scans matching inventory; representative query plans should precede further indexing or large-scale use.

Shop pagination uses normal links with seller ID and page in the URL. Visual changes retain the established palette and type. Added shared motion/focus tokens, wrap-capable pagination and constrained management form width. Existing local animation changes remain in the same working tree.

## Verification and limitations
- JavaScript syntax checks passed for changed application and page code; git diff whitespace check passed.
- All 10 Node tests passed with loopback access. The earlier EACCES failure was the environment blocking localhost; rerunning with authorized loopback access resolved it.
- New HTTP test verifies missing/wrong admin credentials yield 401 without a database call, valid credentials can read a draft, invalid IDs yield 400, missing products yield 404, and successful private reads are no-store.
- Existing tests cover checkout price authority, multi-seller split, rollback, invalid input and catalog filters.
- Tests use database substitutes. They do not establish real PostgreSQL aggregate execution, persisted buyer/admin journeys, browser behavior or visual conformance.
- Only .env.example is present locally. No development database credentials were found or requested from production. Real database integration remains unverified.
- Live homepage retrieval through the web reader failed; this is not evidence of a service outage. No before/after screenshots or lab/field performance numbers were obtained in this pass.
- Render connector confirmed the already-authorized workspace's Savdo service: main branch, Oregon, free plan, auto deployment off, /api/health, npm ci build, db:setup followed by npm start. No service configuration or production data changed. Runtime logs and resource measurements were not collected.
- No installed dedicated frontend design/accessibility skill was identified. Applied existing conventions plus PostgreSQL and Vercel end-to-end verification guidance; inspected Render web-service guidance. React and Supabase platform skills do not apply to this project.

## Next verification gate and backlog
1. Provide isolated development PostgreSQL and MongoDB instances, apply schema and demo seed there, then verify directory SQL against actual data and query plans.
2. Walk buyer discovery -> cart -> checkout -> persisted order -> local receipt; verify stock failure and retry behavior. Walk administrator token -> draft load -> edit -> save -> persisted row -> public visibility. Capture desktop/mobile before/after images; check keyboard focus, dialogs and reduced motion.
3. Add checkout idempotency and security audit logging, then seller identity/ownership and an authenticated inventory workspace.
4. Separate migrations from startup, add bounded directory pagination for catalog growth, and collect endpoint baselines before proposing caches or indexes.

Targets (not measured results): LCP <=2.5s, INP <=200ms and CLS <=0.1 at p75 real visits, segmented by device; WCAG 2.2 AA with manual and automated review. Establish warm endpoint p50/p95 over at least 100 read requests against a documented 10k-product development dataset before choosing service targets. Count search success as searches followed by product selection / submitted searches; checkout completion as persisted successful orders / checkout starts, excluding test activity. Seller onboarding/time-to-publish metrics require real seller identity first.

References: https://web.dev/articles/vitals ; https://www.w3.org/WAI/standards-guidelines/wcag/ . The requested OWASP page could not be retrieved in this pass; authorization findings above come from actual route and test inspection.

Changes remain local for review; production deployment is excluded by the current brief.
