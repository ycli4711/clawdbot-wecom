import { FastifyInstance } from 'fastify';
import { verifyUrl, decryptBotMessage } from '../../wecom/bot-crypto';
import { gatewayClient } from '../../gateway/client';
import { wecomBotClient } from '../../wecom/bot-client';
import { sessionManager } from '../../session';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { StreamProcessor } from '../../stream';
import type { WeComCallbackQuery, WeComBotMessage } from '../../wecom/types';
import type { ContentPart } from '../../session/types';
import axios from 'axios';

/**
 * 从 URL 下载图片并转换为 base64
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    logger.debug('开始下载图片', { url: url.substring(0, 100) });

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // 获取图片类型
    let mimeType = 'image/jpeg'; // 默认

    // 优先从 URL 推断类型
    if (url.includes('.png') || url.includes('image/png')) {
      mimeType = 'image/png';
    } else if (url.includes('.jpg') || url.includes('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (url.includes('.gif')) {
      mimeType = 'image/gif';
    } else if (url.includes('.webp')) {
      mimeType = 'image/webp';
    }

    // 如果响应头有有效的图片类型，则使用响应头的
    const contentType = response.headers['content-type'];
    if (contentType && contentType.startsWith('image/')) {
      mimeType = contentType.split(';')[0];
    }

    // 转换为 base64
    const base64 = Buffer.from(response.data, 'binary').toString('base64');
    const dataUrl = `data:${mimeType};base64,${base64}`;

    logger.info('图片下载并转换成功', {
      mimeType,
      contentType,
      sizeKB: Math.round(response.data.length / 1024),
      base64Length: base64.length,
      dataUrlPrefix: dataUrl.substring(0, 50),
    });

    return dataUrl;
  } catch (error) {
    logger.error('下载图片失败', {
      url: url.substring(0, 100),
      error: String(error),
    });
    return null;
  }
}

/**
 * 提取多模态内容（图片转base64格式）
 * 返回 null 表示无有效内容
 */
async function extractMultimodalContent(message: WeComBotMessage): Promise<ContentPart[] | null> {
  const parts: ContentPart[] = [];

  // 场景1: 纯文本消息
  if (message.msgtype === 'text' && message.text?.content) {
    parts.push({
      type: 'text',
      text: message.text.content,
    });
  }

  // 场景2: 纯图片消息 - 下载并转换为 base64
  else if (message.msgtype === 'image' && message.image?.url) {
    const base64Url = await downloadImageAsBase64(message.image.url);
    if (base64Url) {
      parts.push({
        type: 'image_url',
        image_url: { url: base64Url },
      });
    } else {
      logger.warn('图片下载失败，跳过该图片');
    }
  }

  // 场景3: 图文混合消息
  else if (message.msgtype === 'mixed' && message.mixed) {
    try {
      const mixedData = typeof message.mixed === 'string'
        ? JSON.parse(message.mixed)
        : message.mixed;

      if (mixedData.msg_item && Array.isArray(mixedData.msg_item)) {
        for (const item of mixedData.msg_item) {
          // 提取文本部分
          if (item.msgtype === 'text' && item.text?.content) {
            parts.push({
              type: 'text',
              text: item.text.content,
            });
          }
          // 提取图片部分 - 下载并转换为 base64
          else if (item.msgtype === 'image' && item.image?.url) {
            const base64Url = await downloadImageAsBase64(item.image.url);
            if (base64Url) {
              parts.push({
                type: 'image_url',
                image_url: { url: base64Url },
              });
            } else {
              logger.warn('图片下载失败，跳过该图片');
            }
          }
        }
      }
    } catch (error) {
      logger.error('解析 mixed 消息失败', { error: String(error) });
    }
  }

  // 返回结果: 有内容返回数组，无内容返回 null
  return parts.length > 0 ? parts : null;
}

function extractTextContent(message: WeComBotMessage): string | null {
  if (message.msgtype === 'text' && message.text?.content) {
    return message.text.content;
  }

  if (message.msgtype === 'mixed' && message.mixed) {
    try {
      // mixed 可能是 JSON 字符串,需要先解析
      const mixedData = typeof message.mixed === 'string'
        ? JSON.parse(message.mixed)
        : message.mixed;

      if (mixedData.msg_item && Array.isArray(mixedData.msg_item)) {
        const textParts = mixedData.msg_item
          .filter((item: any) => item.msgtype === 'text' && item.text?.content)
          .map((item: any) => item.text.content);

        if (textParts.length > 0) {
          return textParts.join('\n');
        }
      }
    } catch (error) {
      logger.error('解析 mixed 消息失败', { error: String(error) });
    }
  }

  return null;
}

export async function callbackRoutes(fastify: FastifyInstance): Promise<void> {
  // GET 请求：URL 验证
  fastify.get<{ Querystring: WeComCallbackQuery }>('/wecom/callback', async (request, reply) => {
    logger.info('收到URL验证请求', {
      fullUrl: request.url,
      query: request.query,
      headers: {
        'user-agent': request.headers['user-agent'],
        'content-type': request.headers['content-type'],
      },
    });

    const { msg_signature, timestamp, nonce, echostr } = request.query;

    if (!msg_signature || !timestamp || !nonce || !echostr) {
      logger.warn('URL 验证缺少必要参数', { query: request.query });
      return reply.status(400).send('缺少必要参数');
    }

    try {
      const decryptedEchostr = verifyUrl(msg_signature, timestamp, nonce, echostr);
      logger.info('URL 验证成功');

      logger.info('返回解密后的echostr', {
        length: decryptedEchostr.length,
        preview: decryptedEchostr.substring(0, 20),
      });

      // 智能机器人要求：响应内容不能加引号，不能带bom头，不能带换行符
      return reply
        .type('text/plain; charset=utf-8')
        .send(decryptedEchostr);
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
      // 智能机器人发送的是 JSON 格式: {"encrypt": "加密内容"}
      const body = request.body as any;
      const encryptData = typeof body === 'string' ? body : JSON.stringify(body);

      logger.debug('收到加密消息', { bodyType: typeof body });

      const message = decryptBotMessage(msg_signature, timestamp, nonce, encryptData);

      logger.info('收到企业微信消息', {
        msgid: message.msgid,
        msgtype: message.msgtype,
        chattype: message.chattype,
        from: message.from?.userid,
        chatid: message.chatid,
      });

      // 打印完整消息结构用于调试
      if (message.msgtype === 'mixed') {
        logger.info('Mixed消息完整结构', {
          mixed: JSON.stringify(message.mixed, null, 2)
        });
      }

      // 打印所有消息的完整结构
      logger.info('完整消息结构', {
        msgtype: message.msgtype,
        fullMessage: JSON.stringify(message, null, 2)
      });

      // 提取多模态内容（异步，因为需要下载图片）
      const multimodalContent = await extractMultimodalContent(message);

      logger.debug('extractMultimodalContent结果', {
        msgtype: message.msgtype,
        contentParts: multimodalContent?.length,
        contentTypes: multimodalContent?.map(p => p.type),
        hasResponseUrl: !!message.response_url
      });

      if (multimodalContent && message.response_url) {
        const userId = message.from.userid;
        const chatId = message.chatid;
        const responseUrl = message.response_url;

        logger.info('提取到消息内容', {
          msgtype: message.msgtype,
          contentParts: multimodalContent.length,
          contentTypes: multimodalContent.map(p => p.type),
        });

        // 智能机器人要求在1秒内响应，所以立即返回空包
        reply.send('');

        // 异步处理 AI 响应
        (async () => {
          try {
            logger.info('开始处理用户消息', {
              userId,
              chatId,
              contentParts: multimodalContent.length,
              contentTypes: multimodalContent.map(p => p.type),
            });

            // 1. 添加用户消息到本地历史（供后续功能使用）
            await sessionManager.addUserMessage(userId, multimodalContent, chatId);

            // 2. 从 response_url 中提取 response_code 参数
            const url = new URL(responseUrl);
            const responseCode = url.searchParams.get('response_code');

            if (!responseCode) {
              throw new Error('response_url 中缺少 response_code 参数');
            }

            if (config.stream.enabled) {
              // 流式模式
              logger.info('使用流式模式处理消息', { userId, chatId });

              const processor = new StreamProcessor({
                responseCode,
                config: {
                  minChunkSize: config.stream.minChunkSize,
                  maxChunkSize: config.stream.maxChunkSize,
                  sendInterval: config.stream.sendInterval,
                  maxContentLength: 20480,
                },
                onSend: async (streamId, content, finish) => {
                  await wecomBotClient.sendStreamResponse(responseCode, streamId, content, finish);
                },
                onError: async (error) => {
                  logger.error('流式发送失败', { error: String(error) });
                },
              });

              const fullContent = await gatewayClient.sendMessageStream(
                multimodalContent,
                userId,
                chatId,
                async (delta, isComplete) => {
                  if (isComplete) {
                    await processor.finish();
                  } else {
                    await processor.handleDelta(delta);
                  }
                }
              );

              // 3. 添加 AI 回复到本地历史
              await sessionManager.addAssistantMessage(userId, fullContent, chatId);

            } else {
              // 非流式模式 (保留现有逻辑作为回退)
              logger.info('使用非流式模式处理消息', { userId, chatId });

              const aiReply = await gatewayClient.sendMessageWithContext(
                multimodalContent,
                userId,
                chatId
              );

              // 3. 添加 AI 回复到本地历史
              await sessionManager.addAssistantMessage(userId, aiReply, chatId);

              // 4. 使用 response_code 发送回复
              await wecomBotClient.sendResponse(responseCode, aiReply);
            }

            logger.info('消息处理完成', { userId, chatId });
          } catch (error) {
            logger.error('异步处理消息失败', { userId, chatId, error: String(error) });

            // 发送错误提示
            try {
              const url = new URL(responseUrl);
              const responseCode = url.searchParams.get('response_code');
              if (responseCode) {
                await wecomBotClient.sendResponse(responseCode, '抱歉，服务暂时不可用，请稍后再试。');
              }
            } catch (sendError) {
              logger.error('发送错误提示失败', { error: String(sendError) });
            }
          }
        })();

        return;
      }

      // 返回空响应
      return reply.send('');
    } catch (error) {
      logger.error('处理消息失败', { error: String(error) });
      return reply.status(500).send('处理失败');
    }
  });
}
