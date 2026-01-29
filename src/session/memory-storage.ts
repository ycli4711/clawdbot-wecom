import type { Session, SessionStorage } from './types';
import { logger } from '../utils/logger';

export class MemorySessionStorage implements SessionStorage {
  private sessions: Map<string, Session> = new Map();

  async getSession(sessionId: string): Promise<Session | null> {
    const session = this.sessions.get(sessionId);
    return session || null;
  }

  async saveSession(session: Session): Promise<void> {
    this.sessions.set(session.sessionId, session);
    logger.debug('会话已保存', { sessionId: session.sessionId, messageCount: session.messages.length });
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    logger.debug('会话已删除', { sessionId });
  }

  async cleanExpiredSessions(expireSeconds: number): Promise<number> {
    const now = Date.now();
    const expireThreshold = now - expireSeconds * 1000;
    let count = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.lastActiveAt < expireThreshold) {
        this.sessions.delete(sessionId);
        count++;
      }
    }

    if (count > 0) {
      logger.info('已清理过期会话', { count });
    }

    return count;
  }

  // 获取当前会话数量 (用于监控)
  getSessionCount(): number {
    return this.sessions.size;
  }
}
