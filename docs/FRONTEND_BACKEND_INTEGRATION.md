# 五模块前端接口接入说明

## 1. 当前交付状态

- 模块 1～4：页面已通过统一 Port 调用，默认使用 Mock Adapter。
- 模块 5：页面默认使用 HTTP Adapter，真实后端位于 `backend/module5`。
- 浏览器声音播放：继续由 `BrowserAudioEngineAdapter` 执行，不上传播放推断。
- 界面视觉、CSS、图片、导航与现有文案未重做。

唯一 HTTP 契约是 `contracts/openapi.yaml`，浏览器类型是 `frontend-api/index.d.ts`。

## 2. 本地启动

要求 Node.js 24.11 或更高版本。

```powershell
cd backend/module5
npm install
npm run dev
```

另开终端启动静态预览：

```powershell
cd ../..
node preview_server.js
```

模块五 API 默认监听 `http://127.0.0.1:8787/api/v1`，数据保存到 `backend/module5/data/module5.sqlite`。

## 3. 各成员如何接入真实后端

现有默认配置在 `system_preview.html`：

```js
window.__MIANYU_TRANSPORTS__ = {
  content: 'mock',
  planning: 'mock',
  scene: 'mock',
  session: 'mock',
  growth: 'http',
  common: 'mock'
};
```

成员完成后端并通过契约测试后，只修改自己负责模块的值：

- 成员 1：`content: 'http'`
- 成员 2：`planning: 'http'`
- 成员 3：`scene: 'http'`
- 成员 4：`session: 'http'`
- 成员 5：保持 `growth: 'http'`

不要在页面中直接写 `fetch`，也不要改变 Port 方法返回结构。HTTP 路径、枚举、错误包络以 OpenAPI 为准。

## 4. 统一请求约束

- 所有响应：`{ "data": ... }`。
- 所有错误：`{ "error": { "code": "...", "message": "...", "details": ... } }`。
- 除匿名注册与健康检查外，都发送 `X-User-Id`。
- 所有写请求发送 `Idempotency-Key`。
- 时间统一为 UTC ISO 8601。
- 人声偏好只允许 `want / avoid / unspecified`；界面的“都可以”映射为 `unspecified`。
- 模块不得根据播放时长、暂停或退出推断入睡、睡眠质量或偏好。

## 5. 模块五与模块四的交接

模块五只依赖 `SessionFactsPort`，当前由 `DevelopmentSessionFactsAdapter` 提供开发会话。成员 4 完成后，实现同一接口：

- `latestCompleted(userId)`：返回该用户最近一条已完成会话事实。
- `isCompletedForUser(sessionId, userId)`：验证会话归属及完成状态。

替换构造注入即可，禁止在模块五业务服务里读取模块四数据库表。

## 6. 验证命令

```powershell
npm run test:contracts
npm --prefix backend/module5 run typecheck
npm --prefix backend/module5 test
powershell -ExecutionPolicy Bypass -File verify_frontend.ps1
```

测试覆盖 Adapter 方法一致性、OpenAPI 路径、重复反馈、积分幂等、反馈事务、用户隔离、会话来源隔离和输入校验。
