# 成员四：会话后端

## 实现范围

`service.ts` 管理准备、音频确实开始后的运行、阶段切换、暂停恢复、跳过、音量渐弱、结束、历史读取与用户数据清理。`repository.ts` 只访问模块四的三张表；`backend/migrations/400_module4_sleep.sql` 建表并约束状态与只追加事件。所有记录均为播放事实，不推断是否入睡。

旧包《40-模块4-睡眠模式与夜间记录》是字段、状态、事件的依据：§2 `sleep_session`，§3 `playback_stage`，§4 `playback_event`，§9 枚举，§10 事务。旧分工设计 §10.4 要求成员四自备 Fake，§6.2 要求进入 `running` 后发布 `PlanStartedFact`，成员五幂等处理。旧分工设计 §10.5 还列有 UI 和播放适配；本次用户确认的修订计划将网页播放和前端接线交给组长，成员四交付会话后端。

## 本地运行

需要 Node.js 24（使用内置 `node:sqlite`）。在 `backend` 目录运行 `npm test`，会连同其他模块一起执行本模块测试；`node:sqlite` 当前会提示实验性警告。

## 功能和测试文件

| 功能 | 测试文件 |
| --- | --- |
| 方案、场景、资源校验与准备 | `session-prepare.test.ts` |
| 音频开始确认和开始事实 | `session-start.test.ts` |
| 阶段顺序、跳过、故事结束 | `session-stage-transition.test.ts` |
| 暂停恢复、有效时长与中断 | `session-pause-resume.test.ts` |
| 音量与单调渐弱 | `session-volume-fade.test.ts` |
| 事件只追加和请求幂等 | `session-events-idempotency.test.ts` |
| 7/30 天历史和用户隔离 | `session-history-query.test.ts` |
| 用户数据清理 | `session-data-erasure.test.ts` |
| 建表约束与外键 | `session-migration.test.ts` |

## 联调交接

统一后端已装配本模块，`routes.ts` 按 `contracts/openapi.yaml` 暴露 HTTP 接口：

| 接口 | 服务方法 |
| --- | --- |
| `POST /sessions` | 由组合根解析方案与场景（草稿会先交接冻结），再 `prepare`，返回 `preparing` |
| `POST /sessions/:id/start` | 音频确实开始后调用 `start`，进入 `running` 并发布开始事实 |
| `POST /sessions/:id/pause`、`/resume` | `pause`、`resume` |
| `POST /sessions/:id/stop` | 准备阶段 `user_cancelled_before_start`，播放后 `user_ended` |
| `POST /sessions/:id/events` | `track_*`、`resource_missing`、`playback_error` 追加观测；`stage_completed`、`stage_skipped`、`volume_changed` 驱动阶段与音量 |
| `GET /sessions/history`、`GET /sessions/:id` | `listHistory`、`getSessionFacts` |

端口实现见 `src/integration/adapters.ts`：`PlanQueryPort` 接方案模块（已开始或已完成的方案不能再开新会话），`SceneConfigQueryPort` 接场景模块（声源 `trackId` 即素材 UUID），`PlayableResourceResolverPort` 接内容目录。`testing/fakes.ts` 和 `testing/harness.ts` 仍只服务于本模块的单元测试。

`PlanStartedFact` 以 `sessionId` 作为稳定 `eventId`，进入 `running` 后发布给方案模块（标记 `started`）和成长模块（`plan_started +10`，按来源幂等）。若进程在会话事务提交后、事件发布前退出，积分可能漏记，后续需要发件箱补发机制。
