# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

WeCom Bridge 是一个企业微信智能机器人到 Moltbot Gateway 的桥接服务,作为企业微信智能机器人和本地 Moltbot 之间的中间层。

**架构模式**:
- 接收消息: JSON 加密格式
- 发送消息: 使用 response_code 主动回复
- Gateway 通信: HTTP API (OpenAI 兼容格式)
- 会话管理: 内存存储,支持多轮对话

```
企业微信智能机器人 <--(HTTPS JSON)--> WeCom Bridge <--(HTTP API)--> Moltbot Gateway
                                           ↕
                                    会话管理 (内存存储)
```

## 开发命令

### 构建与运行
```bash
# 安装依赖
npm install

# 开发模式 (使用 ts-node 直接运行 TypeScript)
npm run dev

# 构建 (编译 TypeScript 到 dist/)
npm run build

# 检查 TypeScript 类型错误 (不生成文件)
npx tsc --noEmit

# 生产模式 (运行已编译的 JavaScript)
npm start

# 生产环境部署 (使用 PM2)
pm2 start dist/index.js --name wecom-bridge
pm2 logs wecom-bridge
pm2 restart wecom-bridge
```

### 环境配置
复制 `.env.example` 为 `.env` 并填入实际值:
```bash
cp .env.example .env
```

必需的环境变量:
- `WECOM_CORP_ID`: 企业 ID
- `WECOM_BOT_ID`: 智能助手 ID (客服账号 ID)
- `WECOM_TOKEN`: 回调 Token (用于消息解密验证)
- `WECOM_ENCODING_AES_KEY`: EncodingAESKey (用于消息加解密)
- `GATEWAY_BASE_URL`: Moltbot Gateway HTTP API 地址 (默认: http://127.0.0.1:18789)
- `GATEWAY_AUTH_TOKEN`: Gateway 认证 Token
- `GATEWAY_MODEL`: AI 模型名称 (默认: claude-3-5-sonnet)
- `GATEWAY_TIMEOUT`: API 请求超时时间(毫秒) (默认: 30000)
- `SESSION_MAX_MESSAGES`: 会话保留的最大消息数 (默认: 20)
- `SESSION_EXPIRE_SECONDS`: 会话过期时间(秒) (默认: 3600)
- `SERVER_PORT`: HTTP 服务端口 (默认: 3000)
- `LOG_LEVEL`: 日志级别 (debug/info/warn/error)

## 核心架构

### 主要模块

**1. Session 模块** (`src/session/`)
- `types.ts`: 会话相关类型定义
  - `Message`: 单条消息 (role, content, timestamp)
  - `Session`: 会话对象 (userId, chatId, messages, 时间戳)
  - `SessionStorage`: 存储接口
- `memory-storage.ts`: 内存存储实现
  - 使用 Map 存储会话数据
  - 支持过期清理
- `manager.ts`: 会话管理器
  - 创建/获取会话
  - 添加用户消息和助手回复
  - 限制消息数量 (保留最近 N 条)
  - 定期清理过期会话
- `index.ts`: 导出全局会话管理器实例

**2. Gateway 模块** (`src/gateway/`)
- `client.ts`: HTTP API 客户端,负责与 Moltbot Gateway 通信
  - 使用 OpenAI 兼容的 `/v1/chat/completions` 端点
  - `sendMessageWithContext()`: 发送带上下文的消息
  - 请求格式: `{model: string, messages: [{role, content}], stream: false}`
  - 响应格式: `{choices: [{message: {content}}]}`
  - 同步等待 AI 响应 (默认 30 秒超时)
  - 自动添加 Authorization Bearer Token

**3. WeCom 模块** (`src/wecom/`)
- `bot-client.ts`: 企业微信智能机器人客户端
  - `sendResponse()`: 使用 response_code 主动发送回复
  - 支持 markdown 格式消息
- `bot-crypto.ts`: 智能机器人消息加解密
  - `verifyUrl()`: URL 验证 (GET 请求)
  - `decryptBotMessage()`: 解密 JSON 格式消息
  - `encryptBotReply()`: 加密回复消息 (被动回复)
- `types.ts`: TypeScript 类型定义
  - `WeComMessage`: 包含 ResponseCode (用于主动回复)
  - `WeComCallbackQuery`: 回调查询参数

**4. Server 模块** (`src/server/`)
- `app.ts`: Fastify HTTP 服务器
  - 自定义 XML 解析器 (企业微信发送 XML 格式消息)
  - 健康检查端点: `GET /health`
- `routes/callback.ts`: 企业微信回调处理
  - `GET /wecom/callback`: URL 验证 (企业微信配置时调用)
  - `POST /wecom/callback`: 接收消息 (必须在 5 秒内响应)
  - 集成会话管理器

### 消息流转

**完整消息流程** (带会话上下文):
1. 用户在企业微信中 @智能助手 发送消息
2. 企业微信发送加密的 XML 消息到 `POST /wecom/callback`
3. `crypto.decryptMessage()` 解密并解析为 JSON 对象
4. 仅处理 `MsgType === 'text'` 的消息
5. 立即返回空字符串给企业微信 (避免 5 秒超时)
6. 异步处理流程:
   a. `sessionManager.addUserMessage()` 添加用户消息到会话历史
   b. `sessionManager.getSessionHistory()` 获取完整会话上下文
   c. `gatewayClient.sendMessageWithContext()` 发送上下文+新消息到 Gateway
   d. 等待 AI 生成回复 (最多 30 秒)
   e. `sessionManager.addAssistantMessage()` 添加 AI 回复到会话历史
   f. `wecomBotClient.sendMessage()` 发送回复到企业微信
7. 如果失败,发送错误提示给用户

**会话管理**:
- 会话ID生成: `userId_chatId` (群聊) 或 `userId` (单聊)
- 自动限制消息数量: 保留最近 N 条 (默认 20 条)
- 自动过期清理: 超过指定时间未活跃的会话会被清理 (默认 1 小时)

### 错误处理

- HTTP 请求超时会抛出异常并记录详细日志
- Gateway API 错误会记录状态码和响应数据
- access_token 获取失败会抛出异常并记录日志
- 消息解密失败返回 403 状态码
- 所有异常都通过 `logger` 记录,包含完整上下文

### 日志系统

使用自定义日志实现 (`src/utils/logger.ts`),支持结构化日志:
```typescript
logger.info('消息描述', { contextData });
logger.error('错误描述', { error: String(error) });
```

日志级别通过环境变量 `LOG_LEVEL` 控制 (debug/info/warn/error)。

## 技术栈约定

- **运行时**: Node.js 18+
- **语言**: TypeScript (strict 模式)
- **HTTP 框架**: Fastify (高性能)
- **HTTP 客户端**: axios
- **XML 解析**: fast-xml-parser
- **加解密**: @wecom/crypto (企业微信官方库)
- **日志**: 自定义日志实现
- **进程管理**: PM2 (生产环境)

## TypeScript 配置

- **编译目标**: ES2020
- **模块系统**: CommonJS
- **严格模式**: 启用 (strict: true)
- **源码目录**: `src/`
- **输出目录**: `dist/`
- **生成 source map 和类型声明文件**

## 部署说明

详见 `docs/DEPLOYMENT.md`,包含完整的生产环境部署流程:
- 公网服务器配置 (Linux + Node.js + Nginx + SSL)
- PM2 进程管理和开机自启
- 企业微信后台配置步骤
- 常见问题排查指南

## 关键注意事项

1. **应用类型**: 使用企业微信智能助手,而非自建应用
2. **消息解密依赖**: 企业微信的 Token 和 EncodingAESKey 必须与后台配置严格一致
3. **响应时间限制**: 企业微信回调要求 5 秒内响应,因此采用异步处理模式
4. **会话管理**: 基于内存的会话存储,重启服务会丢失历史对话
5. **上下文限制**: 默认保留最近 20 条消息,过长的对话会自动截断
6. **Gateway API 超时**: 默认 30 秒超时,可通过 GATEWAY_TIMEOUT 配置
7. **单例模式**: `gatewayClient`, `wecomBotClient`, `sessionManager` 都是单例,导入时直接使用
8. **群聊支持**: 支持在群聊中 @智能助手进行对话,会话按 userId+chatId 隔离
