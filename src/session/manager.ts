import type { Session, SessionStorage, Message, MessageContent } from './types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class SessionManager {
  constructor(private storage: SessionStorage) {
    // 定期清理过期会话
    setInterval(() => {
      this.storage.cleanExpiredSessions(config.session.expireSeconds);
    }, 60000); // 每分钟清理一次
  }

  // 生成会话ID
  private generateSessionId(userId: string, chatId?: string): string {
    return chatId ? `${userId}_${chatId}` : userId;
  }

  // 获取或创建会话
  async getOrCreateSession(userId: string, chatId?: string): Promise<Session> {
    const sessionId = this.generateSessionId(userId, chatId);
    let session = await this.storage.getSession(sessionId);

    if (!session) {
      session = {
        sessionId,
        userId,
        chatId,
        messages: [],
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      logger.info('创建新会话', { sessionId, userId, chatId });
    }

    return session;
  }

  // 添加用户消息
  async addUserMessage(userId: string, content: MessageContent, chatId?: string): Promise<void> {
    const session = await this.getOrCreateSession(userId, chatId);

    session.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    // 限制消息数量
    if (session.messages.length > config.session.maxMessages) {
      session.messages = session.messages.slice(-config.session.maxMessages);
    }

    session.lastActiveAt = Date.now();
    await this.storage.saveSession(session);
  }

  // 添加助手回复
  async addAssistantMessage(userId: string, content: string, chatId?: string): Promise<void> {
    const session = await this.getOrCreateSession(userId, chatId);

    session.messages.push({
      role: 'assistant',
      content,
      timestamp: Date.now(),
    });

    // 限制消息数量
    if (session.messages.length > config.session.maxMessages) {
      session.messages = session.messages.slice(-config.session.maxMessages);
    }

    session.lastActiveAt = Date.now();
    await this.storage.saveSession(session);
  }

  // 获取会话历史 (用于发送给AI)
  async getSessionHistory(userId: string, chatId?: string): Promise<Message[]> {
    const session = await this.getOrCreateSession(userId, chatId);
    return session.messages;
  }

  // 清除会话
  async clearSession(userId: string, chatId?: string): Promise<void> {
    const sessionId = this.generateSessionId(userId, chatId);
    await this.storage.deleteSession(sessionId);
    logger.info('会话已清除', { sessionId });
  }
}
