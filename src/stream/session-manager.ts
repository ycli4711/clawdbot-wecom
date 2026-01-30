import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';
import type { StreamSession } from './types';

const SESSION_EXPIRE_MS = 5 * 60 * 1000; // 5 分钟过期

class StreamSessionManager {
  private sessions: Map<string, StreamSession> = new Map();
  private userToStreamId: Map<string, string> = new Map(); // userId_chatId -> streamId

  constructor() {
    // 定期清理过期会话
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * 生成用户会话键
   */
  private getUserKey(userId: string, chatId?: string): string {
    return chatId ? `${userId}_${chatId}` : userId;
  }

  /**
   * 创建新的流式会话
   */
  createSession(userId: string, chatId?: string): string {
    const streamId = randomUUID();
    const userKey = this.getUserKey(userId, chatId);
    const now = Date.now();

    // 清理该用户之前的会话
    const oldStreamId = this.userToStreamId.get(userKey);
    if (oldStreamId) {
      this.sessions.delete(oldStreamId);
    }

    const session: StreamSession = {
      streamId,
      userId,
      chatId,
      content: '',
      isComplete: false,
      createdAt: now,
      updatedAt: now,
    };

    this.sessions.set(streamId, session);
    this.userToStreamId.set(userKey, streamId);

    logger.debug('创建流式会话', { streamId, userId, chatId });

    return streamId;
  }

  /**
   * 根据 streamId 获取会话
   */
  getSession(streamId: string): StreamSession | undefined {
    return this.sessions.get(streamId);
  }

  /**
   * 根据用户信息获取当前活跃的会话
   */
  getSessionByUser(userId: string, chatId?: string): StreamSession | undefined {
    const userKey = this.getUserKey(userId, chatId);
    const streamId = this.userToStreamId.get(userKey);
    if (streamId) {
      return this.sessions.get(streamId);
    }
    return undefined;
  }

  /**
   * 追加内容
   */
  appendContent(streamId: string, delta: string): void {
    const session = this.sessions.get(streamId);
    if (session && !session.isComplete) {
      session.content += delta;
      session.updatedAt = Date.now();
    }
  }

  /**
   * 设置完整内容
   */
  setContent(streamId: string, content: string): void {
    const session = this.sessions.get(streamId);
    if (session) {
      session.content = content;
      session.updatedAt = Date.now();
    }
  }

  /**
   * 标记完成
   */
  markComplete(streamId: string): void {
    const session = this.sessions.get(streamId);
    if (session) {
      session.isComplete = true;
      session.updatedAt = Date.now();
      logger.debug('流式会话完成', { streamId, contentLength: session.content.length });
    }
  }

  /**
   * 标记错误
   */
  markError(streamId: string, error: string): void {
    const session = this.sessions.get(streamId);
    if (session) {
      session.error = error;
      session.isComplete = true;
      session.updatedAt = Date.now();
      logger.error('流式会话出错', { streamId, error });
    }
  }

  /**
   * 删除会话
   */
  removeSession(streamId: string): void {
    const session = this.sessions.get(streamId);
    if (session) {
      const userKey = this.getUserKey(session.userId, session.chatId);
      this.userToStreamId.delete(userKey);
      this.sessions.delete(streamId);
      logger.debug('删除流式会话', { streamId });
    }
  }

  /**
   * 清理过期会话
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [streamId, session] of this.sessions) {
      if (now - session.updatedAt > SESSION_EXPIRE_MS) {
        const userKey = this.getUserKey(session.userId, session.chatId);
        this.userToStreamId.delete(userKey);
        this.sessions.delete(streamId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug('清理过期流式会话', { count: cleaned });
    }
  }
}

export const streamSessionManager = new StreamSessionManager();
