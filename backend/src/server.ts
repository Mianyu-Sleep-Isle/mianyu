import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 8787);
const databasePath = process.env.MIANYU_DB_PATH ?? fileURLToPath(new URL('../data/mianyu.sqlite', import.meta.url));
const { app, migrations } = createApp({ databasePath });

app.listen(port, '127.0.0.1', () => {
  console.log(`Mianyu API: http://127.0.0.1:${port}/api/v1`);
  console.log(`SQLite: ${databasePath}`);
  if (migrations.length > 0) console.log(`Applied migrations: ${migrations.map((item) => item.name).join(', ')}`);
});
