/**
 * Message handling service for the collaboration server
 */

import { EventEmitter, Operation, DocumentId, ClientId } from '@rtcc/core';
import { DocumentManager } from './document-manager.js';
import { ClientManager } from './client-manager.js';
import { AuthService } from './auth-service.js';
import {
  ConnectedClient,
  ServerMessageType,
  ErrorCode,
  UserPresence,
} from '../types/server-types.js';

/**
 * Message types from client
 */
enum ClientMessageType {
  AUTHENTICATE = 'authenticate',
  JOIN_DOCUMENT = 'join_document',
  LEAVE_DOCUMENT = 'leave_document',
  OPERATION = 'operation',
  PRESENCE_UPDATE = 'presence_update',
  PING = 'ping',
}

/**
 * Events emitted by MessageHandler
 */
export interface MessageHandlerEvents {
  /** Client joined document */
  documentJoined: (documentId: DocumentId, client: ConnectedClient) => void;
  
  /** Client left document */
  documentLeft: (documentId: DocumentId, client: ConnectedClient) => void;
  
  /** Operation received from client */
  operationReceived: (documentId: DocumentId, operation: Operation, client: ConnectedClient) => void;
  
  /** Presence updated */
  presenceUpdated: (documentId: DocumentId, presence: UserPresence, client: ConnectedClient) => void;
}

/**
 * Handles incoming messages from clients
 */
export class MessageHandler extends EventEmitter<MessageHandlerEvents> {
  private documentManager: DocumentManager;
  private clientManager: ClientManager;
  private authService: AuthService;

  constructor(
    documentManager: DocumentManager,
    clientManager: ClientManager,
    authService: AuthService
  ) {
    super();
    this.documentManager = documentManager;
    this.clientManager = clientManager;
    this.authService = authService;
  }

  /**
   * Handle incoming message from client
   */
  async handleMessage(client: ConnectedClient, message: any): Promise<void> {
    try {
      switch (message.type) {
        case ClientMessageType.AUTHENTICATE:
          await this.handleAuthenticate(client, message);
          break;

        case ClientMessageType.JOIN_DOCUMENT:
          await this.handleJoinDocument(client, message);
          break;

        case ClientMessageType.LEAVE_DOCUMENT:
          await this.handleLeaveDocument(client, message);
          break;

        case ClientMessageType.OPERATION:
          await this.handleOperation(client, message);
          break;

        case ClientMessageType.PRESENCE_UPDATE:
          await this.handlePresenceUpdate(client, message);
          break;

        case ClientMessageType.PING:
          this.handlePing(client, message);
          break;

        default:
          this.sendError(client, ErrorCode.SERVER_ERROR, `Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.sendError(client, ErrorCode.SERVER_ERROR, 'Internal server error');
    }
  }

  /**
   * Handle authentication message
   */
  private async handleAuthenticate(client: ConnectedClient, message: any): Promise<void> {
    const { token, clientId } = message;

    // Update client ID if provided
    if (clientId && clientId !== client.clientId) {
      // Remove old client and update with new ID
      this.clientManager.removeClient(client.clientId);
      client.clientId = clientId;
      this.clientManager.addClient(client);
    }

    const clientInfo = await this.authService.authenticateClient(client.clientId, token);

    if (clientInfo) {
      // Update client info
      client.info = clientInfo;
      this.clientManager.updateClientInfo(client.clientId, clientInfo);

      // Send success response
      this.sendMessage(client, {
        type: ServerMessageType.AUTH_SUCCESS,
        clientInfo,
        timestamp: Date.now(),
      });
    } else {
      // Send failure response
      this.sendMessage(client, {
        type: ServerMessageType.AUTH_FAILED,
        reason: 'Invalid credentials',
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handle join document message
   */
  private async handleJoinDocument(client: ConnectedClient, message: any): Promise<void> {
    const { documentId } = message;

    // Check authentication if required
    if (this.authService.isAuthRequired() && !this.authService.isClientAuthenticated(client.clientId)) {
      this.sendError(client, ErrorCode.UNAUTHORIZED, 'Authentication required');
      return;
    }

    // Check document access permission
    if (!this.authService.canAccessDocument(client.clientId, documentId)) {
      this.sendError(client, ErrorCode.FORBIDDEN, 'Access denied to document');
      return;
    }

    try {
      // Get or create document
      const document = await this.documentManager.getOrCreateDocument(documentId, message.schema);

      // Add client to document
      this.documentManager.addClientToDocument(documentId, client.clientId);
      this.clientManager.addClientToDocument(documentId, client.clientId);

      // Get current users in document
      const users = this.clientManager.getDocumentPresence(documentId);

      // Send document state to client
      this.sendMessage(client, {
        type: ServerMessageType.DOCUMENT_JOINED,
        documentId,
        version: document.version,
        state: document.data,
        users,
        timestamp: Date.now(),
      });

      // Notify other users that this client joined
      this.broadcastToDocument(documentId, {
        type: ServerMessageType.USER_JOINED,
        documentId,
        user: this.clientToPresence(client),
        timestamp: Date.now(),
      }, client.clientId);

      this.emit('documentJoined', documentId, client);

    } catch (error) {
      this.sendError(client, ErrorCode.SERVER_ERROR, `Failed to join document: ${error}`);
    }
  }

  /**
   * Handle leave document message
   */
  private async handleLeaveDocument(client: ConnectedClient, message: any): Promise<void> {
    const { documentId } = message;

    // Remove client from document
    this.documentManager.removeClientFromDocument(documentId, client.clientId);
    this.clientManager.removeClientFromDocument(documentId, client.clientId);

    // Notify other users that this client left
    this.broadcastToDocument(documentId, {
      type: ServerMessageType.USER_LEFT,
      documentId,
      user: this.clientToPresence(client),
      timestamp: Date.now(),
    }, client.clientId);

    this.emit('documentLeft', documentId, client);
  }

  /**
   * Handle operation message
   */
  private async handleOperation(client: ConnectedClient, message: any): Promise<void> {
    const { documentId, operation } = message;

    // Check if client is in document
    if (!this.clientManager.isClientInDocument(client.clientId, documentId)) {
      this.sendError(client, ErrorCode.FORBIDDEN, 'Not joined to document');
      return;
    }

    // Check edit permission
    if (!this.authService.canEditDocument(client.clientId, documentId)) {
      this.sendError(client, ErrorCode.FORBIDDEN, 'No edit permission');
      return;
    }

    try {
      // Apply operation to document
      const newVersion = await this.documentManager.applyOperation(documentId, operation);

      // Send acknowledgment to client
      this.sendMessage(client, {
        type: ServerMessageType.OPERATION_APPLIED,
        operationId: operation.id,
        version: newVersion,
        timestamp: Date.now(),
      });

      this.emit('operationReceived', documentId, operation, client);

    } catch (error) {
      this.sendError(client, ErrorCode.INVALID_OPERATION, `Operation failed: ${error}`);
    }
  }

  /**
   * Handle presence update message
   */
  private async handlePresenceUpdate(client: ConnectedClient, message: any): Promise<void> {
    const { documentId, presence } = message;

    // Check if client is in document
    if (!this.clientManager.isClientInDocument(client.clientId, documentId)) {
      this.sendError(client, ErrorCode.FORBIDDEN, 'Not joined to document');
      return;
    }

    // Update presence
    const updatedPresence: UserPresence = {
      ...presence,
      clientId: client.clientId,
      lastSeen: Date.now(),
      isOnline: true,
    };

    this.clientManager.updateClientPresence(client.clientId, documentId, updatedPresence);

    // Broadcast presence update to other clients
    this.broadcastToDocument(documentId, {
      type: ServerMessageType.PRESENCE_UPDATE,
      documentId,
      presence: updatedPresence,
      timestamp: Date.now(),
    }, client.clientId);

    this.emit('presenceUpdated', documentId, updatedPresence, client);
  }

  /**
   * Handle ping message
   */
  private handlePing(client: ConnectedClient, message: any): void {
    // Send pong response
    this.sendMessage(client, {
      type: ServerMessageType.PONG,
      timestamp: Date.now(),
    });
  }

  /**
   * Send message to client
   */
  private sendMessage(client: ConnectedClient, message: any): void {
    if (client.socket.readyState === client.socket.OPEN) {
      try {
        client.socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Error sending message to client ${client.clientId}:`, error);
      }
    }
  }

  /**
   * Send error message to client
   */
  private sendError(client: ConnectedClient, code: ErrorCode, message: string, details?: any): void {
    this.sendMessage(client, {
      type: ServerMessageType.ERROR,
      code,
      message,
      details,
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast message to all clients in document
   */
  private broadcastToDocument(documentId: DocumentId, message: any, excludeClientId?: ClientId): void {
    const clients = this.clientManager.getClientsInDocument(documentId);

    for (const client of clients) {
      if (client.clientId === excludeClientId) {
        continue;
      }

      this.sendMessage(client, message);
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
}