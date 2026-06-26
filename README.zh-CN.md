# AppShelf

English: [README.md](README.md)

AppShelf 是一个 Windows 桌面应用，用于通过可视化库集中管理本地 localhost 项目。

它面向 AI agent 参与的本地开发工作流：当 agent 可以快速生成很多 localhost 项目时，人不应该再为了重新运行项目而记启动命令、翻旧聊天记录、重新打开命令行。

这些项目可以是 web app、个人网站、博客、文档站、仪表盘、游戏、demo 或本地工具。共同点很简单：一个本地命令启动一个可在 localhost URL 打开的项目。

状态：早期预览版，仅支持 Windows。当前仓库以源码公开为主，可以在本地生成 unsigned Windows unpacked build，但还没有签名的公开安装器。

![AppShelf main screen](docs/images/appshelf-main.png)

## 功能

- 从用户指定的目录读取 `.localapp.json`，发现 localhost 项目。
- 在没有 manifest 时手动注册项目。
- 在桌面 GUI 中启动、停止、重启和打开项目。
- 显示项目状态、日志、启动错误、端口、进程 ID 和项目路径。
- 将本地偏好保存在 AppShelf 用户注册表中。
- 支持中文和英文界面。

## 不是什么

AppShelf 不是 IDE、Docker 替代品、PM2 GUI、包管理器、远程部署工具，也不是 agent control plane。

v0 的目标很窄：让本地 localhost 项目更容易找到和启动。

## 适合谁

AppShelf 适合本地保留了很多项目的人，尤其是经常使用 AI agent 生成或维护项目的人。当项目本身已经可以在本地运行，但启动命令、端口或项目路径很容易忘记时，AppShelf 会更有价值。

## 当前限制

- 仅支持 Windows。
- 还没有签名安装器。
- 不负责安装运行环境或修复依赖。
- 不支持 Git 仓库克隆/导入流程。
- 不支持 Docker Compose 或远程部署。
- `.localapp.json` 仍是草案性质的本地约定，不是最终标准。

## 安全模型

`.localapp.json` 包含可执行命令。请把它当作代码看待。

AppShelf 只扫描用户选择的目录。首次运行命令前会询问用户确认；命令发生变化后也会再次询问。AppShelf 不会自动上传日志，不管理密钥，也应该只指向你信任的本地项目。

AppShelf 作为个人/开源工具按现状提供，不提供任何担保。你需要自行审查本地命令，并判断项目是否可以安全运行。

## Local App Manifest

最小 `.localapp.json`：

```json
{
  "name": "My Web App",
  "command": "npm run dev"
}
```

推荐写法：

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

更多信息见 [SPEC.md](SPEC.md) 和 [docs/AGENT_REGISTER_LOCALAPP.md](docs/AGENT_REGISTER_LOCALAPP.md)。

## 开发

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

生成本地 unsigned Windows unpacked build：

```powershell
npm run pack:win
```

输出位于 `release/win-unpacked/AppShelf.exe`。该目录已被 Git 忽略，不是签名的正式发布产物。

## 示例项目

仓库包含 `examples/hello-localapp` 作为有意保留的示例项目。它是一个很小的本地 Node server，带有 `.localapp.json`，可用于测试 AppShelf 的扫描、启动、停止、日志和打开动作，不涉及私人项目。

## 项目文档

- [SPEC.md](SPEC.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/LOCALAPP_MANIFEST_V0.md](docs/LOCALAPP_MANIFEST_V0.md)
- [docs/AGENT_REGISTER_LOCALAPP.md](docs/AGENT_REGISTER_LOCALAPP.md)

## 许可证

MIT. 见 [LICENSE](LICENSE)。
