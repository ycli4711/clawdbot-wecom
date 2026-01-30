import { getSignature, decrypt, encrypt } from '@wecom/crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { WeComBotMessage, WeComStreamMessage } from './types';

/**
 * 验证 URL (GET 请求)
 * 智能机器人要求在1秒内响应，返回解密后的 echostr
 */
export function verifyUrl(
  msgSignature: string,
  timestamp: string,
  nonce: string,
  echostr: string
): string {
  try {
    logger.info('URL验证开始', {
      msgSignature,
      timestamp,
      nonce,
      echostr: echostr.substring(0, 20) + '...',
      corpId: config.wecom.corpId,
      token: config.wecom.token.substring(0, 5) + '***',
      encodingAESKeyLength: config.wecom.encodingAESKey.length,
    });

    // 1. 验证签名
    const expectedSignature = getSignature(
      config.wecom.token,
      timestamp,
      nonce,
      echostr
    );

    if (expectedSignature !== msgSignature) {
      logger.error('签名验证失败', {
        expected: expectedSignature,
        received: msgSignature,
      });
      throw new Error('签名验证失败');
    }

    // 2. 解密 echostr
    const { message } = decrypt(config.wecom.encodingAESKey, echostr);

    logger.info('URL验证成功', {
      decryptedLength: message.length,
      decryptedPreview: message.substring(0, 20),
    });

    return message;
  } catch (error) {
    logger.error('URL验证失败', {
      error: String(error),
      errorMessage: error instanceof Error ? error.message : '未知错误',
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * 解密智能机器人的 JSON 消息
 * 格式: {"encrypt": "加密内容"}
 */
export function decryptBotMessage(
  msgSignature: string,
  timestamp: string,
  nonce: string,
  encryptData: string
): WeComBotMessage {
  try {
    logger.debug('开始解密消息', {
      encryptDataLength: encryptData.length,
      encryptDataPreview: encryptData.substring(0, 100),
    });

    // 1. 解析 JSON 获取 encrypt 字段
    const data = JSON.parse(encryptData);
    const encrypted = data.encrypt;

    if (!encrypted) {
      throw new Error('消息格式错误：缺少 encrypt 字段');
    }

    // 2. 验证签名
    const expectedSignature = getSignature(
      config.wecom.token,
      timestamp,
      nonce,
      encrypted
    );

    if (expectedSignature !== msgSignature) {
      logger.error('签名验证失败', {
        expected: expectedSignature,
        received: msgSignature,
      });
      throw new Error('签名验证失败');
    }

    // 3. 解密消息
    const { message } = decrypt(config.wecom.encodingAESKey, encrypted);

    logger.debug('解密后的原始消息', {
      messageLength: message.length,
      messagePreview: message.substring(0, 200),
    });

    // 4. 直接解析 JSON (智能机器人发送的是 JSON 格式,不是 XML)
    const parsed: WeComBotMessage = JSON.parse(message);

    logger.debug('消息解密成功', {
      msgid: parsed.msgid,
      msgtype: parsed.msgtype,
      chattype: parsed.chattype,
      from: parsed.from?.userid,
      hasResponseUrl: !!parsed.response_url,
    });

    return parsed;
  } catch (error) {
    logger.error('消息解密失败', {
      error: String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

/**
 * 加密被动回复消息
 * 用于流式消息被动回复
 */
export function encryptReply(message: WeComStreamMessage): string {
  try {
    const messageJson = JSON.stringify(message);

    logger.debug('加密被动回复消息', {
      msgtype: message.msgtype,
      streamId: message.stream?.id,
      finish: message.stream?.finish,
      contentLength: message.stream?.content?.length,
    });

    // 生成时间戳和随机串
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = Math.random().toString(36).substring(2, 15);

    // 使用企业微信加密库加密
    const encryptedMsg = encrypt(
      config.wecom.encodingAESKey,
      messageJson,
      config.wecom.corpId
    );

    // 计算签名
    const signature = getSignature(config.wecom.token, timestamp, nonce, encryptedMsg);

    // 返回加密后的 JSON 格式
    const response = JSON.stringify({
      encrypt: encryptedMsg,
      msgsignature: signature,
      timestamp,
      nonce,
    });

    logger.debug('被动回复消息加密成功', { responseLength: response.length });

    return response;
  } catch (error) {
    logger.error('被动回复消息加密失败', {
      error: String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}
