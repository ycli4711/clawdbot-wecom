export interface WeComMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  AgentID?: string;
  PicUrl?: string;      // 图片消息的图片链接
  MediaId?: string;     // 媒体文件 ID
  ThumbMediaId?: string; // 视频消息的缩略图 ID
}

export interface WeComCallbackQuery {
  msg_signature: string;
  timestamp: string;
  nonce: string;
  echostr?: string;
}

// 图文消息文章
export interface WeComNewsArticle {
  title: string;
  description?: string;
  url: string;
  picurl?: string;
}

// 视频消息
export interface WeComVideo {
  media_id: string;
  title?: string;
  description?: string;
}

// 图片消息
export interface WeComImage {
  media_id: string;
}

export interface WeComSendMessageRequest {
  touser: string;
  msgtype: 'text' | 'markdown' | 'image' | 'video' | 'news';
  agentid: number;
  text?: { content: string };
  markdown?: { content: string };
  image?: WeComImage;
  video?: WeComVideo;
  news?: { articles: WeComNewsArticle[] };
}

export interface WeComApiResponse {
  errcode: number;
  errmsg: string;
}

export interface WeComAccessTokenResponse extends WeComApiResponse {
  access_token?: string;
  expires_in?: number;
}
