"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = require("./server/app");
const client_1 = require("./gateway/client");
const session_1 = require("./gateway/session");
const logger_1 = require("./utils/logger");
async function main() {
    logger_1.logger.info('WeCom Bridge 服务启动中...');
    // 连接 Gateway
    client_1.gatewayClient.connect();
    // 启动 HTTP 服务器
    await (0, app_1.startServer)();
    // 定期清理过期会话
    setInterval(() => {
        session_1.sessionManager.cleanExpiredSessions();
    }, 5 * 60 * 1000);
    logger_1.logger.info('WeCom Bridge 服务已就绪');
}
// 优雅退出
process.on('SIGINT', () => {
    logger_1.logger.info('收到 SIGINT 信号，正在关闭...');
    client_1.gatewayClient.disconnect();
    process.exit(0);
});
process.on('SIGTERM', () => {
    logger_1.logger.info('收到 SIGTERM 信号，正在关闭...');
    client_1.gatewayClient.disconnect();
    process.exit(0);
});
main().catch((error) => {
    logger_1.logger.error('服务启动失败', { error: String(error) });
    process.exit(1);
});
//# sourceMappingURL=index.js.map