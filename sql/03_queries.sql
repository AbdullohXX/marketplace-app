-- Run in a development database. Mutating exercises roll back their data changes.
-- Q1 CRUD: How do we add a new category without changing the sample data?
BEGIN;
INSERT INTO categories(name,icon) VALUES('Query exercise category','📦') RETURNING *;
ROLLBACK;
-- Q2 CRUD: Which approved products cost less than 300,000 UZS?
SELECT id,name,price FROM products WHERE approved AND active AND price<300000 ORDER BY price;
-- Q3 CRUD: How would we adjust a product's stock?
BEGIN;
UPDATE products SET stock=stock+5 WHERE id=1 RETURNING id,stock;
ROLLBACK;
-- Q4 CRUD: How do we remove a category that has no products?
BEGIN;
INSERT INTO categories(name,icon) VALUES('Disposable query category','📦');
DELETE FROM categories WHERE name='Disposable query category' RETURNING *;
ROLLBACK;
-- Q5 JOIN: Who sells each product?
SELECT p.name,s.name AS seller FROM products p JOIN sellers s ON s.id=p.seller_id;
-- Q6 JOIN: Which category does each product belong to?
SELECT p.name,c.name AS category FROM products p JOIN categories c ON c.id=p.category_id;
-- Q7 JOIN: Who placed each order?
SELECT o.id,c.name,o.total FROM orders o JOIN customers c ON c.id=o.customer_id;
-- Q8 LEFT JOIN: Which sellers have no orders?
SELECT s.name FROM sellers s LEFT JOIN seller_orders so ON so.seller_id=s.id WHERE so.id IS NULL;
-- Q9 JOIN: Which items were purchased and from which seller?
SELECT i.order_id,p.name,s.name AS seller,i.quantity,i.unit_price FROM order_items i JOIN products p ON p.id=i.product_id JOIN sellers s ON s.id=i.seller_id;
-- Q10 GROUP BY: How many products are in each category?
SELECT c.name,count(p.id) FROM categories c LEFT JOIN products p ON p.category_id=c.id GROUP BY c.id;
-- Q11 GROUP BY: What revenue belongs to each seller?
SELECT seller_id,sum(total) FROM seller_orders WHERE status<>'cancelled' GROUP BY seller_id;
-- Q12 GROUP BY/HAVING: Which sellers have more than two active products?
SELECT seller_id,count(*) FROM products WHERE active GROUP BY seller_id HAVING count(*)>2;
-- Q13 GROUP BY: What is the daily order value?
SELECT created_at::date AS day,sum(total) FROM orders WHERE status<>'cancelled' GROUP BY 1 ORDER BY 1;
-- Q14 VIEW: What does the reusable seller report show?
SELECT * FROM seller_sales ORDER BY revenue DESC;
-- Q15 WINDOW: How do sellers rank by revenue?
SELECT name,revenue,dense_rank() OVER(ORDER BY revenue DESC) AS rank FROM seller_sales;
-- Q16 WINDOW: What is the running order value?
SELECT id,created_at,total,sum(total) OVER(ORDER BY created_at,id ROWS UNBOUNDED PRECEDING) AS running_total FROM orders WHERE status<>'cancelled';
-- Q17 SUBQUERY: Which products cost above the catalog average?
SELECT name,price FROM products WHERE price>(SELECT avg(price) FROM products WHERE active);
-- Q18 TRANSACTION: How do we reserve stock atomically for a cart?
-- Full multi-seller order creation is in src/orders.js. This exercise leaves no reservation behind.
BEGIN;
SELECT id,stock FROM products WHERE id=1 FOR UPDATE;
UPDATE products SET stock=stock-1 WHERE id=1 AND stock>=1 RETURNING id,stock;
ROLLBACK;
-- Q19 FREE: Which products need restocking soon?
SELECT name,stock FROM products WHERE active AND stock<20 ORDER BY stock;
-- Q20 FREE: Are any pending payouts missing for existing seller orders?
SELECT so.id FROM seller_orders so LEFT JOIN payouts p ON p.seller_order_id=so.id WHERE p.id IS NULL;
