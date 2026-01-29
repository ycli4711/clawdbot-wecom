import { SessionManager } from './manager';
import { MemorySessionStorage } from './memory-storage';

// 创建全局会话管理器实例
const storage = new MemorySessionStorage();
export const sessionManager = new SessionManager(storage);

// 导出类型
export type { Session, Message, SessionStorage } from './types';
