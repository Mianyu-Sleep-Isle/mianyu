import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import express from 'express';
import { createPlanningRouter } from './modules/planning/routes.ts';
import { PlanningRepository } from './modules/planning/repository.ts';
import { PlanningService, type ContentCatalogService, type PreferenceQueryService } from './modules/planning/service.ts';
import type { ContentCandidate } from './modules/planning/types.ts';
const demoCandidates: ContentCandidate[] = [
  { contentId: 'A01', contentKind: 'audio', tags: ['rain'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'A03', contentKind: 'audio', tags: ['fire'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A04', contentKind: 'audio', tags: ['page'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A07', contentKind: 'audio', tags: ['room'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A10', contentKind: 'audio', tags: ['keyboard'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'A12', contentKind: 'audio', tags: ['thunder'], ageMode: 'all', hasVoice: false, reviewStatus: 'approved', copyrightStatus: 'licensed', enabled: true },
  { contentId: 'S01', contentKind: 'story', tags: ['gentle'], ageMode: 'adult', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'S02', contentKind: 'story', tags: ['gentle'], ageMode: 'child', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
  { contentId: 'B01', contentKind: 'breath', tags: ['calm'], ageMode: 'all', hasVoice: true, reviewStatus: 'approved', copyrightStatus: 'owned', enabled: true },
];
export function createApp(options: { database?: DatabaseSync; catalog?: ContentCatalogService; preferences?: PreferenceQueryService } = {}) {
  const database = options.database ?? new DatabaseSync(':memory:'); database.exec(readFileSync(new URL('../migrations/200_module2.sql', import.meta.url), 'utf8'));
  const catalog = options.catalog ?? { async listCandidates() { return demoCandidates; } };
  const preferences = options.preferences ?? { async getPreferences() { return { avoidTags: [] }; } };
  const service = new PlanningService(new PlanningRepository(database), catalog, preferences); const app = express();
  app.use((req, res, next) => { const origin = req.header('Origin');
    if (origin && (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Mianyu-User-Id, X-Mianyu-Age-Mode, Idempotency-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS'); if (req.method === 'OPTIONS') { res.sendStatus(204); return; } next(); });
  app.use(express.json({ limit: '32kb' })); app.get('/api/v1/health', (_req, res) => res.json({ data: { service: 'mianyu-backend', database: 'ok', contractVersion: 'v1' } }));
  app.use('/api/v1', createPlanningRouter(service)); return { app, database, service }; }
