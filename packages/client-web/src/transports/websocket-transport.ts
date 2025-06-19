/**
 * WebSocket transport implementation for real-time communication
 */

import { EventEmitter } from '@rtcc/core';
import { Message, ConnectionState } from '../types.js';

/**
 * Events emitted by WebSocket transport
 */
export interface WebSocketTransportEvents {
  /** Connection state changed */
  stateChange: (state: ConnectionState) => void;
  
  /** Message received */
  message: (message: Message) => void;
  
  /** Connection opened */
  open: () => void;
  
  /** Connection closed */
  close: (code: number, reason: string) => void;
  
  /** Error occurred */
  error: (error: Error) => void;
  
  /** Allow additional events */
  [key: string]: (...args: any[]) => void;
}

/**
 * WebSocket transport configuration
 */
export interface WebSocketTransportConfig {
  /** Connection timeout in milliseconds */
  timeout?: number;
  
  /** Additional headers */
  headers?: Record<string, string>;
  
  /** WebSocket protocols */
  protocols?: string | string[];
  
  /** Ping interval in milliseconds */
  pingInterval?: number;
  
  /** Pong timeout in milliseconds */
  pongTimeout?: number;
}

/**
 * WebSocket transport for real-time communication
 */
export class WebSocketTransport extends EventEmitter<WebSocketTransportEvents> {
  private ws: WebSocket | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;
  private url: string = '';
  private config: WebSocketTransportConfig;
  private pingTimer: number | null = null;
  private pongTimer: number | null = null;
  private messageQueue: Message[] = [];
  private isClosing = false;

  constructor(config: WebSocketTransportConfig = {}) {
    super();
    this.config = {
      timeout: 30000,
      pingInterval: 30000,
      pongTimeout: 5000,
      ...config,
    };
  }

  /**
   * Current connection state
   */
  get connectionState(): ConnectionState {
    return this.state;
  }

  /**
   * Check if transport is connected
   */
  get isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED;
  }

  /**
   * Connect to WebSocket server
   */
  async connect(url: string): Promise<void> {
    if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.CONNECTED) {
      throw new Error('Already connecting or connected');
    }

    this.url = url;
    this.isClosing = false;
    this.setState(ConnectionState.CONNECTING);

    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection
        this.ws = new WebSocket(url, this.config.protocols);
        
        // Set up connection timeout
        const timeoutId = setTimeout(() => {
          if (this.state === ConnectionState.CONNECTING) {
            this.close();
            reject(new Error('Connection timeout'));
          }
        }, this.config.timeout);

        // Handle WebSocket events
        this.ws.onopen = () => {
          clearTimeout(timeoutId);
          this.setState(ConnectionState.CONNECTED);
          this.startPingLoop();
          this.flushMessageQueue();
          this.emit('open');
          resolve();
        };

        this.ws.onclose = (event) => {
          clearTimeout(timeoutId);
          this.handleClose(event.code, event.reason);
          if (this.state === ConnectionState.CONNECTING) {
            reject(new Error(`Connection failed: ${event.reason}`));
          }
        };

        this.ws.onerror = (event) => {
          clearTimeout(timeoutId);
          const error = new Error('WebSocket error');
          this.emit('error', error);
          if (this.state === ConnectionState.CONNECTING) {
            reject(error);
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.isClosing = true;
    this.stopPingLoop();
    
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Normal closure');
    } else {
      this.setState(ConnectionState.DISCONNECTED);
    }
  }

  /**
   * Send a message
   */
  send(message: Message): void {
    if (!this.isConnected) {
      // Queue message for later sending
      this.messageQueue.push(message);
      return;
    }

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    try {
      const data = JSON.stringify(message);
      this.ws.send(data);
    } catch (error) {
      this.emit('error', new Error(`Failed to send message: ${error}`));
    }
  }

  /**
   * Handle incoming message
   */
  private handleMessage(data: string): void {
    try {
      const message: Message = JSON.parse(data);
      
      // Handle pong messages
      if (message.type === 'pong' as any) {
        this.handlePong();
        return;
      }
      
      this.emit('message', message);
    } catch (error) {
      this.emit('error', new Error(`Failed to parse message: ${error}`));
    }
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(code: number, reason: string): void {
    this.stopPingLoop();
    
    if (this.isClosing) {
      this.setState(ConnectionState.DISCONNECTED);
    } else {
      this.setState(ConnectionState.ERROR);
    }
    
    this.emit('close', code, reason);
    this.ws = null;
  }

  /**
   * Set connection state and emit event
   */
  private setState(state: ConnectionState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }

  /**
   * Start ping/pong loop to keep connection alive
   */
  private startPingLoop(): void {
    if (this.config.pingInterval && this.config.pingInterval > 0) {
      this.pingTimer = window.setInterval(() => {
        this.sendPing();
      }, this.config.pingInterval);
    }
  }

  /**
   * Stop ping/pong loop
   */
  private stopPingLoop(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Send ping message
   */
  private sendPing(): void {
    if (!this.isConnected || !this.ws) {
      return;
    }

    try {
      this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      
      // Set pong timeout
      if (this.config.pongTimeout && this.config.pongTimeout > 0) {
        this.pongTimer = window.setTimeout(() => {
          // No pong received - close connection
          this.close();
        }, this.config.pongTimeout);
      }
    } catch (error) {
      // Ignore ping errors
    }
  }

  /**
   * Handle pong message
   */
  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
  }

  /**
   * Close the connection (internal)
   */
  private close(): void {
    if (this.ws) {
      this.ws.close();
    }
  }

  /**
   * Flush queued messages when connection is established
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift()!;
      this.send(message);
    }
  }

  /**
   * Get queued message count
   */
  get queuedMessageCount(): number {
    return this.messageQueue.length;
  }

  /**
   * Clear message queue
   */
  clearMessageQueue(): void {
    this.messageQueue = [];
  }
}