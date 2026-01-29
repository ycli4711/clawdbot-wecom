export interface WeComMessage {
    ToUserName: string;
    FromUserName: string;
    CreateTime: string;
    MsgType: string;
    Content?: string;
    MsgId?: string;
    AgentID?: string;
    PicUrl?: string;
    MediaId?: string;
    ThumbMediaId?: string;
}
export interface WeComCallbackQuery {
    msg_signature: string;
    timestamp: string;
    nonce: string;
    echostr?: string;
}
export interface WeComNewsArticle {
    title: string;
    description?: string;
    url: string;
    picurl?: string;
}
export interface WeComVideo {
    media_id: string;
    title?: string;
    description?: string;
}
export interface WeComImage {
    media_id: string;
}
export interface WeComSendMessageRequest {
    touser: string;
    msgtype: 'text' | 'markdown' | 'image' | 'video' | 'news';
    agentid: number;
    text?: {
        content: string;
    };
    markdown?: {
        content: string;
    };
    image?: WeComImage;
    video?: WeComVideo;
    news?: {
        articles: WeComNewsArticle[];
    };
}
export interface WeComApiResponse {
    errcode: number;
    errmsg: string;
}
export interface WeComAccessTokenResponse extends WeComApiResponse {
    access_token?: string;
    expires_in?: number;
}
