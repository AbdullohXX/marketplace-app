import test from 'node:test';
import assert from 'node:assert/strict';
import { checkoutInput,productInput,integer } from '../src/domain.js';
import { placeOrder } from '../src/orders.js';
import { createApp } from '../src/app.js';
const customer={name:'Aziza Karimova',email:'AZIZA@example.test',city:'Tashkent',address:'Chilonzor 12, house 7'};
test('cart merges duplicate IDs, sorts locks, normalizes email, ignores client prices',()=>{
 const input=checkoutInput({...customer,items:[{product_id:9,quantity:2,price:1},{product_id:2,quantity:1},{product_id:9,quantity:3}]});
 assert.deepEqual(input.items,[[2,1],[9,5]]);assert.equal(input.email,'aziza@example.test');
});
test('rejects empty, fractional, oversized and excessive combined carts',()=>{
 for(const items of [[],[{product_id:1,quantity:.5}],[{product_id:1,quantity:-1}],[{product_id:1,quantity:100}],[{product_id:1,quantity:60},{product_id:1,quantity:60}],Array.from({length:51},(_,i)=>({product_id:i+1,quantity:1}))]) assert.throws(()=>checkoutInput({...customer,items}),{status:400});
});
test('requires valid customer fields',()=>{for(const patch of [{email:'not-an-email'},{name:''},{address:'x'},{city:null}])assert.throws(()=>checkoutInput({...customer,...patch,items:[{product_id:1,quantity:1}]}),{status:400});});
test('integer rejects booleans, null, non-finite and SQL-shaped input',()=>{for(const value of [true,null,undefined,NaN,Infinity,'1; DROP TABLE products','',{},[]])assert.throws(()=>integer(value,'id'),{status:400});});
test('product approval cannot be granted through a truthy string',()=>{const input=productInput({name:'Ceramic mug',description:'Hand-painted ceramic mug',price:85000,stock:3,category_id:1,seller_id:1,approved:'true'});assert.equal(input.approved,false);assert.throws(()=>productInput({...input,price:1.5}),{status:400});});
function fakePool(products){const calls=[];const client={async query(sql,params){calls.push({sql,params});if(sql.startsWith('SELECT id, seller_id'))return{rows:products};if(sql.startsWith('INSERT INTO customers'))return{rows:[{id:5}]};if(sql.startsWith('INSERT INTO orders('))return{rows:[{id:12,total:params[2],status:'placed'}]};if(sql.startsWith('INSERT INTO seller_orders'))return{rows:[{id:100+params[1],seller_id:params[1],total:params[2]}]};return{rows:[]};},release(){calls.push({sql:'RELEASE'});}};return{calls,async connect(){return client;}};}
test('checkout prices on server and splits totals between sellers',async()=>{
 const pool=fakePool([{id:1,seller_id:2,price:'95000',stock:10},{id:2,seller_id:3,price:'185000',stock:5}]);
 const order=await placeOrder(pool,{...customer,items:[{product_id:2,quantity:2,price:1},{product_id:1,quantity:1}]});
 assert.equal(order.total,465000);assert.deepEqual(order.seller_orders.map(s=>s.total),[95000,370000]);assert.equal(pool.calls.filter(c=>c.sql.startsWith('UPDATE products')).length,2);assert.equal(pool.calls.at(-2).sql,'COMMIT');assert.equal(pool.calls.at(-1).sql,'RELEASE');
});
test('insufficient stock rolls back and never writes an order',async()=>{const pool=fakePool([{id:1,seller_id:1,price:'1000',stock:0}]);await assert.rejects(placeOrder(pool,{...customer,items:[{product_id:1,quantity:1}]}),{status:409});assert.equal(pool.calls.at(-2).sql,'ROLLBACK');assert.equal(pool.calls.some(c=>c.sql.startsWith('INSERT')),false);assert.equal(pool.calls.at(-1).sql,'RELEASE');});
test('unapproved or missing products roll back',async()=>{const pool=fakePool([]);await assert.rejects(placeOrder(pool,{...customer,items:[{product_id:1,quantity:1}]}),{status:409});assert.equal(pool.calls.at(-2).sql,'ROLLBACK');});
test('catalog price and stock filters reach both product and count queries',async()=>{
 const calls=[];
 const pool={async query(sql,params){calls.push({sql,params});return sql.startsWith('SELECT count')?{rows:[{total:1}]}:{rows:[{id:2,name:'Bowl'}]};}};
 let server;
 await new Promise(resolve=>{server=createApp(pool,{}).listen(0,'127.0.0.1',resolve);});
 try{
  const base=`http://127.0.0.1:${server.address().port}`;
  const valid=await fetch(`${base}/api/products?minPrice=1000&maxPrice=200000&inStock=1`);
  assert.equal(valid.status,200);
  assert.deepEqual(calls[0].params,['',null,null,1000,200000,true,0]);
  assert.deepEqual(calls[1].params,['',null,null,1000,200000,true]);
  assert.match(calls[0].sql,/p\.stock > 0/);
  assert.equal((await fetch(`${base}/api/products?minPrice=300000&maxPrice=1000`)).status,400);
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('admin product reads reject missing and incorrect tokens before accessing data',async()=>{
 const previous=process.env.ADMIN_TOKEN;process.env.ADMIN_TOKEN='local-test-only-token-12345678901234567890';
 const calls=[];const pool={async query(sql,params){calls.push({sql,params});return {rows:params[0]===7?[{id:7,name:'Draft',approved:false}]:[]};}};
 let server;await new Promise(resolve=>{server=createApp(pool,{}).listen(0,'127.0.0.1',resolve);});
 try {
  const base=`http://127.0.0.1:${server.address().port}/api/admin/products/`;
  assert.equal((await fetch(base+'7')).status,401);
  assert.equal((await fetch(base+'7',{headers:{Authorization:'Bearer wrong'}})).status,401);
  assert.equal(calls.length,0);
  assert.equal((await fetch(base+'7',{headers:{Authorization:'Bearer '+process.env.ADMIN_TOKEN}})).status,401);
  assert.equal(calls.length,0);
 } finally {await new Promise(resolve=>server.close(resolve));if(previous===undefined)delete process.env.ADMIN_TOKEN;else process.env.ADMIN_TOKEN=previous;}
});

test('retry after a committed checkout returns the stored response without changing stock',async()=>{
 const pool=fakePool([{id:1,seller_id:2,price:'95000',stock:10}]);
 const connect=pool.connect.bind(pool);let saved;
 pool.connect=async()=>{const client=await connect();const query=client.query.bind(client);return {release:client.release,async query(sql,params){
  if(sql.startsWith('SELECT fingerprint'))return {rows:saved?[saved]:[]};
  if(sql.startsWith('INSERT INTO checkout_requests'))saved={fingerprint:params[1],response:JSON.parse(params[2])};
  return query(sql,params);
 }};};
 const body={...customer,expectedTotal:95000,items:[{product_id:1,quantity:1}]};const key='12345678-1234-1234-1234-123456789012';
 const first=await placeOrder(pool,body,key);const again=await placeOrder(pool,body,key);
 assert.deepEqual(again,first);assert.equal(pool.calls.filter(c=>c.sql.startsWith('UPDATE products')).length,1);
 await assert.rejects(placeOrder(pool,{...body,address:'Another test address'},key),{status:409});
});
test('changed checkout total rolls back before writing any customer or order',async()=>{
 const pool=fakePool([{id:1,seller_id:2,price:'96000',stock:10}]);
 await assert.rejects(placeOrder(pool,{...customer,expectedTotal:95000,items:[{product_id:1,quantity:1}]}),{status:409});
 assert.equal(pool.calls.some(c=>c.sql.startsWith('INSERT')),false);
});
