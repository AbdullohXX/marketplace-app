# Observed validation — November 3, 2026

These checks ran in the current cloud machine. They do not establish public deployment or restoration in a fresh task.

| Check | Observed result |
|---|---|
| Locked npm installation | Passed; `npm ci` installed runtime dependencies |
| Dependency audit after patching rate limiter | 0 vulnerabilities reported |
| PostgreSQL 17.6 / MongoDB 7.0.24 | Docker Compose health checks passed |
| Schema/seed setup and repeat setup | Passed twice without resetting existing records |
| Unit suite | 8 passed, 0 failed, 0 skipped |
| Real API integration suite | 1 comprehensive test passed; CRUD/auth, SQL-shaped search, Mongo reviews, split checkout, rollback, competing last-unit checkouts |
| Browser checks, installed Chromium | Five pages loaded; search filtered; reviews rendered; bag persisted; two-seller cart; dashboard; manager form; mobile catalog/cart had no horizontal overflow; no page exceptions |
| Mobile browser checkout | Delivery form submitted, two seller shipments confirmed, bag cleared; test order removed and stock restored afterward |
| Final restarted server | Health request returned status ok, PostgreSQL connected, MongoDB connected |
| 20 SQL business exercises | Executed; current results saved in `artifacts/sql-results.json` |
| 12 MongoDB exercises | Executed in mongosh; output in `artifacts/mongo-exercises.txt`; both explain queries reported IXSCAN |
| MongoDB aggregations/counts | Actual JSON in `artifacts/mongo-results.json` |
| 500,000-row PostgreSQL experiment | Actual plans saved in `artifacts/benchmark.txt` |
| Whitespace and source syntax checks | Passed |

The measured selective lookup returned 50 rows. Before indexing: parallel sequential scan, **18.108 ms**. After: bitmap index/heap scan, **0.132 ms**, approximately **137×** in this one run. This is a cache/hardware-specific observation, not a performance guarantee; rerun the benchmark for your own evidence.

Screenshots in ignored `artifacts/`: `catalog-desktop.png`, `catalog-mobile.png`, `cart-mobile.png`, `dashboard-desktop.png`, `checkout-success-mobile.png`. These are actual browser captures of the current app. Generated data is demonstration activity, not real customer demand.

Remaining course work: export the ER diagram/query screenshots to the requested submission formats, fill and export the 8–12-page report, create slides/screen recording, provision cloud databases/hosting and test a public URL, and make genuine commits as work progresses over multiple days. No public deployment, Git push, or presentation is claimed.
