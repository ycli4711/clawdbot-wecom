import Fastify from 'fastify';
import { config } from '../config';
import { logger } from '../utils/logger';
import { callbackRoutes } from './routes/callback';

export async function createServer() {
  const fastify = Fastify({
    logger: false,
  });

  // 智能机器人使用 JSON 格式，需要注册 JSON 解析器
  // 但企业微信可能不设置 Content-Type，所以需要处理纯文本
  fastify.addContentTypeParser('text/plain', { parseAs: 'string' }, (req, body, done) => {
    // 尝试解析为 JSON
    try {
      const parsed = JSON.parse(body as string);
      done(null, parsed);
    } catch {
      // 如果不是 JSON，返回原始字符串
      done(null, body);
    }
  });

  // 注册路由
  await fastify.register(callbackRoutes);

  // 健康检查
  fastify.get('/health', async () => {
    return { status: 'ok' };
  });

  return fastify;
}

export async function startServer() {
  const server = await createServer();

  try {
    await server.listen({ port: config.server.port, host: '0.0.0.0' });
    logger.info(`服务器已启动`, { port: config.server.port });
    return server;
  } catch (error) {
    logger.error('服务器启动失败', { error: String(error) });
    throw error;
  }
}
