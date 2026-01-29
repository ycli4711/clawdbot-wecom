import WebSocket from 'ws';
import { config } from '../config';
import { logger } from '../utils/logger';
import { wecomClient } from '../wecom/client';

type MessageHandler = (userId: string, content: string) => void;

class GatewayClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private pendingRequests: Map<string, { userId: string; resolve: () => void }> = new Map();
  private onMessageCallback: MessageHandler | null = null;

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    logger.info('正在连接 Gateway', { url: config.gateway.wsUrl });

    this.ws = new WebSocket(config.gateway.wsUrl);

    this.ws.on('open', () => {
      logger.info('Gateway 连接成功，发送握手消息');

      // 发送握手消息
      const connectMsg = {
        type: 'req',
        id: this.generateRequestId(),
        method: 'connect',
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          auth: { token: config.gateway.authToken },
          client: {
            id: 'wecom-bridge',
            mode: 'api',
            platform: 'linux',
            version: '1.0.0',
          }
        }
      };

      this.ws!.send(JSON.stringify(connectMsg));
      this.reconnectAttempts = 0;
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data.toString());
    });

    this.ws.on('close', () => {
      logger.warn('Gateway 连接断开');
      this.scheduleReconnect();
    });

    this.ws.on('error', (error) => {
      logger.error('Gateway 连接错误', { error: error.message });
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('达到最大重连次数，停止重连');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    logger.info(`${delay / 1000} 秒后尝试重连`, { attempt: this.reconnectAttempts });

    setTimeout(() => this.connect(), delay);
  }

  private async handleMessage(rawData: string): Promise<void> {
    try {
      const message = JSON.parse(rawData);
      logger.debug('收到 Gateway 消息', { type: message.type, method: message.method, data: rawData });

      // 处理握手响应
      if (message.type === 'res' && message.method === 'connect') {
        if (message.error) {
          logger.error('Gateway 握手失败', { error: message.error, fullMessage: rawData });
        } else {
          logger.info('Gateway 握手成功', { result: message.result });
        }
        return;
      }

      // 处理来自 Moltbot 的回复
      if (message.type === 'response' && message.userId && message.content) {
        await wecomClient.sendTextMessage(message.userId, message.content);
      }
    } catch (error) {
      logger.error('处理 Gateway 消息失败', { error: String(error) });
    }
  }

  async sendMessage(userId: string, content: string): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway 未连接');
    }

    const message = {
      type: 'req',
      id: this.generateRequestId(),
      method: 'message',
      params: {
        userId,
        content,
        timestamp: Date.now(),
      }
    };

    this.ws.send(JSON.stringify(message));
    logger.debug('消息已发送到 Gateway', { userId });
  }

  onMessage(handler: MessageHandler): void {
    this.onMessageCallback = handler;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

export const gatewayClient = new GatewayClient();
