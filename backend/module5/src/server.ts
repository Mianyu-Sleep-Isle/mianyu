import { resolve } from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 8787);
const databasePath = process.env.MIANYU_DB_PATH || resolve(process.cwd(), 'data', 'module5.sqlite');
const { app } = createApp({ databasePath });
app.listen(port, '127.0.0.1', () => {
  console.log(`Mianyu module 5 API: http://127.0.0.1:${port}/api/v1`);
  console.log(`SQLite: ${databasePath}`);
});
