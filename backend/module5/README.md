# 模块五：反馈、偏好、积分与档案

## 运行

```powershell
npm install
npm run dev
```

环境变量：

- `PORT`：默认 `8787`。
- `MIANYU_DB_PATH`：默认 `data/module5.sqlite`。

## 模块边界

本模块拥有 `user_profile`、`morning_feedback`、`preference_profile`、四张偏好关系表和 `points_ledger`。会话完成事实通过 `SessionFactsPort` 获取，不跨模块读表。

提交反馈时会在单个 SQLite 事务中写入反馈、更新偏好并追加 `feedback_submitted +5`。`plan_started +10` 由内部 `recordPlanStarted` 服务接收真实开始事实后写入，不开放给前端伪造。

开发阶段的 `DevelopmentSessionFactsAdapter` 只用于模块四尚未实现时联调，生产整合时必须替换。
