// Creates a local-only .env without overwriting an existing one or printing secrets.
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
const password=randomBytes(24).toString('hex');
const token=randomBytes(32).toString('hex');
try {
 await writeFile(new URL('../.env',import.meta.url),`DATABASE_URL=postgresql://marketplace:${password}@127.0.0.1:5432/marketplace\nDATABASE_PASSWORD=${password}\nMONGODB_URI=mongodb://127.0.0.1:27017\nMONGODB_DB=marketplace\nPORT=3000\nADMIN_TOKEN=${token}\nTRUST_PROXY=0\n`,{flag:'wx',mode:0o600});
 console.log('Created private local .env. No credential values printed.');
}catch(e){if(e.code==='EEXIST')console.log('Existing .env preserved.');else throw e;}
