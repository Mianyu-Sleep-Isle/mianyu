# Planning 模块接入说明

本目录是成员2正式 TypeScript planning 模块的实现位置，已装配进统一后端 `backend/src/app.ts`：共用数据库连接、迁移执行器、`X-User-Id` 身份头和跨模块适配器；幂等结果仍保存在进程内。

- `routes.ts`
- `schema.ts`
- `service.ts`
- `repository.ts`
- `intent-parser.ts`
- `rule-engine.ts`
- `explanation.ts`
- `frontend-compat.ts`（现有前端 Adapter 的兼容转换层）
- `seed.ts`（仅供本模块单元测试和独立演示使用的候选内容，统一后端改用内容目录）
- `planning.test.ts`

统一后端里的依赖：

- `ContentCatalogService` 由内容目录 `src/modules/content/catalog.ts` 提供，内容编号与前端原型一致（`A01`～`A12`、`ST01`～`ST06`、`BR01`）。
- `PreferenceQueryService` 读取成长模块的禁用声音标签。
- `findPlan`、`markStarted`、`markCompleted` 供会话模块通过适配器调用。

`frontend-compat.ts` 接受 OpenAPI `SleepIntent.emotion` 的 `excited / anxious / wants_company / calm / unspecified`，并继续接受早期的 `annoyed / tired`。映射到内部情绪：`excited`、`anxious` → `annoyed`；`wants_company` → `calm`，且在人声偏好未指定时视为想要陪伴；`unspecified` → `calm`。`available_minutes` 接受 1～180，就近取整到 10/15/20/30/45/60 分钟。

正式实现以仓库根部的后端团队文档和 `contracts/openapi.yaml` 为准。
