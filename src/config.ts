import dotenv from 'dotenv';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`环境变量 ${name} 未设置`);
  }
  return value;
}

export const config = {
  wecom: {
    corpId: requireEnv('WECOM_CORP_ID'),
    botId: requireEnv('WECOM_BOT_ID'),
    token: requireEnv('WECOM_TOKEN'),
    encodingAESKey: requireEnv('WECOM_ENCODING_AES_KEY'),
  },
  gateway: {
    baseUrl: process.env['GATEWAY_BASE_URL'] || 'http://127.0.0.1:18789',
    authToken: requireEnv('GATEWAY_AUTH_TOKEN'),
    model: process.env['GATEWAY_MODEL'] || 'claude-3-5-sonnet',
    timeout: parseInt(process.env['GATEWAY_TIMEOUT'] || '30000', 10),
  },
  session: {
    maxMessages: parseInt(process.env['SESSION_MAX_MESSAGES'] || '20', 10),
    expireSeconds: parseInt(process.env['SESSION_EXPIRE_SECONDS'] || '3600', 10),
  },
  server: {
    port: parseInt(process.env['SERVER_PORT'] || '3000', 10),
  },
};

// 在服务启动时打印配置信息（脱敏）
if (process.env.LOG_LEVEL === 'debug' || process.env.LOG_LEVEL === 'info') {
  console.log('[CONFIG] 企业微信配置加载完成:', {
    corpId: config.wecom.corpId,
    botId: config.wecom.botId,
    tokenLength: config.wecom.token.length,
    encodingAESKeyLength: config.wecom.encodingAESKey.length,
    gatewayBaseUrl: config.gateway.baseUrl,
  });
}
