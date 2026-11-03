-- Standalone reproducible experiment, isolated from business tables.
CREATE SCHEMA IF NOT EXISTS benchmark;
CREATE TABLE IF NOT EXISTS benchmark.marketplace_events (
 id integer PRIMARY KEY, product_id integer NOT NULL,
 event_type text NOT NULL, occurred_at timestamptz NOT NULL
);
INSERT INTO benchmark.marketplace_events
SELECT n,n%10000+1,'product_view',timestamptz '2026-01-01'+n*interval '1 second'
FROM generate_series(1,500000) n ON CONFLICT DO NOTHING;
DROP INDEX IF EXISTS benchmark.event_product_idx;
ANALYZE benchmark.marketplace_events;
-- BEFORE: save the actual plan and Execution Time; do not invent a speedup.
EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM benchmark.marketplace_events WHERE product_id=42;
CREATE INDEX event_product_idx ON benchmark.marketplace_events(product_id);
ANALYZE benchmark.marketplace_events;
-- AFTER: compare actual scan type, buffers, row count, and Execution Time.
EXPLAIN (ANALYZE,BUFFERS) SELECT * FROM benchmark.marketplace_events WHERE product_id=42;
