// Requires npm run db:setup on a DISPOSABLE database. Uses real PostgreSQL and MongoDB.
import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { pool,mongo,connect,close } from '../src/db.js';

test('real API: catalog, reviews, admin, split checkout, rollback, concurrent last item',async()=>{
 await connect();
 const oldToken=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN=randomUUID();
 const server=createApp(pool,mongo).listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const email=`integration-${randomUUID()}@example.test`;const ids=[];
 async function request(path,method='GET',body,admin=false){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(admin?{Authorization:`Bearer ${process.env.ADMIN_TOKEN}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return{status:response.status,body:response.status===204?null:await response.json()};}
 try{
  assert.equal((await request('/health')).body.status,'ok');
  const cats=await request('/categories'),sellers=await request('/sellers');assert.ok(cats.body.length>=5);assert.ok(sellers.body.length>=5);
  const data={name:'Integration fixture',description:'Temporary integration test product',price:12345,stock:5,category_id:cats.body[0].id,seller_id:sellers.body[0].id,approved:true};
  assert.equal((await request('/products','POST',data)).status,401);
  for(const seller of sellers.body.slice(0,2)){const p=await request('/products','POST',{...data,seller_id:seller.id},true);assert.equal(p.status,201);ids.push(p.body.id);}
  assert.equal((await request('/products?search=%27%20OR%201%3D1--')).body.total,0);
  assert.equal((await request('/products?sort=__proto__')).status,400);
  assert.equal((await request(`/products/${ids[0]}`)).body.reviews.length,0);
  assert.equal((await request(`/products/${ids[0]}/reviews`,'POST',{author:'Aziza',rating:5,comment:'Great test product'})).status,201);
  assert.equal((await request(`/products/${ids[0]}`)).body.reviews.length,1);
  const customer={name:'Integration User',email,city:'Tashkent',address:'Integration test address'};
  let order=await request('/orders','POST',{...customer,items:ids.map(id=>({product_id:id,quantity:2,price:1}))});assert.equal(order.status,201);assert.equal(Number(order.body.total),49380);assert.equal(order.body.seller_orders.length,2);
  const before=await pool.query('SELECT id,stock FROM products WHERE id=ANY($1::int[]) ORDER BY id',[ids]);
  const failed=await request('/orders','POST',{...customer,items:[{product_id:ids[0],quantity:1},{product_id:ids[1],quantity:99}]});assert.equal(failed.status,409);
  assert.deepEqual((await pool.query('SELECT id,stock FROM products WHERE id=ANY($1::int[]) ORDER BY id',[ids])).rows,before.rows);
  await pool.query('UPDATE products SET stock=1 WHERE id=$1',[ids[0]]);
  const concurrent=await Promise.all([1,2].map(()=>request('/orders','POST',{...customer,items:[{product_id:ids[0],quantity:1}]})));
  assert.deepEqual(concurrent.map(x=>x.status).sort(),[201,409]);
  assert.equal((await pool.query('SELECT stock FROM products WHERE id=$1',[ids[0]])).rows[0].stock,0);
  assert.equal((await request('/stats/sales')).status,200);assert.equal((await request('/stats/activity')).status,200);
  assert.equal((await request(`/products/${ids[1]}`,'PUT',{...data,seller_id:sellers.body[1].id,approved:false},true)).status,200);
  assert.equal((await request(`/products/${ids[1]}`)).status,404);
  assert.equal((await request(`/products/${ids[0]}`,'DELETE',undefined,true)).status,204);
  assert.equal((await request(`/products/${ids[0]}`)).status,404);
 }finally{
  // Remove only rows belonging to this unique test customer and generated product IDs.
  await new Promise(resolve=>server.close(resolve));
  const client=await pool.connect();try{await client.query('BEGIN');const orderFilter='SELECT o.id FROM orders o JOIN customers c ON c.id=o.customer_id WHERE c.email=$1';await client.query(`DELETE FROM payouts WHERE seller_order_id IN (SELECT id FROM seller_orders WHERE order_id IN (${orderFilter}))`,[email]);for(const table of ['payments','order_items','seller_orders'])await client.query(`DELETE FROM ${table} WHERE order_id IN (${orderFilter})`,[email]);await client.query(`DELETE FROM orders WHERE id IN (${orderFilter})`,[email]);await client.query('DELETE FROM customers WHERE email=$1',[email]);await client.query('DELETE FROM products WHERE id=ANY($1::int[])',[ids]);await client.query('COMMIT');}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();await mongo.collection('reviews').deleteMany({productId:{$in:ids}});if(oldToken===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=oldToken;await close();}
 }
});
