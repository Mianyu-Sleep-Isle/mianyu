import type { DatabaseSync } from 'node:sqlite';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  confirmedPlansForScene, planPreferences, planStartedPublisher, plansForSession, resourcesForSession, sceneAssetDirectory,
  scenesForSession, sessionFactsForGrowth, sessionLifecycle, sessionTargets,
} from './integration/adapters.ts';
import { createCommonRouter } from './modules/common/routes.ts';
import { UserService, type UserDataEraser } from './modules/common/users.ts';
import { ContentCatalog } from './modules/content/catalog.ts';
import { createContentRouter } from './modules/content/routes.ts';
import type { SessionFactsPort } from './modules/growth/contracts.ts';
import { createGrowthRouter, growthErrorTranslator } from './modules/growth/routes.ts';
import { GrowthService } from './modules/growth/service.ts';
import { createPlanningRouter } from './modules/planning/routes.ts';
import { PlanningRepository } from './modules/planning/repository.ts';
import { PlanningService, type ContentCatalogService, type PreferenceQueryService } from './modules/planning/service.ts';
import { PlanningError } from './modules/planning/types.ts';
import { SceneRepository } from './modules/scene/repository.ts';
import { createSceneRouter } from './modules/scene/routes.ts';
import { SceneService } from './modules/scene/service.ts';
import { SceneError } from './modules/scene/types.ts';
import { SleepSessionRepository } from './modules/session/repository.ts';
import { createSessionRouter, sessionErrorTranslator } from './modules/session/routes.ts';
import { SleepSessionService } from './modules/session/service.ts';
import type { Clock } from './modules/session/types.ts';
import { openDatabase, runMigrations } from './shared/database.ts';
import { ApiError, createErrorHandler, notFoundHandler, type ErrorTranslator } from './shared/http.ts';

export interface AppOptions {
  database?: DatabaseSync;
  databasePath?: string;
  // Test seams; production wiring uses the module 1 catalog, module 5 preferences and module 4 facts.
  catalog?: ContentCatalogService;
  preferences?: PreferenceQueryService;
  sessionFacts?: SessionFactsPort;
  clock?: Clock;
}

const allowedOrigins = new Set(['https://liuzilin94.github.io', 'https://mianyu-sleep-isle.github.io']);
const translators: ErrorTranslator[] = [
  (error) => error instanceof PlanningError ? new ApiError(error.code, error.message, error.status, error.details) : null,
  (error) => error instanceof SceneError ? new ApiError(error.code, error.message, error.status, error.details) : null,
  sessionErrorTranslator,
  growthErrorTranslator,
];

function cors(request: Request, response: Response, next: NextFunction): void {
  const origin = request.header('Origin');
  if (origin && (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) || allowedOrigins.has(origin))) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-Age-Mode, X-Mianyu-User-Id, X-Mianyu-Age-Mode, Idempotency-Key');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (request.method === 'OPTIONS') {
    response.sendStatus(204);
    return;
  }
  next();
}

export function createApp(options: AppOptions = {}) {
  const database = options.database ?? openDatabase(options.databasePath);
  database.exec('PRAGMA foreign_keys = ON');
  const migrations = runMigrations(database);

  const erasers: UserDataEraser[] = [];
  const users = new UserService(database, erasers);
  const catalog = new ContentCatalog(database);

  let sessionFacts: SessionFactsPort | undefined = options.sessionFacts;
  const growth = new GrowthService(database, {
    latestCompleted: (userId) => sessionFacts!.latestCompleted(userId),
    isCompletedForUser: (sessionId, userId) => sessionFacts!.isCompletedForUser(sessionId, userId),
  });
  const planning = new PlanningService(new PlanningRepository(database), options.catalog ?? catalog, options.preferences ?? planPreferences(growth, users));
  const scenes = new SceneService(new SceneRepository(database), confirmedPlansForScene(planning), catalog);
  const sessions = new SleepSessionService({
    plans: plansForSession(planning, catalog),
    scenes: scenesForSession(scenes),
    resources: resourcesForSession(catalog),
    publisher: planStartedPublisher(planning, growth, users),
    clock: options.clock ?? { now: () => new Date() },
    repository: new SleepSessionRepository(database),
  });
  sessionFacts ??= sessionFactsForGrowth(sessions);
  erasers.push(
    { module: 'content', erase: (userId) => catalog.eraseUserData(userId) },
    { module: 'planning', erase: (userId) => planning.eraseUserData(userId) },
    { module: 'scene', erase: (userId) => scenes.eraseUserData(userId) },
    { module: 'session', erase: (userId) => sessions.eraseUserData(userId) },
    { module: 'growth', erase: (userId) => growth.eraseUserData(userId) },
  );

  const app = express();
  app.disable('x-powered-by');
  app.use(cors);
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/v1/health', (_request, response) => {
    response.json({ data: { service: 'mianyu-backend', database: 'ok', contractVersion: 'v1', migrations: (database.prepare('SELECT version FROM schema_migration ORDER BY version').all() as Array<{ version: number }>).map((row) => row.version) } });
  });
  app.use('/api/v1', createCommonRouter(users));
  app.use('/api/v1', createContentRouter(catalog));
  app.use('/api/v1', createPlanningRouter(planning, { trackName: (contentId) => catalog.find(contentId)?.name }));
  app.use('/api/v1', createSceneRouter(scenes, { assets: sceneAssetDirectory(catalog) }));
  app.use('/api/v1', createSessionRouter(sessions, sessionTargets(planning, scenes), sessionLifecycle(planning)));
  app.use('/api/v1', createGrowthRouter(growth, users));
  app.use(notFoundHandler);
  app.use(createErrorHandler(translators));

  return { app, database, migrations, service: planning, services: { users, catalog, planning, scenes, sessions, growth } };
}
