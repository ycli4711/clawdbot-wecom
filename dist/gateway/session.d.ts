interface Session {
    userId: string;
    lastActiveAt: number;
}
declare class SessionManager {
    private sessions;
    private readonly sessionTimeout;
    getOrCreateSession(userId: string): Session;
    cleanExpiredSessions(): void;
}
export declare const sessionManager: SessionManager;
export {};
