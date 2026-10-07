# 眠屿 LLM 集成说明

> 本文档说明"眠屿"App 的 AI（LLM）方案合成能力的接入方式、运行配置、降级策略与未来扩展点。

## 1. 概览

| 项 | 说明 |
| --- | --- |
| **目标** | 让用户用自然语言描述今晚的需求（如"想听点雨，但不要打雷，最好有人陪"）就能生成个性化方案。 |
| **当前状态** | 已接入阿里云百炼（DashScope）OpenAI 兼容模式，默认模型 `qwen-plus`。 |
| **降级策略** | LLM 调用失败时自动降级到原有的规则引擎（`rule-engine.ts`），前端无感知。 |
| **可观测性** | 服务端控制台会打印 `[planning] LLM unavailable, falling back to rule engine: <reason>`。 |
| **依赖** | 后端无新增 npm 依赖，直接用 Node 22+ 内置 `fetch`。 |

## 2. 快速配置

### 2.1 在 `backend/.env` 中填入 key

```env
PORT=8787
MIANYU_DB_PATH=data/mianyu.sqlite

# 从 https://dashscope.console.aliyun.com/apiKey 获取
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
LLM_TIMEOUT_MS=8000
```

> `backend/.env` 已被 `.gitignore` 忽略；`.env.example` 是模板，已提交到仓库。

### 2.2 启动

```bash
cd backend
npm start          # 使用 .env 中的 key
# 或
npm run dev        # 监听代码变更自动重启
```

启动后控制台会打印：
- `Mianyu API: http://127.0.0.1:8787/api/v1`
- 如 key 存在且 plan 合成被触发，会在请求路径里间接看到 LLM 调用；失败会打印 `LLM unavailable, falling back to rule engine: <reason>`。

## 3. 模型选择

| 模型 | 适用场景 | 单次合成成本（粗估） |
| --- | --- | --- |
| `qwen-turbo` | 调试、压测 | 极低 |
| `qwen-plus`（默认） | 课程项目 / 真实用户 | 约 ¥0.004 / 1k tokens |
| `qwen-max` | 长尾表达、希望更准 | 较高 |

切换：在 `.env` 改 `DASHSCOPE_MODEL` 即可，无需重启。

## 4. 端到端流程

```
用户自然语言 ─► POST /api/v1/plans ─► PlanningService.compose
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                    toStructuredIntent                 composeWithFallback
                    (intent-parser.ts)                       │
                              │                       ┌───────┴───────┐
                              ▼                       ▼               ▼
                       StructuredIntent            LLM 路径     规则引擎
                                              (composeLlmPlan)  (composeRulePlan)
                                                     │
                                                     └─► 失败：抛 LlmUnavailableError
                                                                │
                                                                ▼
                                                        自动降级到规则引擎
                                                                │
                                                                ▼
                                                       保存 SleepPlan → 返回前端
```

## 5. 数据契约

### 5.1 LLM 输入（自动构造）
- `system prompt` 中包含全部规则（ageMode / voicePreference / avoidTags / 用户显式选择）
- `user message` 包含 JSON intent + 可用素材清单（contentId / kind / tags / hasVoice / duration / ageMode）

### 5.2 LLM 输出（必须严格 JSON）

```json
{
  "reason": "今晚小雨陪着你，慢慢呼吸然后进入梦。",
  "tracks": [
    { "contentId": "A01", "volume": 0.4 },
    { "contentId": "BR01", "volume": 0.5 }
  ]
}
```

### 5.3 后端二次校验（`compose-llm.ts` 的 `assemblePlan`）

| 校验项 | 不通过时行为 |
| --- | --- |
| 选了 `avoidTags` 中包含的标签 | 抛 `LlmUnavailableError` |
| `voicePreference=avoid` 时选了 voice/story | 抛 `LlmUnavailableError` |
| `ageMode=child` 时选了成人故事 | 抛 `LlmUnavailableError` |
| 忽略了用户显式选中的素材 | 抛 `LlmUnavailableError` |
| `tracks` 为空 | 抛 `LlmUnavailableError` |
| `volume` 越界 [0,1] | 抛 `LlmUnavailableError` |
| 选了不存在的 `contentId` | 抛 `LlmUnavailableError` |

**任何校验失败都会自动降级到规则引擎**——保证用户始终能拿到一个方案。

## 6. 安全与合规

| 项 | 说明 |
| --- | --- |
| API Key 存储 | 仅在 `backend/.env`（已 gitignore）；不写进任何源文件或 git 历史 |
| 请求体 | 不落库；`freeText` 是用户表达，不存 SQLite |
| 风险词检测 | `intent-parser.ts` 已识别"自杀"、"伤害自己"等表达并返回 `PRODUCT_BOUNDARY_CRISIS` 错误 |
| 数据清理 | `DELETE /users/me/data` 仍会清空该用户所有方案/会话/反馈；LLM 路径无副作用 |
| 速率限制 | DashScope 限流由其网关处理；后端超时默认 8s |

## 7. 端到端验证

```bash
# 1. 启动后端
cd backend && npm start

# 2. 创建匿名用户
curl -s -X POST http://127.0.0.1:8787/api/v1/users/anonymous \
  -H "Content-Type: application/json" -d '{}' | jq .data.user_id

# 3. 用自然语言合成方案
curl -s -X POST http://127.0.0.1:8787/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "X-User-Id: <上面返回的 id>" \
  -d '{
    "emotion": "anxious",
    "voice_preference": "unspecified",
    "available_minutes": 25,
    "forbidden_tags": ["远雷"],
    "preset_sentence": "今晚有点烦躁，想听点雨，最好有一点陪伴感"
  }' | jq .
```

响应中 `source: "llm"`、`sourceLabel: "模型建议"` 表示走了 LLM；`source: "rule"` 表示降级。

## 8. 测试覆盖

| 测试文件 | 用例 | 行为 |
| --- | --- | --- |
| `llm/llm.test.ts` | 11 例 | 单元测试：config 加载、prompt 解析、组装校验、fallback 错误处理 |
| `integration.test.ts` | 新增 2 例 | 端到端：LLM 路径返回 `source=llm`；降级路径返回 `source=rule` |

集成测试默认禁用 LLM（`createApp({ llmProvider: null })`），保证 CI 不打真实 DashScope。

## 9. 未来可扩展点

| 方向 | 改动点 |
| --- | --- |
| **多 LLM 路由** | 在 `llmProvider` 接口下挂多个 provider（千问、DeepSeek、GLM），按可用性自动选 |
| **TTS** | 在 `compose-llm.ts` 基础上加 `compose-llm-tts.ts`，把动态生成的故事直接合成语音 |
| **素材自动生成** | 让 LLM 生成新内容（故事/呼吸词），再走 `content/catalog.ts` 的 `pending_review` 流程 |
| **个性化记忆** | 把 `preferences.current` 的 avoidTags + 历史方案 reason 喂给 LLM，让方案理由越来越贴合用户 |
| **可观测性** | 引入 OpenTelemetry，把 LLM 调用耗时、错误率导出到监控 |

## 10. 排错

| 现象 | 排查 |
| --- | --- |
| 启动后 `source` 永远是 `rule` | 检查 `backend/.env` 中 `DASHSCOPE_API_KEY` 是否存在；服务启动后调一次 `/plans` 看控制台日志 |
| 报 `LLM call failed: 401` | API key 错误或 region 不匹配；百炼 key 与 `DASHSCOPE_BASE_URL` 必须同一 region |
| 报 `LLM response parse failed` | 通常是模型输出非 JSON；可在 `llm/prompt.ts` 加强 prompt，或降低 `temperature` |
| 报 `LLM request exceeded 8000ms` | 调大 `.env` 中 `LLM_TIMEOUT_MS`；或换 `qwen-turbo` |
| 集成测试一直走 LLM | `createApp({ llmProvider: null })` 显式禁用；本地启动 service.ts 时会读 .env，强制走 LLM |
