"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gatewayClient = void 0;
const ws_1 = __importDefault(require("ws"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const client_1 = require("../wecom/client");
class GatewayClient {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.pendingRequests = new Map();
        this.onMessageCallback = null;
    }
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    }
    connect() {
        if (this.ws?.readyState === ws_1.default.OPEN) {
            return;
        }
        logger_1.logger.info('正在连接 Gateway', { url: config_1.config.gateway.wsUrl });
        this.ws = new ws_1.default(config_1.config.gateway.wsUrl);
        this.ws.on('open', () => {
            logger_1.logger.info('Gateway 连接成功，发送握手消息');
            // 发送握手消息
            const connectMsg = {
                type: 'req',
                id: this.generateRequestId(),
                method: 'connect',
                params: {
                    minProtocol: 3,
                    maxProtocol: 3,
                    auth: { token: config_1.config.gateway.authToken },
                    client: {
                        id: 'wecom-bridge',
                        mode: 'api',
                        platform: 'linux',
                        version: '1.0.0',
                    }
                }
            };
            this.ws.send(JSON.stringify(connectMsg));
            this.reconnectAttempts = 0;
        });
        this.ws.on('message', (data) => {
            this.handleMessage(data.toString());
        });
        this.ws.on('close', () => {
            logger_1.logger.warn('Gateway 连接断开');
            this.scheduleReconnect();
        });
        this.ws.on('error', (error) => {
            logger_1.logger.error('Gateway 连接错误', { error: error.message });
        });
    }
    scheduleReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger_1.logger.error('达到最大重连次数，停止重连');
            return;
        }
        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
        logger_1.logger.info(`${delay / 1000} 秒后尝试重连`, { attempt: this.reconnectAttempts });
        setTimeout(() => this.connect(), delay);
    }
    async handleMessage(rawData) {
        try {
            const message = JSON.parse(rawData);
            logger_1.logger.debug('收到 Gateway 消息', { type: message.type, method: message.method, data: rawData });
            // 处理握手响应
            if (message.type === 'res' && message.method === 'connect') {
                if (message.error) {
                    logger_1.logger.error('Gateway 握手失败', { error: message.error, fullMessage: rawData });
                }
                else {
                    logger_1.logger.info('Gateway 握手成功', { result: message.result });
                }
                return;
            }
            // 处理来自 Moltbot 的回复
            if (message.type === 'response' && message.userId && message.content) {
                await client_1.wecomClient.sendTextMessage(message.userId, message.content);
            }
        }
        catch (error) {
            logger_1.logger.error('处理 Gateway 消息失败', { error: String(error) });
        }
    }
    async sendMessage(userId, content) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            throw new Error('Gateway 未连接');
        }
        const message = {
            type: 'req',
            id: this.generateRequestId(),
            method: 'message',
            params: {
                userId,
                content,
                timestamp: Date.now(),
            }
        };
        this.ws.send(JSON.stringify(message));
        logger_1.logger.debug('消息已发送到 Gateway', { userId });
    }
    onMessage(handler) {
        this.onMessageCallback = handler;
    }
    isConnected() {
        return this.ws?.readyState === ws_1.default.OPEN;
    }
    disconnect() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}
exports.gatewayClient = new GatewayClient();
//# sourceMappingURL=client.js.map