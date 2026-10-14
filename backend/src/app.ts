import type { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type NextFunction, type Request, type Response } from 'express';
import {
  confirmedPlansForScene, planPreferences, planStartedPublisher, plansForSession, resourcesForSession, sceneAssetDirectory,
  scenesForSession, sessionFactsForGrowth, sessionLifecycle, sessionTargets,
} from './integration/adapters.ts';
import { createCommonRouter } from './modules/common/routes.ts';
import { UserService, type UserDataEraser } from './modules/common/users.ts';
import { AuthService } from './modules/auth/accounts.ts';
import { createAuthRouter } from './modules/auth/routes.ts';
import { ContentCatalog } from './modules/content/catalog.ts';
import { createContentRouter } from './modules/content/routes.ts';
import type { SessionFactsPort } from './modules/growth/contracts.ts';
import { createGrowthRouter, growthErrorTranslator } from './modules/growth/routes.ts';
import { GrowthService } from './modules/growth/service.ts';
import { createPlanningRouter } from './modules/planning/routes.ts';
import { PlanningRepository } from './modules/planning/repository.ts';
import { PlanningService, type ContentCatalogService, type LlmProvider, type PreferenceQueryService } from './modules/planning/service.ts';
import { PlanningError } from './modules/planning/types.ts';
import { SceneRepository } from './modules/scene/repository.ts';
import { createSceneRouter } from './modules/scene/routes.ts';
import { SceneService } from './modules/scene/service.ts';
import { SceneError } from './modules/scene/types.ts';
import { SleepSessionRepository } from './modules/session/repository.ts';
import { createSessionRouter, sessionErrorTranslator } from './modules/session/routes.ts';
import { SleepSessionService } from './modules/session/service.ts';
import type { Clock } from './modules/session/types.ts';
import { createDramaModule, type DramaModuleOptions } from './modules/drama/module.ts';
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
  // 可选注入：自定义 LLM provider（如测试用 mock）。省略时按 DASHSCOPE_API_KEY 自动选 LLM/规则引擎。
  // 显式传 null 强制走规则引擎；显式传 mock 函数即用 mock。
  llmProvider?: LlmProvider | null;
  // 短片测试默认 fake，并且不读取 DRAMA_PROVIDERS，避免测试打到真实模型。
  drama?: Omit<DramaModuleOptions, 'database'>;
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
  const isLocalOrigin = Boolean(origin && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin));
  if (origin && (isLocalOrigin || allowedOrigins.has(origin))) response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Vary', 'Origin');
  // 认证头仅供本机跨端口预览（4173 → 8787）使用，不向公开静态站点开放。
  const localAuthHeaders = isLocalOrigin ? ', Authorization, X-Auth-Token' : '';
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-Age-Mode, X-Mianyu-User-Id, X-Mianyu-Age-Mode, Idempotency-Key' + localAuthHeaders);
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
  const planning = new PlanningService(
    new PlanningRepository(database),
    options.catalog ?? catalog,
    options.preferences ?? planPreferences(growth, users),
    // AppOptions.llmProvider 三态：undefined→自动；null→强制规则；函数→用注入的 provider
    options.llmProvider,
  );
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
  const drama = createDramaModule({ database, isolate: true, ...options.drama }, users);
  erasers.push(
    { module: 'content', erase: (userId) => catalog.eraseUserData(userId) },
    { module: 'planning', erase: (userId) => planning.eraseUserData(userId) },
    { module: 'scene', erase: (userId) => scenes.eraseUserData(userId) },
    { module: 'session', erase: (userId) => sessions.eraseUserData(userId) },
    { module: 'growth', erase: (userId) => growth.eraseUserData(userId) },
    { module: 'drama', erase: (userId) => drama.service.eraseUser(userId) },
  );

  const app = express();
  app.disable('x-powered-by');
  app.use(cors);
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/v1/health', (_request, response) => {
    response.json({ data: { service: 'mianyu-backend', database: 'ok', contractVersion: 'v1', migrations: (database.prepare('SELECT version FROM schema_migration ORDER BY version').all() as Array<{ version: number }>).map((row) => row.version) } });
  });
  // Serve audio/image assets as static files so the frontend can play them by URL.
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  app.use('/assets', express.static(path.join(projectRoot, 'assets'), { maxAge: '1h', fallthrough: false }));
  // Serve the frontend single-page app from the public/ directory (built or copied).
  // Falls back to index.html so client-side routes like /system_preview.html still work.
  const publicDir = path.join(projectRoot, 'public');
  if (existsSync(publicDir)) {
    app.use(express.static(publicDir, { maxAge: 0, setHeaders: (res) => { res.setHeader('Cache-Control', 'no-store, must-revalidate'); res.setHeader('Pragma', 'no-cache'); res.setHeader('Expires', '0'); }, extensions: ['html'] }));
    app.get(/^(?!\/api\/|\/assets\/).*/, (_request, response, next) => {
      const indexPath = path.join(publicDir, 'index.html');
      if (existsSync(indexPath)) {
        response.sendFile(indexPath);
      } else {
        next();
      }
    });
  }
  app.use('/api/v1', createCommonRouter(users));
  app.use('/api/v1', createAuthRouter(new AuthService(database, users)));
  app.use('/api/v1', createContentRouter(catalog));
  app.use('/api/v1', createPlanningRouter(planning, { trackName: (contentId) => catalog.find(contentId)?.name }));
  app.use('/api/v1', createSceneRouter(scenes, { assets: sceneAssetDirectory(catalog) }));
  app.use('/api/v1', createSessionRouter(sessions, sessionTargets(planning, scenes), sessionLifecycle(planning)));
  app.use('/api/v1', createGrowthRouter(growth, users));
  app.use('/api/v1', drama.router);
  app.use(notFoundHandler);
  app.use(createErrorHandler(translators));

  return { app, database, migrations, service: planning, services: { users, catalog, planning, scenes, sessions, growth, drama } };
}
