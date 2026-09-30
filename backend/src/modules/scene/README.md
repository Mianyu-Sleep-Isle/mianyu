# 场景编辑模块

模块3保存梦境空间编辑页里的场景草稿，并在用户开始睡眠时把一份不可变快照交给播放模块。拖拽动画、元素视觉大小、PNG 和浏览器预览属于前端。

## 职责

本模块拥有并读写这三张表：

- `scene_config`
- `scene_audio_source`
- `scene_element`

它提供五个 HTTP 接口，以及给模块4、模块5使用的进程内方法：

- `getSceneSnapshot(sceneConfigId, userId)`：只返回该用户已经 `handed_off` 的快照。
- `eraseUserData(userId)`：删除该用户的场景配置；子项随外键级联删除。

`assetId` 和 `sourcePlanId` 只保存跨模块 UUID。本模块不复制素材名称、URL、版权或审核状态，不修改 `SleepPlan`，也不重新分析用户情绪。

## 明确不负责

- 素材目录、可播放性判定和展示编号解析。这些由 `ContentCatalogService` 提供。
- 睡眠方案的生成、确认和轨道内容。创建场景时只通过 `PlanQueryService.getConfirmedPlan` 读取已确认方案。
- 播放、暂停、会话和睡眠档案。模块4拿到冻结快照后自行播放。
- 收藏、预设快照复制和前端 `visualSpecs`。`presetSceneId` 只存引用，不会展开预设元素。
- 室内/户外切换动画，以及元素视觉宽高、PNG 文件名。这些不入库。

## 三张表

API 使用 camelCase，数据库使用 snake_case。主键和跨模块引用都是 UUID。时间是 UTC ISO-8601。秒字段使用 `Sec` / `_sec`。

`scene_config` 保存版本族和配置头：

| 列 | 含义 |
| --- | --- |
| `scene_config_id` | 这一版的主键 |
| `scene_family_id` | 同一系列不变；第一版等于自身 id |
| `config_version` | 从 1 开始，族内唯一 |
| `previous_version_id` | 直接复制来源；第一版为空，不能指向自己 |
| `user_id` | 所有者 |
| `source_plan_id` / `preset_scene_id` | 二选一的来源引用，可以都为空 |
| `status` | `draft`、`handed_off`、`retired` |
| `space_type` | 默认打开空间，不是“只能放这一种元素” |
| `environment_type` / `reverb_type` | 1～64 字符 |
| `handed_off_at` | 仅 `handed_off` 时必填 |

`scene_audio_source` 属于某一个 `scene_config_id`。`volume` 为 0～1，`loop_mode` 为 `once`、`loop` 或 `intermittent`，淡入淡出为非负整数秒，`enabled` 为 0/1。

`scene_element` 同样属于某一个配置。`position_x`、`position_y` 为 0～1，`scale > 0`，`z_order >= 0`。`source_id` 可空；有值时必须指向同一配置里的声源。`client_element_id` 在同一配置内唯一，供前端刷新后对上原来的摆放项。

三张表之间可以建外键。`source_plan_id`、`preset_scene_id`、`asset_id`、`user_id` 不建跨模块物理外键，查询也不 JOIN 其他模块的表。

## 状态机

```text
draft --PUT 完整快照--> draft
draft --hand-off--> handed_off
handed_off --再次 hand-off--> handed_off（返回第一次的 handedOffAt）
handed_off --copy--> 新的 draft
任意已有版本 --copy--> 新的 draft
```

- `handed_off` 后再 PUT，返回 409 `SCENE_ALREADY_HANDED_OFF`。
- 没有启用声源时 hand-off 返回 409 `SCENE_NO_ENABLED_SOURCE`，状态仍是 `draft`。
- `retired` 只留给后续下线流程。本模块的接口不会把记录写成 `retired`。对它保存或交接会返回 409 `SCENE_STATUS_CONFLICT`。
- 复制时 `sceneFamilyId` 不变，`configVersion` 取该族当前最大版本再加 1，`previousVersionId` 指向被复制的那一版。配置、声源、元素全部使用新 UUID。旧版行不更新。
- 模块4调用 `getSceneSnapshot` 时，草稿返回 409 `SCENE_STATUS_CONFLICT`。HTTP GET 仍按所有权返回当前用户自己的草稿或冻结版本。

产品动作对应关系：

- 点击“保存”只调用 PUT，成功后仍是 `draft`，留在编辑页。
- 点击“开始睡眠”才调用 hand-off，成功后再交给播放。
- 播放页要继续编辑时，先 copy 出新草稿，再编辑新的 `sceneConfigId`。

## HTTP API

成功响应是 `{ "data": ... }`。失败响应是：

```json
{ "error": { "code": "SCENE_NOT_FOUND", "message": "场景不存在", "requestId": "uuid", "details": [] } }
```

前端只依赖 `code`。未知异常返回 `INTERNAL_ERROR`，响应里不包含内部异常文本。

稳定错误码：`IDENTITY_REQUIRED`、`INVALID_REQUEST`、`SCENE_NOT_FOUND`、`SCENE_FORBIDDEN`、`SCENE_ALREADY_HANDED_OFF`、`SCENE_STATUS_CONFLICT`、`SCENE_NO_ENABLED_SOURCE`、`SCENE_ASSET_UNAVAILABLE`、`SCENE_SPACE_INCOMPATIBLE`、`PLAN_NOT_FOUND`、`PLAN_FORBIDDEN`、`PLAN_NOT_CONFIRMED`、`INTERNAL_ERROR`。

### 请求头

`X-Mianyu-User-Id` 必填，表示本机匿名身份。缺失时返回 401 `IDENTITY_REQUIRED`。所有读写都按这个身份做所有权隔离：别人的场景返回 403 `SCENE_FORBIDDEN`，不存在返回 404 `SCENE_NOT_FOUND`。

`Idempotency-Key` 可选。同一个用户、同一个操作、同一个目标、同一个键，在当前进程里再次调用会直接返回第一次成功的快照，不会再执行一次写入。创建、保存、交接、复制都看这个头。不传或只有空白时，每次都真实执行。这个缓存只在内存中，进程重启后消失。交接本身还有数据库级幂等：已经 `handed_off` 的版本再次交接，即使没有这个头，也返回第一次的 `handedOffAt`，并且不再访问素材目录。

### `POST /api/v1/scenes`

创建草稿，返回 201。空对象会使用默认值：`spaceType=indoor`，`environmentType=bedroom`，`reverbType=indoor_soft`。

```http
POST /api/v1/scenes
X-Mianyu-User-Id: device-user-1
Content-Type: application/json

{}
```

从已确认方案创建时只提交方案引用。服务读取轨道并转成启用声源；元素为空。方案不是 `confirmed`、不属于该用户或不存在时，不写入场景。

```json
{
  "sourcePlanId": "11111111-1111-4111-8111-111111111111",
  "spaceType": "outdoor",
  "environmentType": "forest",
  "reverbType": "outdoor_open"
}
```

`sourcePlanId` 和 `presetSceneId` 不能同时出现。

### `GET /api/v1/scenes/:sceneConfigId`

返回该用户自己的完整快照，草稿和已交接版本都可以读。

```http
GET /api/v1/scenes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
X-Mianyu-User-Id: device-user-1
```

### `PUT /api/v1/scenes/:sceneConfigId`

接收完整草稿快照，成功后状态仍是 `draft`。一次事务内删除旧声源和旧元素，再写入新子项并更新 `updatedAt`。任一步失败都会回滚，旧快照保持不变。

声源必须带 `sourceId`。元素用这个 id 绑定同一份快照里的声源；不绑定写 `null`。`01-HTTP-API-v1.md` 的示例省略了 `sourceId`，当前实现不接受省略。

```http
PUT /api/v1/scenes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa
X-Mianyu-User-Id: device-user-1
Content-Type: application/json

{
  "spaceType": "indoor",
  "environmentType": "bedroom",
  "reverbType": "indoor_soft",
  "sources": [
    {
      "sourceId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "assetId": "33333333-3333-4333-8333-333333333333",
      "spaceType": "indoor",
      "volume": 0.62,
      "loopMode": "loop",
      "fadeInSec": 2,
      "fadeOutSec": 8,
      "enabled": true
    }
  ],
  "elements": [
    {
      "clientElementId": "A02",
      "assetId": "44444444-4444-4444-8444-444444444444",
      "sourceId": null,
      "spaceType": "outdoor",
      "positionX": 0.72,
      "positionY": 0.38,
      "scale": 1,
      "zOrder": 2
    }
  ]
}
```

上面这个元素来自页面坐标 `x=72`、`y=38`。配置默认空间是室内，元素自己仍可以是户外。`visualSpecs` 出现在请求体里会被拒绝。

### `POST /api/v1/scenes/:sceneConfigId/hand-off`

冻结当前草稿并返回 200。交接前至少要有一个 `enabled` 声源，并再次调用素材目录校验可播放性和空间兼容。重复调用返回第一次的结果。

```http
POST /api/v1/scenes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/hand-off
X-Mianyu-User-Id: device-user-1
```

### `POST /api/v1/scenes/:sceneConfigId/copy`

复制出一个新草稿，返回 201。新快照的声源和元素都是新 UUID，绑定关系保持，旧版的 `handedOffAt` 不变。

```http
POST /api/v1/scenes/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/copy
X-Mianyu-User-Id: device-user-1
```

## 前端 placed 映射

当前摆放项是 `{ id, x, y }`。提交 PUT 之前由前端转换，后端不接受百分比，也不接受展示编号充当 `assetId`。

| 页面字段 | 请求字段 |
| --- | --- |
| `id` | 先经模块1目录换成正式 `assetId`；展示编号可同时放到 `clientElementId` |
| `x / 100` | `positionX` |
| `y / 100` | `positionY` |
| `visualSpecs` | 不提交 |
| `masterVolume` | 每个声源的 `volume`，范围 0～1 |
| `outdoor` | 配置默认 `spaceType` 与 `environmentType` |

`outdoor` 为真时，`spaceType` 传 `outdoor`，`environmentType` 传该页当前户外环境名。为假时，创建接口可以省略这两项，默认是 `indoor` 和 `bedroom`。元素和声源各自还有 `spaceType`，室内和户外条目可以同时存在。

读取后若页面仍用百分比，把 `positionX`、`positionY` 乘回 100。视觉宽高继续留在前端设计配置里。

## 独立启动和测试

场景路由还没有挂进 `src/app.ts`。`npm start` 目前只提供方案接口。场景验收使用测试文件里的最小 Express 应用，监听本机随机端口，不改总应用。

在 `backend` 目录执行：

```text
node --experimental-transform-types --test src/modules/scene/scene.test.ts
npm run typecheck
```

仓库根目录也可以执行：

```text
node --experimental-transform-types --test backend/src/modules/scene/scene.test.ts
npm --prefix backend run typecheck
```

当前 `npm test` 只运行 planning 测试。场景测试要单独用上面的命令，直到组长改测试脚本。

## Fake 假设

独立开发不导入 planning repository。`FakePlanQuery` 和 `FakeContentCatalog` 只实现这两个接口上的三个方法：

- `PlanQueryService.getConfirmedPlan(planId, userId)`
- `ContentCatalogService.validateAssets(assetIds, userId)`
- `ContentCatalogService.resolveContentIds(contentIds, userId)`

正式装配必须换成模块1、模块2适配器，不能把 Fake 放进生产代码。

尚未由组长确认的契约：

- 模块2公开的是 `PlanningService.getPlan`，没有 `getConfirmedPlan`。适配器应只在方案 `status === 'confirmed'` 且属于该用户时返回轨道；否则分别抛出找不到、无权限、未确认。
- 轨道只读取 `contentId`、`volume`、`loopMode`（`once` 或 `loop`）。不读取情绪、偏好、时长和内容种类，也不回写方案。
- `contentId` 可以是 `A01` 这样的展示编号。展示编号不是 UUID，不能写入 `asset_id`。`resolveContentIds` 负责把它解析成 `assetId`。
- 初始声源使用本次请求的 `spaceType`，`enabled = true`，淡入淡出为 0 秒，`sourceId` 由本模块新生成。
- `validateAssets` 只返回 `assetId`、`playable` 和允许的 `spaceType`。审核、版权和 URL 留在模块1。
- 空间是否兼容，看每个声源或元素自己的 `spaceType`。配置上的 `spaceType` 只是默认打开空间。
- 已交接版本再次 hand-off 时不再访问素材目录。事后下架不会改变第一次的 `handedOffAt`；新的交接仍会失败。
- PUT 声源必须带 UUID。这和 `01-HTTP-API-v1.md` 里省略 `sourceId` 的示例不同。

Fake 展示编号只用于测试，不能当作线上目录：

| 展示编号 | Fake assetId |
| --- | --- |
| A01 | `10000000-0000-4000-8000-000000000001` |
| A03 | `10000000-0000-4000-8000-000000000003` |
| A12 | `10000000-0000-4000-8000-000000000012` |

## 需要组长完成的最小集成

本分支不修改 `app.ts` 和 `package.json`。接入时：

1. 在 `200_module2.sql` 之后执行 `migrations/300_module3.sql`。
2. 用真实 `PlanQueryService`、`ContentCatalogService` 构造 `SceneRepository` 和 `SceneService`，再执行 `app.use('/api/v1', createSceneRouter(sceneService))`。
3. `Access-Control-Allow-Methods` 在现有 `GET,POST,OPTIONS` 上增加 `PUT`。`Idempotency-Key` 已经在允许的请求头里。
4. 把 test 脚本改成同时运行 planning 和 scene：

```json
"test": "node --experimental-transform-types --test src/modules/planning/planning.test.ts src/modules/scene/scene.test.ts"
```

5. 前端负责人把 `placed` 保存接到 PUT，把“开始睡眠”接到 hand-off；继续编辑已交接场景时先 copy。
