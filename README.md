# DeepSeek 可用性检测插件（deepseek-availability）

一个用于 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 Cordis 插件，检测 DeepSeek 服务器可用性，并在侧边栏左下方（账号信息上方）显示状态。

## 功能

- 每分钟自动检测一次 DeepSeek 服务器状态。
- 列出每个模型（`deepseek-flash`、`deepseek-v4-pro` 等）的可用状态。
- 提供手动刷新按钮，可随时立即重新检测。
- 状态展示位置：侧边栏左下方、账号信息上方。
- 使用主题 token，自动适配明暗主题；侧边栏收起时只显示状态圆点。

## 工作原理

- **Host 端**（`index.js`）：注册同源路由 `/deepseek-availability`，每次请求时从服务端实际探测 `api.deepseek.com` 与 `chat.deepseek.com`（无浏览器 CORS 限制）；若配置了 `DEEPSEEK_API_KEY`，还会调用 `/models` 拉取真实模型列表，否则回退到内置模型名册。
- **Client 端**（`client.js`）：在 `sidebar.footer.action` 槽位渲染状态卡片，挂载后立即检测，之后每 60 秒轮询一次；点击刷新按钮立即重测。

## 安装

这是一个 `dsh.bundle` 包，可通过 Harness 的插件管理器安装：

```text
plugin_manager → install_bundle → 选择本目录
```

或手动将目录链接进 profile。安装后刷新页面即可看到状态卡片。

## 文件结构

```
deepseek-availability/
├── package.json        # bundle 清单（含 dsh.bundle / dsh.client 声明）
├── cordis.patch.yml    # 插件插入行
├── index.js            # Host 端：探测路由
├── client.js           # Client 端：状态卡片 UI
├── icon.svg            # 插件图标
└── locale/
    ├── en.json         # 英文显示元数据
    └── zh.json         # 中文显示元数据
```

## 说明

- 刷新间隔为 60 秒（`client.js` 中的 `POLL_MS`）。
- 探测超时为 5 秒（`index.js` 中的 `TIMEOUT_MS`）。
- 未配置 API Key 时使用内置模型名册，仍能正确反映服务器可达性。
