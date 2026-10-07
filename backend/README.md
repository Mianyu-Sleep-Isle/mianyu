# 眠屿统一后端

五个业务模块和公共层合并在同一个 Node.js 工程里，共用一个 SQLite 数据库、一套迁移、一套身份与错误约定。技术栈：Node.js 24（`node:sqlite`、`--experimental-transform-types`）、TypeScript、Express 5、Zod 4。

## 运行

```text
npm ci
npm run check   # tsc + 全部测试
npm start       # http://127.0.0.1:8787/api/v1
```

- `PORT`：默认 `8787`（`preview_server.js` 占用 4173）。
- `MIANYU_DB_PATH`：默认 `backend/data/mianyu.sqlite`，启动时自动执行未执行过的迁移。

## 目录

| 路径 | 负责人 | 内容 |
| --- | --- | --- |
| `src/app.ts` | 组长 | 组合根：装配迁移、各模块服务、跨模块适配器、路由、CORS 和统一错误处理 |
| `src/shared/` | 组长 | 数据库打开与迁移执行器、身份头读取、统一错误包络 |
| `src/integration/` | 组长 | 跨模块端口适配器与主路径集成测试 |
| `src/modules/common/` | 组长 | 匿名用户、PIN、全模块数据删除（`010_common_user.sql`） |
| `src/modules/content/` | 成员1（占位） | 内容目录清单、收藏（`100_module1_content.sql`） |
| `src/modules/planning/` | 成员2 | 睡前沟通与方案（`200_module2.sql`） |
| `src/modules/scene/` | 成员3 | 场景草稿、交接、复制（`300_module3.sql`） |
| `src/modules/session/` | 成员4 | 睡眠会话、阶段、播放事件（`400_module4_sleep.sql`） |
| `src/modules/growth/` | 成员5 | 次日反馈、偏好、积分、档案（`500_module5_growth.sql`） |

迁移文件名前三位是模块号段，执行器按数字顺序执行并记录在 `schema_migration` 表，重复启动不会重复执行。跨模块只允许逻辑引用：不建跨模块物理外键，不跨模块 JOIN，一律通过端口调用。

## 契约约定

- 唯一 HTTP 契约是仓库根目录的 `contracts/openapi.yaml`。
- 身份头 `X-User-Id`；旧演示使用的 `X-Mianyu-User-Id` 仍被接受。年龄模式 `X-Age-Mode`（兼容 `X-Mianyu-Age-Mode`）。
- 成功响应 `{ "data": ... }`；失败响应 `{ "error": { "code", "message", "requestId", "details" } }`。
- 写请求携带 `Idempotency-Key`。幂等结果目前保存在进程内存中，重启后失效；反馈与积分另有数据库唯一约束兜底。
- 响应同时保留各模块的 camelCase 规范字段和 `frontend-api` 使用的 snake_case 别名（`id`、`plan_id`、`asset_id` 等）。

## 跨模块链路

| 端口 | 提供方 → 使用方 | 实现 |
| --- | --- | --- |
| `ContentCatalogService.listCandidates` | 内容 → 方案 | `ContentCatalog` |
| `PreferenceQueryService` | 成长 → 方案 | 反馈里的禁用声音标签（`planPreferences`） |
| `PlanQueryService.getConfirmedPlan` | 方案 → 场景 | `confirmedPlansForScene` |
| `ContentCatalogService.validateAssets/resolveContentIds` | 内容 → 场景 | `ContentCatalog` |
| `PlanQueryPort` / `SceneConfigQueryPort` / `PlayableResourceResolverPort` | 方案、场景、内容 → 会话 | `plansForSession` 等 |
| `DomainEventPublisherPort.publishPlanStarted` | 会话 → 方案、成长 | 方案标记 `started`，成长记 `plan_started +10` |
| `SessionFactsPort` | 会话 → 成长 | 计时完成或用户主动结束、且已开始播放的会话可提交反馈 |

会话生命周期：`POST /sessions` 冻结场景并准备会话（`preparing`）；只有在音频确实开始播放后，客户端才调用 `POST /sessions/:id/start` 进入 `running` 并发布开始事实；`stop` 在准备阶段记为 `user_cancelled_before_start`，播放后记为 `user_ended`。

## 已知限制

- 模块1尚未交付，`src/modules/content/manifest.ts` 是与前端原型编号一致的占位清单，素材 UUID 固定不可复用。成员1的自然声交付包（`docs/素材台账/成员1-自然声/`）使用按文件哈希生成的另一套 UUID，接入内容服务时需统一。
- 自然声 A01、A02、A05、A06、A09 为 `pending_review`，不可播放、不进方案；A12 `exclusionTestOnly`，任何路径都不可选用或播放。详见 `assets/audio/README.md`。
- 幂等缓存在进程内存中；多实例部署前需要换成持久化幂等表。
- `PlanStarted` 在会话事务提交后同步发布，进程若在两者之间退出，积分可能漏记，需后续补发件箱。
