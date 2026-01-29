// 多模态内容部分 (OpenAI/Claude API 兼容格式)
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

// 消息内容可以是字符串或多模态数组
export type MessageContent = string | ContentPart[];

export interface Message {
  role: 'user' | 'assistant';
  content: MessageContent;
  timestamp: number;
}

export interface Session {
  sessionId: string;  // userId_chatId 或 userId
  userId: string;
  chatId?: string;    // 群聊ID (如果是群聊)
  messages: Message[];
  createdAt: number;
  lastActiveAt: number;
}

export interface SessionStorage {
  // 获取会话
  getSession(sessionId: string): Promise<Session | null>;

  // 保存会话
  saveSession(session: Session): Promise<void>;

  // 删除会话
  deleteSession(sessionId: string): Promise<void>;

  // 清理过期会话
  cleanExpiredSessions(expireSeconds: number): Promise<number>;
}
