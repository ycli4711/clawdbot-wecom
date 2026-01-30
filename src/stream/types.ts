export interface StreamConfig {
  minChunkSize: number;     // 最小累积字符数再发送 (默认 20)
  maxChunkSize: number;     // 最大累积字符数强制发送 (默认 500)
  sendInterval: number;     // 最小发送间隔 ms (默认 300)
  maxContentLength: number; // 企业微信限制 20480 字节
}

export interface StreamProcessorOptions {
  responseCode: string;
  config: StreamConfig;
  onSend: (streamId: string, content: string, finish: boolean) => Promise<void>;
  onError: (error: Error) => Promise<void>;
}

// 被动回复流式会话状态
export interface StreamSession {
  streamId: string;
  userId: string;
  chatId?: string;
  content: string;          // 累积内容
  isComplete: boolean;      // 是否完成
  error?: string;           // 错误信息
  createdAt: number;
  updatedAt: number;
}
