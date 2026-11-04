import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createApp} from '../src/app.js';
export async function developmentEnvironment(){
 const db=new PGlite();await db.waitReady;
 for(const file of ['01_schema.sql','05_workspace.sql','02_seed.sql','06_demo_catalog.sql'])await db.exec(await readFile(new URL('../sql/'+file,import.meta.url),'utf8'));
 await db.exec('CREATE FUNCTION pg_advisory_xact_lock(bigint) RETURNS void LANGUAGE sql AS $$ SELECT $$');
 let tail=Promise.resolve();const metrics=[];
 const run=async(sql,params=[])=>{const start=performance.now();const r=await db.query(sql,params);metrics.push({sql:sql.replace(/\s+/g,' ').slice(0,100),ms:performance.now()-start});return{...r,rowCount:r.fields?.length?r.rows.length:(r.affectedRows??r.rows.length)};};
 const pool={query(sql,params,callback){if(typeof params==='function'){callback=params;params=[];}const p=run(sql,params);if(callback)p.then(r=>callback(null,r),callback);return p;},async connect(){let release;const previous=tail;tail=new Promise(r=>release=r);await previous;return{query:run,release};},on(){},end:()=>db.close()};
 const collections=new Map();
 const mongo={
  async command(){return{ok:1};},
  collection(name){
   if(!collections.has(name))collections.set(name,[]);
   const data=collections.get(name);
   const matches=(row,q)=>Object.entries(q).every(([k,v])=>v&&typeof v==='object'&&'$exists'in v?(v.$exists?row[k]!==undefined:row[k]===undefined):row[k]===v);
   return {
    async findOne(q){return data.find(r=>matches(r,q));},
    async insertOne(row){data.push({...row});return{insertedId:data.length};},
    async updateOne(q,update,{upsert}={}){const row=data.find(r=>matches(r,q));if(row){Object.assign(row,update.$set);return{matchedCount:1};}if(upsert){data.push({...q,...update.$set});return{upsertedCount:1};}return{matchedCount:0};},
    find(q){let rows=data.filter(r=>matches(r,q));const cursor={sort(){return cursor;},limit(n){rows=rows.slice(0,n);return cursor;},async toArray(){return rows;}};return cursor;},
    async countDocuments(){return data.length;},
    aggregate(){return{async toArray(){return[];}};}
   };
  }
 };

 return{db,pool,mongo,metrics,app:createApp(pool,mongo)};
}
if(process.argv.includes('--serve')){
 process.env.ADMIN_TOKEN='development-only-bootstrap-token-1234567890';
 const environment=await developmentEnvironment();environment.app.listen(4174,'127.0.0.1',()=>console.log('Isolated SQL development server at http://127.0.0.1:4174'));
}
