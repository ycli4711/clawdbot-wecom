"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sessionManager = void 0;
const logger_1 = require("../utils/logger");
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 分钟
    }
    getOrCreateSession(userId) {
        let session = this.sessions.get(userId);
        if (!session) {
            session = { userId, lastActiveAt: Date.now() };
            this.sessions.set(userId, session);
            logger_1.logger.debug('创建新会话', { userId });
        }
        else {
            session.lastActiveAt = Date.now();
        }
        return session;
    }
    cleanExpiredSessions() {
        const now = Date.now();
        for (const [userId, session] of this.sessions) {
            if (now - session.lastActiveAt > this.sessionTimeout) {
                this.sessions.delete(userId);
                logger_1.logger.debug('清理过期会话', { userId });
            }
        }
    }
}
exports.sessionManager = new SessionManager();
//# sourceMappingURL=session.js.map