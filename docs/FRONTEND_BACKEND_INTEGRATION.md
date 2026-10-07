# 五模块前端接口接入说明

## 1. 当前交付状态

- 模块 1～4：页面已通过统一 Port 调用，默认使用 Mock Adapter；统一后端 `backend/` 已实现对应 HTTP 接口，并通过后端主路径集成测试。
- 模块 5：本机预览时默认使用 HTTP Adapter，由同一个统一后端提供。
- 浏览器声音播放：继续由 `BrowserAudioEngineAdapter` 执行，不上传播放推断。
- 界面视觉、CSS、图片、导航与现有文案未重做。

唯一 HTTP 契约是 `contracts/openapi.yaml`，浏览器类型是 `frontend-api/index.d.ts`。

## 2. 本地启动

要求 Node.js 24.11 或更高版本。

```powershell
cd backend
npm ci
npm start
```

另开终端，在仓库根目录启动静态预览：

```powershell
node preview_server.js
```

统一后端默认监听 `http://127.0.0.1:8787/api/v1`，数据保存到 `backend/data/mianyu.sqlite`，启动时自动执行迁移。

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

切换前需要注意：

- 身份：Mock 公共适配器把身份存在 `mianyu_user_id`，成长 HTTP 适配器另行注册并存在 `mianyu_growth_user_id`。模块 1～4 切到 HTTP 后，应让公共适配器通过 `POST /users/anonymous` 注册并与成长模块共用同一个 ID，否则开始方案的 +10 积分会记不到成长账户。
- 会话：`SessionHttpAdapter.start` 先 `POST /sessions`（准备，返回 `preparing`），再 `POST /sessions/:id/start`（确认音频开始，进入 `running`）。接入真实音频回调后，应把第二步移到播放开始回调里。
- 场景：`PUT /scenes/current` 接受页面现有的 `sceneDto()`，展示编号（`A03`）由后端换成素材 UUID；会话开始时后端会自动交接当前草稿。
- 页面当前传入的 `plan_id: 'plan-demo'`、`scene_id: 'scene-demo'` 不是 UUID，后端会退回到该用户的当前方案和当前场景。

## 4. 统一请求约束

- 所有响应：`{ "data": ... }`。
- 所有错误：`{ "error": { "code": "...", "message": "...", "requestId": "...", "details": [...] } }`。
- 除匿名注册与健康检查外，都发送 `X-User-Id`（后端仍兼容旧的 `X-Mianyu-User-Id`）。
- 情绪只允许 `excited / anxious / wants_company / calm / unspecified`；可用时长 1～180 分钟，后端就近取整到 10/15/20/30/45/60。
- 所有写请求发送 `Idempotency-Key`。
- 时间统一为 UTC ISO 8601。
- 人声偏好只允许 `want / avoid / unspecified`；界面的“都可以”映射为 `unspecified`。
- 模块不得根据播放时长、暂停或退出推断入睡、睡眠质量或偏好。

## 5. 模块五与模块四的交接

模块五只依赖 `SessionFactsPort`。统一后端里由模块四的真实会话记录实现（`backend/src/integration/adapters.ts`）：

- `latestCompleted(userId)`：该用户最近一条已开始播放、并以计时完成或用户主动结束收尾的会话。
- `isCompletedForUser(sessionId, userId)`：验证会话归属及上述完成状态。

`DevelopmentSessionFactsAdapter` 只保留在模块五自己的测试里。模块五业务服务不读取模块四数据库表。

## 6. 验证命令

```powershell
npm test                      # 前端契约测试 + 后端 tsc 与全部测试
powershell -ExecutionPolicy Bypass -File verify_frontend.ps1
```

测试覆盖 Adapter 方法一致性、OpenAPI 路径与后端实现一致、跨模块主路径（匿名用户→方案→场景→会话→反馈→积分→档案→删除）、重复反馈、积分幂等、反馈事务、用户隔离和输入校验。
