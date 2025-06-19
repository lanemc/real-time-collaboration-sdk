/**
 * Real-time collaboration server implementation
 */

import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { EventEmitter, Operation, DocumentId, ClientId, Version } from '@thesaasdevkit/core';
import {
  ServerConfig,
  ServerEvents,
  ConnectedClient,
  ClientInfo,
  DocumentState,
  ServerMessage,
  ServerMessageType,
  ErrorCode,
  UserPresence,
} from './types/server-types.js';
import { DocumentManager } from './services/document-manager.js';
import { ClientManager } from './services/client-manager.js';
import { AuthService } from './services/auth-service.js';
import { MessageHandler } from './services/message-handler.js';

/**
 * Real-time collaboration server
 */
export class CollaborationServer extends EventEmitter<ServerEvents> {
  private config: ServerConfig;
  private app: Express;
  private httpServer: HttpServer;
  private wss: WebSocketServer;
  private documentManager: DocumentManager;
  private clientManager: ClientManager;
  private authService: AuthService;
  private messageHandler: MessageHandler;
  private isRunning = false;

  constructor(config: ServerConfig) {
    super();
    
    this.config = {
      host: '0.0.0.0',
      cors: { origin: true },
      auth: { required: false },
      persistence: { enabled: false },
      logging: { level: 'info' },
      ...config,
    };

    // Initialize Express app
    this.app = express();
    this.setupMiddleware();

    // Create HTTP server
    this.httpServer = createServer(this.app);

    // Initialize services
    this.documentManager = new DocumentManager(this.config.persistence);
    this.clientManager = new ClientManager();
    this.authService = new AuthService(this.config.auth);
    this.messageHandler = new MessageHandler(
      this.documentManager,
      this.clientManager,
      this.authService
    );

    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      server: this.httpServer,
      path: '/ws',
    });

    this.setupWebSocketServer();
    this.setupEventListeners();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Server is already running');
    }

    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.config.port, this.config.host, (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        this.isRunning = true;
        this.log('info', `Server started on ${this.config.host}:${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      // Close all WebSocket connections
      this.wss.clients.forEach((ws) => {
        ws.close(1001, 'Server shutting down');
      });

      // Close WebSocket server
      this.wss.close(() => {
        // Close HTTP server
        this.httpServer.close(() => {
          this.isRunning = false;
          this.log('info', 'Server stopped');
          resolve();
        });
      });
    });
  }

  /**
   * Get server statistics
   */
  getStats(): {
    connectedClients: number;
    activeDocuments: number;
    totalOperations: number;
    uptime: number;
  } {
    return {
      connectedClients: this.clientManager.getClientCount(),
      activeDocuments: this.documentManager.getDocumentCount(),
      totalOperations: this.documentManager.getTotalOperations(),
      uptime: process.uptime(),
    };
  }

  /**
   * Get list of active documents
   */
  getActiveDocuments(): DocumentId[] {
    return this.documentManager.getActiveDocuments();
  }

  /**
   * Get document information
   */
  getDocumentInfo(documentId: DocumentId): DocumentState | null {
    return this.documentManager.getDocument(documentId) || null;
  }

  /**
   * Set up Express middleware
   */
  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    
    // CORS middleware
    if (this.config.cors) {
      this.app.use(cors(this.config.cors));
    }

    // JSON parsing
    this.app.use(express.json({ limit: '1mb' }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ...this.getStats(),
      });
    });

    // API routes
    this.app.get('/api/documents', (req, res) => {
      res.json(this.getActiveDocuments());
    });

    this.app.get('/api/documents/:id', (req, res) => {
      const documentId = req.params.id;
      const document = this.getDocumentInfo(documentId);
      
      if (!document) {
        res.status(404).json({ error: 'Document not found' });
        return;
      }

      res.json({
        id: document.id,
        version: document.version,
        clientCount: document.clients.size,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      });
    });
  }

  /**
   * Set up WebSocket server
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws: WebSocket, request) => {
      this.handleClientConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      this.log('error', 'WebSocket server error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Handle new client connection
   */
  private async handleClientConnection(ws: WebSocket, request: any): Promise<void> {
    const clientId = this.generateClientId();
    
    try {
      // Create client info (will be updated after authentication)
      const clientInfo: ClientInfo = {
        clientId,
      };

      const client: ConnectedClient = {
        clientId,
        socket: ws,
        info: clientInfo,
        documents: new Set(),
        lastActivity: Date.now(),
        presence: new Map(),
      };

      // Add client to manager
      this.clientManager.addClient(client);
      
      this.log('debug', `Client ${clientId} connected from ${request.socket.remoteAddress}`);

      // Set up WebSocket event handlers
      ws.on('message', async (data) => {
        // Convert RawData to Buffer
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data.toString());
        await this.handleClientMessage(client, buffer);
      });

      ws.on('close', (code, reason) => {
        this.handleClientDisconnection(client, code, reason.toString());
      });

      ws.on('error', (error) => {
        this.log('error', `Client ${clientId} error:`, error);
        this.emit('error', error, client);
      });

      // Send authentication requirement if needed
      if (this.config.auth?.required) {
        this.sendToClient(client, {
          type: ServerMessageType.AUTH_REQUIRED,
          timestamp: Date.now(),
        });
      }

      this.emit('clientConnected', client);

    } catch (error) {
      this.log('error', 'Error handling client connection:', error);
      ws.close(1011, 'Server error');
    }
  }

  /**
   * Handle client message
   */
  private async handleClientMessage(client: ConnectedClient, data: Buffer): Promise<void> {
    try {
      const message = JSON.parse(data.toString());
      client.lastActivity = Date.now();
      
      this.log('debug', `Message from ${client.clientId}:`, message.type);
      
      await this.messageHandler.handleMessage(client, message);
      
    } catch (error) {
      this.log('error', `Error handling message from ${client.clientId}:`, error);
      
      this.sendErrorToClient(client, ErrorCode.SERVER_ERROR, 'Invalid message format');
    }
  }

  /**
   * Handle client disconnection
   */
  private handleClientDisconnection(client: ConnectedClient, code: number, reason: string): void {
    this.log('debug', `Client ${client.clientId} disconnected: ${code} ${reason}`);

    // Remove client from all documents
    for (const documentId of client.documents) {
      this.documentManager.removeClientFromDocument(documentId, client.clientId);
      this.broadcastToDocument(documentId, {
        type: ServerMessageType.USER_LEFT,
        documentId,
        user: this.clientToPresence(client),
        timestamp: Date.now(),
      } as any, client.clientId);
      
      this.emit('documentLeft', documentId, client);
    }

    // Remove client from manager
    this.clientManager.removeClient(client.clientId);
    
    this.emit('clientDisconnected', client, reason);
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Document manager events
    this.documentManager.on('operationApplied', (documentId, operation) => {
      this.broadcastToDocument(documentId, {
        type: ServerMessageType.OPERATION_APPLIED,
        documentId,
        operation,
        timestamp: Date.now(),
      });
      
      this.emit('operationApplied', documentId, operation);
    });

    // Message handler events
    this.messageHandler.on('documentJoined', (documentId, client) => {
      this.emit('documentJoined', documentId, client);
    });

    this.messageHandler.on('operationReceived', (documentId, operation, client) => {
      this.emit('operationReceived', documentId, operation, client);
    });
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(client: ConnectedClient, message: ServerMessage): void {
    if (client.socket.readyState === WebSocket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        this.log('error', `Error sending message to client ${client.clientId}:`, error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendErrorToClient(client: ConnectedClient, code: ErrorCode, message: string, details?: any): void {
    this.sendToClient(client, {
      type: ServerMessageType.ERROR,
      code,
      message,
      details,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all clients in a document
   */
  private broadcastToDocument(documentId: DocumentId, message: any, excludeClientId?: ClientId): void {
    const document = this.documentManager.getDocument(documentId);
    if (!document) {
      return;
    }

    for (const clientId of document.clients) {
      if (clientId === excludeClientId) {
        continue;
      }

      const client = this.clientManager.getClient(clientId);
      if (client) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Convert client to presence object
   */
  private clientToPresence(client: ConnectedClient): UserPresence {
    return {
      clientId: client.clientId,
      userId: client.info.userId,
      name: client.info.name,
      avatar: client.info.avatar,
      lastSeen: client.lastActivity,
      isOnline: true,
    };
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): ClientId {
    return `client-${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  /**
   * Log message with level
   */
  private log(level: string, message: string, ...args: any[]): void {
    const levels = ['error', 'warn', 'info', 'debug'];
    const configLevel = this.config.logging?.level || 'info';
    
    if (levels.indexOf(level) <= levels.indexOf(configLevel)) {
      const logMethod = console[level as 'error' | 'warn' | 'info' | 'debug'];
      if (logMethod) {
        logMethod.call(console,
          `[${new Date().toISOString()}] [${level.toUpperCase()}]`,
          message,
          ...args
        );
      }
    }
  }
}