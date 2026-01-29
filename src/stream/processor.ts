import { randomUUID } from 'crypto';
import type { StreamConfig, StreamProcessorOptions } from './types';

export class StreamProcessor {
  private streamId: string;
  private accumulatedContent: string = '';
  private lastSentContent: string = '';
  private lastSentTime: number = 0;
  private pendingTimer: NodeJS.Timeout | null = null;
  private finished: boolean = false;
  private config: StreamConfig;
  private onSend: StreamProcessorOptions['onSend'];
  private onError: StreamProcessorOptions['onError'];

  constructor(options: StreamProcessorOptions) {
    this.streamId = randomUUID();
    this.config = options.config;
    this.onSend = options.onSend;
    this.onError = options.onError;
  }

  getStreamId(): string {
    return this.streamId;
  }

  getAccumulatedContent(): string {
    return this.accumulatedContent;
  }

  async handleDelta(delta: string): Promise<void> {
    if (this.finished) return;

    this.accumulatedContent += delta;

    const newContentLength = this.accumulatedContent.length - this.lastSentContent.length;
    const timeSinceLastSend = Date.now() - this.lastSentTime;

    // 清除待发送的定时器
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    // 判断是否需要立即发送
    if (newContentLength >= this.config.maxChunkSize) {
      // 新增内容 >= maxChunkSize: 立即发送
      await this.send(false);
    } else if (newContentLength >= this.config.minChunkSize && timeSinceLastSend >= this.config.sendInterval) {
      // 新增内容 >= minChunkSize 且 间隔 >= sendInterval: 发送
      await this.send(false);
    } else if (newContentLength > 0) {
      // 设置定时器延迟发送
      this.pendingTimer = setTimeout(async () => {
        if (!this.finished && this.accumulatedContent.length > this.lastSentContent.length) {
          await this.send(false);
        }
      }, this.config.sendInterval);
    }
  }

  async finish(): Promise<void> {
    if (this.finished) return;

    // 清除待发送的定时器
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.finished = true;

    // 发送最终内容
    await this.send(true);
  }

  async abort(errorMessage?: string): Promise<void> {
    if (this.finished) return;

    // 清除待发送的定时器
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }

    this.finished = true;

    // 如果有错误消息，追加到内容中
    if (errorMessage) {
      this.accumulatedContent += `\n\n[错误: ${errorMessage}]`;
    }

    // 发送最终内容并标记结束
    await this.send(true);
  }

  private async send(finish: boolean): Promise<void> {
    try {
      // 检查内容字节长度并截断
      const content = this.truncateToBytes(this.accumulatedContent, this.config.maxContentLength);

      await this.onSend(this.streamId, content, finish);

      this.lastSentContent = this.accumulatedContent;
      this.lastSentTime = Date.now();
    } catch (error) {
      await this.onError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private truncateToBytes(str: string, maxBytes: number): string {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(str);

    if (encoded.length <= maxBytes) {
      return str;
    }

    // UTF-8 安全截断：找到最后一个完整字符的边界
    let end = maxBytes;
    while (end > 0 && (encoded[end] & 0xC0) === 0x80) {
      end--;
    }

    return new TextDecoder().decode(encoded.slice(0, end));
  }
}
