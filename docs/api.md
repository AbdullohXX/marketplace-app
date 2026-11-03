# API reference

All bodies and responses use JSON. Error responses have `{ "error": "message" }`. Pagination is 12 products per page. Prices are whole Uzbek so'm; PostgreSQL numeric values arrive as JSON strings.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | Live query/ping to both databases |
| GET | `/api/categories` | Categories |
| GET | `/api/sellers` | Seller directory |
| GET | `/api/products` | Catalog: `search`, `category`, `seller`, `page`, `sort=newest/price_asc/price_desc` |
| GET | `/api/products/:id` | Approved product, seller, category, latest 20 MongoDB reviews |
| POST | `/api/products` | Admin: create product |
| PUT | `/api/products/:id` | Admin: replace product fields and approval state |
| DELETE | `/api/products/:id` | Admin: soft-delete; preserve order references |
| POST | `/api/orders` | Validate cart and atomically place a multi-seller order |
| POST | `/api/products/:id/reviews` | Add public community feedback |
| POST | `/api/events` | Record `product_view`, `add_to_cart`, or `search` |
| GET | `/api/stats/sales?seller=1` | SQL seller totals, last 30 daily sales, top products |
| GET | `/api/stats/activity` | MongoDB marketplace-wide activity and searches |

Admin requests use `Authorization: Bearer <ADMIN_TOKEN>`. Missing authentication returns 401; management disabled by missing/short server configuration returns 503. Do not include the token in URLs.

Product write body:

```json
{"name":"Silk scarf","description":"Handwoven atlas silk from Margilan","price":265000,"stock":30,"seller_id":3,"category_id":3,"approved":true}
```

Checkout body:

```json
{"name":"Aziza Karimova","email":"aziza@example.test","city":"Tashkent","address":"Chilonzor 12, house 7","items":[{"product_id":1,"quantity":1},{"product_id":2,"quantity":2}]}
```

Checkout ignores client-supplied totals/prices. Success returns 201 with order ID, total, seller fulfillment rows, and `cash_on_delivery` payment method. It records a demo order and pending payment; it does not arrange shipping or charge money. No public customer/order listing endpoints expose personal details.

Review body: `{"author":"Aziza","rating":5,"comment":"Lovely quality and carefully packed."}`. Event body: `{"type":"product_view","productId":1}` or `{"type":"search","query":"silk"}`.

Status codes: 200 read/update, 201 create, 204 delete, 400 invalid input/reference, 401 administrator authentication required, 404 unavailable resource, 409 insufficient stock/conflict, 413 oversized body, 429 rate limit, 500/503 service/configuration failures. Public reviews and event collection are limited per IP; production abuse protection needs additional controls. SQL values are parameterized; sorting uses a fixed allowlist. User strings are rendered with DOM `textContent`.
