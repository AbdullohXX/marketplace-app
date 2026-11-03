-- Idempotent demo data. Never resets a populated database.
BEGIN;
INSERT INTO sellers(id,name,city,description) VALUES
 (1,'Tashkent Tech','Tashkent','Everyday electronics from local experts.'),
 (2,'Rishtan Studio','Rishtan','Handmade ceramics with a story.'),
 (3,'Atlas House','Margilan','Natural textiles, woven in the Fergana Valley.'),
 (4,'Samarqand Living','Samarkand','Thoughtful essentials for your home.'),
 (5,'Bukhara Goods','Bukhara','Small-batch accessories and local craft.') ON CONFLICT DO NOTHING;
INSERT INTO categories(id,name,icon) VALUES
 (1,'Electronics','🎧'),(2,'Home & living','🏺'),(3,'Fashion','🧣'),(4,'Accessories','🎒'),(5,'Lifestyle','☕') ON CONFLICT DO NOTHING;
INSERT INTO products(id,seller_id,category_id,name,description,price,stock,approved,icon) VALUES
 (1,1,1,'Wireless studio headphones','Soft ear cushions, balanced sound, and up to 30 hours of listening. Includes a USB-C charging cable.',490000,24,true,'🎧'),
 (2,2,2,'Rishtan ceramic bowl','A hand-painted ceramic bowl from Rishtan. Each blue and white pattern is a little different.',185000,18,true,'🥣'),
 (3,3,3,'Margilan silk scarf','Lightweight atlas silk woven in Margilan. A bright accent made for everyday wear.',265000,30,true,'🧣'),
 (4,4,2,'Warm desk lamp','A compact adjustable lamp with three warm lighting levels. Designed for quiet evening work.',320000,15,true,'💡'),
 (5,5,4,'Everyday canvas backpack','A durable cotton canvas backpack with a padded laptop sleeve and plenty of room for your day.',375000,20,true,'🎒'),
 (6,1,1,'Pocket Bluetooth speaker','Portable sound in a compact body. USB-C charging, splash resistance, and a handy carry strap.',295000,32,true,'🔊'),
 (7,2,2,'Hand-painted tea set','A traditional teapot with four matching cups. Made and painted by ceramic artisans in Rishtan.',425000,12,true,'🫖'),
 (8,3,3,'Cotton everyday tote','A reusable natural cotton tote with a woven atlas accent. Made for market days and more.',95000,45,true,'👜'),
 (9,4,5,'Morning coffee mug','A generously sized stoneware mug with a comfortable handle and a soft matte finish.',85000,38,true,'☕'),
 (10,5,4,'Leather card holder','Slim hand-finished leather wallet with four card slots. Made in Bukhara.',210000,25,true,'👝'),
 (11,1,1,'Compact wireless keyboard','A quiet low-profile keyboard for your desk. Connects over Bluetooth with a rechargeable battery.',385000,17,true,'⌨️'),
 (12,4,5,'Linen notebook','A cloth-bound notebook with 160 unlined pages. A simple space for your next idea.',65000,50,true,'📓'),
 (13,5,4,'Travel pouch prototype','An upcoming travel pouch awaiting marketplace approval.',135000,10,false,'👝') ON CONFLICT DO NOTHING;
INSERT INTO customers(id,name,email,city) VALUES
 (1,'Aziza Karimova','aziza@example.test','Tashkent'),(2,'Javohir Aliyev','javohir@example.test','Samarkand'),
 (3,'Nodira Usmonova','nodira@example.test','Bukhara'),(4,'Bekzod Rasulov','bekzod@example.test','Namangan'),
 (5,'Madina Sobirova','madina@example.test','Fergana') ON CONFLICT DO NOTHING;
INSERT INTO orders(id,customer_id,address,total,status,created_at)
SELECT n,n,'Demo delivery address, Uzbekistan',p.price,'delivered',now()-(n||' days')::interval
FROM generate_series(1,5) n JOIN products p ON p.id=n ON CONFLICT DO NOTHING;
INSERT INTO seller_orders(id,order_id,seller_id,total,status)
SELECT o.id,o.id,p.seller_id,o.total,'delivered' FROM orders o JOIN products p ON p.id=o.id WHERE o.id<=5 ON CONFLICT DO NOTHING;
INSERT INTO order_items(id,order_id,seller_order_id,seller_id,product_id,quantity,unit_price)
SELECT o.id,o.id,o.id,p.seller_id,p.id,1,p.price FROM orders o JOIN products p ON p.id=o.id WHERE o.id<=5 ON CONFLICT DO NOTHING;
INSERT INTO payments(id,order_id,amount,status) SELECT id,id,total,'paid' FROM orders WHERE id<=5 ON CONFLICT DO NOTHING;
INSERT INTO payouts(id,seller_order_id,amount,status) SELECT id,id,total,'paid' FROM seller_orders WHERE id<=5 ON CONFLICT DO NOTHING;
-- Advance identities after explicit seed IDs without moving sequences backwards.
SELECT setval(pg_get_serial_sequence('sellers','id'),greatest((SELECT max(id) FROM sellers),(SELECT last_value FROM sellers_id_seq)));
SELECT setval(pg_get_serial_sequence('categories','id'),greatest((SELECT max(id) FROM categories),(SELECT last_value FROM categories_id_seq)));
SELECT setval(pg_get_serial_sequence('products','id'),greatest((SELECT max(id) FROM products),(SELECT last_value FROM products_id_seq)));
SELECT setval(pg_get_serial_sequence('customers','id'),greatest((SELECT max(id) FROM customers),(SELECT last_value FROM customers_id_seq)));
SELECT setval(pg_get_serial_sequence('orders','id'),greatest((SELECT max(id) FROM orders),(SELECT last_value FROM orders_id_seq)));
SELECT setval(pg_get_serial_sequence('seller_orders','id'),greatest((SELECT max(id) FROM seller_orders),(SELECT last_value FROM seller_orders_id_seq)));
SELECT setval(pg_get_serial_sequence('order_items','id'),greatest((SELECT max(id) FROM order_items),(SELECT last_value FROM order_items_id_seq)));
SELECT setval(pg_get_serial_sequence('payments','id'),greatest((SELECT max(id) FROM payments),(SELECT last_value FROM payments_id_seq)));
SELECT setval(pg_get_serial_sequence('payouts','id'),greatest((SELECT max(id) FROM payouts),(SELECT last_value FROM payouts_id_seq)));
COMMIT;
