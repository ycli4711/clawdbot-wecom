// 智能机器人消息格式 (JSON)
export interface WeComBotMessage {
  msgid: string;                    // 消息唯一标识
  aibotid: string;                  // 智能助手 ID
  chatid: string;                   // 会话 ID (群聊时使用)
  chattype: 'single' | 'group';     // 会话类型
  from: {
    userid: string;                 // 发送者 userid
  };
  response_url: string;             // 主动回复的临时 URL
  msgtype: 'text' | 'image' | 'video' | 'file' | 'link' | 'miniprogram' | 'mixed';

  // 文本消息
  text?: {
    content: string;
  };

  // 引用消息 (可选)
  quote?: {
    msgtype: string;
    text?: {
      content: string;
    };
  };

  // 图片消息
  image?: {
    url: string;
  };

  // 图文混排消息 (注意: mixed 字段可能是 JSON 字符串)
  mixed?: string | {
    msg_item: Array<{
      msgtype: 'text' | 'image' | 'news';
      text?: {
        content: string;
      };
      image?: {
        img_url: string;
      };
    }>;
  };

  // 其他消息类型暂不处理
}

// 旧版自建应用消息格式 (XML,已废弃,保留用于参考)
export interface WeComMessage {
  ToUserName: string;
  FromUserName: string;
  CreateTime: string;
  MsgType: string;
  Content?: string;
  MsgId?: string;
  AgentID?: string;
  ChatId?: string;      // 群聊ID (如果是群聊)
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

// 智能助手回复消息请求
export interface WeComBotReplyRequest {
  touser: string;
  msgtype: 'text';
  text: {
    content: string;
  };
}

export interface WeComApiResponse {
  errcode: number;
  errmsg: string;
}
