# 眠屿 Flutter 前端

本分支为眠屿 MVP 的完整前端实现，包含 Flutter 页面、浏览器交互预览、视觉素材、Fake Port 和前端说明文档。

## 已覆盖

- P0–P11 全部页面与四项主导航
- 点选/预制句 → 可解释方案 → 房间预摆 → 保存 → 睡眠模式
- 成人/儿童模式与 PIN 门控
- 室内/户外切换、声音物体拖放和试听演示
- 次日反馈、个性化成长、来源标签和积分
- 隐私授权、撤回授权和本机数据删除演示
- 10 个 DTO、12 个 Port、Fake 实现与集中式演示状态
- 卧室、小院、首页岛屿、App 图标和声音/内容视觉素材
- `system_preview.html`、`app_pages.css`、`app_pages.js` 提供完整移动端浏览器流程
- 五模块浏览器 Port、HTTP/Mock Adapter、DTO 类型与契约测试

## 浏览器预览

在本目录启动静态服务器：

```powershell
node preview_server.js
```

然后打开：

```text
http://127.0.0.1:4173/system_preview.html
```

也可以通过 `index.html` 进入当前预览版本。

## Flutter 运行

需要 Flutter 3.x：

```bash
flutter pub get
flutter run
```

当前代码仅依赖 Flutter SDK，不依赖第三方 UI、状态管理或 SVG 包。

## 浏览器接口测试

```bash
npm test
```

本地 `localhost`/`127.0.0.1` 预览默认连接模块五后端；GitHub Pages 等静态托管环境自动使用 Growth Mock，确保反馈、积分与档案页面可以独立演示。可通过 `window.__MIANYU_TRANSPORTS__` 和 `window.__MIANYU_API_BASE_URL__` 覆盖默认配置。

## 文档

- [前端实现说明](docs/FRONTEND_IMPLEMENTATION.md)
- [前端界面说明](docs/FRONTEND_INTERFACE_SPEC.md)
- [当前实际交互说明](docs/FRONTEND_INTERACTION_ACTUAL.md)

## 目录

- `lib/`：Flutter 页面、主题、状态编排、契约和 Fake 服务
- `assets/images/`：品牌、场景、声音、内容和 SVG 图标素材
- `prototype_images/`：原型图、分层素材和生成素材归档
- `docs/`：前端实现、界面和交互文档
- `frontend-api/`：五模块 Port、DTO、HTTP/Mock Adapter 与前端契约测试
- `contracts/openapi.yaml`：五模块统一 HTTP 契约
- `test/`：Flutter 冒烟测试
- `system_preview.html`：当前完整浏览器交互预览
- `verify_frontend.ps1`：前端静态验收脚本

## 边界

模块一至四默认使用 Mock Adapter，模块五在本地连接真实 HTTP 后端、在静态托管环境使用 Growth Mock。页面只依赖统一 Port，不直接读取其他模块内部模型；后续可逐模块切换为 HTTP Adapter。

眠屿不是医疗产品，不能诊断或治疗失眠；播放记录不代表实际入睡情况。
