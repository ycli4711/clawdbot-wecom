import WXBizMsgCrypt from 'wxcrypt';
import { XMLParser } from 'fast-xml-parser';
import { config } from '../config';
import type { WeComMessage } from './types';

const wxCrypt = new WXBizMsgCrypt(
  config.wecom.token,
  config.wecom.encodingAESKey,
  config.wecom.corpId
);

const xmlParser = new XMLParser();

export function verifyUrl(
  msgSignature: string,
  timestamp: string,
  nonce: string,
  echostr: string
): string {
  return wxCrypt.verifyURL(msgSignature, timestamp, nonce, echostr);
}

export function decryptMessage(
  msgSignature: string,
  timestamp: string,
  nonce: string,
  postData: string
): WeComMessage {
  const decryptedXml = wxCrypt.decryptMsg(msgSignature, timestamp, nonce, postData);
  const parsed = xmlParser.parse(decryptedXml);
  return parsed.xml as WeComMessage;
}
