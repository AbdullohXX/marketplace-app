# Mapping to the PDF

This is the guide's **individual multi-seller marketplace** option. A pair must additionally implement register/login with bcrypt and seller/admin authorization; the admin bearer tool does not satisfy that requirement.

| Requirement | Implementation / evidence |
|---|---|
| At least 6 SQL tables, constraints, M:N | 9 tables in `sql/01_schema.sql`; `docs/er-diagram.md` |
| At least 30 realistic rows, at least 5 per table | `sql/02_seed.sql`; cities, local names, whole-UZS prices |
| 20 SQL queries in specified categories | `sql/03_queries.sql`, labeled Q1–Q20 |
| 500,000 rows and before/after plans | `sql/04_big_data.sql`; `npm run db:benchmark` generates actual evidence |
| At least 2 Mongo collections, 10,000 docs | 3 collections; `mongo/01_setup.js` |
| 12 Mongo exercises: 5 CRUD, 5 aggregation, 2 explain | `mongo/02_queries.mongodb.js` |
| At least 8 API routes | 13 method/route combinations; `docs/api.md` |
| At least 4 web pages | Catalog, product/reviews, bag/checkout, seller dashboard, manager |
| Both databases on one page | Product page and dashboard |
| Transaction and failure case | `src/orders.js`; unit and real-database integration tests |
| Product approval | Admin writes `approved`; catalog/checkout require active approved products |
| Orders split per seller | `seller_orders`, seller-specific lines and pending payouts |
| Public URL and cloud databases | Must still provision and deploy; `docs/deployment.md` |
| ER diagram PNG and query results PDF | Export ER source and capture actual results; not fabricated |
| Report, screenshots, presentation | Fill `docs/report-outline.md` and `docs/demo.md` |
| Git commits over at least 3 days | Student work requirement; cannot fabricate history |

The PDF refers to a separate teacher-provided `BigData_Starter_Code` archive. That archive was not attached. This implementation uses the architecture and patterns in the PDF, including its server appendix, and is original marketplace source rather than a claim to have executed that missing archive.
