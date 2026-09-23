# 睡前沟通与方案决策

模块2负责把用户当晚的睡前状态转换为可解释、可修改、可确认的结构化 `SleepPlan`。MVP 使用规则引擎，不直接调用播放器，也不保存完整对话原文、模型提示词或模型原始回复。

## 规则优先级

冲突时依次执行：儿童限制 > 禁忌 > 不要人声 > 短时间 > 想被陪伴。LLM 仅作为答辩可选适配器；输出必须经过同一套结构校验和白名单校验，失败时回退规则方案。

## 输出

`SleepPlan` 包含 `plan_type`、`reason`、`tracks`、`story_id`、`breath_id`、`duration_min`、`fade_out_min` 和 `source`。音轨字段为 `asset_id`、`volume`、`pan`、`distance`、`indoor_or_outdoor`。

## 文件清单

- `sql/001_module2_plan.sql`：SQLite 四表建表脚本。
- `fake/fake_plan_composer.dart`：按四条预制场景生成固定方案的 Fake。
- `fake/fake_plan_query.dart`：按 `plan_id` 从内存 Map 查询方案的 Fake。
- `fake/fixtures.json`：三个可用于测试的方案样例。
- `素材台账.md`：模块2需要交接的素材台账。

当前仓库尚未提供共享 Dart 契约，因此 Fake 文件内含最小契约，接入正式工程时应替换为共享契约。

预制场景“赶作业，想听雨，不要打雷”使用 `A01`、`A02` 两个雨声 `asset_id`。这两个资源由成员1提供并维护，模块2只通过稳定编号引用，不复制素材主数据。

成员2的一级素材职责为6个室内环境声编号：`A03`、`A04`、`A07`、`A08`、`A10`、`A11`。其中 `A10` 保留轻键盘与轻写字两个文件变体，所以实际交付7个音频文件。故事与呼吸素材不属于成员2本轮一级素材任务。
