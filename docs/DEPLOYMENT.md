# WeCom Bridge 部署文档

本文档介绍如何将 WeCom Bridge 服务部署到生产环境。

## 目录

- [架构概述](#架构概述)
- [环境要求](#环境要求)
- [本地开发](#本地开发)
- [公网服务器部署](#公网服务器部署)
- [企业微信配置](#企业微信配置)
- [验证与测试](#验证与测试)
- [常见问题](#常见问题)

---

## 架构概述

```
+------------------+      HTTPS      +----------------------+      WebSocket      +------------------+
|   企业微信服务器   | <-------------> |  WeCom Bridge 服务   | <----------------> |  Moltbot Gateway |
|  (腾讯云)         |    回调/API     |  (公网服务器)         |   ws://127.0.0.1   |  (本地 Windows)  |
+------------------+                 +----------------------+       :18789       +------------------+
```

**反向连接模式**：本地 Moltbot 无需暴露端口，由 Bridge 主动连接。

---

## 环境要求

### 公网服务器
- Linux 服务器（推荐 Ubuntu 20.04+）
- Node.js 18+
- 已备案域名（中国大陆服务器）
- HTTPS 证书

### 本地环境
- Moltbot 已安装并运行
- Gateway 监听在 `ws://127.0.0.1:18789`

---

## 本地开发

### 1. 安装依赖

```bash
cd E:\clawdbot-qw
npm install
```

### 2. 配置环境变量

复制示例配置文件：

```bash
copy .env.example .env
```

编辑 `.env` 文件，填入实际值：

```env
WECOM_CORP_ID=你的企业ID
WECOM_APP_SECRET=应用Secret
WECOM_AGENT_ID=应用AgentId
WECOM_TOKEN=回调Token
WECOM_ENCODING_AES_KEY=EncodingAESKey

GATEWAY_WS_URL=ws://127.0.0.1:18789
SERVER_PORT=3000
LOG_LEVEL=debug
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 本地调试（可选）

使用 ngrok 或 frp 将本地服务暴露到公网进行调试：

```bash
ngrok http 3000
```

---

## 公网服务器部署

### 1. 上传代码

```bash
# 在本地打包
npm run build

# 使用 scp 或其他工具上传
scp -r dist package.json package-lock.json .env user@server:/opt/wecom-bridge/
```

或使用 Git：

```bash
# 在服务器上
cd /opt
git clone <your-repo-url> wecom-bridge
cd wecom-bridge
```

### 2. 安装依赖

```bash
cd /opt/wecom-bridge
npm install --production
```

### 3. 配置环境变量

```bash
cp .env.example .env
nano .env  # 编辑配置
```

**生产环境配置示例**：

```env
WECOM_CORP_ID=ww1234567890abcdef
WECOM_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
WECOM_AGENT_ID=1000002
WECOM_TOKEN=your_callback_token
WECOM_ENCODING_AES_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

GATEWAY_WS_URL=ws://127.0.0.1:18789
SERVER_PORT=3000
LOG_LEVEL=info
```

### 4. 配置 Nginx 反向代理

安装 Nginx：

```bash
sudo apt update
sudo apt install nginx
```

创建站点配置 `/etc/nginx/sites-available/wecom-bridge`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # HTTP 重定向到 HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 代理到 Node.js 服务
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/wecom-bridge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 配置 SSL 证书

使用 Let's Encrypt 免费证书：

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

证书会自动续期。

### 6. 使用 PM2 管理进程

安装 PM2：

```bash
sudo npm install -g pm2
```

启动服务：

```bash
cd /opt/wecom-bridge
pm2 start dist/index.js --name wecom-bridge
```

配置开机自启：

```bash
pm2 startup
pm2 save
```

**PM2 常用命令**：

```bash
pm2 status              # 查看状态
pm2 logs wecom-bridge   # 查看日志
pm2 restart wecom-bridge # 重启服务
pm2 stop wecom-bridge   # 停止服务
```

### 7. 配置防火墙

```bash
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## 企业微信配置

### 1. 获取企业信息

1. 登录 [企业微信管理后台](https://work.weixin.qq.com)
2. 进入「我的企业」页面
3. 记录 **企业 ID (CorpId)**

### 2. 配置应用

1. 进入「应用管理」→ 选择你的应用
2. 记录 **AgentId** 和 **Secret**

### 3. 配置接收消息

1. 在应用详情页，找到「接收消息」设置
2. 点击「设置API接收」
3. 填写配置：

| 配置项 | 值 |
|--------|-----|
| URL | `https://your-domain.com/wecom/callback` |
| Token | 自定义 3-32 位字母数字（与 .env 中一致） |
| EncodingAESKey | 点击随机生成（43位，与 .env 中一致） |

4. 点击保存，企业微信会发送验证请求

### 4. 配置可信 IP

1. 在应用详情页，找到「企业可信IP」
2. 添加公网服务器的 IP 地址

---

## 验证与测试

### 1. 健康检查

```bash
curl https://your-domain.com/health
# 应返回: {"status":"ok"}
```

### 2. 回调验证

在企业微信后台保存回调配置时，会自动验证 URL。如果验证失败，检查：

```bash
# 查看服务日志
pm2 logs wecom-bridge --lines 50
```

### 3. 消息测试

1. 在企业微信中找到应用
2. 发送测试消息
3. 检查日志确认消息流转：

```bash
pm2 logs wecom-bridge
```

预期日志：
```
[INFO] 收到企业微信消息 {"from":"UserName","type":"text"}
[INFO] 消息已发送到 Gateway {"userId":"UserName"}
```

---

## 常见问题

### Q: 回调验证失败

**可能原因**：
1. 服务未启动或端口不通
2. HTTPS 证书无效
3. Token 或 EncodingAESKey 配置不匹配

**排查步骤**：
```bash
# 检查服务状态
pm2 status

# 检查端口监听
netstat -tlnp | grep 3000

# 测试 HTTPS
curl -I https://your-domain.com/health

# 查看详细日志
pm2 logs wecom-bridge --lines 100
```

### Q: 消息发送失败，提示 IP 不在白名单

**解决方案**：
1. 登录企业微信管理后台
2. 进入应用设置 → 企业可信IP
3. 添加服务器公网 IP

### Q: access_token 获取失败

**可能原因**：
1. CorpId 或 Secret 配置错误
2. 网络问题（服务器无法访问企业微信 API）

**排查**：
```bash
# 测试网络连通性
curl https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=YOUR_CORPID&corpsecret=YOUR_SECRET
```

### Q: Gateway 连接失败

**可能原因**：
1. Moltbot Gateway 未启动
2. WebSocket 地址配置错误
3. 防火墙阻止连接

**解决方案**：
1. 确认 Moltbot 正在运行
2. 检查 `GATEWAY_WS_URL` 配置
3. 如果 Bridge 和 Gateway 不在同一台机器，需要配置内网穿透

---

## 日志说明

| 日志级别 | 说明 |
|----------|------|
| DEBUG | 详细调试信息（生产环境建议关闭） |
| INFO | 正常运行信息 |
| WARN | 警告信息 |
| ERROR | 错误信息 |

修改日志级别：

```env
LOG_LEVEL=info  # 可选: debug, info, warn, error
```

---

## 安全建议

1. **不要将 .env 文件提交到版本控制**
2. **定期轮换 Token 和 EncodingAESKey**
3. **启用防火墙，只开放必要端口**
4. **定期更新依赖包修复安全漏洞**
5. **使用强密码保护服务器**

```bash
# 检查依赖漏洞
npm audit

# 更新依赖
npm update
```

---

## 维护命令速查

```bash
# 查看服务状态
pm2 status

# 重启服务
pm2 restart wecom-bridge

# 查看实时日志
pm2 logs wecom-bridge

# 更新代码后重新部署
git pull
npm install --production
npm run build
pm2 restart wecom-bridge

# 查看 Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
