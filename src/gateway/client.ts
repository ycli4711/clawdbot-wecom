import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { Message, MessageContent, ContentPart } from '../session/types';

interface GatewayMessage {
  role: 'user' | 'assistant' | 'system';
  content: MessageContent;  // 支持多模态
}

interface GatewayRequest {
  model: string;
  messages: GatewayMessage[];
  stream: false;
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
   * 发送带上下文的消息到 Gateway
   * @param sessionHistory 会话历史
   * @param newMessage 新消息 (支持多模态)
   */
  async sendMessageWithContext(
    sessionHistory: Message[],
    newMessage: MessageContent
  ): Promise<string> {
    try {
      // 构建完整的消息数组
      const messages: GatewayMessage[] = [
        ...sessionHistory.map(m => ({
          role: m.role,
          content: m.content,
        })),
        {
          role: 'user' as const,
          content: newMessage,
        },
      ];

      logger.debug('发送消息到 Gateway', {
        messageCount: messages.length,
        newMessageType: typeof newMessage === 'string' ? 'text' : 'multimodal',
        newMessageParts: Array.isArray(newMessage) ? newMessage.length : undefined,
      });

      const requestBody: GatewayRequest = {
        model: this.model,
        messages,
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
          messageCount: messages.length,
          stream: false,
        }
      });

      // 打印完整请求体用于调试
      logger.info('Gateway完整请求体', {
        fullRequest: JSON.stringify(requestBody, null, 2)
      });

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
}

export const gatewayClient = new GatewayClient();
