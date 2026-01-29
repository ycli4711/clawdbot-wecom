import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyUrl, decryptMessage } from '../../wecom/crypto';
import { gatewayClient } from '../../gateway/client';
import { sessionManager } from '../../gateway/session';
import { logger } from '../../utils/logger';
import type { WeComCallbackQuery } from '../../wecom/types';

export async function callbackRoutes(fastify: FastifyInstance): Promise<void> {
  // GET 请求：URL 验证
  fastify.get<{ Querystring: WeComCallbackQuery }>('/wecom/callback', async (request, reply) => {
    const { msg_signature, timestamp, nonce, echostr } = request.query;

    if (!msg_signature || !timestamp || !nonce || !echostr) {
      logger.warn('URL 验证缺少必要参数');
      return reply.status(400).send('缺少必要参数');
    }

    try {
      const decryptedEchostr = verifyUrl(msg_signature, timestamp, nonce, echostr);
      logger.info('URL 验证成功');
      return reply.send(decryptedEchostr);
    } catch (error) {
      logger.error('URL 验证失败', { error: String(error) });
      return reply.status(403).send('验证失败');
    }
  });

  // POST 请求：接收消息
  fastify.post<{ Querystring: WeComCallbackQuery }>('/wecom/callback', async (request, reply) => {
    const { msg_signature, timestamp, nonce } = request.query;

    if (!msg_signature || !timestamp || !nonce) {
      logger.warn('消息接收缺少必要参数');
      return reply.status(400).send('缺少必要参数');
    }

    try {
      const postData = request.body as string;
      const message = decryptMessage(msg_signature, timestamp, nonce, postData);

      logger.info('收到企业微信消息', {
        from: message.FromUserName,
        type: message.MsgType
      });

      // 只处理文本消息
      if (message.MsgType === 'text' && message.Content) {
        sessionManager.getOrCreateSession(message.FromUserName);

        // 发送到 Gateway
        if (gatewayClient.isConnected()) {
          await gatewayClient.sendMessage(message.FromUserName, message.Content);
        } else {
          logger.warn('Gateway 未连接，无法处理消息');
        }
      }

      // 企业微信要求在5秒���返回空字符串或 success
      return reply.send('');
    } catch (error) {
      logger.error('处理消息失败', { error: String(error) });
      return reply.status(500).send('处理失败');
    }
  });
}
