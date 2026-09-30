import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { createPlanningRouter } from './modules/planning/routes.ts';
import { PlanningRepository } from './modules/planning/repository.ts';
import { PlanningService, type ContentCatalogService, type PreferenceQueryService } from './modules/planning/service.ts';
import { demoCandidates } from './modules/planning/seed.ts';
export function createApp(options: { database?: DatabaseSync; catalog?: ContentCatalogService; preferences?: PreferenceQueryService } = {}) {
  const database = options.database ?? new DatabaseSync(':memory:'); database.exec(readFileSync(new URL('../migrations/200_module2.sql', import.meta.url), 'utf8'));
  const catalog = options.catalog ?? { async listCandidates() { return demoCandidates; } };
  const preferences = options.preferences ?? { async getPreferences() { return { avoidTags: [] }; } };
  const service = new PlanningService(new PlanningRepository(database), catalog, preferences); const app = express();
  app.use((req, res, next) => { const origin = req.header('Origin');
    if (origin && (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || origin === 'https://liuzilin94.github.io')) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-Age-Mode, X-Mianyu-User-Id, X-Mianyu-Age-Mode, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); if (req.method === 'OPTIONS') { res.sendStatus(204); return; } next(); });
  app.use(express.json({ limit: '32kb' })); app.get('/api/v1/health', (_req, res) => res.json({ data: { service: 'mianyu-backend', database: 'ok', contractVersion: 'v1' } }));
  app.use('/api/v1', createPlanningRouter(service)); return { app, database, service }; }
