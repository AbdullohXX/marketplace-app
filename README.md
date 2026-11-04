# Savdo — a multi-seller marketplace

A Big Data course project based on the attached *Complete 3-Week Project Guide*. Local Uzbek sellers offer products priced in whole UZS. Customers search the catalog, read document-backed reviews, keep a bag, and place cash-on-delivery demo orders. A single checkout produces one order and a fulfillment/payout record for each seller.

## Run locally

Requirements: Node.js 22+ (tested runtime: 24), npm, Docker with Compose. PostgreSQL 17 and MongoDB 7 run in containers. Alternatively use your own compatible databases and configure `.env` yourself.

```sh
cd /workspace/marketplace-app
npm ci
node scripts/local-env.js
docker compose up -d --wait
npm run db:setup
npm test
npm run test:integration
npm start
```

On your own computer, replace the first directory with your checkout path. The local server uses port 3000. `scripts/local-env.js` creates random local credentials with private file permissions and preserves an existing `.env`. Never commit `.env`. The database ports bind to loopback only. The local MongoDB service has no authentication and is intended only for development.

`db:setup` is repeatable: schema objects and seed records are created only when missing, and existing application records are preserved. Use a fresh database for a clean course demonstration. Do not run `docker compose down -v` unless you intentionally want to delete all local database data.

On the managed cloud machine, use its managed Docker socket and inherited proxy/CA settings. Sandbox restrictions may require approved execution for network requests, Docker, and local sockets. Do not disable TLS checks or change proxy settings to bypass access restrictions.

## Pages

- `/`: searchable catalog with category/seller filters, sorting, pagination, and bag actions.
- `/product.html?id=1`: SQL product/seller data combined with MongoDB reviews; review submission.
- `/cart.html`: quantity editing, delivery form, transactional checkout, seller split confirmation.
- `/dashboard.html`: seller-filtered booked sales, daily sales, bestsellers, and marketplace-wide MongoDB activity.
- `/manage.html`: administrator product creation, replacement, soft deletion, and approval.

The manager requires `ADMIN_TOKEN`, at least 32 characters, in the server environment. The local generator creates one. Access it privately in your editor; never paste it into chat or commit it. Enter it into the management page only on a trusted development origin or HTTPS deployment. It stays in page memory. There are no seller logins or ownership controls: this is the individual-project implementation, not the guide's additional pair-work authentication task.

## Data model and API

See [ER diagram](docs/er-diagram.md), [API reference](docs/api.md), and [course deliverables](docs/course-checklist.md).

PostgreSQL holds sellers, categories, products, customers, orders, seller orders, order items, payments, and payouts. MongoDB holds reviews, click events, and search logs. Sample data includes five sellers, five categories, thirteen products (one awaiting approval), five customers and five complete orders, 36 reviews, 10,000 click events, and 1,000 searches. Generated activity and seeded order values are explicitly labeled in the dashboard.

`src/orders.js` locks approved active products in ID order, checks stock, calculates prices on the server, and creates all SQL rows on one client inside `BEGIN` / `COMMIT`. Any failure rolls back. Duplicate cart items are merged before locking. Money is represented as `NUMERIC(14,0)` in SQL and safe whole-UZS integers in JavaScript, within the validated cart bounds. Pending payouts represent gross seller proceeds; platform commissions and real payment collection are out of scope.

## Validation and database exercises

```sh
npm test                    # dependency-free validation and transaction orchestration tests
npm run test:integration    # real databases; run on disposable development data only
npm run db:benchmark        # inserts 500k rows in the isolated benchmark schema
```

The integration test checks real HTTP routes, review persistence, protected management, server pricing, seller splits, rollback, and two competing checkouts for the last unit. Test fixtures are removed afterward. SQL transaction sequences may still advance during tests.

Run `sql/03_queries.sql` in pgAdmin or `psql` to see 20 business questions and their results. Its mutating exercises roll back. Run `mongo/02_queries.mongodb.js` in mongosh or a MongoDB Playground for 12 exercises. `npm run db:benchmark` writes current actual query plans and timings to ignored `artifacts/benchmark.txt`; do not claim a particular speedup until you have measured it. See [validation record](docs/validation.md) for observed results and remaining work.

## Deploy

See [deployment instructions](docs/deployment.md). No hosting account, Git push, public deployment, or real payment collection is performed automatically. The report and demo outline in `docs/` are templates to fill with your own verified results, screenshots, and explanation. Commit history over multiple days and a live defense must be completed by the student.

## Account and workspace release

See [release notes](docs/workspace-release.md) and [permission matrix](docs/permissions.md) for account setup, seller/admin routes, migrations and verification limits. Run `npm run test:workspace` for the isolated SQL/browser workflow suite. Email delivery is currently disabled; SMTP configuration is needed to enable verification and recovery.
