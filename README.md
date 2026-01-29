# WeCom Bridge

企业微信智能机器人到 clawdbot 的桥接服务。作为企业微信和本地 clawdbot 服务之间的中间层，实现智能对话功能。

## 功能特性

- **多模态支持**: 支持文本消息、图片消息、图文混合消息
- **多轮对话**: 基于内存的会话管理，支持上下文连续对话
- **群聊支持**: 支持在群聊中 @智能助手 进行对话，会话按用户+群组隔离
- **Markdown 渲染**: AI 回复自动格式化为企业微信支持的 Markdown 格式
- **OpenAI 兼容**: 使用标准的 OpenAI API 格式与 Gateway 通信

## 架构概述

```
┌──────────────────┐      HTTPS/JSON      ┌──────────────────┐      HTTP API       ┌──────────────────┐
│  企业微信服务器   │ ◄─────────────────► │  WeCom Bridge    │ ◄─────────────────► │  AI Gateway      │
│  (腾讯云)        │      回调消息         │  (Node.js)       │   OpenAI 格式       │  (本地/远程)     │
└──────────────────┘                       └──────────────────┘                     └──────────────────┘
                                                    ↕
                                            会话管理 (内存存储)
```

**工作流程**:
1. 用户在企业微信中 @智能助手 发送消息
2. 企业微信发送加密消息到 Bridge 回调接口
3. Bridge 解密消息，维护会话上下文
4. 将消息转发到 AI Gateway 获取回复
5. 通过 `response_code` 机制主动回复用户

## 快速开始

### 环境要求

- Node.js 18+
- 企业微信智能助手（已配置回调）
- AI Gateway 服务（OpenAI 兼容 API）

### 安装

```bash
# 克隆项目
git clone <your-repo-url>
cd clawdbot-wecom

# 安装依赖
npm install
```

### 配置

复制环境变量示例文件并填入实际值：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 企业微信配置
WECOM_CORP_ID=你的企业ID
WECOM_BOT_ID=智能助手ID（客服账号ID）
WECOM_TOKEN=回调Token
WECOM_ENCODING_AES_KEY=EncodingAESKey（43位）

# Gateway 配置
GATEWAY_BASE_URL=http://127.0.0.1:18789
GATEWAY_AUTH_TOKEN=你的Gateway认证Token
GATEWAY_MODEL=claude-3-5-sonnet
GATEWAY_TIMEOUT=30000

# 会话配置
SESSION_MAX_MESSAGES=20
SESSION_EXPIRE_SECONDS=3600

# 服务器配置
SERVER_PORT=3000
LOG_LEVEL=info
```

### 运行

```bash
# 开发模式
npm run dev

# 构建
npm run build

# 生产模式
npm start
```

## 环境变量说明

| 变量名 | 必填 | 默认值 | 说明 |
|--------|------|--------|------|
| `WECOM_CORP_ID` | 是 | - | 企业微信企业 ID |
| `WECOM_BOT_ID` | 是 | - | 智能助手 ID（客服账号 ID） |
| `WECOM_TOKEN` | 是 | - | 回调 Token（用于消息验证） |
| `WECOM_ENCODING_AES_KEY` | 是 | - | EncodingAESKey（43 位，用于消息加解密） |
| `GATEWAY_BASE_URL` | 否 | `http://127.0.0.1:18789` | AI Gateway HTTP API 地址 |
| `GATEWAY_AUTH_TOKEN` | 是 | - | Gateway 认证 Token |
| `GATEWAY_MODEL` | 否 | `claude-3-5-sonnet` | AI 模型名称 |
| `GATEWAY_TIMEOUT` | 否 | `30000` | API 请求超时时间（毫秒） |
| `SESSION_MAX_MESSAGES` | 否 | `20` | 会话保留的最大消息数 |
| `SESSION_EXPIRE_SECONDS` | 否 | `3600` | 会话过期时间（秒） |
| `SERVER_PORT` | 否 | `3000` | HTTP 服务端口 |
| `LOG_LEVEL` | 否 | `info` | 日志级别（debug/info/warn/error） |

## 项目结构

```
clawdbot-wecom/
├── src/
│   ├── index.ts                 # 入口文件
│   ├── config.ts                # 配置管理
│   ├── gateway/
│   │   └── client.ts            # Gateway HTTP 客户端
│   ├── server/
│   │   ├── app.ts               # Fastify 服务器
│   │   └── routes/
│   │       └── callback.ts      # 企业微信回调路由
│   ├── session/
│   │   ├── index.ts             # 会话管理器导出
│   │   ├── manager.ts           # 会话管理逻辑
│   │   ├── memory-storage.ts    # 内存存储实现
│   │   └── types.ts             # 类型定义
│   ├── wecom/
│   │   ├── bot-client.ts        # 企业微信消息发送客户端
│   │   ├── bot-crypto.ts        # 消息加解密
│   │   └── types.ts             # 类型定义
│   └── utils/
│       ├── logger.ts            # 日志工具
│       └── markdown-formatter.ts # Markdown 格式化
├── dist/                        # 编译输出目录
├── docs/
│   └── DEPLOYMENT.md            # 部署文档
├── package.json
├── tsconfig.json
└── .env.example
```

## API 端点

### 健康检查

```
GET /health
```

响应：
```json
{"status": "ok"}
```

### 企业微信回调

```
GET /wecom/callback   # URL 验证（企业微信配置时调用）
POST /wecom/callback  # 接收消息
```

## 消息流程

### 接收消息流程

1. **接收加密消息**: 企业微信发送 JSON 格式加密消息 `{"encrypt": "..."}`
2. **解密验证**: 使用 `@wecom/crypto` 库解密并验证签名
3. **快速响应**: 在 1 秒内返回空响应给企业微信（避免超时重发）
4. **异步处理**:
   - 解析消息内容（支持文本、图片、混合消息）
   - 图片消息自动下载并转换为 base64 格式
   - 添加到会话历史
   - 获取完整会话上下文
   - 调用 Gateway API 获取 AI 回复
   - 保存 AI 回复到会话历史
   - 通过 `response_code` 主动发送回复

### 消息格式支持

| 类型 | 说明 |
|------|------|
| `text` | 纯文本消息 |
| `image` | 图片消息（自动下载转 base64） |
| `mixed` | 图文混合消息 |

## 会话管理

- **会话 ID 生成规则**:
  - 群聊: `{userId}_{chatId}`
  - 单聊: `{userId}`
- **消息限制**: 默认保留最近 20 条消息
- **过期清理**: 超过设定时间（默认 1 小时）未活跃的会话自动清理
- **存储方式**: 内存存储（重启后会话历史丢失）

## 生产部署

### 使用 PM2

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
pm2 start dist/index.js --name wecom-bridge

# 查看状态
pm2 status

# 查看日志
pm2 logs wecom-bridge

# 设置开机自启
pm2 startup
pm2 save
```

### Nginx 反向代理

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

详细部署说明请参考 [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)。

## 企业微信配置

### 1. 获取企业信息

1. 登录 [企业微信管理后台](https://work.weixin.qq.com)
2. 进入「我的企业」获取企业 ID

### 2. 配置智能助手

1. 进入「应用管理」→「智能助手」
2. 获取智能助手 ID（客服账号 ID）

### 3. 配置消息接收

1. 在智能助手设置中找到「接收消息」
2. 配置回调 URL: `https://your-domain.com/wecom/callback`
3. 设置 Token 和 EncodingAESKey（与 `.env` 保持一致）
4. 保存后企业微信会发送验证请求

## 常见问题

### 回调验证失败

- 检查服务是否正常运行
- 确认 Token 和 EncodingAESKey 配置正确
- 确认 HTTPS 证书有效

### 消息无响应

- 检查 Gateway 服务是否可用
- 查看日志确认消息是否正常接收
- 检查 `GATEWAY_AUTH_TOKEN` 配置

### 图片识别失败

- 确认 Gateway 支持多模态 API
- 检查图片下载是否成功（查看日志）

## 技术栈

- **运行时**: Node.js 18+
- **语言**: TypeScript (strict mode)
- **HTTP 框架**: Fastify
- **HTTP 客户端**: Axios
- **加解密**: @wecom/crypto（企业微信官方库）
- **进程管理**: PM2

## 开发

```bash
# 类型检查
npx tsc --noEmit

# 开发模式（支持热重载）
npm run dev

# 构建
npm run build
```

## License

ISC
