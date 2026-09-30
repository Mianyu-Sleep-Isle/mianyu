# 眠屿成员2后端独立 Demo

本目录实现 `backend-team/03-成员2-沟通与方案后端.md` 规定的 planning 模块，使用 Node.js 24、TypeScript、Express、Zod 和 SQLite。

## 运行

```text
npm install
npm run check
npm start
```

默认地址为 `http://127.0.0.1:4173/api/v1`，可通过 `PORT` 和 `MIANYU_DB_PATH` 环境变量覆盖。

## 接口

- `POST /api/v1/plans/compose`
- `GET /api/v1/plans/:planId`
- `POST /api/v1/plans/:planId/confirm`
- `POST /api/v1/plans/:planId/regenerate`

为了直接兼容现有前端 `frontend-api/http-adapters.js`，同时提供：

- `POST /api/v1/plans`
- `GET /api/v1/plans/current`
- `POST /api/v1/plans/regenerate`

兼容层接受前端现有的 `emotion`、`voice_preference`、`available_minutes`、`forbidden_tags`、`preset_sentence` 字段，并返回其所需的 `id`、`type`、`duration_minutes`、`fade_out_minutes` 和轨道别名。新版驼峰字段仍然保留。

本地匿名身份通过 `X-Mianyu-User-Id` 传入，年龄模式通过 `X-Mianyu-Age-Mode` 传入。写请求接受 `Idempotency-Key`；独立 Demo 目前在进程内保存幂等结果，接入团队公共骨架时应替换为统一的持久化幂等组件。
现有前端的 `X-User-Id` 也可直接使用。

## 前端切换到真实后端

前端默认使用 mock。在加载 `frontend-api/mianyu-ports.js` 之前设置：

```html
<script>
window.__MIANYU_TRANSPORTS__ = { planning: 'http' };
window.__MIANYU_API_BASE_URL__ = 'http://127.0.0.1:4173/api/v1';
</script>
```

如果后端使用其他端口，只需同步修改第二行。后端已允许本地预览页和 `https://liuzilin94.github.io` 的跨域请求。

`ContentCatalogService` 和 `PreferenceQueryService` 当前使用演示适配器。正式集成时由团队真实模块实现替换，planning 模块不直接访问其他模块 Repository。
