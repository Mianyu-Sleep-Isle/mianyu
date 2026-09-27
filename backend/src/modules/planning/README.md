# Planning 模块接入说明

本目录是成员2正式 TypeScript planning 模块的实现位置。

当前仓库尚未提供团队共享服务器骨架，因此 `backend/src/app.ts` 和 `backend/src/server.ts` 仅作为模块2独立 Demo 的最小入口。团队公共骨架落地后，应保留本目录业务文件，将路由、数据库连接、身份、错误处理和持久化幂等接入公共实现。

- `routes.ts`
- `schema.ts`
- `service.ts`
- `repository.ts`
- `intent-parser.ts`
- `rule-engine.ts`
- `explanation.ts`
- `planning.test.ts`

正式实现以仓库根部的后端团队文档和 HTTP API v1 契约为准。
