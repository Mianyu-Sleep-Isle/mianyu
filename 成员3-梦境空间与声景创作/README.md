# 模块3 今日交付（M0 / 2026-09-17）

负责人：成员3 梦境空间与声景创作  
范围：三张表 SQL、`FakeSceneConfigQuery`、V01/V02 台账  
不含：成图文件、完整 Repository、拖放/冻结业务实现

| 文件 | 说明 |
|---|---|
| [sql/001_module3_scene.sql](sql/001_module3_scene.sql) | `scene_config`、`scene_audio_source`、`scene_element` |
| [fake/scene_config_query_port.dart](fake/scene_config_query_port.dart) | 只读 Port 接口（供组长契约对照） |
| [fake/fake_scene_config_query.dart](fake/fake_scene_config_query.dart) | Fake 实现 + 两套固定场景 |
| [fake/fixtures.json](fake/fixtures.json) | 同一套数据的 JSON，前端可先读这个 |
| [assets/V01-V02台账.md](assets/V01-V02台账.md) | 两张场景图收集台账 |

跨模块 `user_id`、`source_plan_id`、`asset_id` 只存 UUID，SQL 里不建物理外键。
