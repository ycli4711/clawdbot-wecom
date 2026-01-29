import type { WeComNewsArticle } from './types';
declare class WeComClient {
    private httpClient;
    private accessToken;
    private tokenExpiresAt;
    constructor();
    private getAccessToken;
    sendTextMessage(userId: string, content: string): Promise<void>;
    sendMarkdownMessage(userId: string, content: string): Promise<void>;
    sendImageMessage(userId: string, mediaId: string): Promise<void>;
    sendVideoMessage(userId: string, mediaId: string, title?: string, description?: string): Promise<void>;
    sendNewsMessage(userId: string, articles: WeComNewsArticle[]): Promise<void>;
    /**
     * 上传临时素材（图片、视频等）
     * @param type 媒体类型: image, video, voice, file
     * @param filePath 文件路径
     * @returns media_id
     */
    uploadMedia(type: 'image' | 'video' | 'voice' | 'file', fileBuffer: Buffer, filename: string): Promise<string>;
}
export declare const wecomClient: WeComClient;
export {};
