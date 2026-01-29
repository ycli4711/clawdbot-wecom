import { logger } from '../utils/logger';

interface Session {
  userId: string;
  lastActiveAt: number;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly sessionTimeout = 30 * 60 * 1000; // 30 分钟

  getOrCreateSession(userId: string): Session {
    let session = this.sessions.get(userId);
    if (!session) {
      session = { userId, lastActiveAt: Date.now() };
      this.sessions.set(userId, session);
      logger.debug('创建新会话', { userId });
    } else {
      session.lastActiveAt = Date.now();
    }
    return session;
  }

  cleanExpiredSessions(): void {
    const now = Date.now();
    for (const [userId, session] of this.sessions) {
      if (now - session.lastActiveAt > this.sessionTimeout) {
        this.sessions.delete(userId);
        logger.debug('清理过期会话', { userId });
      }
    }
  }
}

export const sessionManager = new SessionManager();
