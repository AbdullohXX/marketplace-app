import { readFile } from 'node:fs/promises';
import { pool,mongo,connect,close } from '../src/db.js';
import { seedMongo } from '../mongo/01_setup.js';
try {
  await connect();
  for (const file of ['01_schema.sql','05_workspace.sql']) await pool.query(await readFile(new URL(`../sql/${file}`,import.meta.url),'utf8'));
  const {rows:[count]}=await pool.query('SELECT count(*)::int AS total FROM products');
  if(!count.total){await pool.query(await readFile(new URL('../sql/02_seed.sql',import.meta.url),'utf8'));await seedMongo(mongo);}
  await mongo.collection('media').createIndex({id:1},{unique:true});
  await mongo.collection('media').createIndex({userId:1});
  console.log('Database migrations complete; existing catalog and orders preserved.');
} finally { await close(); }
