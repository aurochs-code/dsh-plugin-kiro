# dsh-plugin-kiro

将本机已认证的 [Kiro CLI](https://kiro.dev/docs/cli/acp/) 作为 DeepSeek Harness（DSH）的 `kiro` LLM provider 使用。插件只使用 Kiro 官方的 Agent Client Protocol（ACP）；不复制企业 SSO 凭据，也不调用未公开的 Kiro HTTP 接口。

> 当前为 0.1 版本：已支持文本、多轮 DSH 历史、模型发现和流式输出；图片、DSH 工具映射与 Kiro 会话复用尚未实现。

## 适用场景

- Kiro 企业用户通过 AWS IAM Identity Center、Okta 或 Microsoft Entra ID 登录 Kiro CLI。
- 管理员已允许 API Key 时，在非交互式机器上使用 `KIRO_API_KEY`。

企业管理员默认可禁止 API Key 生成；该开关和 Kiro 的模型白名单仍由 Kiro Console 管理。插件会调用 `kiro-cli whoami` 和 `kiro-cli chat --list-models --format json`，因此只会展示该用户实际可用的模型。

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
    cwd: /absolute/path/to/workspace  # 默认 DSH 进程当前目录
    apiKeyEnv: KIRO_API_KEY           # 不会读取或保存密钥以外的配置值
    models:                           # CLI 目录故障时的显示兜底
      - { id: auto, name: Auto }
```

`models` 只是在模型发现失败时提供 UI 目录；实际请求仍由 Kiro CLI 和企业模型治理决定。

## 安全与边界

- 插件不保存 Kiro API Key、IAM Identity Center token 或外部 IdP token。
- ACP client 不声明文件系统、终端或 MCP 能力；Kiro 若仍发起工具调用，当前请求会失败，而不会由插件代为执行。
- 每次 DSH 请求都会创建一个新的 Kiro ACP session，并将 DSH 会话历史序列化为一个文本提示。Kiro CLI 自己的会话落盘策略仍由 Kiro 控制。
- 当前仅支持文本输入和文本输出。带图片的请求会明确报 `UNSUPPORTED`，不会静默丢弃。

## 开发与验证

```sh
pnpm install
pnpm check
```

测试使用本地模拟 Kiro CLI，覆盖 ACP 初始化、模型选择、流式响应、ACP 参数兼容、DSH 流转换和图片拒绝行为。发布前仍建议使用一个管理员批准的企业测试账户做端到端验证。

## License

[MIT](LICENSE)
