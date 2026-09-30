# 全分支整合清单

完整的逐分支合并、改写、排除、归档和验证说明见 [全分支整合完整报告](./全分支整合完整报告.md)，可提交版 Word 为 [全分支整合完整报告.docx](./全分支整合完整报告.docx)。

- 整合日期：2026-09-30
- 整合分支：`integration/all-branches`
- 基线：`main` @ `568af1c`
- 原则：只保留有效且唯一的内容；重复文件按内容哈希去重；团队自产的原始调研归档到 GitHub Release [archive-2026-09-30](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/tag/archive-2026-09-30)，第三方论文与候选音频不二次分发、只保留在预整合标签，均不进入 `main`。

每个分支头都打了附注标签 `pre-integration/<名称>`。即使日后删除原分支，也可以用标签找回整合前的完整内容。

## 分支快照

体积和文件数是该分支相对 `main` 新增或修改的文件。

| 分支 | 头提交 | 领先 main | 文件数 | 体积 | 备份标签 |
|---|---|---|---|---|---|
| `main` | `568af1c` | 0 | 0 | 0 | `pre-integration/main` |
| `feature/fronted` | `ea57e1f` | 2 | 116 | 107.9 MB | `pre-integration/feature-fronted` |
| `feature/module5-backend-integration` | `efd6763` | 15 | 134 | 108.0 MB | `pre-integration/feature-module5-backend-integration` |
| `feature/mk-backend` | `fd99787` | 12 | 30 | 44.9 MB | `pre-integration/feature-mk-backend` |
| `myh-backend` | `de3c5ff` | 3 | 15 | 4.7 MB | `pre-integration/myh-backend` |
| `feature/m4-session` | `98c592a` | 1 | 21 | 0.1 MB | `pre-integration/feature-m4-session` |
| `feature/member2-design-diagrams` | `0b7184d` | 3 | 5 | 0.2 MB | `pre-integration/feature-member2-design-diagrams` |
| `成员四_UML类图时序图用例图` | `d0831d9` | 2 | 37 | 24.0 MB | `pre-integration/member4-uml-diagrams` |
| `feature/member3-m0-scene` | `43c6d02` | 2 | 14 | 36.0 MB | `pre-integration/feature-member3-m0-scene` |
| `feature/minin-minin` | `5a4e0c8` | 3 | 31 | 201.8 MB | `pre-integration/feature-minin-minin` |
| `feature/minin-minin`（整合期间更新） | `948d8ca` | 4 | 60 | 398.1 MB | `pre-integration/feature-minin-minin-v2` |
| `feature/requirement-research` | `c948cfc` | 3 | 36 | 22.1 MB | `pre-integration/feature-requirement-research` |
| `feature/需求分析` | `c152f96` | 2 | 4 | 1.2 MB | `pre-integration/feature-requirement-analysis` |

## 处置方式

| 分支 | 方式 | 说明 |
|---|---|---|
| `feature/module5-backend-integration` | Git 合并 | 前端基线：Flutter 页面、浏览器预览、`frontend-api/`、`contracts/openapi.yaml`、视觉素材。README 不采用其缩短版，内容并入 `main` 原 README。 |
| `feature/fronted` | 在模块5之后 Git 合并 | 与 `main` 无共同祖先，但除最后一个提交外都已进入模块5分支。最后一个提交只新增 `docs/团队开发/` 下 6 份后端开发文档，这些文档没有其他副本，因此保留。 |
| `feature/mk-backend` | Git 合并 | 统一后端骨架（`backend/`）、模块2方案决策、室内声素材。 |
| `myh-backend` | Git 合并 | 模块3场景编辑后端，装配进统一后端。 |
| `feature/m4-session` | Git 合并 | 模块4睡眠会话，放弃该分支根目录的 `package.json`、`package-lock.json`、`tsconfig.json`，依赖和测试并入 `backend/`。 |
| `feature/member2-design-diagrams` | Git 合并 | 成员2设计图，移入 `docs/diagrams/`。 |
| `成员四_UML类图时序图用例图` | 选择性检出 | 29 个图标、背景、App 图标与 `assets/images/**` 内容完全相同，丢弃；8 张 UML 图移入 `docs/diagrams/`。 |
| `feature/member3-m0-scene` | 选择性检出 + 归档 | 故事与呼吸音频进入 `assets/audio/{stories,breath}/`，说明移为 `docs/素材台账/成员3-故事呼吸.md`；fake 查询、旧场景 SQL 已被 `myh-backend` 的真实实现取代，归档到 Release。 |
| `feature/minin-minin` | 选择性检出 + 归档 | 内容中心设计图移入 `docs/diagrams/`；「成员一后端文件交付包」的说明、清单和 config 移入 `docs/素材台账/成员1-自然声/`；访谈文档归档到 Release。交付包写明 19 个自然声没有版权凭证、未听审、审核前不能播放，A12 远雷仅用于排除测试，因此音频只保留在标签，内容清单中对应编号为 `pending_review`、不可播放。 |
| `feature/requirement-research` | 归档 | 团队整理的报告与表格归档到 Release；第三方论文 PDF 只保留在标签；成员3需求分析图包解压到 `docs/diagrams/`。 |
| `feature/需求分析` | 归档 + 解压 | 问卷与调研报告归档到 Release；模块5图包解压到 `docs/diagrams/成员5-晨间反馈与成长/`。 |
| `sucai/`、`睡前沟通与方案决策/`（随 `feature/mk-backend` 合入） | 目录迁移 | 室内声移入 `assets/audio/indoor/`，素材台账移为 `docs/素材台账/成员2-室内声.md`。 |

选择性检出和归档的分支不做 Git 合并，避免把大体积原始资料写入 `main` 的历史。具体文件与校验值见 [归档索引](../archive-index.md)。
