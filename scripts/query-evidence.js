import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { pool,mongo,connect,close } from '../src/db.js';
try{
 await connect();await mkdir('artifacts',{recursive:true});
 const sql=await readFile(new URL('../sql/03_queries.sql',import.meta.url),'utf8');
 const results=await pool.query(sql);
 const queries=results.map((r,i)=>({statement:i+1,command:r.command,rowCount:r.rowCount,rows:r.rows}));
 await writeFile('artifacts/sql-results.json',JSON.stringify({run:new Date().toISOString(),results:queries},null,2));
 const counts={};for(const name of ['reviews','click_events','search_logs'])counts[name]=await mongo.collection(name).countDocuments();
 const aggregations={
  topViews:await mongo.collection('click_events').aggregate([{$match:{type:'product_view'}},{$group:{_id:'$productId',views:{$sum:1}}},{$sort:{views:-1}},{$limit:5}]).toArray(),
  ratings:await mongo.collection('reviews').aggregate([{$group:{_id:'$productId',rating:{$avg:'$rating'},reviews:{$sum:1}}},{$sort:{rating:-1}}]).toArray(),
  searches:await mongo.collection('search_logs').aggregate([{$group:{_id:'$query',searches:{$sum:1}}},{$sort:{searches:-1}}]).toArray(),
  daily:await mongo.collection('click_events').aggregate([{$group:{_id:{$dateToString:{format:'%Y-%m-%d',date:'$createdAt'}},events:{$sum:1}}},{$sort:{_id:1}}]).toArray(),
  cities:await mongo.collection('click_events').aggregate([{$match:{type:'add_to_cart'}},{$group:{_id:'$city',events:{$sum:1}}},{$sort:{events:-1}}]).toArray()
 };
 await writeFile('artifacts/mongo-results.json',JSON.stringify({run:new Date().toISOString(),counts,aggregations},null,2));
 console.log('Executed all SQL exercises and five Mongo aggregations. Saved actual JSON evidence in artifacts/.');
}finally{await close();}
