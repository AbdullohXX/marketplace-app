# Report template — complete with your own evidence (8–12 pages)

Do not submit this outline as a completed report. Replace prompts with verified explanations and real screenshots.

1. **Title and problem (1 page):** project name, student/team, course, date. Explain how a local multi-seller marketplace helps buyers discover independent Uzbek businesses. State individual or pair scope.
2. **Requirements and architecture (1 page):** browser → Express → PostgreSQL/MongoDB. Explain which data needs transactions and which data is flexible. List implemented features and exclusions.
3. **Relational design (1–2 pages):** export `er-diagram.md` as a readable image. Discuss keys, the order/product M:N relationship, seller splits, CHECK constraints, NUMERIC money, and normalization. Include schema execution evidence.
4. **SQL evidence (1–2 pages):** run the 20 labeled queries. Select representative JOIN, HAVING, view, window, subquery, and transaction screenshots; attach the full query-results PDF separately. Explain the business question and result.
5. **Big Data experiment (1 page):** paste actual before/after plans from a current benchmark. Record row count, scan type, buffers, both execution times, hardware/cache limitations, and measured ratio. Explain why an index can help a selective lookup and costs write time/storage. Do not promise 10×.
6. **MongoDB model (1 page):** show reviews, click events and searches, counts, compound indexes, and five aggregation results. Explain the lack of cross-database referential integrity and how product data is combined with reviews.
7. **Website and API (1–2 pages):** real catalog/detail/checkout/dashboard screenshots. Show server-side validation, parameterized SQL, stock locks, rollback, cash-on-delivery state, and one split order's database records.
8. **Testing, deployment and reflection (1–2 pages):** actual test results, failed-stock and concurrent-last-unit evidence, public URL only after deployment, mobile screenshots, remaining limitations, individual contributions, and lessons learned.

Appendices: `sql/03_queries.sql`, Mongo exercise source, benchmark output, API examples without secrets, screenshots of test runs. Never include real customer information or connection-string passwords.
