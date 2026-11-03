import { createApp } from './app.js';
import { pool,mongo,connect,close } from './db.js';
try {
  await connect();
  const server = createApp(pool,mongo).listen(Number(process.env.PORT || 3000),'0.0.0.0', () => console.log('Marketplace server started'));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => server.close(async () => { await close(); process.exit(0); }));
} catch (error) {
  console.error('Startup failed:', error.name, error.code || '', 'Check database configuration and connectivity.');
  await close(); process.exitCode = 1;
}
