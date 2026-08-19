# dsh-plugin-kiro

将本机已认证的 [Kiro CLI](https://kiro.dev/docs/cli/acp/) 作为 DeepSeek Harness（DSH）的 `kiro` LLM provider 使用。插件只使用 Kiro 官方的 Agent Client Protocol（ACP）；不复制企业 SSO 凭据，也不调用未公开的 Kiro HTTP 接口。

> 当前为 0.2.3 版本：已支持文本、多轮 DSH 历史、模型发现、流式输出、推理强度选择和 Web 配置卡；图片、DSH 工具映射与 Kiro 会话复用尚未实现。

## 适用场景

- Kiro 企业用户通过 AWS IAM Identity Center、Okta 或 Microsoft Entra ID 登录 Kiro CLI。
- 管理员已允许 API Key 时，在非交互式机器上使用 `KIRO_API_KEY`。

企业管理员默认可禁止 API Key 生成；该开关和 Kiro 的模型白名单仍由 Kiro Console 管理。插件会调用 `kiro-cli whoami` 和 `kiro-cli chat --list-models --format json`，因此只会展示该用户实际可用的模型。模型目录会在 DSH 进程内缓存 5 分钟，并会合并同时发生的加载请求，避免每次打开选择器都重复启动 Kiro CLI。

## 安装

先安装并认证 Kiro CLI：

```sh
kiro-cli login
kiro-cli whoami --format json
```

然后将插件装入 DSH profile：

```sh
dsh plugin --profile web add github:aurochs-code/dsh-plugin-kiro
```

安装后重启 `dsh web`，在模型选择器中选择 **Kiro (ACP)** 下的模型。

本插件已将运行所需的 JavaScript 文件随 Git 仓库提交，安装不需要为它在 pnpm 的 `allowBuilds` 中增加白名单。

Kiro CLI 2.x 使用 ACP 的 `prompt` 字段；插件已兼容该字段，也会对明确拒绝它的旧版 ACP 服务回退到 `content`。

无浏览器/CI 场景，先让企业管理员允许 API Key，再由安全的密钥管理机制提供环境变量：

```sh
export KIRO_API_KEY='…'
```

不要把密钥放进 DSH 配置、源码或 GitHub Actions workflow 文件。

## 配置

默认配置已可使用：

```yaml
- id: llm-kiro
  name: dsh-plugin-kiro
```

可选项：

```yaml
- id: llm-kiro
  name: dsh-plugin-kiro
  config:
    command: /usr/local/bin/kiro-cli  # 默认 kiro-cli
    cwd: /absolute/path/to/workspace  # 可选；未填写时使用当前 DSH 对话的项目目录
    apiKeyEnv: KIRO_API_KEY           # 只保存变量名，不会读取或保存密钥值
    defaultEffort: high                # 可选：low / medium / high / xhigh / max
    models:                           # CLI 目录故障时的显示兜底
      - { id: auto, name: Auto }
```

`models` 只是在模型发现失败时提供 UI 目录；实际请求仍由 Kiro CLI 和企业模型治理决定。

### Web 配置页

安装 Web profile 后，打开 **设置 → 插件 → 插件配置 → Kiro ACP**。该卡片可修改：

- Kiro CLI 命令、可选的 ACP 工作目录和 API Key 环境变量名；留空时自动使用当前 DSH 对话的项目目录；
- 默认推理强度；
- 已覆盖的字段可单独重置回 profile 配置。

保存后配置会应用到新的请求；对话中手动选择的推理强度优先于默认值。每次 ACP 请求都会以对应的 `kiro-cli acp --effort <level>` 启动。

### Kiro 额度

Kiro CLI 的交互式 `/usage` 会显示用量/订阅入口，但当前公开的 CLI 和 ACP 协议没有提供可由插件稳定读取的“剩余额度”数值。因此配置卡会明确显示这一限制并链接到 [Kiro 的订阅说明](https://kiro.dev/docs/cli/billing/subscription-portal/)；请在 Kiro CLI 中输入 `/usage` 查看实时额度，而不要依赖插件猜测或抓取私有接口。

## 安全与边界

- 插件不保存 Kiro API Key、IAM Identity Center token 或外部 IdP token。
- ACP client 不声明 DSH 的文件系统、终端或 MCP 能力。Kiro 发出的 `ToolCall` / `ToolCallUpdate` 是 ACP 状态通知，插件会等待最终文本；插件不会映射或代为执行 DSH 工具，Kiro 自身工具仍受其 CLI 配置和权限控制。
- 每次 DSH 请求都会创建一个新的 Kiro ACP session，并将 DSH 会话历史作为结构化 JSON 文本传入，避免内容中的角色标签伪装成新的指令。Kiro CLI 自己的会话落盘策略仍由 Kiro 控制。
- 当前仅支持文本输入和文本输出。带图片的请求会明确报 `UNSUPPORTED`，不会静默丢弃。

## 开发与验证

```sh
pnpm install
pnpm check
```

测试使用本地模拟 Kiro CLI，覆盖 ACP 初始化、模型选择、流式响应、ACP 参数兼容、推理强度透传、模型目录缓存/并发合并、DSH 流转换和图片拒绝行为。发布前仍建议使用一个管理员批准的企业测试账户做端到端验证。

## License

[MIT](LICENSE)
