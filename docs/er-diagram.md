# Relational model

```mermaid
erDiagram
  SELLERS ||--o{ PRODUCTS : lists
  CATEGORIES ||--o{ PRODUCTS : classifies
  CUSTOMERS ||--o{ ORDERS : places
  ORDERS ||--|{ SELLER_ORDERS : splits
  SELLERS ||--o{ SELLER_ORDERS : fulfills
  SELLER_ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : purchased
  ORDERS ||--|{ ORDER_ITEMS : contains
  ORDERS ||--|| PAYMENTS : records
  SELLER_ORDERS ||--|| PAYOUTS : accrues
  SELLERS { int id PK string name UK string city string description }
  CATEGORIES { int id PK string name UK string icon }
  PRODUCTS { int id PK int seller_id FK int category_id FK string name numeric price int stock boolean approved boolean active }
  CUSTOMERS { int id PK string name string email UK string city }
  ORDERS { int id PK int customer_id FK string address numeric total string status timestamp created_at }
  SELLER_ORDERS { int id PK int order_id FK int seller_id FK numeric total string status }
  ORDER_ITEMS { int id PK int order_id FK int seller_order_id FK int seller_id FK int product_id FK int quantity numeric unit_price }
  PAYMENTS { int id PK int order_id FK numeric amount string method string status }
  PAYOUTS { int id PK int seller_order_id FK numeric amount string status }
```

`order_items` resolves the many-to-many relationship between orders and products. The composite foreign key `(seller_order_id, order_id, seller_id)` prevents a line being attached to another order's seller shipment. Unique keys prevent duplicate seller shipments per order, duplicate products per order, and duplicate payment/payout records. The application creates the required item, payment, and payout rows in the same transaction; foreign keys alone do not enforce a minimum child count.

MongoDB collections are separate: `reviews` links to SQL products by numeric `productId`; `click_events` stores activity; `search_logs` stores flexible search evidence. There is no cross-database transaction or foreign-key enforcement. Orders deliberately stay entirely in PostgreSQL, so analytics failures cannot partially commit a checkout. Soft deletion retains historic product references. Anonymous reviews are not verified purchases.
