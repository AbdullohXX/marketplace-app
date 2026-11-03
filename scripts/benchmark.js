import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { pool,close } from '../src/db.js';
try {
  const result = await pool.query(await readFile(new URL('../sql/04_big_data.sql',import.meta.url),'utf8'));
  const plans = result.filter(r=>r.fields?.some(f=>f.name==='QUERY PLAN')).map(r=>r.rows.map(row=>row['QUERY PLAN']).join('\n'));
  await mkdir('artifacts',{recursive:true});
  const output = `Run: ${new Date().toISOString()}\n\nBEFORE\n${plans[0]}\n\nAFTER\n${plans[1]}\n`;
  await writeFile('artifacts/benchmark.txt',output); console.log(output);
} finally { await close(); }
