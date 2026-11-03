import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { integer, text, productInput, HttpError } from './domain.js';
import { placeOrder } from './orders.js';

export function createApp(pool, mongo) {
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 180 }));
  const writeLimit = rateLimit({ windowMs: 60000, limit: 20 });
  const admin = (req, res, next) => {
    const expected = process.env.ADMIN_TOKEN;
    const supplied = req.get('authorization')?.replace(/^Bearer /, '') || '';
    if (!expected || expected.length < 32) return res.status(503).json({ error: 'Product management is disabled. Configure ADMIN_TOKEN (32+ characters).' });
    const a = Buffer.from(expected), b = Buffer.from(supplied);
    if (a.length !== b.length || !timingSafeEqual(a,b)) return res.status(401).json({ error: 'Administrator access required' });
    next();
  };
  app.get('/api/health', async (req,res) => {
    await pool.query('SELECT 1'); await mongo.command({ ping: 1 });
    res.json({ status: 'ok', postgres: 'connected', mongodb: 'connected' });
  });
  app.get('/api/categories', async (req,res) => res.json((await pool.query('SELECT * FROM categories ORDER BY id')).rows));
  app.get('/api/sellers', async (req,res) => res.json((await pool.query('SELECT * FROM sellers ORDER BY id')).rows));
  app.get('/api/products', async (req,res) => {
    const search = req.query.search === undefined ? '' : text(req.query.search, 'Search', 0, 100);
    const category = req.query.category ? integer(req.query.category, 'Category') : null;
    const seller = req.query.seller ? integer(req.query.seller, 'Seller') : null;
    const minPrice = req.query.minPrice === undefined ? null : integer(req.query.minPrice, 'Minimum price', 0, 100000000);
    const maxPrice = req.query.maxPrice === undefined ? null : integer(req.query.maxPrice, 'Maximum price', 0, 100000000);
    if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) throw new HttpError(400, 'Minimum price cannot exceed maximum price');
    const inStock = req.query.inStock === undefined ? false : req.query.inStock === '1';
    if (req.query.inStock !== undefined && !['0','1'].includes(req.query.inStock)) throw new HttpError(400, 'Invalid stock filter');
    const page = integer(req.query.page || 1, 'Page', 1, 10000);
    const sorts = new Map([['newest','p.id DESC'],['price_asc','p.price ASC,p.id'],['price_desc','p.price DESC,p.id']]);
    const sort = sorts.get(req.query.sort || 'newest');
    if (!sort) throw new HttpError(400,'Invalid sort');
    const where = `p.active AND p.approved AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%') AND ($2::int IS NULL OR p.category_id=$2) AND ($3::int IS NULL OR p.seller_id=$3) AND ($4::bigint IS NULL OR p.price >= $4) AND ($5::bigint IS NULL OR p.price <= $5) AND (NOT $6::boolean OR p.stock > 0)`;
    const values = [search,category,seller,minPrice,maxPrice,inStock];
    const { rows } = await pool.query(`SELECT p.*,s.name AS seller,c.name AS category FROM products p JOIN sellers s ON s.id=p.seller_id JOIN categories c ON c.id=p.category_id WHERE ${where} ORDER BY ${sort} LIMIT 12 OFFSET $7`, [...values,(page-1)*12]);
    const { rows: [count] } = await pool.query(`SELECT count(*)::integer AS total FROM products p WHERE ${where}`, values);
    res.json({ products:rows, total:count.total, page, pages:Math.ceil(count.total/12) });
  });
  app.get('/api/products/:id', async (req,res) => {
    const id = integer(req.params.id,'Product ID');
    const { rows:[p] } = await pool.query('SELECT p.*,s.name AS seller,s.city,c.name AS category FROM products p JOIN sellers s ON s.id=p.seller_id JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND p.active AND p.approved',[id]);
    if (!p) throw new HttpError(404,'Product not found');
    // This page combines relational product data and document reviews.
    const reviews = await mongo.collection('reviews').find({ productId:id },{ projection:{ _id:0 } }).sort({ createdAt:-1 }).limit(20).toArray();
    res.json({ ...p, reviews });
  });
  app.post('/api/products', writeLimit, admin, async (req,res) => {
    const p = productInput(req.body);
    const { rows:[row] } = await pool.query('INSERT INTO products(name,description,price,stock,category_id,seller_id,approved,icon) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',Object.values(p));
    res.status(201).json(row);
  });
  app.put('/api/products/:id', writeLimit, admin, async (req,res) => {
    const id = integer(req.params.id,'Product ID'), p = productInput(req.body);
    const { rows:[row] } = await pool.query('UPDATE products SET name=$1,description=$2,price=$3,stock=$4,category_id=$5,seller_id=$6,approved=$7,icon=$8 WHERE id=$9 AND active RETURNING *',[...Object.values(p),id]);
    if (!row) throw new HttpError(404,'Product not found');
    res.json(row);
  });
  app.delete('/api/products/:id', writeLimit, admin, async (req,res) => {
    const { rowCount } = await pool.query('UPDATE products SET active=false WHERE id=$1 AND active',[integer(req.params.id,'Product ID')]);
    if (!rowCount) throw new HttpError(404,'Product not found');
    res.status(204).end();
  });
  app.post('/api/orders', writeLimit, async (req,res) => res.status(201).json(await placeOrder(pool, req.body)));
  app.post('/api/products/:id/reviews', writeLimit, async (req,res) => {
    const id = integer(req.params.id,'Product ID');
    const { rowCount } = await pool.query('SELECT id FROM products WHERE id=$1 AND active AND approved',[id]);
    if (!rowCount) throw new HttpError(404,'Product not found');
    const review = { productId:id, author:text(req.body?.author,'Name',2,80), rating:integer(req.body?.rating,'Rating',1,5), comment:text(req.body?.comment,'Review',5,1000), createdAt:new Date() };
    await mongo.collection('reviews').insertOne(review);
    res.status(201).json({ message:'Review published' });
  });
  app.post('/api/events', writeLimit, async (req,res) => {
    const type = req.body?.type;
    if (!['product_view','search','add_to_cart'].includes(type)) throw new HttpError(400,'Invalid event type');
    const event = { type, createdAt:new Date() };
    if (type === 'search') event.query = text(req.body?.query,'Search',1,100);
    else event.productId = integer(req.body?.productId,'Product ID');
    await mongo.collection(type === 'search' ? 'search_logs' : 'click_events').insertOne(event);
    res.status(201).json({ recorded:true });
  });
  app.get('/api/stats/sales', async (req,res) => {
    const seller = req.query.seller ? integer(req.query.seller,'Seller') : null;
    const { rows:sellers } = await pool.query('SELECT * FROM seller_sales WHERE ($1::int IS NULL OR id=$1) ORDER BY revenue DESC',[seller]);
    const { rows:daily } = await pool.query(`SELECT to_char(o.created_at,'YYYY-MM-DD') AS day,sum(so.total) AS revenue,count(*)::int AS orders FROM seller_orders so JOIN orders o ON o.id=so.order_id WHERE so.status <> 'cancelled' AND o.created_at >= now()-interval '30 days' AND ($1::int IS NULL OR so.seller_id=$1) GROUP BY 1 ORDER BY 1`,[seller]);
    const { rows:top } = await pool.query(`SELECT p.name,sum(i.quantity)::int AS units,sum(i.quantity*i.unit_price) AS revenue FROM order_items i JOIN products p ON p.id=i.product_id JOIN orders o ON o.id=i.order_id WHERE o.status <> 'cancelled' AND ($1::int IS NULL OR i.seller_id=$1) GROUP BY p.id ORDER BY revenue DESC LIMIT 5`,[seller]);
    res.json({ sellers,daily,top });
  });
  app.get('/api/stats/activity', async (req,res) => {
    const [events, searches, reviews] = await Promise.all([
      mongo.collection('click_events').aggregate([{ $group:{ _id:'$type', count:{ $sum:1 } } },{ $sort:{ count:-1 } }]).toArray(),
      mongo.collection('search_logs').aggregate([{ $group:{ _id:'$query', count:{ $sum:1 } } },{ $sort:{ count:-1 } },{ $limit:5 }]).toArray(),
      mongo.collection('reviews').countDocuments()
    ]);
    res.json({ events,searches,reviews });
  });
  app.use('/api', (req,res) => res.status(404).json({ error:'API route not found' }));
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
  app.use((err,req,res,next) => {
    const status = err.status || ({ '23503':400,'23505':409,'23514':400,'22P02':400 }[err.code]) || 500;
    if (status >= 500) console.error('Request failed:', err.name, err.code || '');
    res.status(status).json({ error:status >= 500 ? 'Service unavailable. Please try again.' : err.code ? 'Invalid or conflicting database reference' : err.message });
  });
  return app;
}
