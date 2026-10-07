import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadDashScopeConfig } from './modules/planning/llm/client.ts';

const port = Number(process.env.PORT ?? 8787);
const databasePath = process.env.MIANYU_DB_PATH ?? fileURLToPath(new URL('../data/mianyu.sqlite', import.meta.url));
const { app, migrations } = createApp({ databasePath });

app.listen(port, '127.0.0.1', () => {
  console.log(`Mianyu API: http://127.0.0.1:${port}/api/v1`);
  console.log(`SQLite: ${databasePath}`);
  if (migrations.length > 0) console.log(`Applied migrations: ${migrations.map((item) => item.name).join(', ')}`);
  const dashscope = loadDashScopeConfig();
  console.log(`LLM: ${dashscope ? `enabled (model=${dashscope.model}, base=${dashscope.baseUrl})` : 'disabled (DASHSCOPE_API_KEY not set; rule engine only)'}`);
});
