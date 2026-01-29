"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`环境变量 ${name} 未设置`);
    }
    return value;
}
exports.config = {
    wecom: {
        corpId: requireEnv('WECOM_CORP_ID'),
        appSecret: requireEnv('WECOM_APP_SECRET'),
        agentId: parseInt(requireEnv('WECOM_AGENT_ID'), 10),
        token: requireEnv('WECOM_TOKEN'),
        encodingAESKey: requireEnv('WECOM_ENCODING_AES_KEY'),
    },
    gateway: {
        wsUrl: process.env['GATEWAY_WS_URL'] || 'ws://127.0.0.1:18789',
        authToken: requireEnv('GATEWAY_AUTH_TOKEN'),
    },
    server: {
        port: parseInt(process.env['SERVER_PORT'] || '3000', 10),
    },
};
//# sourceMappingURL=config.js.map