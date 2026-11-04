import assert from 'node:assert/strict';

import {request,chromium} from 'playwright';

import {generate} from 'otplib';

import sharp from 'sharp';

import{developmentEnvironment}from'./development.js';

import{randomUUID}from'node:crypto';

import{writeFile,mkdir}from'node:fs/promises';

process.env.ADMIN_TOKEN='development-only-bootstrap-token-1234567890';

const env=await developmentEnvironment(),server=env.app.listen(4180,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:4180';const contexts=[];let browser;const evidence=[];

async function client(){const context=await request.newContext({baseURL:base});contexts.push(context);let csrf='';return{context,async refresh(){const r=await context.get('/api/auth/me'),data=await r.json();csrf=data.csrf;return data;},async call(path,method='GET',body,headers={}){const r=await context.fetch('/api'+path,{method,data:body,headers:{...(csrf?{'X-CSRF-Token':csrf}:{}),...headers}});return{status:r.status(),body:await r.json()};},async register(email,name='Test User'){const r=await this.call('/auth/register','POST',{name,email,password:'Development-only-password42!',agree:true,role:'super_admin'});assert.equal(r.status,201,JSON.stringify(r.body));await this.refresh();return r.body.user;}};}

const ok=(r,status=200)=>{assert.equal(r.status,status,JSON.stringify(r.body));return r.body;};

try{

 const admin=await client();const root=await admin.register('admin@example.test');assert.equal(root.role,'buyer');ok(await admin.call('/auth/bootstrap','POST',{}, {Authorization:'Bearer '+process.env.ADMIN_TOKEN}));ok(await admin.call('/admin/overview'),403);const setup=ok(await admin.call('/account/mfa/setup','POST'));ok(await admin.call('/account/mfa/confirm','POST',{code:await generate({secret:setup.secret})}));await admin.refresh();ok(await admin.call('/admin/overview'));evidence.push('Public registration cannot grant a privileged role; bootstrap and MFA protect staff tools.');

 const seller=await client(),user=await seller.register('seller@example.test','Seller One');const app=ok(await seller.call('/seller/application','PUT',{name:'Test Ceramic Studio',slug:'test-ceramic-studio',city:'Tashkent',description:'Test ceramics and home objects',version:0}));assert.ok(app.shop_id);const shops=ok(await seller.call('/seller/shops'));const shop=shops[0].id;assert.equal(shop,app.shop_id);

 ok(await seller.call('/seller/application/submit','POST'),403);

 await env.pool.query('UPDATE app_users SET verified=true WHERE id=$1',[user.id]);ok(await seller.call('/seller/application/submit','POST'));ok(await admin.call('/admin/applications/'+app.id+'/decision','POST',{state:'changes_requested',reason:'Please clarify your product description.'}));let application=ok(await seller.call('/seller/application'));assert.equal(application.state,'changes_requested');application=ok(await seller.call('/seller/application','PUT',{...application.data,description:'Handmade ceramic homewares from our test studio',version:application.version}));ok(await seller.call('/seller/application/submit','POST'));ok(await admin.call('/admin/applications/'+app.id+'/decision','POST',{state:'approved',reason:'Test application meets the marketplace criteria.'}));evidence.push('Seller application persists, changes requested, corrected and approved; provisional shop becomes active.');

 const png=await sharp({create:{width:240,height:240,channels:3,background:'#d9e7cf'}}).png().toBuffer();const me=await seller.refresh();const upload=await seller.context.post('/api/media',{multipart:{image:{name:'test.png',mimeType:'image/png',buffer:png}},headers:{'X-CSRF-Token':me.csrf}});assert.equal(upload.status(),201,await upload.text());const {url}=await upload.json();

 const draftData={name:'Test ceramic cup',description:'A handmade test cup with a comfortable handle.',category_id:2,price:90000,stock:1,media:[url],variants:[{name:'Green',sku:'CUP-GREEN',price:90000,stock:1}]};let draft=ok(await seller.call(`/seller/${shop}/products`,'POST',draftData),201);const initial=draft;draft=ok(await seller.call(`/seller/${shop}/products/${draft.id}`,'PUT',{...draftData,version:draft.version}));ok(await seller.call(`/seller/${shop}/products/${draft.id}`,'PUT',{...draftData,version:initial.version}),409);ok(await seller.call(`/seller/${shop}/products/${draft.id}/submit`,'POST'));

 const stranger=await client();await stranger.register('stranger@example.test');ok(await stranger.call(`/seller/${shop}/products`),403);ok(await stranger.call(`/seller/${shop}/products/${draft.id}`),403);assert.equal((await stranger.context.get(url)).status(),404);

 ok(await admin.call(`/admin/products/${draft.id}/decision`,'POST',{state:'changes_requested',reason:'Add clearer product specifications.'}));draft=ok(await seller.call(`/seller/${shop}/products/${draft.id}`));draft=ok(await seller.call(`/seller/${shop}/products/${draft.id}`,'PUT',{...draft.data,specifications:'Glazed ceramic, handwash recommended.',version:draft.version}));ok(await seller.call(`/seller/${shop}/products/${draft.id}/submit`,'POST'));ok(await admin.call(`/admin/products/${draft.id}/decision`,'POST',{state:'approved',reason:'Description and image meet the test criteria.'}));const published=ok(await stranger.call('/products?seller='+shop)).products[0];assert.equal(published.name,'Test ceramic cup · Green');assert.equal((await stranger.context.get(url)).status(),200);evidence.push('Raster upload persists; drafts are private; stale edits rejected; moderation feedback and corrected approval publish the product.');

 const customer={name:'Test Buyer',email:'stranger@example.test',city:'Tashkent',address:'Test address 42',expectedTotal:90000,items:[{product_id:published.id,quantity:1}]};const key=randomUUID();const [a,b]=await Promise.all([stranger.call('/orders','POST',customer,{'Idempotency-Key':key}),stranger.call('/orders','POST',customer,{'Idempotency-Key':key})]);ok(a,201);ok(b,201);assert.equal(a.body.id,b.body.id);assert.equal(ok(await stranger.call('/orders/recover','POST',{key})).id,a.body.id);ok(await seller.call('/orders/recover','POST',{key}),404);ok(await stranger.call('/orders','POST',customer,{'Idempotency-Key':key}),201);const data=ok(await stranger.call('/account/orders'));assert.equal(data.length,1);assert.equal((await env.pool.query('SELECT stock FROM products WHERE id=$1',[published.id])).rows[0].stock,0);evidence.push('Simultaneous same-key requests and retry after a committed response return one order and decrement stock once (serialized PGlite test adapter).');

 const order=a.body.seller_orders[0];ok(await stranger.call(`/seller/${shop}/orders/${order.id}`),403);const detail=ok(await seller.call(`/seller/${shop}/orders/${order.id}`));assert.equal(detail.items.length,1);ok(await seller.call(`/seller/${shop}/orders/${order.id}/status`,'POST',{previousStatus:'placed',status:'shipped'}));ok(await seller.call(`/seller/${shop}/orders/${order.id}/status`,'POST',{previousStatus:'placed',status:'shipped'}));ok(await seller.call(`/seller/${shop}/orders/${order.id}/status`,'POST',{previousStatus:'shipped',status:'delivered'}));assert.equal(ok(await stranger.call('/account/orders'))[0].status,'delivered');evidence.push('Seller sees only own order portion; fulfillment updates persist and appear in buyer history. Repeated status update is safe.');

 // Stock concurrency and changed price use separate keys; only one buyer can buy the final item.

 await env.pool.query('UPDATE products SET stock=1 WHERE id=$1',[published.id]);const concurrent=await Promise.all([stranger.call('/orders','POST',customer,{'Idempotency-Key':randomUUID()}),stranger.call('/orders','POST',customer,{'Idempotency-Key':randomUUID()})]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[201,409]);await env.pool.query('UPDATE products SET stock=2,price=91000 WHERE id=$1',[published.id]);ok(await stranger.call('/orders','POST',customer,{'Idempotency-Key':randomUUID()}),409);evidence.push('Final-item competition and changed-price rejection checked in isolated SQL adapter; real multi-connection PostgreSQL locking still requires staging.');

 const invite=ok(await seller.call(`/seller/${shop}/team`,'POST',{email:'stranger@example.test',permissions:['inventory']}));await env.pool.query('UPDATE app_users SET verified=true WHERE email=$1',['stranger@example.test']);ok(await stranger.call('/account/invitations/'+invite.link.split('=').pop()+'/accept','POST'));ok(await stranger.call(`/seller/${shop}/inventory`));ok(await stranger.call(`/seller/${shop}/products`),403);const strangerId=(await stranger.refresh()).user.id;ok(await seller.call(`/seller/${shop}/team/${strangerId}`,'DELETE'));ok(await stranger.call(`/seller/${shop}/inventory`),403);evidence.push('Invitation permissions restrict staff operations; removal affects the existing session immediately.');

 // Browser verifies persisted results and responsive workspace layouts.

 browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({storageState:await seller.context.storageState()});const p=await context.newPage();await mkdir('evidence',{recursive:true});

 for(const width of[360,390,768,1440]){await p.setViewportSize({width,height:900});for(const route of['/seller',`/seller/products?shop=${shop}`,`/seller/orders/${order.id}?shop=${shop}`,'/account/profile']){await p.goto(base+route,{waitUntil:'networkidle'});assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow '+width);assert.equal(await p.locator('#workspace>.error').count(),0);}}

 await p.goto(base+`/seller/orders/${order.id}?shop=${shop}`,{waitUntil:'networkidle'});await p.getByText('delivered',{exact:true}).waitFor();await p.screenshot({path:'evidence/seller-fulfilled-order.png',fullPage:true});await p.goto(base+`/seller/products/${draft.id}/edit?shop=${shop}`,{waitUntil:'networkidle'});await p.getByLabel('Product title',{exact:true}).waitFor();await p.screenshot({path:'evidence/product-editor.png',fullPage:true});evidence.push('Chrome renders persisted seller order and product revision; four responsive widths have no document overflow.');

 const newcomer=await browser.newContext();const signup=await newcomer.newPage();await signup.goto(base+'/register',{waitUntil:'networkidle'});await signup.getByLabel('Your name',{exact:true}).fill('Browser Seller');await signup.getByLabel('Email address',{exact:true}).fill('browser-seller@example.test');await signup.locator('input[name=password]').fill('Development-only-password42!');await signup.getByRole('checkbox').check();await signup.getByRole('button',{name:'Create account',exact:true}).click();await signup.waitForURL('**/account/profile');await signup.goto(base+'/seller/onboarding',{waitUntil:'networkidle'});await signup.getByLabel('Shop name',{exact:true}).fill('Browser Shop');await signup.locator('input[name=slug]').fill('browser-shop');await signup.getByLabel('City',{exact:true}).fill('Tashkent');await signup.getByLabel('What will you sell?',{exact:true}).fill('Browser-tested ceramics and homewares');await signup.getByRole('button',{name:'Save application draft',exact:true}).click();await signup.getByText('Draft saved. You can return to continue.',{exact:true}).waitFor();await signup.reload({waitUntil:'networkidle'});assert.equal(await signup.getByLabel('Shop name',{exact:true}).inputValue(),'Browser Shop');await newcomer.close();evidence.push('Browser registration and application draft saving persist across refresh.');



 const anonymous=await client();ok(await anonymous.call('/admin/users'),401);ok(await anonymous.call('/auth/forgot','POST',{email:'seller@example.test'}),503);await env.pool.query('UPDATE app_users SET suspended=true WHERE id=$1',[user.id]);ok(await seller.call('/seller/shops'),401);evidence.push('Suspension interrupts existing sessions; disabled email recovery reports unavailable.');

 await writeFile('evidence/workspace-verification.json',JSON.stringify({checks:evidence,queryCount:env.metrics.length,limits:'PGlite runs PostgreSQL SQL in-process; transactions serialized by adapter and advisory lock function is a test shim. Mongo media uses an in-memory substitute. Production PostgreSQL/MongoDB checks are separate.'},null,2));console.log('WORKSPACE PASS',evidence.length,'checks');

}finally{await browser?.close();for(const c of contexts)await c.dispose();await new Promise(r=>server.close(r));await env.db.close();}
