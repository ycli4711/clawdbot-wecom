"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyUrl = verifyUrl;
exports.decryptMessage = decryptMessage;
const wxcrypt_1 = __importDefault(require("wxcrypt"));
const fast_xml_parser_1 = require("fast-xml-parser");
const config_1 = require("../config");
const wxCrypt = new wxcrypt_1.default(config_1.config.wecom.token, config_1.config.wecom.encodingAESKey, config_1.config.wecom.corpId);
const xmlParser = new fast_xml_parser_1.XMLParser();
function verifyUrl(msgSignature, timestamp, nonce, echostr) {
    return wxCrypt.verifyURL(msgSignature, timestamp, nonce, echostr);
}
function decryptMessage(msgSignature, timestamp, nonce, postData) {
    const decryptedXml = wxCrypt.decryptMsg(msgSignature, timestamp, nonce, postData);
    const parsed = xmlParser.parse(decryptedXml);
    return parsed.xml;
}
//# sourceMappingURL=crypto.js.map