<p align="center">
  <img src="assets/app-icon/appshelf-icon-source.png" width="108" alt="AppShelf logo">
</p>

<h1 align="center">AppShelf</h1>

<p align="center">
  一个用于管理本地 localhost 项目的桌面书架。
</p>

<p align="center">
  <a href="README.md">English</a>
</p>

<p align="center">
  <img alt="Windows" src="https://img.shields.io/badge/Windows-only-2563eb">
  <img alt="Status" src="https://img.shields.io/badge/status-early_preview-0f9f7a">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-black">
</p>

![AppShelf main screen](docs/images/appshelf-main.png)

AppShelf 是一个 Windows 桌面应用，用于通过可视化库集中管理本地 localhost 项目。它面向 AI agent 参与的本地开发工作流：项目可以快速变多，但人不应该为了重新运行项目而记启动命令、端口、文件夹路径或旧聊天记录。

它适合管理本地 web app、个人网站、博客、文档站、仪表盘、游戏、demo 和工具。只要一个本地命令能启动一个 localhost URL 上的项目，AppShelf 就可以把它放到你的本地书架里。

## 亮点

- **一键启动：** 在桌面 GUI 中启动、停止、重启和打开本地项目。
- **Manifest 注册：** 从你指定目录里的 `.localapp.json` 发现项目。
- **Agent 友好：** 让 AI agent 帮项目注册一次，之后在 AppShelf 里管理。
- **运行上下文：** 查看状态、日志、启动错误、端口、进程 ID 和路径。
- **本地优先：** 偏好保存在 AppShelf 用户注册表中，日志不会自动上传。
- **双语界面：** 支持中文和英文。

## 为什么需要 AppShelf

AI agent 让创建本地项目变得很便宜。新的麻烦转移到了另一个地方：启动命令可能散落在 README、package scripts、终端历史或旧对话里。

AppShelf 把这些项目集中放在一个地方，让你像打开本地应用库一样启动项目，而不是记住每个命令。

## 当前状态

AppShelf 仍处于早期预览阶段。

- 仅支持 Windows。
- 仓库以源码公开为主。
- 支持生成本地 unsigned Windows unpacked build。
- 暂无签名公开安装器。
- 不负责安装运行环境或修复依赖。
- 不支持 Git 仓库克隆/导入流程。
- 不支持 Docker Compose 或远程部署。
- `.localapp.json` 仍是草案性质的本地约定，不是最终标准。

## 快速开始

要求：

- Windows
- Node.js 和 npm

安装依赖：

```powershell
npm install
```

开发运行：

```powershell
npm run dev
```

或者使用本地启动脚本：

```powershell
.\start-AppShelf.cmd
```

生成本地 unsigned Windows unpacked build：

```powershell
npm run pack:win
```

输出位于 `release/win-unpacked/AppShelf.exe`。该目录已被 Git 忽略，不是签名的正式发布产物。

## 注册项目

最小 `.localapp.json`：

```json
{
  "name": "My Web App",
  "command": "npm run dev"
}
```

推荐字段：

```json
{
  "$schema": "https://localapp.dev/schema/v0.json",
  "name": "My Web App",
  "description": "A short description of the app.",
  "icon": ".localapp/icon.png",
  "command": "npm run dev",
  "url": "http://localhost:5173",
  "port": 5173,
  "workingDirectory": "."
}
```

如果希望让 agent 帮项目注册，见 [docs/AGENT_REGISTER_LOCALAPP.md](docs/AGENT_REGISTER_LOCALAPP.md)。Manifest 参考文档见 [docs/LOCALAPP_MANIFEST_V0.md](docs/LOCALAPP_MANIFEST_V0.md)。

## 安全模型

`.localapp.json` 包含可执行命令。请把它当作代码看待。

AppShelf 只扫描你选择的目录。首次运行命令前会询问确认；命令发生变化后也会再次询问。请只添加你信任的项目。

AppShelf 作为个人/开源工具按现状提供，不提供任何担保。你需要自行审查本地命令，并判断项目是否可以安全运行。

## 开发

类型检查：

```powershell
npm run typecheck
```

构建：

```powershell
npm run build
```

生成 README 使用的安全截图：

```powershell
npm run capture:ui
```

## 示例项目

仓库包含 `examples/hello-localapp` 作为有意保留的示例项目。它是一个很小的本地 Node server，带有 `.localapp.json`，可用于测试 AppShelf 的扫描、启动、停止、日志和打开动作，不涉及私人项目。

## 项目文档

- [SPEC.md](SPEC.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/LOCALAPP_MANIFEST_V0.md](docs/LOCALAPP_MANIFEST_V0.md)
- [docs/AGENT_REGISTER_LOCALAPP.md](docs/AGENT_REGISTER_LOCALAPP.md)

## 致谢

AppShelf 的开发过程中使用了 OpenAI Codex 提供的协作辅助。

## 许可证

MIT. 见 [LICENSE](LICENSE)。
