# Seven-minute defense plan

- **0:00–0:45:** explain the buyer/seller problem, individual-project scope, and architecture.
- **0:45–2:00:** search, filter by seller/category, open a product, explain SQL product data plus MongoDB reviews.
- **2:00–3:30:** add products from two sellers, place one demo order, show one parent order and two seller fulfillments. Explain cash on delivery, server prices, ordered row locks, and rollback.
- **3:30–4:30:** dashboard: seller sales versus global sample event activity. Show an actual Mongo aggregation.
- **4:30–5:30:** ER diagram and a JOIN/HAVING/window result. Explain the order_items M:N relation.
- **5:30–6:15:** actual 500k-row index experiment, plans and measured times. Explain selectivity and cache effects.
- **6:15–7:00:** tests, deployed URL if available, limitations, and next steps.

Be ready to explain: why all transaction queries use one pg client; what happens when two buyers want the last unit; why prices are not trusted from the browser; how soft deletion protects order history; why a document event failure cannot undo or partially commit an SQL order; how textContent protects displayed reviews; how the admin bearer differs from customer/seller login; why a pending payment is not paid revenue.

Record a short backup screen capture only after the flows work. Do not simulate multi-day Git history, live deployment, benchmark performance, screenshots, or results you have not obtained.
