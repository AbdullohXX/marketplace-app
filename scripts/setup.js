import { readFile } from 'node:fs/promises';
import { pool,mongo,connect,close } from '../src/db.js';
import { seedMongo } from '../mongo/01_setup.js';
try {
  await connect();
  for (const file of ['01_schema.sql','02_seed.sql']) await pool.query(await readFile(new URL(`../sql/${file}`,import.meta.url),'utf8'));
  await seedMongo(mongo);
  console.log('Schema, SQL sample data, reviews, 10000 click events, and 1000 search logs prepared.');
} finally { await close(); }
