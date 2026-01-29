"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.callbackRoutes = callbackRoutes;
const crypto_1 = require("../../wecom/crypto");
const client_1 = require("../../gateway/client");
const session_1 = require("../../gateway/session");
const logger_1 = require("../../utils/logger");
async function callbackRoutes(fastify) {
    // GET 请求：URL 验证
    fastify.get('/wecom/callback', async (request, reply) => {
        const { msg_signature, timestamp, nonce, echostr } = request.query;
        if (!msg_signature || !timestamp || !nonce || !echostr) {
            logger_1.logger.warn('URL 验证缺少必要参数');
            return reply.status(400).send('缺少必要参数');
        }
        try {
            const decryptedEchostr = (0, crypto_1.verifyUrl)(msg_signature, timestamp, nonce, echostr);
            logger_1.logger.info('URL 验证成功');
            return reply.send(decryptedEchostr);
        }
        catch (error) {
            logger_1.logger.error('URL 验证失败', { error: String(error) });
            return reply.status(403).send('验证失败');
        }
    });
    // POST 请求：接收消息
    fastify.post('/wecom/callback', async (request, reply) => {
        const { msg_signature, timestamp, nonce } = request.query;
        if (!msg_signature || !timestamp || !nonce) {
            logger_1.logger.warn('消息接收缺少必要参数');
            return reply.status(400).send('缺少必要参数');
        }
        try {
            const postData = request.body;
            const message = (0, crypto_1.decryptMessage)(msg_signature, timestamp, nonce, postData);
            logger_1.logger.info('收到企业微信消息', {
                from: message.FromUserName,
                type: message.MsgType
            });
            // 只处理文本消息
            if (message.MsgType === 'text' && message.Content) {
                session_1.sessionManager.getOrCreateSession(message.FromUserName);
                // 发送到 Gateway
                if (client_1.gatewayClient.isConnected()) {
                    await client_1.gatewayClient.sendMessage(message.FromUserName, message.Content);
                }
                else {
                    logger_1.logger.warn('Gateway 未连接，无法处理消息');
                }
            }
            // 企业微信要求在5秒���返回空字符串或 success
            return reply.send('');
        }
        catch (error) {
            logger_1.logger.error('处理消息失败', { error: String(error) });
            return reply.status(500).send('处理失败');
        }
    });
}
//# sourceMappingURL=callback.js.map