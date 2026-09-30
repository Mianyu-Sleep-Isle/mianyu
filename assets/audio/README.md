# 运行音频素材与许可

后端内容清单 `backend/src/modules/content/manifest.ts` 的 `audioPath` 指向本目录，`内容清单引用的音频文件都在仓库中` 测试会校验文件存在。本目录只放来源与许可有记录的音频，每个编号一个运行文件；候选素材和原始调研见 [`docs/archive-index.md`](../../docs/archive-index.md)。

| 编号 | 前端名称 | 文件 | 时长 | 来源 | 许可 | 台账 |
|---|---|---|---|---|---|---|
| A03 | 壁炉 | `indoor/A03_fireplace.mp3` | — | 爱给网 | CC0 | [成员2-室内声](../../docs/素材台账/成员2-室内声.md) |
| A04 | 翻书声 | `indoor/A04_page_turn.mp3` | — | 爱给网 | CC0 | 同上 |
| A07 | 室内底噪 | `indoor/A07_room_tone_night.mp3` | — | 爱给网 | CC0 | 同上 |
| A08 | 柴火燃烧 | `indoor/A08_wood_fire.mp3` | — | 爱给网 | CC0 | 同上 |
| A10 | 轻键盘 | `indoor/A10_keyboard.mp3` | — | 爱给网 | CC0 | 同上 |
| A11 | 被子摩擦 | `indoor/A11_blanket_rub.mp3` | — | 爱给网 | CC0 | 同上 |
| ST01 | 窗边听雨 | `stories/S01_adult_rain_window.mp3` | 04:05 | 原创稿 + 百炼 CosyVoice | 团队原创，课程演示 | [成员3-故事呼吸](../../docs/素材台账/成员3-故事呼吸.md) |
| ST02 | 静室入夜 | `stories/S02_adult_quiet_room.mp3` | 08:59 | 原创稿 + 百炼 CosyVoice | 同上 | 同上 |
| ST03 | 暖茶时光 | `stories/S03_adult_warm_tea.mp3` | 04:22 | 原创稿 + 百炼 CosyVoice | 同上 | 同上 |
| ST04 | 星星和小毯子 | `stories/S04_child_star_blanket.mp3` | 05:04 | 原创稿 + Edge TTS | 同上 | 同上 |
| ST05 | 小小花园的晚安 | `stories/S05_child_small_garden.mp3` | 04:26 | 原创稿 + Edge TTS | 同上 | 同上 |
| BR01 | 睡前两分钟呼吸 | `breath/B01_breath_relax_2min.mp3` | 02:17 | 原创口播 + Edge TTS | 同上 | 同上 |

## 待审核的自然声（A01、A02、A05、A06、A09、A12）

成员1的 [自然声交付包](../../docs/素材台账/成员1-自然声/交付内容说明.md) 共 19 个候选，源包没有版权凭证，也未逐条听审，全部为 `pending_review`，交付说明要求审核前不能播放。因此：

- 音频文件不进入本目录（`main` 会整体部署到 GitHub Pages），原文件保留在 `pre-integration/feature-minin-minin-v2` 标签，SHA-256 见归档索引。
- 内容清单中这些编号的 `audioPath` 为空、`copyrightStatus` 为 `pending_review`，内容列表显示但 `enabled=false`，播放接口返回 `playable=false` 和空 `url`，方案生成不会选用。
- A12 远雷 `exclusionTestOnly=true`：即使补齐授权也不能默认、推荐、被用户显式选入或解析播放，只用于验证「不要打雷」的排除规则。

成员1补齐授权凭证并完成听审后，把通过的文件放入 `assets/audio/nature/`，在清单中填写 `audioPath` 并把 `copyrightStatus` 改为 `licensed`，同时在 `pubspec.yaml` 加入该目录。

## 其他

- ST06「月光邮局」是模板故事，目前没有音频，播放接口返回空 `url`。
- 成员3的正式场景图 `assets/scenes/scene_bedroom.png`、`scene_rain_yard.png` 暂未接入前端；`verify_frontend.ps1` 要求 `assets/images` 恰好 42 个文件，因此没有并入该目录。
