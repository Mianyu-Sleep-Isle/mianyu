import { mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 4173);

mkdirSync('data', { recursive: true });

const database = new DatabaseSync(process.env.MIANYU_DB_PATH ?? 'data/mianyu.sqlite');
const { app } = createApp({ database });
const server = app.listen(port, '127.0.0.1');

server.on('listening', () => {
  console.log(`Mianyu API listening on http://127.0.0.1:${port}/api/v1`);
});

server.on('error', (error) => {
  console.error('Mianyu API failed to start:', error);
  process.exitCode = 1;
});

