import { FastifyInstance } from 'fastify';
import { verifyUrl, decryptBotMessage, encryptReply } from '../../wecom/bot-crypto';
import { gatewayClient } from '../../gateway/client';
import { wecomBotClient } from '../../wecom/bot-client';
import { sessionManager } from '../../session';
import { streamSessionManager } from '../../stream';
import { logger } from '../../utils/logger';
import { config } from '../../config';
import { formatMarkdownForWecom } from '../../utils/markdown-formatter';
import type { WeComCallbackQuery, WeComBotMessage, WeComStreamMessage } from '../../wecom/types';
import type { ContentPart } from '../../session/types';
import axios from 'axios';
import crypto from 'crypto';
import { decrypt } from '@wecom/crypto';

/**
 * 解密企业微信加密的图片数据
 * 加密方式: AES-256-CBC
 * IV: EncodingAESKey 的前 16 字节
 * 填充: PKCS#7
 */
function decryptImageData(encryptedData: Buffer, encodingAESKey: string): Buffer {
  try {
    // 1. EncodingAESKey 是 base64 编码 (43字节),需要先 decode 为 32 字节
    // 企业微信的 EncodingAESKey 缺少 base64 padding,需要补上 '='
    const aesKey = Buffer.from(encodingAESKey + '=', 'base64');

    logger.debug('解密参数', {
      encodingAESKeyLength: encodingAESKey,
      aesKeyLength: aesKey.length,
      encryptedDataLength: encryptedData.length,
    });

    // 2. IV 为 AESKey 的前 16 字节
    const iv = aesKey.slice(0, 16);

    // 3. AES-256-CBC 解密
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    decipher.setAutoPadding(true); // 自动处理 PKCS#7 填充

    const decrypted = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final()
    ]);

    // 输出解密后数据的文件头 (用于验证是否为有效图片)
    const fileHeader = decrypted.slice(0, 8).toString('hex').toUpperCase();
    logger.info('图片解密成功', {
      encryptedSize: encryptedData.length,
      decryptedSize: decrypted.length,
      fileHeader, // JPEG: FFD8FF, PNG: 89504E47
    });

    return decrypted;
  } catch (error) {
    logger.error('图片解密失败', {
      error: String(error),
      encryptedDataLength: encryptedData.length,
    });
    throw error;
  }
}

/**
 * 从 URL 下载图片并转换为 base64
 */
async function downloadImageAsBase64(url: string): Promise<string | null> {
  try {
    logger.debug('开始下载图片', { url: url.substring(0, 150) });

    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    // 诊断信息
    logger.info('图片下载响应', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'],
      dataLength: response.data.length,
    });

    // 如果下载的数据太小（< 500 字节），记录诊断信息
    if (response.data.length < 500) {
      const buffer = Buffer.from(response.data);
      const hexContent = buffer.toString('hex');

      logger.warn('下载的数据较小，可能是加密的媒体数据', {
        dataLength: response.data.length,
        hexPreview: hexContent.substring(0, 64),
      });
    }

    // 转换为 Buffer
    const imageBuffer = Buffer.from(response.data);

    // 获取图片类型（优先从响应头，其次从 URL）
    let mimeType = 'image/jpeg'; // 默认
    const contentType = response.headers['content-type'];

    if (contentType && contentType.startsWith('image/')) {
      mimeType = contentType.split(';')[0];
    } else if (url.includes('.png') || url.includes('image/png')) {
      mimeType = 'image/png';
    } else if (url.includes('.jpg') || url.includes('.jpeg')) {
      mimeType = 'image/jpeg';
    } else if (url.includes('.gif')) {
      mimeType = 'image/gif';
    } else if (url.includes('.webp')) {
      mimeType = 'image/webp';
    }

    // 企业微信智能助手：下载的图片数据是加密的，需要解密
    logger.info('尝试解密企业微信图片数据', {
      dataLength: imageBuffer.length,
      hexPreview: imageBuffer.toString('hex').substring(0, 64),
    });

    try {
      // 直接使用 AES-256-CBC 解密（不使用官方库，因为官方库用于消息文本）
      const decryptedBuffer = decryptImageData(imageBuffer, config.wecom.encodingAESKey);

      // 检测图片类型 (根据文件头)
      const fileHeader = decryptedBuffer.slice(0, 4).toString('hex').toUpperCase();
      logger.debug('解密后的图片文件头', { fileHeader });

      if (fileHeader.startsWith('FFD8FF')) {
        mimeType = 'image/jpeg';
      } else if (fileHeader.startsWith('89504E47')) {
        mimeType = 'image/png';
      } else if (fileHeader.startsWith('47494638')) {
        mimeType = 'image/gif';
      } else if (fileHeader.startsWith('52494646')) {
        mimeType = 'image/webp';
      } else {
        logger.warn('解密后的数据不是有效的图片格式', { fileHeader });
        return null;
      }

      // 转换为 base64
      const base64 = decryptedBuffer.toString('base64');
      const dataUrl = `data:${mimeType};base64,${base64}`;

      logger.info('图片解密并转换成功', {
        mimeType,
        originalContentType: contentType,
        encryptedSizeKB: Math.round(imageBuffer.length / 1024),
        decryptedSizeKB: Math.round(decryptedBuffer.length / 1024),
        base64Length: base64.length,
        dataUrlLength: dataUrl.length,
      });

      return dataUrl;
    } catch (decryptError) {
      logger.error('图片解密失败，企业微信智能助手暂不支持图片识别', {
        error: String(decryptError),
        encryptedDataLength: imageBuffer.length,
      });

      // 解密失败，暂不支持图片
      return null;
    }
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
  let hasFailedImage = false;  // 标记是否有图片下载失败

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
      hasFailedImage = true;
      // 添加提示文本
      parts.push({
        type: 'text',
        text: '[收到图片，但暂不支持图片识别，请用文字描述您的问题]',
      });
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
          // 提取文���部分
          if (item.msgtype === 'text' && item.text?.content) {
            parts.push({
              type: 'text',
              text: item.text.content,
            });
          }
          // 提取图片部分 - 下载并转换为 base64
          else if (item.msgtype === 'image' && item.image?.url) {
            logger.info('准备下载图片', {
              urlLength: item.image.url.length,
              urlFull: item.image.url,
            });

            const base64Url = await downloadImageAsBase64(item.image.url);
            if (base64Url) {
              parts.push({
                type: 'image_url',
                image_url: { url: base64Url },
              });
            } else {
              logger.warn('图片下载失败，跳过该图片');
              hasFailedImage = true;
            }
          }
        }
      }
    } catch (error) {
      logger.error('解析 mixed 消息失败', { error: String(error) });
    }
  }

  // 返回结果: 有内容返回数组，无内容返回 null
  // 如果有图片下载失败，在最后添加提示
  if (hasFailedImage && parts.length > 0) {
    // 检查是否已有文本提示
    const hasTextHint = parts.some(p => p.type === 'text' && p.text?.includes('暂不支持图片'));
    if (!hasTextHint) {
      parts.push({
        type: 'text',
        text: '\n\n[注意：包含的图片暂无法识别，如需帮助请用文字描述]',
      });
    }
  }

  return parts.length > 0 ? parts : null;
}

/**
 * 构建流式消息响应
 */
function buildStreamResponse(streamId: string, content: string, finish: boolean): WeComStreamMessage {
  return {
    msgtype: 'stream',
    stream: {
      id: streamId,
      finish,
      content: formatMarkdownForWecom(content),
    },
  };
}

/**
 * 判断是否是流式刷新事件
 * 根据企业微信文档，刷新事件会包含 stream 相关信息
 */
function isStreamRefreshEvent(message: WeComBotMessage): boolean {
  // 检查消息是否包含 stream 字段（刷新事件的特征）
  return (message as any).stream?.id !== undefined;
}

/**
 * 启动 Gateway 流式请求（异步）
 */
function startGatewayStream(
  streamId: string,
  content: ContentPart[],
  userId: string,
  chatId?: string
): void {
  // 异步执行，不阻塞回调响应
  (async () => {
    try {
      logger.info('开始 Gateway 流式请求', { streamId, userId, chatId });

      await gatewayClient.sendMessageStream(
        content,
        userId,
        chatId,
        async (delta, isComplete) => {
          if (isComplete) {
            streamSessionManager.markComplete(streamId);
          } else if (delta) {
            streamSessionManager.appendContent(streamId, delta);
          }
        }
      );

      // 获取完整内容保存到会话历史
      const session = streamSessionManager.getSession(streamId);
      if (session) {
        await sessionManager.addAssistantMessage(userId, session.content, chatId);
        logger.info('Gateway 流式请求完成', { streamId, contentLength: session.content.length });
      }
    } catch (error) {
      logger.error('Gateway 流式请求失败', { streamId, error: String(error) });
      streamSessionManager.markError(streamId, String(error));
    }
  })();
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

      // 打印完整的解密消息（用于调试图片消息）
      logger.info('【完整消息内容】', {
        fullMessage: JSON.stringify(message, null, 2)
      });

      logger.info('收到企业微信消息', {
        msgid: message.msgid,
        msgtype: message.msgtype,
        chattype: message.chattype,
        from: message.from?.userid,
        chatid: message.chatid,
      });

      const userId = message.from?.userid;
      const chatId = message.chatid;

      if (!userId) {
        logger.warn('消息缺少发送者信息');
        return reply.send('');
      }

      // ========== 流式模式处理 ==========
      if (config.stream.enabled) {
        // 检查是否是流式刷新事件
        const existingSession = streamSessionManager.getSessionByUser(userId, chatId);

        if (existingSession && !existingSession.isComplete && isStreamRefreshEvent(message)) {
          // 这是流式刷新事件，返回当前累积内容
          logger.debug('处理流式刷新事件', {
            streamId: existingSession.streamId,
            contentLength: existingSession.content.length,
            isComplete: existingSession.isComplete,
          });

          const streamResponse = buildStreamResponse(
            existingSession.streamId,
            existingSession.content,
            existingSession.isComplete
          );

          // 如果会话已完成，清理会话
          if (existingSession.isComplete) {
            // 延迟清理，确保最后一次响应发送成功
            setTimeout(() => {
              streamSessionManager.removeSession(existingSession.streamId);
            }, 5000);
          }

          const encryptedResponse = encryptReply(streamResponse);
          return reply
            .type('application/json; charset=utf-8')
            .send(encryptedResponse);
        }

        // 检查是否有已完成但未清理的会话需要响应
        if (existingSession && existingSession.isComplete) {
          // 返回最终完成响应
          const streamResponse = buildStreamResponse(
            existingSession.streamId,
            existingSession.content,
            true
          );

          // 清理会话
          setTimeout(() => {
            streamSessionManager.removeSession(existingSession.streamId);
          }, 5000);

          const encryptedResponse = encryptReply(streamResponse);
          return reply
            .type('application/json; charset=utf-8')
            .send(encryptedResponse);
        }

        // 这是新用户消息，开始流式处理
        const multimodalContent = await extractMultimodalContent(message);

        if (multimodalContent) {
          logger.info('开始处理用户消息（被动流式模式）', {
            userId,
            chatId,
            contentParts: multimodalContent.length,
            contentTypes: multimodalContent.map(p => p.type),
          });

          // 1. 添加用户消息到本地历史
          await sessionManager.addUserMessage(userId, multimodalContent, chatId);

          // 2. 创建流式会话
          const streamId = streamSessionManager.createSession(userId, chatId);

          // 3. 异步启动 Gateway 流式请求
          startGatewayStream(streamId, multimodalContent, userId, chatId);

          // 4. 立即返回初始流式响应（空内容，表示开始处理）
          const streamResponse = buildStreamResponse(streamId, '', false);
          const encryptedResponse = encryptReply(streamResponse);

          logger.debug('返回初始流式响应', { streamId });

          return reply
            .type('application/json; charset=utf-8')
            .send(encryptedResponse);
        }
      } else {
        // ========== 非流式模式处理 ==========
        const multimodalContent = await extractMultimodalContent(message);

        if (multimodalContent && message.response_url) {
          logger.info('开始处理用户消息（主动回复模式）', {
            userId,
            chatId,
            contentParts: multimodalContent.length,
          });

          // 立即返回空响应
          reply.send('');

          // 异步处理
          (async () => {
            try {
              await sessionManager.addUserMessage(userId, multimodalContent, chatId);

              const url = new URL(message.response_url);
              const responseCode = url.searchParams.get('response_code');

              if (!responseCode) {
                throw new Error('response_url 中缺少 response_code 参数');
              }

              const aiReply = await gatewayClient.sendMessageWithContext(
                multimodalContent,
                userId,
                chatId
              );

              await sessionManager.addAssistantMessage(userId, aiReply, chatId);
              await wecomBotClient.sendResponse(responseCode, aiReply);

              logger.info('消息处理完成', { userId, chatId });
            } catch (error) {
              logger.error('异步处理消息失败', { userId, chatId, error: String(error) });

              try {
                const url = new URL(message.response_url);
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
      }

      // 返回空响应
      return reply.send('');
    } catch (error) {
      logger.error('处理消息失败', { error: String(error) });
      return reply.status(500).send('处理失败');
    }
  });
}
