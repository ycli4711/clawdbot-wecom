type MessageHandler = (userId: string, content: string) => void;
declare class GatewayClient {
    private ws;
    private reconnectAttempts;
    private maxReconnectAttempts;
    private reconnectDelay;
    private pendingRequests;
    private onMessageCallback;
    private generateRequestId;
    connect(): void;
    private scheduleReconnect;
    private handleMessage;
    sendMessage(userId: string, content: string): Promise<void>;
    onMessage(handler: MessageHandler): void;
    isConnected(): boolean;
    disconnect(): void;
}
export declare const gatewayClient: GatewayClient;
export {};
