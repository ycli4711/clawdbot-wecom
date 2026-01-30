import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { Message, MessageContent, ContentPart } from '../session/types';
import { Readable } from 'stream';

interface GatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;  // 支持多模态
}

interface GatewayRequest {
  model: string;
  messages: GatewayMessage[];
  stream: boolean;
  user: string;  // 会话标识符，用于 Gateway 维护上下文
}

interface GatewayResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
}

class GatewayClient {
  private client: AxiosInstance;
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.gateway.baseUrl;
    this.model = config.gateway.model;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: config.gateway.timeout,
      headers: {
        'Authorization': `Bearer ${config.gateway.authToken}`,
        'Content-Type': 'application/json',
      },
    });

    logger.info('Gateway HTTP 客户端已初始化', {
      baseUrl: this.baseUrl,
      model: this.model
    });
  }

  /**
   * 发送消息到 Gateway (服务端会话管理模式)
   * @param newMessage 新消息 (支持多模态)
   * @param userId 用户 ID
   * @param chatId 群聊 ID (可选)
   */
  async sendMessageWithContext(
    newMessage: MessageContent,
    userId: string,
    chatId?: string
  ): Promise<string> {
    try {
      // 生成会话标识符 (用于 Gateway 维护会话)
      const sessionId = chatId ? `${userId}_${chatId}` : userId;

      // 构建消息数组 (只包含新消息)
      const messages: GatewayMessage[] = [
        {
          role: 'user' as const,
          content: newMessage,
        },
      ];

      logger.debug('发送消息到 Gateway (服务端会话模式)', {
        sessionId,
        newMessageType: typeof newMessage === 'string' ? 'text' : 'multimodal',
        newMessageParts: Array.isArray(newMessage) ? newMessage.length : undefined,
      });

      const requestBody: GatewayRequest = {
        model: this.model,
        messages,
        user: sessionId,  // Gateway 根据此字段维护会话
        stream: false,
      };

      logger.debug('发送请求详情', {
        url: `${this.baseUrl}/v1/chat/completions`,
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ***',
          'Content-Type': 'application/json',
        },
        bodyPreview: {
          model: this.model,
          user: sessionId,
          messageCount: messages.length,
          stream: false,
        }
      });

      // 打印请求体摘要（避免图片 base64 导致日志过大）
      logger.debug('Gateway请求体摘要', {
        model: requestBody.model,
        user: requestBody.user,
        messageCount: requestBody.messages.length,
        messageTypes: requestBody.messages.map(m =>
          Array.isArray(m.content)
            ? m.content.map(p => p.type).join(',')
            : 'text'
        ),
      });

      // 输出完整请求体（包含完整 base64）
      logger.debug('Gateway完整请求体', {
        requestBody: JSON.stringify(requestBody, null, 2)
      });

      // 写入文件（避免日志被截断）
      const fs = require('fs');
      const debugFilePath = `./debug-gateway-request-${Date.now()}.json`;
      fs.writeFileSync(debugFilePath, JSON.stringify(requestBody, null, 2), 'utf-8');
      logger.info('Gateway 完整请求体已写入文件', { file: debugFilePath });

      const response = await this.client.post<GatewayResponse>(
        '/v1/chat/completions',
        requestBody
      );

      const reply = response.data.choices[0]?.message?.content;

      if (!reply) {
        throw new Error('Gateway 响应格式错误：缺少 content');
      }

      logger.debug('收到 Gateway 响应', {
        replyLength: reply.length,
        model: response.data.model
      });

      return reply;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Gateway API 调用失败', {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL,
          fullUrl: `${error.config?.baseURL}${error.config?.url}`,
          status: error.response?.status,
          statusText: error.response?.statusText,
          message: error.message,
          responseData: error.response?.data,
          responseHeaders: error.response?.headers,
        });
      } else {
        logger.error('Gateway 处理失败', { error: String(error) });
      }
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/health', { timeout: 5000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * 流式发送消息到 Gateway
   * @param newMessage 新消息 (支持多模态)
   * @param userId 用户 ID
   * @param chatId 群聊 ID (可选)
   * @param onChunk 增量内容回调
   * @returns 完整响应内容
   */
  async sendMessageStream(
    newMessage: MessageContent,
    userId: string,
    chatId: string | undefined,
    onChunk: (deltaContent: string, isComplete: boolean) => Promise<void>
  ): Promise<string> {
    const sessionId = chatId ? `${userId}_${chatId}` : userId;

    const messages: GatewayMessage[] = [
      {
        role: 'user' as const,
        content: newMessage,
      },
    ];

    logger.debug('发送流式消息到 Gateway', {
      sessionId,
      newMessageType: typeof newMessage === 'string' ? 'text' : 'multimodal',
    });

    const requestBody: GatewayRequest = {
      model: this.model,
      messages,
      user: sessionId,
      stream: true,
    };

    // 写入文件（流式模式）
    const fs = require('fs');
    const debugFilePath = `./debug-gateway-stream-request-${Date.now()}.json`;
    fs.writeFileSync(debugFilePath, JSON.stringify(requestBody, null, 2), 'utf-8');
    logger.info('Gateway 流式请求体已写入文件', { file: debugFilePath });

    try {
      const response = await axios.post(
        `${this.baseUrl}/v1/chat/completions`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${config.gateway.authToken}`,
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          responseType: 'stream',
          timeout: config.stream.timeout,
        }
      );

      let fullContent = '';

      const stream = response.data as Readable;

      for await (const data of this.parseSSEStream(stream)) {
        if (data === '[DONE]') {
          await onChunk('', true);
          break;
        }

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;

          if (delta) {
            fullContent += delta;
            await onChunk(delta, false);
          }

          // 检查是否完成
          const finishReason = parsed.choices?.[0]?.finish_reason;
          if (finishReason) {
            await onChunk('', true);
            break;
          }
        } catch (parseError) {
          logger.debug('解析 SSE 数据失败', { data, error: String(parseError) });
        }
      }

      logger.debug('流式响应完成', { contentLength: fullContent.length });
      return fullContent;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        logger.error('Gateway 流式 API 调用失败', {
          url: `${this.baseUrl}/v1/chat/completions`,
          status: error.response?.status,
          message: error.message,
        });
      } else {
        logger.error('Gateway 流式处理失败', { error: String(error) });
      }
      throw error;
    }
  }

  private async *parseSSEStream(stream: Readable): AsyncGenerator<string> {
    let buffer = '';

    for await (const chunk of stream) {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6).trim();
          if (data) {
            yield data;
          }
        }
      }
    }

    // 处理剩余的 buffer
    if (buffer.trim().startsWith('data: ')) {
      const data = buffer.trim().slice(6).trim();
      if (data) {
        yield data;
      }
    }
  }
}

export const gatewayClient = new GatewayClient();
