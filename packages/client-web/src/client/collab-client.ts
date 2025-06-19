/**
 * Main collaboration client for web applications
 */

import { 
  EventEmitter, 
  Operation, 
  DocumentId, 
  ClientId, 
  Version,
  SharedText,
  SharedList,
  SharedMap,
  generateId 
} from '@rtc-sdk/core';
import { WebSocketTransport } from '../transports/websocket-transport.js';
import { 
  CollabClientConfig,
  CollabClientEvents,
  ConnectionState,
  Message,
  MessageType,
  DocumentSchema,
  UserPresence,
  AuthMessage,
  JoinDocumentMessage,
  OperationMessage,
  PresenceUpdateMessage,
  DocumentStateMessage
} from '../types.js';
import { CollabDocument } from './collab-document.js';

/**
 * Main collaboration client
 */
export class CollabClient extends EventEmitter<CollabClientEvents> {
  private config: Required<CollabClientConfig>;
  private transport: WebSocketTransport;
  private clientId: ClientId;
  private documents = new Map<DocumentId, CollabDocument>();
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private authToken?: string;
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;

  constructor(config: CollabClientConfig) {
    super();
    
    // Set default configuration
    this.config = {
      connectionTimeout: 30000,
      reconnection: {
        enabled: true,
        attempts: 5,
        delay: 1000,
        delayMax: 30000,
      },
      headers: {},
      ...config,
      clientId: config.clientId || generateId(),
      token: config.token || '',
    };

    this.clientId = this.config.clientId;
    this.authToken = this.config.token;

    // Initialize transport
    this.transport = new WebSocketTransport({
      timeout: this.config.connectionTimeout,
      headers: this.config.headers,
    });

    this.setupTransportListeners();
  }

  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Check if client is connected
   */
  get isConnected(): boolean {
    return this.connectionState === ConnectionState.CONNECTED;
  }

  /**
   * Get client ID
   */
  get id(): ClientId {
    return this.clientId;
  }

  /**
   * Connect to the collaboration server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return;
    }

    try {
      await this.transport.connect(this.config.serverUrl);
      
      // Send authentication message
      await this.authenticate();
      
      this.reconnectAttempts = 0;
      this.setConnectionState(ConnectionState.CONNECTED);
      this.emit('connected');
      
    } catch (error) {
      this.setConnectionState(ConnectionState.ERROR);
      this.emit('error', error as Error);
      
      if (this.config.reconnection.enabled) {
        this.scheduleReconnect();
      }
      
      throw error;
    }
  }

  /**
   * Disconnect from the collaboration server
   */
  disconnect(): void {
    this.cancelReconnect();
    
    // Leave all documents
    for (const doc of this.documents.values()) {
      doc.leave();
    }
    
    this.transport.disconnect();
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.emit('disconnected');
  }

  /**
   * Open or create a collaborative document
   */
  async openDocument<T = any>(
    documentId: DocumentId,
    schema?: DocumentSchema
  ): Promise<CollabDocument<T>> {
    if (!this.isConnected) {
      throw new Error('Client not connected');
    }

    // Check if document is already open
    let document = this.documents.get(documentId);
    if (document) {
      return document as CollabDocument<T>;
    }

    // Create new document
    document = new CollabDocument<T>(documentId, this.clientId, schema);
    this.documents.set(documentId, document);

    // Set up document event listeners
    document.on('operation', (operation) => {
      this.sendOperation(documentId, operation);
    });

    document.on('presenceUpdate', (presence) => {
      this.sendPresenceUpdate(documentId, presence);
    });

    document.on('leave', () => {
      this.documents.delete(documentId);
    });

    // Join the document on the server
    await this.joinDocument(documentId);

    return document as CollabDocument<T>;
  }

  /**
   * Close a collaborative document
   */
  closeDocument(documentId: DocumentId): void {
    const document = this.documents.get(documentId);
    if (document) {
      document.leave();
      this.documents.delete(documentId);
      
      if (this.isConnected) {
        this.transport.send({
          type: MessageType.LEAVE_DOCUMENT,
          documentId,
          timestamp: Date.now(),
        });
      }
    }
  }

  /**
   * Get a list of open documents
   */
  getOpenDocuments(): DocumentId[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get a document by ID
   */
  getDocument<T = any>(documentId: DocumentId): CollabDocument<T> | undefined {
    return this.documents.get(documentId) as CollabDocument<T> | undefined;
  }

  /**
   * Set up transport event listeners
   */
  private setupTransportListeners(): void {
    this.transport.on('stateChange', (state) => {
      this.setConnectionState(state);
    });

    this.transport.on('message', (message) => {
      this.handleMessage(message);
    });

    this.transport.on('close', (code, reason) => {
      this.handleDisconnect(reason);
    });

    this.transport.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Send authentication message
   */
  private async authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      const authMessage: AuthMessage = {
        type: MessageType.AUTHENTICATE,
        clientId: this.clientId,
        token: this.authToken,
        timestamp: Date.now(),
      };

      // Set up timeout for auth response
      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 10000);

      // Listen for auth response (simplified - in real implementation would be more robust)
      const handleMessage = (message: Message) => {
        if (message.type === MessageType.ERROR) {
          clearTimeout(timeout);
          this.transport.off('message', handleMessage);
          reject(new Error(`Authentication failed: ${message.message}`));
        }
        // For now, assume auth succeeds if no error is received
      };

      this.transport.on('message', handleMessage);
      this.transport.send(authMessage);

      // Resolve after a short delay (in real implementation, wait for auth success message)
      setTimeout(() => {
        clearTimeout(timeout);
        this.transport.off('message', handleMessage);
        resolve();
      }, 1000);
    });
  }

  /**
   * Join a document on the server
   */
  private async joinDocument(documentId: DocumentId): Promise<void> {
    const message: JoinDocumentMessage = {
      type: MessageType.JOIN_DOCUMENT,
      documentId,
      timestamp: Date.now(),
    };

    this.transport.send(message);
  }

  /**
   * Send an operation to the server
   */
  private sendOperation(documentId: DocumentId, operation: Operation): void {
    if (!this.isConnected) {
      return;
    }

    const message: OperationMessage = {
      type: MessageType.OPERATION,
      documentId,
      operation,
      timestamp: Date.now(),
    };

    this.transport.send(message);
  }

  /**
   * Send presence update to the server
   */
  private sendPresenceUpdate(documentId: DocumentId, presence: UserPresence): void {
    if (!this.isConnected) {
      return;
    }

    const message: PresenceUpdateMessage = {
      type: MessageType.PRESENCE_UPDATE,
      documentId,
      presence,
      timestamp: Date.now(),
    };

    this.transport.send(message);
  }

  /**
   * Send a message to the server
   */
  private sendMessage(message: Partial<Message>): void {
    if (!this.isConnected) {
      return;
    }

    const fullMessage = {
      ...message,
      timestamp: Date.now(),
    } as Message;

    this.transport.send(fullMessage);
  }

  /**
   * Handle incoming messages from server
   */
  private handleMessage(message: Message): void {
    this.emit('message', message);

    switch (message.type) {
      case MessageType.DOCUMENT_STATE:
        this.handleDocumentState(message as DocumentStateMessage);
        break;
      
      case MessageType.OPERATION:
        this.handleOperation(message as OperationMessage);
        break;
      
      case MessageType.PRESENCE_UPDATE:
        this.handlePresenceUpdate(message as PresenceUpdateMessage);
        break;
      
      case MessageType.USER_JOIN:
        this.handleUserJoin(message);
        break;
      
      case MessageType.USER_LEAVE:
        this.handleUserLeave(message);
        break;
      
      case MessageType.ERROR:
        this.handleError(message);
        break;
    }
  }

  /**
   * Handle document state message
   */
  private handleDocumentState(message: DocumentStateMessage): void {
    const document = this.documents.get(message.documentId);
    if (document) {
      document.updateState(message.state, message.version);
      document.updatePresence(message.users);
    }
  }

  /**
   * Handle operation message
   */
  private handleOperation(message: OperationMessage): void {
    const document = this.documents.get(message.documentId);
    if (document) {
      document.applyRemoteOperation(message.operation);
    }
  }

  /**
   * Handle presence update message
   */
  private handlePresenceUpdate(message: PresenceUpdateMessage): void {
    const document = this.documents.get(message.documentId);
    if (document) {
      document.updateUserPresence(message.presence);
    }
    
    this.emit('presenceUpdate', message.documentId, message.presence);
  }

  /**
   * Handle user join message
   */
  private handleUserJoin(message: any): void {
    this.emit('userJoined', message.documentId, message.user);
  }

  /**
   * Handle user leave message
   */
  private handleUserLeave(message: any): void {
    this.emit('userLeft', message.documentId, message.user);
  }

  /**
   * Handle error message
   */
  private handleError(message: any): void {
    const error = new Error(message.message);
    this.emit('error', error);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason?: string): void {
    if (this.connectionState === ConnectionState.DISCONNECTED) {
      return;
    }

    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.emit('disconnected', reason);

    if (this.config.reconnection.enabled && reason !== 'Normal closure') {
      this.scheduleReconnect();
    }
  }

  /**
   * Set connection state and emit event
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit('connectionStateChange', state);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.reconnection.attempts) {
      this.setConnectionState(ConnectionState.ERROR);
      return;
    }

    this.setConnectionState(ConnectionState.RECONNECTING);
    
    const delay = Math.min(
      this.config.reconnection.delay * Math.pow(2, this.reconnectAttempts),
      this.config.reconnection.delayMax
    );

    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectAttempts++;
      
      try {
        await this.connect();
      } catch (error) {
        // Will be handled by connect() method
      }
    }, delay);
  }

  /**
   * Cancel reconnection attempt
   */
  private cancelReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
  }
}