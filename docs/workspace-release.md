# Savdo workspace release — 4 November 2026

## Public and account pages
Discover with manual collection banners, category tiles, responsive product cards, search/filters, product gallery/specifications, reviews, cart, recoverable idempotent demo checkout, local receipts and account-linked orders. Public seller pages: /shops/:slug (existing /shop.html links remain).

/register, /login, /verify-email, /forgot-password, /reset-password, /account/profile, /account/security, /account/orders, /account/saved. Accounts use Argon2id, PostgreSQL sessions, same-site HttpOnly cookies, CSRF headers, login throttling, single-use mail tokens, immediate suspension/membership enforcement, and encrypted TOTP enrollment with replay prevention. Privileged operations require MFA after sign-in. No public registration can select a role.

## Seller pages
/seller; /seller/onboarding; /seller/shop; /seller/shop/appearance; /seller/products; /seller/products/new; /seller/products/:id/edit; /seller/inventory; /seller/orders; /seller/orders/:id; /seller/team; /seller/settings.

A saved application creates a private provisional shop so applicants can prepare product drafts. Editing uses version checks. Application and product moderation states are separate from operating state and stock. The editor covers identity/category fields, raster images, description/specifications, sellable variant rows, pricing/stock, demo fulfillment disclosure, preview and submission. Revisions preserve approved public content until moderation approval. Updating an approved SKU through moderation preserves live stock; inventory is adjusted separately with compare-and-set protection. Archived products retain order references. Images are validated and re-encoded with Sharp, stored in MongoDB and private until published (staff reviewers with MFA may view submissions).

Shop owners may invite named accounts with products/inventory/orders/settings permissions. Removal takes effect on the next request. Orders expose only the authorized seller’s items and necessary fulfillment information. Forward fulfillment transitions are idempotent and update buyer order history. Counts on overview are explicitly limited to the first 20 matching records.

## Administrator pages
/admin; /admin/seller-applications; /admin/sellers/:id (shop management section); /admin/users; /admin/shops; /admin/products/moderation; /admin/products/:id (moderation section); /admin/categories; /admin/orders; /admin/reports; /admin/access; /admin/audit-log; /admin/settings.

Applications and product revisions support feedback, requested changes, approval and rejection. Users/roles, shop operating status, category hierarchy and required attributes, reports, read-only order lookup, support settings and audit history are persisted. Moderator access is narrower than administrator access; only super administrators assign privileged roles. See permissions.md. Existing /dashboard.html and /manage.html redirect into the protected workspaces.

First administrator: register your own account, open Account Security, use the existing Render ADMIN_TOKEN in the first-admin provisioning form, then enroll and confirm an authenticator. Bootstrap is restricted to the configured server secret and only works before any super administrator exists. No default privileged account was created. Keep the token out of chat and source control.

## Deployment and data
Additive schema: sql/01_schema.sql checkout request ledger and sql/05_workspace.sql. Existing catalog, order IDs and stock are retained. Startup runs idempotent migrations, seeds only an empty product database, and ensures Mongo media indexes. No disk attachment needed. Connection pool remains capped at 10. Existing ADMIN_TOKEN provides a stable session/encryption secret unless SESSION_SECRET is configured. Do not rotate it without a session/MFA migration plan. APP_URL may explicitly specify the public origin; defaults to the request origin for same-origin validation. Current SMTP delivery is disabled at the user's request.

## Actual verification
12 unit/API tests passed. test/workspace.test.js passed ten connected checks, including browser registration, draft persistence across refresh, account privilege restrictions, bootstrap/MFA, application corrections/approval, product moderation/publication, private media, cross-shop access, invitation permissions/removal, stock/price/retry behavior, seller fulfillment and buyer-visible results, and account suspension. Responsive workspace checks used Chrome at 360/390/768/1440. Screenshots and machine-readable evidence are in evidence/.

The isolated database is PGlite (PostgreSQL engine), with serialized transaction adapters and a no-op advisory-lock shim; Mongo media is substituted in those tests. This validates SQL and connected application flows but does not establish behavior under independent real PostgreSQL connections or actual Mongo storage failure. Production read health and public pages must be checked after Render reports live. No production seed reset or test fulfillment order is required.

Directory strategy comparison on 1,013 development products: previous strategy made 6 HTTP requests, 11 SQL queries, 20,647 response bytes; new aggregate strategy made 1 request, 1 SQL query, 446 bytes. Five measured samples after warmup; raw timings and EXPLAIN output in evidence/comparable-directory-performance.json. These are same-machine strategy measurements, not production speedup claims.

## Explicit limitations
Email sending, verification and password recovery delivery are disabled as requested. Accounts can sign in and save applications/drafts; submission, publication and invitation acceptance retain verification gates until delivery is enabled. SMTP_URL, MAIL_FROM and APP_URL activate the implemented email flow later.

The platform continues to record demonstration cash-on-delivery orders: no real payment settlement, shipping, returns or warehouse integration. Variant combinations are entered as distinct rows rather than generated automatically. Store collections are configured through structured JSON and featured product IDs. No unrestricted HTML is accepted. Order lookup in the admin workspace is read-only; fulfillment actions are in the authorized seller order workspace. Native browser zoom, comprehensive screen-reader/contrast certification and independent multi-connection PostgreSQL concurrency remain future validation work.
