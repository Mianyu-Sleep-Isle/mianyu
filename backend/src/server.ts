import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';
import { loadDashScopeConfig } from './modules/planning/llm/client.ts';

const port = Number(process.env.PORT ?? 8787);
const databasePath = process.env.MIANYU_DB_PATH ?? fileURLToPath(new URL('../data/mianyu.sqlite', import.meta.url));
const dramaMode = process.env.DRAMA_PROVIDERS === 'real' ? 'real' : 'fake';
const { app, migrations, services } = createApp({
  databasePath,
  drama: {
    mode: dramaMode,
    enabled: process.env.DRAMA_ENABLED !== '0',
    isolate: false,
    ...(process.env.DRAMA_DATA_DIR ? { dataDir: process.env.DRAMA_DATA_DIR } : {}),
    ...(process.env.DRAMA_SHOWCASE_DIR ? { showcaseDir: process.env.DRAMA_SHOWCASE_DIR } : {}),
    signingSecret: process.env.MEDIA_SIGNING_SECRET || (dramaMode === 'fake' ? 'fake-dev-signing-secret' : ''),
  },
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Mianyu API: http://127.0.0.1:${port}/api/v1`);
  console.log(`SQLite: ${databasePath}`);
  if (migrations.length > 0) console.log(`Applied migrations: ${migrations.map((item) => item.name).join(', ')}`);
  const dashscope = loadDashScopeConfig();
  console.log(`LLM: ${dashscope ? `enabled (model=${dashscope.model}, base=${dashscope.baseUrl})` : 'disabled (DASHSCOPE_API_KEY not set; rule engine only)'}`);
  services.drama.recover();
  const dramaBase = process.env.LLM_BASE_URL || 'unset';
  console.log(`Drama: providers=${dramaMode} base=${dramaBase} worker=${process.env.DRAMA_WORKER === '1' ? 'on' : 'off'}`);
  if (process.env.DRAMA_WORKER === '1') services.drama.startWorker();
});
