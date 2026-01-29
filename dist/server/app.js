"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.startServer = startServer;
const fastify_1 = __importDefault(require("fastify"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const callback_1 = require("./routes/callback");
async function createServer() {
    const fastify = (0, fastify_1.default)({
        logger: false,
    });
    // 注册原始 body 解析器（企业微信发送的是 XML）
    fastify.addContentTypeParser('application/xml', { parseAs: 'string' }, (req, body, done) => {
        done(null, body);
    });
    fastify.addContentTypeParser('text/xml', { parseAs: 'string' }, (req, body, done) => {
        done(null, body);
    });
    // 注册路由
    await fastify.register(callback_1.callbackRoutes);
    // 健康检查
    fastify.get('/health', async () => {
        return { status: 'ok' };
    });
    return fastify;
}
async function startServer() {
    const server = await createServer();
    try {
        await server.listen({ port: config_1.config.server.port, host: '0.0.0.0' });
        logger_1.logger.info(`服务器已启动`, { port: config_1.config.server.port });
        return server;
    }
    catch (error) {
        logger_1.logger.error('服务器启动失败', { error: String(error) });
        throw error;
    }
}
//# sourceMappingURL=app.js.map