# dsh-plugin-kiro

将本机已认证的 [Kiro CLI](https://kiro.dev/docs/cli/acp/) 作为 DeepSeek Harness（DSH）的 `kiro` LLM provider 使用。插件只使用 Kiro 官方的 Agent Client Protocol（ACP）；不复制企业 SSO 凭据，也不调用未公开的 Kiro HTTP 接口。

> 当前为 0.3.0 版本：已支持文本、多轮 DSH 历史、模型发现、流式输出、推理强度选择、Web 配置卡、ACP 会话复用，以及由 DSH 执行与授权的文件和终端调用。

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

保存后配置会应用到新的请求；对话中手动选择的推理强度优先于默认值。一个 DSH 对话会复用对应的 `kiro-cli acp --effort <level>` 进程和 Kiro ACP session，配置、工作目录、推理强度变更或会话故障时会重新创建。

### Kiro 额度

Kiro CLI 的交互式 `/usage` 会显示用量/订阅入口，但当前公开的 CLI 和 ACP 协议没有提供可由插件稳定读取的“剩余额度”数值。因此配置卡会明确显示这一限制并链接到 [Kiro 的订阅说明](https://kiro.dev/docs/cli/billing/subscription-portal/)；请在 Kiro CLI 中输入 `/usage` 查看实时额度，而不要依赖插件猜测或抓取私有接口。

## 安全与边界

- 插件不保存 Kiro API Key、IAM Identity Center token 或外部 IdP token。
- 对一个活动 DSH 对话，ACP client 会声明标准的文件读取、文件写入和终端能力；它们分别只会调用 DSH 的 `read`、`write`、`bash` 工具运行时，并携带原 DSH agent 与取消信号。因此审批、沙箱、文件观察策略与审计仍以 DSH 的权限策略为准，而不是由 Kiro CLI 绕过执行。
- Kiro 以 `session/request_permission` 发出的通用内部权限请求会被拒绝；这类批准不能可靠地拦住其后的 CLI 操作。终端环境变量覆盖也会被拒绝。两者均为失败关闭，避免出现“看似经 DSH 批准、实际绕过 DSH”的路径。
- 同一个 DSH session 会复用本地 ACP 子进程与 Kiro ACP session，并只传递自上一轮以来新增的结构化历史，避免每轮重启、初始化和完整历史重放。空闲 30 分钟、配置变更、工作目录/推理强度变更或传输错误会清理该 session；历史不连续时会安全地用完整历史重新创建。
- Kiro 的 `ToolCall` / `ToolCallUpdate` 仍是状态通知；真正需要客户端执行的 ACP 文件/终端请求才会进入上述 DSH 工具通道。DSH 的其他工具和 MCP 不会被自动暴露给 Kiro。
- 当前仅支持文本输入和文本输出。带图片的请求会明确报 `UNSUPPORTED`，不会静默丢弃。

## 开发与验证

```sh
pnpm install
pnpm check
```

测试使用本地模拟 Kiro CLI，覆盖 ACP 初始化、模型选择、流式响应、ACP 参数兼容、文件回调、会话复用、DSH 工具授权桥、推理强度透传、模型目录缓存/并发合并、DSH 流转换和图片拒绝行为。发布前仍建议使用一个管理员批准的企业测试账户做端到端验证。

## License

[MIT](LICENSE)
