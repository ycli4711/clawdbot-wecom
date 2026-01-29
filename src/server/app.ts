import Fastify from 'fastify';
import { config } from '../config';
import { logger } from '../utils/logger';
import { callbackRoutes } from './routes/callback';

export async function createServer() {
  const fastify = Fastify({
    logger: false,
  });

  // 注册原始 body 解析器（企业微信发送的是 XML）
  fastify.addContentTypeParser('application/xml', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
  });

  fastify.addContentTypeParser('text/xml', { parseAs: 'string' }, (req, body, done) => {
    done(null, body);
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
