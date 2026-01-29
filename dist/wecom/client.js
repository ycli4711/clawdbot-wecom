"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wecomClient = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config");
const logger_1 = require("../utils/logger");
const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';
class WeComClient {
    constructor() {
        this.accessToken = null;
        this.tokenExpiresAt = 0;
        this.httpClient = axios_1.default.create({
            baseURL: WECOM_API_BASE,
            timeout: 10000,
        });
    }
    async getAccessToken() {
        const now = Date.now();
        if (this.accessToken && this.tokenExpiresAt > now + 60000) {
            return this.accessToken;
        }
        logger_1.logger.info('正在获取企业微信 access_token');
        const response = await this.httpClient.get('/gettoken', {
            params: {
                corpid: config_1.config.wecom.corpId,
                corpsecret: config_1.config.wecom.appSecret,
            },
        });
        if (response.data.errcode !== 0 || !response.data.access_token) {
            throw new Error(`获取 access_token 失败: ${response.data.errmsg}`);
        }
        this.accessToken = response.data.access_token;
        this.tokenExpiresAt = now + (response.data.expires_in ?? 7200) * 1000;
        logger_1.logger.info('access_token 获取成功');
        return this.accessToken;
    }
    async sendTextMessage(userId, content) {
        const token = await this.getAccessToken();
        const request = {
            touser: userId,
            msgtype: 'text',
            agentid: config_1.config.wecom.agentId,
            text: { content },
        };
        const response = await this.httpClient.post('/message/send', request, { params: { access_token: token } });
        if (response.data.errcode !== 0) {
            logger_1.logger.error('发送消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
            throw new Error(`发送消息失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('消息发送成功', { userId });
    }
    async sendMarkdownMessage(userId, content) {
        const token = await this.getAccessToken();
        const request = {
            touser: userId,
            msgtype: 'markdown',
            agentid: config_1.config.wecom.agentId,
            markdown: { content },
        };
        const response = await this.httpClient.post('/message/send', request, { params: { access_token: token } });
        if (response.data.errcode !== 0) {
            logger_1.logger.error('发送消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
            throw new Error(`发送消息失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('Markdown 消息发送成功', { userId });
    }
    async sendImageMessage(userId, mediaId) {
        const token = await this.getAccessToken();
        const request = {
            touser: userId,
            msgtype: 'image',
            agentid: config_1.config.wecom.agentId,
            image: { media_id: mediaId },
        };
        const response = await this.httpClient.post('/message/send', request, { params: { access_token: token } });
        if (response.data.errcode !== 0) {
            logger_1.logger.error('发送图片消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
            throw new Error(`发送图片消息失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('图片消息发送成功', { userId });
    }
    async sendVideoMessage(userId, mediaId, title, description) {
        const token = await this.getAccessToken();
        const request = {
            touser: userId,
            msgtype: 'video',
            agentid: config_1.config.wecom.agentId,
            video: { media_id: mediaId, title, description },
        };
        const response = await this.httpClient.post('/message/send', request, { params: { access_token: token } });
        if (response.data.errcode !== 0) {
            logger_1.logger.error('发送视频消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
            throw new Error(`发送视频消息失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('视频消息发送成功', { userId });
    }
    async sendNewsMessage(userId, articles) {
        const token = await this.getAccessToken();
        const request = {
            touser: userId,
            msgtype: 'news',
            agentid: config_1.config.wecom.agentId,
            news: { articles },
        };
        const response = await this.httpClient.post('/message/send', request, { params: { access_token: token } });
        if (response.data.errcode !== 0) {
            logger_1.logger.error('发送图文消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
            throw new Error(`发送图文消息失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('图文消息发送成功', { userId, articleCount: articles.length });
    }
    /**
     * 上传临时素材（图片、视频等）
     * @param type 媒体类型: image, video, voice, file
     * @param filePath 文件路径
     * @returns media_id
     */
    async uploadMedia(type, fileBuffer, filename) {
        const token = await this.getAccessToken();
        const FormData = (await Promise.resolve().then(() => __importStar(require('form-data')))).default;
        const form = new FormData();
        form.append('media', fileBuffer, { filename });
        const response = await this.httpClient.post('/media/upload', form, {
            params: { access_token: token, type },
            headers: form.getHeaders(),
        });
        if (response.data.errcode !== 0 || !response.data.media_id) {
            throw new Error(`上传素材失败: ${response.data.errmsg}`);
        }
        logger_1.logger.info('素材上传成功', { type, filename, mediaId: response.data.media_id });
        return response.data.media_id;
    }
}
exports.wecomClient = new WeComClient();
//# sourceMappingURL=client.js.map