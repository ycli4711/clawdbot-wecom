import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';
import { formatMarkdownForWecom } from '../utils/markdown-formatter';
import type { WeComStreamMessage } from './types';

const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

interface MarkdownMessage {
  msgtype: 'markdown';
  markdown: {
    content: string;
  };
}

interface WeComApiResponse {
  errcode: number;
  errmsg: string;
}

class WeComBotClient {
  private httpClient: AxiosInstance;

  constructor() {
    this.httpClient = axios.create({
      baseURL: WECOM_API_BASE,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  }

  /**
   * 智能机器人主动回复消息
   * @param responseCode 从接收到的消息中提取的 response_code
   * @param content 回复内容（支持 markdown 格式）
   */
  async sendResponse(responseCode: string, content: string): Promise<void> {
    // 格式化内容：标准化列表符号等，提高 Markdown 可读性
    const formattedContent = formatMarkdownForWecom(content);

    const message: MarkdownMessage = {
      msgtype: 'markdown',
      markdown: {
        content: formattedContent,
      },
    };

    try {
      logger.debug('发送 markdown 消息', {
        responseCode,
        originalLength: content.length,
        formattedLength: formattedContent.length,
      });

      const response = await this.httpClient.post<WeComApiResponse>(
        '/aibot/response',
        message,
        {
          params: {
            response_code: responseCode,
          },
        }
      );

      if (response.data.errcode !== 0) {
        logger.error('发送消息失败', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg,
        });
        throw new Error(`发送消息失败: ${response.data.errmsg}`);
      }

      logger.info('消息发送成功', { responseCode });
    } catch (error) {
      logger.error('发送消息异常', { error: String(error), responseCode });
      throw error;
    }
  }

  /**
   * 智能机器人流式回复消息
   * @param responseCode 从接收到的消息中提取的 response_code
   * @param streamId 流唯一 ID
   * @param content 累积内容
   * @param finish 是否结束
   */
  async sendStreamResponse(
    responseCode: string,
    streamId: string,
    content: string,
    finish: boolean
  ): Promise<void> {
    // 格式化内容
    const formattedContent = formatMarkdownForWecom(content);

    const message: WeComStreamMessage = {
      msgtype: 'stream',
      stream: {
        id: streamId,
        finish,
        content: formattedContent,
      },
    };

    try {
      logger.debug('发送流式消息', {
        responseCode,
        streamId,
        contentLength: formattedContent.length,
        finish,
      });

      const response = await this.httpClient.post<WeComApiResponse>(
        '/aibot/response',
        message,
        {
          params: {
            response_code: responseCode,
          },
        }
      );

      if (response.data.errcode !== 0) {
        logger.error('发送流式消息失败', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg,
        });
        throw new Error(`发送流式消息失败: ${response.data.errmsg}`);
      }

      logger.debug('流式消息发送成功', { responseCode, streamId, finish });
    } catch (error) {
      logger.error('发送流式消息异常', { error: String(error), responseCode, streamId });
      throw error;
    }
  }
}

export const wecomBotClient = new WeComBotClient();
