import { startServer } from './server/app';
import { gatewayClient } from './gateway/client';
import { sessionManager } from './gateway/session';
import { logger } from './utils/logger';

async function main() {
  logger.info('WeCom Bridge 服务启动中...');

  // 连接 Gateway
  gatewayClient.connect();

  // 启动 HTTP 服务器
  await startServer();

  // 定期清理过期会话
  setInterval(() => {
    sessionManager.cleanExpiredSessions();
  }, 5 * 60 * 1000);

  logger.info('WeCom Bridge 服务已就绪');
}

// 优雅退出
process.on('SIGINT', () => {
  logger.info('收到 SIGINT 信号，正在关闭...');
  gatewayClient.disconnect();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('收到 SIGTERM 信号，正在关闭...');
  gatewayClient.disconnect();
  process.exit(0);
});

main().catch((error) => {
  logger.error('服务启动失败', { error: String(error) });
  process.exit(1);
});
