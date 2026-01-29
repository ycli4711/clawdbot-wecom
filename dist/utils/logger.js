"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
const currentLevel = process.env['LOG_LEVEL'] || 'info';
function formatTime() {
    return new Date().toISOString();
}
function log(level, message, meta) {
    if (LOG_LEVELS[level] < LOG_LEVELS[currentLevel]) {
        return;
    }
    const prefix = `[${formatTime()}] [${level.toUpperCase()}]`;
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    console.log(`${prefix} ${message}${metaStr}`);
}
exports.logger = {
    debug: (msg, meta) => log('debug', msg, meta),
    info: (msg, meta) => log('info', msg, meta),
    warn: (msg, meta) => log('warn', msg, meta),
    error: (msg, meta) => log('error', msg, meta),
};
//# sourceMappingURL=logger.js.map