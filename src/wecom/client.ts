import axios, { AxiosInstance } from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';
import type {
  WeComAccessTokenResponse,
  WeComApiResponse,
  WeComSendMessageRequest,
  WeComNewsArticle
} from './types';

const WECOM_API_BASE = 'https://qyapi.weixin.qq.com/cgi-bin';

class WeComClient {
  private httpClient: AxiosInstance;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.httpClient = axios.create({
      baseURL: WECOM_API_BASE,
      timeout: 10000,
    });
  }

  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    if (this.accessToken && this.tokenExpiresAt > now + 60000) {
      return this.accessToken;
    }

    logger.info('正在获取企业微信 access_token');
    const response = await this.httpClient.get<WeComAccessTokenResponse>('/gettoken', {
      params: {
        corpid: config.wecom.corpId,
        corpsecret: config.wecom.appSecret,
      },
    });

    if (response.data.errcode !== 0 || !response.data.access_token) {
      throw new Error(`获取 access_token 失败: ${response.data.errmsg}`);
    }

    this.accessToken = response.data.access_token;
    this.tokenExpiresAt = now + (response.data.expires_in ?? 7200) * 1000;
    logger.info('access_token 获取成功');
    return this.accessToken;
  }

  async sendTextMessage(userId: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const request: WeComSendMessageRequest = {
      touser: userId,
      msgtype: 'text',
      agentid: config.wecom.agentId,
      text: { content },
    };

    const response = await this.httpClient.post<WeComApiResponse>(
      '/message/send',
      request,
      { params: { access_token: token } }
    );

    if (response.data.errcode !== 0) {
      logger.error('发送消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
      throw new Error(`发送消息失败: ${response.data.errmsg}`);
    }

    logger.info('消息发送成功', { userId });
  }

  async sendMarkdownMessage(userId: string, content: string): Promise<void> {
    const token = await this.getAccessToken();
    const request: WeComSendMessageRequest = {
      touser: userId,
      msgtype: 'markdown',
      agentid: config.wecom.agentId,
      markdown: { content },
    };

    const response = await this.httpClient.post<WeComApiResponse>(
      '/message/send',
      request,
      { params: { access_token: token } }
    );

    if (response.data.errcode !== 0) {
      logger.error('发送消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
      throw new Error(`发送消息失败: ${response.data.errmsg}`);
    }

    logger.info('Markdown 消息发送成功', { userId });
  }

  async sendImageMessage(userId: string, mediaId: string): Promise<void> {
    const token = await this.getAccessToken();
    const request: WeComSendMessageRequest = {
      touser: userId,
      msgtype: 'image',
      agentid: config.wecom.agentId,
      image: { media_id: mediaId },
    };

    const response = await this.httpClient.post<WeComApiResponse>(
      '/message/send',
      request,
      { params: { access_token: token } }
    );

    if (response.data.errcode !== 0) {
      logger.error('发送图片消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
      throw new Error(`发送图片消息失败: ${response.data.errmsg}`);
    }

    logger.info('图片消息发送成功', { userId });
  }

  async sendVideoMessage(
    userId: string,
    mediaId: string,
    title?: string,
    description?: string
  ): Promise<void> {
    const token = await this.getAccessToken();
    const request: WeComSendMessageRequest = {
      touser: userId,
      msgtype: 'video',
      agentid: config.wecom.agentId,
      video: { media_id: mediaId, title, description },
    };

    const response = await this.httpClient.post<WeComApiResponse>(
      '/message/send',
      request,
      { params: { access_token: token } }
    );

    if (response.data.errcode !== 0) {
      logger.error('发送视频消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
      throw new Error(`发送视频消息失败: ${response.data.errmsg}`);
    }

    logger.info('视频消息发送成功', { userId });
  }

  async sendNewsMessage(userId: string, articles: WeComNewsArticle[]): Promise<void> {
    const token = await this.getAccessToken();
    const request: WeComSendMessageRequest = {
      touser: userId,
      msgtype: 'news',
      agentid: config.wecom.agentId,
      news: { articles },
    };

    const response = await this.httpClient.post<WeComApiResponse>(
      '/message/send',
      request,
      { params: { access_token: token } }
    );

    if (response.data.errcode !== 0) {
      logger.error('发送图文消息失败', { errcode: response.data.errcode, errmsg: response.data.errmsg });
      throw new Error(`发送图文消息失败: ${response.data.errmsg}`);
    }

    logger.info('图文消息发送成功', { userId, articleCount: articles.length });
  }

  /**
   * 上传临时素材（图片、视频等）
   * @param type 媒体类型: image, video, voice, file
   * @param filePath 文件路径
   * @returns media_id
   */
  async uploadMedia(type: 'image' | 'video' | 'voice' | 'file', fileBuffer: Buffer, filename: string): Promise<string> {
    const token = await this.getAccessToken();
    const FormData = (await import('form-data')).default;
    const form = new FormData();
    form.append('media', fileBuffer, { filename });

    const response = await this.httpClient.post<WeComApiResponse & { media_id?: string }>(
      '/media/upload',
      form,
      {
        params: { access_token: token, type },
        headers: form.getHeaders(),
      }
    );

    if (response.data.errcode !== 0 || !response.data.media_id) {
      throw new Error(`上传素材失败: ${response.data.errmsg}`);
    }

    logger.info('素材上传成功', { type, filename, mediaId: response.data.media_id });
    return response.data.media_id;
  }
}

export const wecomClient = new WeComClient();
