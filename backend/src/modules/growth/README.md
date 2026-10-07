# 模块五：反馈、偏好、积分与档案

## 运行

本模块已并入统一后端，不再单独启动。在 `backend` 目录执行：

```powershell
npm ci
npm start
npm test
```

统一后端默认监听 `http://127.0.0.1:8787/api/v1`，数据库默认 `backend/data/mianyu.sqlite`，可用 `PORT`、`MIANYU_DB_PATH` 覆盖。

## 模块边界

本模块拥有 `morning_feedback`、`preference_profile`、四张偏好关系表和 `points_ledger`，建表语句在 `migrations/500_module5_growth.sql`。`user_profile` 已移到公共层（`migrations/010_common_user.sql`、`src/modules/common/`），本模块只通过 `UserDirectory.hasUser` 校验身份，不对用户表建物理外键。

会话完成事实通过 `SessionFactsPort` 获取，不跨模块读表。统一应用里由模块四的真实会话记录实现：计时完成（`timer_completed`）或用户主动结束（`user_ended`）且已经开始播放的会话，才可以提交次日反馈。

提交反馈时会在单个 SQLite 事务中写入反馈、更新偏好并追加 `feedback_submitted +5`。`plan_started +10` 由模块四开始播放时发布的 `PlanStarted` 事实触发 `recordPlanStarted` 写入，不开放给前端伪造。

`testing/session-facts.ts` 里的 `DevelopmentSessionFactsAdapter` 只用于本模块测试，不得装配进生产应用。
