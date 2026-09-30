# 成员四：会话后端

## 实现范围

`service.ts` 管理准备、音频确实开始后的运行、阶段切换、暂停恢复、跳过、音量渐弱、结束、历史读取与用户数据清理。`repository.ts` 只访问模块四的三张表；`backend/migrations/400_module4_sleep.sql` 建表并约束状态与只追加事件。所有记录均为播放事实，不推断是否入睡。

旧包《40-模块4-睡眠模式与夜间记录》是字段、状态、事件的依据：§2 `sleep_session`，§3 `playback_stage`，§4 `playback_event`，§9 枚举，§10 事务。旧分工设计 §10.4 要求成员四自备 Fake，§6.2 要求进入 `running` 后发布 `PlanStartedFact`，成员五幂等处理。旧分工设计 §10.5 还列有 UI 和播放适配；本次用户确认的修订计划将网页播放和前端接线交给组长，成员四交付会话后端。

## 本地运行

需要 Node.js 24（使用内置 `node:sqlite`）。在仓库根目录的 PowerShell 中运行：

```powershell
$tests=Get-ChildItem 'backend/src/modules/session/__tests__/*.test.ts' | ForEach-Object FullName
node --test $tests
```

测试直接运行 TypeScript 文件；`node:sqlite` 当前会提示实验性警告。无需安装依赖。

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

组长需提供可访问的应用代码基线、共享 Fixture 和测试命令，并核定网页 HTTP 接口如何表达 `preparing → running`。HTTP 草案未经核定，本模块只暴露服务类，不自行修改公共契约。真正音频播放的回调才调用 `SleepSessionService.start`，不能在用户点击按钮时调用。

联调时把 `PlanQueryPort` 接成员二的已确认方案查询、`SceneConfigQueryPort` 接成员三的已交接场景查询、`PlayableResourceResolverPort` 接成员一的资源解析。当前 `testing/fakes.ts` 和 `testing/harness.ts` 用固定本地样例支撑独立测试，组长的共享 Fixture 到位后需替换样例并重跑测试。

向成员五提供 `PlanStartedFact`：以 `sessionId` 作为稳定 `eventId`，在进入 `running` 后发布。发布接口可能被重试；成员五应按 `eventId` 幂等处理，才能保持一次计分。组长的进程内事件总线接入后应验证这条链路。若进程在会话事务提交后、事件发布前退出，需要组长在公共事件总线方案中补交付恢复机制。
