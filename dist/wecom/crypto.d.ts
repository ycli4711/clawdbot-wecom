import type { WeComMessage } from './types';
export declare function verifyUrl(msgSignature: string, timestamp: string, nonce: string, echostr: string): string;
export declare function decryptMessage(msgSignature: string, timestamp: string, nonce: string, postData: string): WeComMessage;
