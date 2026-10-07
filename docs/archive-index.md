# 分支整合归档索引

全分支整合（`integration/all-branches`）时，未进入 main 运行目录的原始调研与冗余素材按下列方式保留。Release：[archive-2026-09-30](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/tag/archive-2026-09-30)。

所有原分支在验收前保留；每个分支整合前的提交另有 `pre-integration/*` 注解标签，删除分支后仍可通过标签取回原文件。校验：Windows 用 `Get-FileHash -Algorithm SHA256 <文件>`，macOS/Linux 用 `shasum -a 256 <文件>`。

## Release 附件

| 附件 | 内容 | 来源分支 | 来源提交 | 文件数 | 大小 | SHA-256 |
|---|---|---|---|---|---|---|
| [mianyu-requirement-research.zip](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/download/archive-2026-09-30/mianyu-requirement-research.zip) | 需求调研材料（团队整理的报告、评论汇总与功能分析） | `feature/requirement-research` | `c948cfcec2` | 16 | 552 KB | `1473fb385e508c07a494337d65bd9e3274f7ecf032d2b1b8c51966207cf2741d` |
| [mianyu-requirement-analysis.zip](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/download/archive-2026-09-30/mianyu-requirement-analysis.zip) | 用户需求调研问卷与报告 | `feature/需求分析` | `c152f9635f` | 3 | 774 KB | `b78c085835d405af381378d203f7cdc4ea496635d57e6b06bf89a33734beb265` |
| [mianyu-user-interviews.zip](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/download/archive-2026-09-30/mianyu-user-interviews.zip) | 用户访谈提纲、记录与分析 | `feature/minin-minin` | `5a4e0c83c0` | 6 | 4331 KB | `6d9460d7fce5dd9aeca07f10dcea526ea94c1019e6fc0461cbece85223e7763a` |
| [mianyu-member3-scene-prototype.zip](https://github.com/Mianyu-Sleep-Isle/mianyu/releases/download/archive-2026-09-30/mianyu-member3-scene-prototype.zip) | 成员3场景模块早期原型（Dart Fake、fixtures、SQL 草案与台账） | `feature/member3-m0-scene` | `43c6d0211e` | 7 | 7.6 KB | `7478f169d294867992ab0465c5ddbc86de01a0783cc17ec8c1353080ac16d1c9` |

## 仅保留在预整合标签的第三方材料

### 第三方论文与统计报告 PDF

第三方版权文献，不在公开 Release 中二次分发；原文件保留在预整合标签：[`pre-integration/feature-requirement-research`](https://github.com/Mianyu-Sleep-Isle/mianyu/tree/pre-integration/feature-requirement-research)（`feature/requirement-research` @ `c948cfcec2`）。

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `网络资料/01_用户问题与统计资料/2025年中国睡眠健康调查报告.pdf` | 749 KB | `dbc5d86d22fcbd24c0d321cdb94268ca199738cdd386acdcb23f12426fd1777b` |
| `网络资料/01_用户问题与统计资料/中国大学生睡眠障碍影响因素的meta分析.pdf` | 1244 KB | `b245e3d2e321c7bd14e2440e7c03d6fceea6f6aaeb0a833923769fa9e7661656` |
| `网络资料/01_用户问题与统计资料/中国睡眠障碍量表的研制及信效度检验.pdf` | 745 KB | `2ac439961ec2b21303a8bdbdab9c8773fdf903a1e6673d4c8ff821f24c223168` |
| `网络资料/01_用户问题与统计资料/在校大学生睡眠质量现状调查_高晓莹.pdf` | 1564 KB | `3e5017e16e736bfd04ebcafa967d4fc9b9198c11a409304ce033eb7a4acaf01f` |
| `网络资料/01_用户问题与统计资料/大一学生睡眠质量现状调查情况及对策分析_何云.pdf` | 103 KB | `6a54d1abc7b1ff2aff10086541233bcf2ceea31600a6a52fe19239fd13df389e` |
| `网络资料/01_用户问题与统计资料/大学生睡眠心理量表的编制及应用研究_张紫琪.pdf` | 2523 KB | `9b1b77bc3cbd6a2b30a14c77277cc475e833d17d972d2c5a3c5f12df21311137` |
| `网络资料/01_用户问题与统计资料/大学生睡眠质量及影响因素分析.pdf` | 369 KB | `28ce80c03d72c176439e24cdd8f5371d9ee1c28bf42470a5cf7f240f3cc6945b` |
| `网络资料/01_用户问题与统计资料/大学生睡眠质量影响因素综述.pdf` | 1313 KB | `b98b04342c78e0a51c9d8a480d765fb7180303b2b0ca73ff6d20de07f7406b82` |
| `网络资料/01_用户问题与统计资料/大学生睡眠质量现状及其影响因素分析.pdf` | 2963 KB | `efc795229fdced169d0f51827b4f68ec03fc408e3f9d058710b183a2065c0661` |
| `网络资料/01_用户问题与统计资料/大学生睡眠质量的调查研究.pdf` | 641 KB | `9d5d9ce006fb8b59b47c1178eff11d7db2c62344827cc237ce0efbdc6cb339c3` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/中国一般人群失眠患病率Meta分析_2017.pdf` | 1538 KB | `751efc04f6defbf105e2d6a29711254adfad2ff39ac963894ef0e953e1c8de5c` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/中国夜班护士睡眠质量决定因素_Frontiers2024.pdf` | 543 KB | `b535d0aec23c2dc4a688fd07ca5f1bd0f8296a40a1bebcfef772e396a502f590` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/佛山成人失眠患病率_Frontiers2025.pdf` | 684 KB | `ab5789a2ca160dbb64d1a6c1eaff8ed193959ee6787ab5422f4c984280e1d4d7` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/北京成人DSM5失眠障碍_BMC2026.pdf` | 1488 KB | `f10a363ce83286aff4d395050391ecfeee7913d346ed2139ff454aac29c0f9dc` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/夜班对睡眠与抑郁症状影响_2019.pdf` | 182 KB | `7161340c37e1b5d359a3623787651dfd8ebfd9727031a491ca8838da7baad411` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/山东省老年人睡眠质量十年比较_2022.pdf` | 1288 KB | `7dd12712adb5a172b10ef4c0d7e8d03821fb9e909610769d9f297fa910f89c5c` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/工作时间安排变化与睡眠障碍_2020.pdf` | 1180 KB | `1957097f3578eb7a8f0f95637cda5dc021af39725064b43bac5e295ac2ad9b24` |
| `网络资料/01_用户问题与统计资料/补充_非学生人群睡眠研究/香港护士轮班与睡眠问题_BMC2025.pdf` | 2031 KB | `32f86ff5137c8ff755a21705039f14a53d1eea6f25e96c8cb196a07294570b7c` |
| `网络资料/01_用户问题与统计资料/近20年我国大学生睡眠质量研究结果的元分析.pdf` | 358 KB | `b3e39224f35cde4fbfdc4ca4df3f5149c8e14e71dc1bade1be7d7fd02b15fbef` |

### 成员1自然声候选（19 个，待授权与听审）

成员1交付说明写明源包没有版权凭证、未逐条听审，审核前不能播放；因此不进入 `main`（会部署到 GitHub Pages），也不在 Release 再分发。同一标签的 `sucai level1 成员1-自然声/` 下是字节相同的原始命名副本。原文件保留在预整合标签：[`pre-integration/feature-minin-minin-v2`](https://github.com/Mianyu-Sleep-Isle/mianyu/tree/pre-integration/feature-minin-minin-v2)（`feature/minin-minin` @ `948d8cae13`）。

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `成员一后端文件交付包/assets/audio/A01/A01-01_小雨.mp3` | 2813 KB | `4bbeffc74f48dc64312937451b04081b693602ba5fa53d5607eb986b282ee33f` |
| `成员一后端文件交付包/assets/audio/A01/A01-02_小雨.mp3` | 16582 KB | `3f96de2d322f7d3d5fa4a28ef2b193e2ccb1f8319d2358e669d9f3f38b74ab88` |
| `成员一后端文件交付包/assets/audio/A01/A01-03_小雨.mp3` | 6056 KB | `1444dc67b3c269444f5d8ce239ff6b544f9a9065c49ed2222f1ec8502c4bc321` |
| `成员一后端文件交付包/assets/audio/A02/A02-01_雨打窗户.mp3` | 4589 KB | `21c9fc2abccf585dfbc57cdee963b3fc25338bfd43e68dc96a10c6a8672755db` |
| `成员一后端文件交付包/assets/audio/A02/A02-02_雨打窗户.mp3` | 23761 KB | `e038d6cb1237cbe6c9e12bbe6449ba1586da3954b90bc6bd71b15759cb2bd0c0` |
| `成员一后端文件交付包/assets/audio/A02/A02-03_雨打窗户.mp3` | 7955 KB | `dcd8aef3fc03362f7233697513c96ba59333b5f1770fe100915c2daf7ba7c8f4` |
| `成员一后端文件交付包/assets/audio/A05/A05-01_微风.mp3` | 2435 KB | `fefde06dc16d6b28f249240d40e611081a5ac4b64a548b1b244315053b52cdb3` |
| `成员一后端文件交付包/assets/audio/A05/A05-02_微风.mp3` | 251 KB | `2351722d774c15b9e732befdea533dd02d4a1d10bf3987547d4bbc5d84c489f7` |
| `成员一后端文件交付包/assets/audio/A05/A05-03_微风.mp3` | 690 KB | `d4113da84f4876a8bf9013c87f3476db50fc4155e6928b847c889b79405d5212` |
| `成员一后端文件交付包/assets/audio/A06/A06-01_溪流.mp3` | 17344 KB | `ce07516a407c60f71480d160e1a464e92e4e8920ffaafecf38223248842d7028` |
| `成员一后端文件交付包/assets/audio/A06/A06-02_溪流.mp3` | 5516 KB | `610ff43b0f76f2e8cf55e5105fbccd215d47252b8cfda4d2e6e07287425d6b3a` |
| `成员一后端文件交付包/assets/audio/A06/A06-03_溪流.mp3` | 22501 KB | `46552bf4368332fb8e531bb4b2a4ed20a56ac77c320743726913737910834063` |
| `成员一后端文件交付包/assets/audio/A09/A09-01_森林夜晚_雨声与虫鸣.mp3` | 28099 KB | `c0fecf2480bb6da52ccc3fbcb46b32917de2fc6c1805124f4448172d83d77652` |
| `成员一后端文件交付包/assets/audio/A09/A09-02_森林夜晚_蛙声与虫鸣.mp3` | 25531 KB | `8f6daecc6d32ea14f01d8dfa6e62b2de1515ae5d42ea6c34f0533d9a8024d636` |
| `成员一后端文件交付包/assets/audio/A09/A09-03_森林夜晚_虫鸣.mp3` | 2565 KB | `83fc7d07f061df15244befe6d995d62d8e03231e9aa0119cae663d26adcaf19e` |
| `成员一后端文件交付包/assets/audio/A12/A12-01_远雷_伴随雨声_仅排除测试.mp3` | 2810 KB | `71f958835e98765a21b0a984b0f200d5fb7605129e847cdfd3631164812272e4` |
| `成员一后端文件交付包/assets/audio/A12/A12-02_远雷_仅排除测试.mp3` | 1272 KB | `72c8cd7ed9eacf23a5a8fd940f678a8972a097893733ed8bd5d947012eca22dd` |
| `成员一后端文件交付包/assets/audio/A12/A12-03_远雷_持续雷声_仅排除测试.mp3` | 21802 KB | `9795a017d3004393e3f3870ba60cad37f8d1f83fde816aebbf990674e7dbd462` |
| `成员一后端文件交付包/assets/audio/A12/A12-04_远雷_仅排除测试.mp3` | 8348 KB | `4288f469b2ac15a30743814205aa531df145ceda14e0babe5cda2f11de388e19` |

## 已并入 main 或确认重复的内容

| 来源分支 | 原路径 | 处置 |
|---|---|---|
| `feature/requirement-research` | docs/diagrams/成员3需求分析图片.zip | 已解压到 `docs/diagrams/成员3-梦境空间与声景创作/` |
| `feature/需求分析` | 模块5各类图.zip | 已解压到 `docs/diagrams/成员5-晨间反馈与成长/` |
| `成员四_UML类图时序图用例图` | APP图标/、图标/、图标效果实体/、背景/（29 个文件） | 与 `assets/images/{brand,icons,sounds,scenes}` 字节完全相同，未重复保存 |
| `成员四_UML类图时序图用例图` | 时序图/、用例图/、类图-04（8 个文件） | 已并入 `docs/diagrams/成员4-睡眠模式与夜间记录/` |
| `feature/member2-design-diagrams` | 成员2-睡前沟通与方案决策/（5 个文件） | 已合并历史并移到 `docs/diagrams/成员2-睡前沟通与方案决策/` |
| `feature/minin-minin` | 眠境探索与内容中心/（6 个文件） | 已并入 `docs/diagrams/成员1-眠境探索与内容中心/` |
| `feature/minin-minin` | 成员一后端文件交付包/ 的说明、清单、config 与检查脚本（10 个文件） | 已并入 `docs/素材台账/成员1-自然声/`；音频见上文，未进入 `main` |
| `feature/member3-m0-scene` | 成员3-故事呼吸/（6 个 MP3 + README） | 已并入 `assets/audio/{stories,breath}/` 与 `docs/素材台账/成员3-故事呼吸.md` |

## Release 附件文件清单

### mianyu-requirement-research.zip

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `docs/README.md` | 0.3 KB | `e9a72ae0c56c269ef104e970915a98dbada08a35d87b372b1ce2ff6a2ff82710` |
| `docs/眠屿需求分析材料总结报告.docx` | 60 KB | `7828c619a6211f42676afff02980b4d61fa001fc4cec4fca29cde86d87562fe5` |
| `网络资料/02_用户需求与竞品分析/小红书体验分析/小红书助眠产品用户调研报告 .docx` | 59 KB | `28953d9bc75b2d857debf25a157f13cb8279596e6769895aa115a7d6b27bbdf1` |
| `网络资料/02_用户需求与竞品分析/应用商店评论/小睡眠_评论详情_20260811_20260909.xlsx` | 26 KB | `a3fefe6b312f5a07347fea1effac5841691d70645c18484cb043df7449c2b78b` |
| `网络资料/02_用户需求与竞品分析/应用商店评论/潮汐_评论详情_20260309_20260909.xlsx` | 36 KB | `5992104c641efa5754e16e5561a98cb1f7ca9d93a295f3077a3657bcab4d8fd2` |
| `网络资料/02_用户需求与竞品分析/应用商店评论/蜗牛睡眠_评论详情_20260811_20260909.xlsx` | 22 KB | `b2fe2bff1e6be5a606a36055f99573d901cd0f85295663eccfa365078544fae9` |
| `网络资料/02_用户需求与竞品分析/应用商店评论/软眠眠-高质量睡眠评论详情2026-06-11 00_00_00-2026-09-08 23_59_59.xlsx` | 13 KB | `f1e6f22c39adde9bb00f23b048e5d5a462d9d4f14efa2a467f3d049dd47e6903` |
| `网络资料/02_用户需求与竞品分析/用户需求分析/《三方交叉验证汇总表》.docx` | 38 KB | `36a3e4d847ac9b54dea21c5d3fc1f415bbd531dc179965a41f5474cada196e10` |
| `网络资料/02_用户需求与竞品分析/用户需求分析/《四款助眠App用户评论对比分析报告》.docx` | 45 KB | `ce060c8d9d6481569bb00544a867b7e1713584d88feabc086c3de9a93cdabd86` |
| `网络资料/02_用户需求与竞品分析/用户需求分析/《竞品对比分析报告》.docx` | 41 KB | `25c18cab10e53bcbe75ae1e554552e3d682a3caf0ae31da7e37533c1174d9519` |
| `网络资料/02_用户需求与竞品分析/用户需求分析/四款助眠App用户评论汇总表.xlsx` | 54 KB | `a58d8f52be876613601d43fca51162ca41bddf6497d65cd61ac1e6eeafafd540` |
| `网络资料/02_用户需求与竞品分析/知乎体验分析/知乎助眠产品用户调研报告.docx` | 51 KB | `37216402767edda87ad029ea7394e16d6f839eca7cf409ed14bcf2373472c498` |
| `网络资料/02_用户需求与竞品分析/知乎体验分析/知乎用户评论汇总表.xlsx` | 14 KB | `080e10f432896fd6505d1f4c22c2e622c4e981934bdb0a5f157177ea9206cde8` |
| `网络资料/03_功能偏好与使用场景/文档一_功能需求清单.docx` | 38 KB | `4474046e542af7d614e914e3081a3273b2e1a7d34f4fe796f3073b16f161f801` |
| `网络资料/03_功能偏好与使用场景/文档三_功能优先级矩阵.docx` | 38 KB | `336019780d4b9ee1615f30aab28fd5c1b088d3e40c696c56d8455825f0263cdc` |
| `网络资料/03_功能偏好与使用场景/文档二_使用场景卡片.docx` | 38 KB | `23c989507b5da4432bfb897014d6dcc6d07427c0fda79db2e8714b18e26b4d39` |

### mianyu-requirement-analysis.zip

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `助眠应用用户需求调研报告简洁版.docx` | 47 KB | `94bd730018911953c0b417af0bcdb442034bd5224826db2026d7e1cac17d2f1d` |
| `助眠应用用户需求调研问卷详细数据及总结.docx` | 692 KB | `4ed20a4b595afccfe31243d95db2c278f942f46a41df24a35f9dcb71cf843adc` |
| `眠屿-助眠应用用户需求调研问卷.docx` | 44 KB | `16ed80d08c68b633aeb3d770ac38acc37c9a7c0b3377ccaff8b9a6899010036c` |

### mianyu-user-interviews.zip

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `访谈/大学生访谈记录.docx` | 2402 KB | `64e7318f1a72a3a361fcbbb29f77e65c513e5ba244c825d6c54cc4af42fc3a96` |
| `访谈/访谈分析.docx` | 32 KB | `f5f1b008b93edea40bcf1f4e84dbdae0a7f37647c253c6d440b5fb28f18d65c5` |
| `访谈/访谈提纲儿童家长.docx` | 13 KB | `70eb69303c2438fc7af8311a01e6e79b40dc9cd4560c8d4f7d47a52b0b85d636` |
| `访谈/访谈提纲大学生群体.docx` | 14 KB | `9525a81d2641f71ca19dadcc149bf105a793e3e1dba2c669a97a418d5cb3abf2` |
| `访谈/访谈提纲职场上班族.docx` | 13 KB | `cd4bcc1169d340f80df0f92c66ab7273c501125be02a5192ff6bb002360d2990` |
| `访谈/访谈记录.docx` | 2460 KB | `a6645afa79d3d7ab9ef86c4e39671cbb7a197aba2144871cace8116f6b3ceaa0` |

### mianyu-member3-scene-prototype.zip

| 文件 | 大小 | SHA-256 |
|---|---|---|
| `成员3-梦境空间与声景创作/README.md` | 0.9 KB | `814708db6c55d98d53e00bf72e762b63edd7e34b01a0d39240dbab0524d5eb3b` |
| `成员3-梦境空间与声景创作/assets/V01-V02台账.md` | 0.8 KB | `af373b92dc9d8f4ce132a05d20db7533befdf65bee9c60b5a9bc4e47083c8cbe` |
| `成员3-梦境空间与声景创作/fake/fake_scene_config_query.dart` | 4.2 KB | `ca89e3b4b276ce93da9b71c19b5edde0cf4f3c7f9724e94dfb003b4647e266e5` |
| `成员3-梦境空间与声景创作/fake/fixtures.json` | 0.7 KB | `e6e60b23ae760973b7f3a02a3ca07580b79d0d4e311e2c841d84c920fc011076` |
| `成员3-梦境空间与声景创作/fake/scene_config_query_port.dart` | 2.9 KB | `a2372ff10a49474ef34b6b0de2ef26b3eed11a932a6c014cd5dc4b3c2b29294b` |
| `成员3-梦境空间与声景创作/sql/001_module3_scene.sql` | 5.5 KB | `1a656990fda0e770a72a9def78526944bec709d992bb2ea409ab6719de6379ad` |
| `成员3-梦境空间与声景创作/场景图/README.md` | 0.2 KB | `51e7ed303e4f2c1edee0e03e3111f09e985b7d8a3e743db360e9c10cc933cd66` |
