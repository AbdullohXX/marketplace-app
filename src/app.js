import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { integer, text, productInput, HttpError } from './domain.js';
import { placeOrder } from './orders.js';
import { installAuth } from './auth.js';
import { installWorkspace } from './workspace.js';

export function createApp(pool, mongo) {
  const app = express();
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use((req,res,next) => {
    const requestId = randomUUID(), start = performance.now();
    res.set('X-Request-ID', requestId);res.locals.requestId=requestId;
    res.on('finish', () => { if(req.path.startsWith('/api/')) console.info(JSON.stringify({event:'request',requestId,method:req.method,status:res.statusCode,durationMs:Math.round(performance.now()-start),route:req.route?.path || '/api/unmatched'})); });
    next();
  });
  app.use(helmet());
  app.use(express.json({ limit: '16kb' }));
  app.use('/api', rateLimit({ windowMs: 60000, limit: 180 }));
  const auth=installAuth(app,pool);
  installWorkspace(app,pool,mongo,auth);
  const writeLimit = rateLimit({ windowMs: 60000, limit: 20 });
  const admin=(req,res,next)=>auth.privileged(req,res,()=>{if(!['admin','super_admin'].includes(req.user.role))throw new HttpError(403,'Administrator access required');next();});
  app.get('/api/health', async (req,res) => {
    await pool.query('SELECT 1'); await mongo.command({ ping: 1 });
    res.json({ status: 'ok', postgres: 'connected', mongodb: 'connected' });
  });
  app.get('/api/categories', async (req,res) => res.json((await pool.query('SELECT c.id,c.name,c.icon,c.parent_id,c.attributes,count(p.id)::int AS product_count,(array_agg(p.id ORDER BY p.id DESC) FILTER (WHERE p.id IS NOT NULL))[1:2] AS preview_ids,(array_agg(p.media_url ORDER BY p.id DESC) FILTER (WHERE p.id IS NOT NULL))[1:2] AS preview_media FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.active AND p.approved AND EXISTS(SELECT 1 FROM sellers visible_shop WHERE visible_shop.id=p.seller_id AND visible_shop.operating_state=$$active$$ AND visible_shop.is_approved) GROUP BY c.id ORDER BY c.id')).rows));
  app.get('/api/sellers', async (req,res) => res.json((await pool.query('SELECT s.id,s.name,s.city,s.description,s.demo,s.slug,count(p.id)::int AS product_count,(array_agg(p.id ORDER BY p.id DESC) FILTER (WHERE p.id IS NOT NULL))[1:3] AS preview_ids,(array_agg(p.media_url ORDER BY p.id DESC) FILTER (WHERE p.id IS NOT NULL))[1:3] AS preview_media FROM sellers s LEFT JOIN products p ON p.seller_id=s.id AND p.active AND p.approved AND EXISTS(SELECT 1 FROM sellers visible_shop WHERE visible_shop.id=p.seller_id AND visible_shop.operating_state=$$active$$ AND visible_shop.is_approved) WHERE s.is_approved AND s.operating_state<>$$suspended$$ GROUP BY s.id ORDER BY s.id')).rows));
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
    const where = `p.active AND p.approved AND EXISTS(SELECT 1 FROM sellers visible_shop WHERE visible_shop.id=p.seller_id AND visible_shop.operating_state=$$active$$ AND visible_shop.is_approved) AND ($1='' OR p.name ILIKE '%'||$1||'%' OR p.description ILIKE '%'||$1||'%') AND ($2::int IS NULL OR p.category_id=$2) AND ($3::int IS NULL OR p.seller_id=$3) AND ($4::bigint IS NULL OR p.price >= $4) AND ($5::bigint IS NULL OR p.price <= $5) AND (NOT $6::boolean OR p.stock > 0)`;
    const values = [search,category,seller,minPrice,maxPrice,inStock];
    const { rows } = await pool.query(`SELECT p.*,s.name AS seller,s.demo,c.name AS category FROM products p JOIN sellers s ON s.id=p.seller_id JOIN categories c ON c.id=p.category_id WHERE ${where} ORDER BY ${sort} LIMIT 12 OFFSET $7`, [...values,(page-1)*12]);
    const { rows: [count] } = await pool.query(`SELECT count(*)::integer AS total FROM products p WHERE ${where}`, values);
    res.json({ products:rows, total:count.total, page, pages:Math.ceil(count.total/12) });
  });
  app.get('/api/products/:id', async (req,res) => {
    const id = integer(req.params.id,'Product ID');
    const { rows:[p] } = await pool.query('SELECT p.*,s.name AS seller,s.city,s.demo,c.name AS category FROM products p JOIN sellers s ON s.id=p.seller_id JOIN categories c ON c.id=p.category_id WHERE p.id=$1 AND p.active AND p.approved AND EXISTS(SELECT 1 FROM sellers visible_shop WHERE visible_shop.id=p.seller_id AND visible_shop.operating_state=$$active$$ AND visible_shop.is_approved)',[id]);
    if (!p) throw new HttpError(404,'Product not found');
    // This page combines relational product data and document reviews.
    const reviews = await mongo.collection('reviews').find({ productId:id,userId:{$exists:true} },{ projection:{ _id:0 } }).sort({ createdAt:-1 }).limit(20).toArray();
    const canReview = !p.demo && !!req.user && !!(await pool.query("SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=$1 AND o.buyer_user_id=$2 AND o.status='delivered' LIMIT 1",[id,req.user.id])).rowCount;
    res.json({ ...p, reviews, canReview });
  });
  app.get('/api/admin/products/:id', admin, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const id = integer(req.params.id, 'Product ID');
    const { rows: [product] } = await pool.query('SELECT id,name,description,price,stock,category_id,seller_id,approved,active,icon FROM products WHERE id=$1 AND active', [id]);
    if (!product) throw new HttpError(404, 'Product not found or archived');
    res.json(product);
  });
  app.post('/api/products', writeLimit, admin, async (req,res) => {
    const p = productInput(req.body);
    const { rows:[row] } = await pool.query('INSERT INTO products(name,description,price,stock,category_id,seller_id,approved,icon) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',Object.values(p));
    await pool.query('INSERT INTO audit_events(actor_id,action,resource) VALUES($1,$2,$3)',[req.user.id,'legacy_product_create',`product:${row.id}`]);
    res.status(201).json(row);
  });
  app.put('/api/products/:id', writeLimit, admin, async (req,res) => {
    const id = integer(req.params.id,'Product ID'), p = productInput(req.body);
    const { rows:[row] } = await pool.query('UPDATE products SET name=$1,description=$2,price=$3,stock=$4,category_id=$5,seller_id=$6,approved=$7,icon=$8 WHERE id=$9 AND active RETURNING *',[...Object.values(p),id]);
    if (!row) throw new HttpError(404,'Product not found');
    await pool.query('INSERT INTO audit_events(actor_id,action,resource) VALUES($1,$2,$3)',[req.user.id,'legacy_product_update',`product:${row.id}`]);
    res.json(row);
  });
  app.delete('/api/products/:id', writeLimit, admin, async (req,res) => {
    const { rowCount } = await pool.query('UPDATE products SET active=false WHERE id=$1 AND active',[integer(req.params.id,'Product ID')]);
    if (!rowCount) throw new HttpError(404,'Product not found');
    await pool.query('INSERT INTO audit_events(actor_id,action,resource) VALUES($1,$2,$3)',[req.user.id,'legacy_product_archive',`product:${req.params.id}`]);
    res.status(204).end();
  });
  app.post('/api/orders/recover',writeLimit,async(req,res)=>{const key=text(req.body.key,'Checkout key',36,36);if(!/^[0-9a-f-]{36}$/i.test(key))throw new HttpError(400,'Invalid checkout key');const {rows:[saved]}=await pool.query('SELECT response FROM checkout_requests WHERE request_key=$1 AND buyer_user_id IS NOT DISTINCT FROM $2::int',[key,req.user?.id||null]);if(!saved)throw new HttpError(404,'No completed checkout found for this request. You can retry your order.');res.json(saved.response);});
  app.post('/api/orders', writeLimit, async (req,res) => res.status(201).json(await placeOrder(pool, req.body, req.get('Idempotency-Key'), req.user?.id)));
  app.post('/api/products/:id/reviews', writeLimit, auth.required, async (req,res) => {
    const id = integer(req.params.id,'Product ID');
    const { rows:[product] } = await pool.query("SELECT p.id,s.demo FROM products p JOIN sellers s ON s.id=p.seller_id WHERE p.id=$1 AND p.active AND p.approved AND s.operating_state='active' AND s.is_approved",[id]);
    if (!product) throw new HttpError(404,'Product not found');
    if (product.demo) throw new HttpError(403,'Reviews are unavailable for demonstration listings.');
    const { rowCount } = await pool.query("SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id WHERE i.product_id=$1 AND o.buyer_user_id=$2 AND o.status='delivered' LIMIT 1",[id,req.user.id]);
    if (!rowCount) throw new HttpError(403,'You can review this product after your account order is delivered.');
    const review = { productId:id,userId:req.user.id,author:req.user.name,rating:integer(req.body?.rating,'Rating',1,5),comment:text(req.body?.comment,'Review',5,1000),createdAt:new Date() };
    await mongo.collection('reviews').updateOne({productId:id,userId:req.user.id},{$set:review},{upsert:true});
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
  app.get('/api/stats/sales', auth.privileged, async (req,res) => {
    const seller = req.query.seller ? integer(req.query.seller,'Seller') : null;
    const { rows:sellers } = await pool.query('SELECT * FROM seller_sales WHERE ($1::int IS NULL OR id=$1) ORDER BY revenue DESC',[seller]);
    const { rows:daily } = await pool.query(`SELECT to_char(o.created_at,'YYYY-MM-DD') AS day,sum(so.total) AS revenue,count(*)::int AS orders FROM seller_orders so JOIN orders o ON o.id=so.order_id WHERE so.status <> 'cancelled' AND o.created_at >= now()-interval '30 days' AND ($1::int IS NULL OR so.seller_id=$1) GROUP BY 1 ORDER BY 1`,[seller]);
    const { rows:top } = await pool.query(`SELECT p.name,sum(i.quantity)::int AS units,sum(i.quantity*i.unit_price) AS revenue FROM order_items i JOIN products p ON p.id=i.product_id JOIN orders o ON o.id=i.order_id WHERE o.status <> 'cancelled' AND ($1::int IS NULL OR i.seller_id=$1) GROUP BY p.id ORDER BY revenue DESC LIMIT 5`,[seller]);
    res.json({ sellers,daily,top });
  });
  app.get('/api/stats/activity', auth.privileged, async (req,res) => {
    const [events, searches, reviews] = await Promise.all([
      mongo.collection('click_events').aggregate([{ $group:{ _id:'$type', count:{ $sum:1 } } },{ $sort:{ count:-1 } }]).toArray(),
      mongo.collection('search_logs').aggregate([{ $group:{ _id:'$query', count:{ $sum:1 } } },{ $sort:{ count:-1 } },{ $limit:5 }]).toArray(),
      mongo.collection('reviews').countDocuments()
    ]);
    res.json({ events,searches,reviews });
  });
  app.use('/api', (req,res) => res.status(404).json({ error:'API route not found' }));
  app.get('/manage.html',(req,res)=>res.redirect('/admin/products/moderation'));
  app.get('/dashboard.html',(req,res)=>res.redirect('/seller'));
  app.get(['/register','/login','/verify-email','/forgot-password','/reset-password','/account','/account/{*path}','/seller','/seller/{*path}','/admin','/admin/{*path}'],(req,res)=>res.sendFile(fileURLToPath(new URL('../public/workspace.html',import.meta.url))));
  app.get('/shops/:slug',(req,res)=>res.sendFile(fileURLToPath(new URL('../public/storefront.html',import.meta.url))));
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
  app.use((err,req,res,next) => {
    const status = (err.code==='LIMIT_FILE_SIZE'?413:err.code==='LIMIT_UNEXPECTED_FILE'?400:0) || err.status || ({ '23503':400,'23505':409,'23514':400,'22P02':400 }[err.code]) || 500;
    if (status >= 500) console.error(JSON.stringify({event:'request_error',requestId:res.locals.requestId,name:err.name,code:err.code || ''}));
    res.status(status).json({ error:status >= 500 ? 'Service unavailable. Please try again.' : err.code==='LIMIT_FILE_SIZE'?'Image must be under 5 MB':err.code==='23505'?'This email, shop URL, name or SKU is already in use. Choose another or sign in.':err.code ? 'Invalid or conflicting database reference' : err.message });
  });
  return app;
}
