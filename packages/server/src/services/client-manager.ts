/**
 * Client management service for the collaboration server
 */

import { EventEmitter, ClientId, DocumentId } from '@thesaasdevkit/core';
import { ConnectedClient, UserPresence } from '../types/server-types.js';

/**
 * Events emitted by ClientManager
 */
export interface ClientManagerEvents {
  /** Client added */
  clientAdded: (client: ConnectedClient) => void;
  
  /** Client removed */
  clientRemoved: (client: ConnectedClient) => void;
  
  /** Client updated */
  clientUpdated: (client: ConnectedClient) => void;
  
  /** Allow additional events */
  [key: string]: (...args: any[]) => void;
}

/**
 * Manages connected clients and their presence
 */
export class ClientManager extends EventEmitter<ClientManagerEvents> {
  private clients = new Map<ClientId, ConnectedClient>();
  private documentClients = new Map<DocumentId, Set<ClientId>>();

  constructor() {
    super();
  }

  /**
   * Add a new client
   */
  addClient(client: ConnectedClient): void {
    this.clients.set(client.clientId, client);
    this.emit('clientAdded', client);
  }

  /**
   * Remove a client
   */
  removeClient(clientId: ClientId): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Remove from all documents
    for (const documentId of client.documents) {
      this.removeClientFromDocument(documentId, clientId);
    }

    // Remove from clients map
    this.clients.delete(clientId);
    this.emit('clientRemoved', client);
  }

  /**
   * Get a client by ID
   */
  getClient(clientId: ClientId): ConnectedClient | null {
    return this.clients.get(clientId) || null;
  }

  /**
   * Get all clients
   */
  getAllClients(): ConnectedClient[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get clients in a specific document
   */
  getClientsInDocument(documentId: DocumentId): ConnectedClient[] {
    const clientIds = this.documentClients.get(documentId);
    if (!clientIds) {
      return [];
    }

    const clients: ConnectedClient[] = [];
    for (const clientId of clientIds) {
      const client = this.clients.get(clientId);
      if (client) {
        clients.push(client);
      }
    }

    return clients;
  }

  /**
   * Add client to document
   */
  addClientToDocument(documentId: DocumentId, clientId: ClientId): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    // Add to document clients
    if (!this.documentClients.has(documentId)) {
      this.documentClients.set(documentId, new Set());
    }
    this.documentClients.get(documentId)!.add(clientId);

    // Add to client's documents
    client.documents.add(documentId);
  }

  /**
   * Remove client from document
   */
  removeClientFromDocument(documentId: DocumentId, clientId: ClientId): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.documents.delete(documentId);
      client.presence.delete(documentId);
    }

    // Remove from document clients
    const documentClientSet = this.documentClients.get(documentId);
    if (documentClientSet) {
      documentClientSet.delete(clientId);
      
      // Clean up empty document client sets
      if (documentClientSet.size === 0) {
        this.documentClients.delete(documentId);
      }
    }
  }

  /**
   * Update client presence for a document
   */
  updateClientPresence(clientId: ClientId, documentId: DocumentId, presence: UserPresence): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    client.presence.set(documentId, presence);
    client.lastActivity = Date.now();
    this.emit('clientUpdated', client);
  }

  /**
   * Get client presence for a document
   */
  getClientPresence(clientId: ClientId, documentId: DocumentId): UserPresence | null {
    const client = this.clients.get(clientId);
    if (!client) {
      return null;
    }

    return client.presence.get(documentId) || null;
  }

  /**
   * Get all presence data for a document
   */
  getDocumentPresence(documentId: DocumentId): UserPresence[] {
    const clients = this.getClientsInDocument(documentId);
    const presence: UserPresence[] = [];

    for (const client of clients) {
      const clientPresence = client.presence.get(documentId);
      if (clientPresence) {
        presence.push(clientPresence);
      } else {
        // Create basic presence if not set
        presence.push({
          clientId: client.clientId,
          userId: client.info.userId,
          name: client.info.name,
          avatar: client.info.avatar,
          lastSeen: client.lastActivity,
          isOnline: true,
        });
      }
    }

    return presence;
  }

  /**
   * Update client info
   */
  updateClientInfo(clientId: ClientId, info: Partial<ConnectedClient['info']>): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }

    Object.assign(client.info, info);
    this.emit('clientUpdated', client);
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get number of clients in a document
   */
  getDocumentClientCount(documentId: DocumentId): number {
    const clientIds = this.documentClients.get(documentId);
    return clientIds ? clientIds.size : 0;
  }

  /**
   * Check if client is connected
   */
  isClientConnected(clientId: ClientId): boolean {
    return this.clients.has(clientId);
  }

  /**
   * Check if client is in document
   */
  isClientInDocument(clientId: ClientId, documentId: DocumentId): boolean {
    const client = this.clients.get(clientId);
    return client ? client.documents.has(documentId) : false;
  }

  /**
   * Get client statistics
   */
  getClientStats(clientId: ClientId): {
    documentsCount: number;
    lastActivity: number;
    connectionTime: number;
  } | null {
    const client = this.clients.get(clientId);
    if (!client) {
      return null;
    }

    return {
      documentsCount: client.documents.size,
      lastActivity: client.lastActivity,
      connectionTime: Date.now() - client.lastActivity, // Simplified
    };
  }

  /**
   * Clean up inactive clients
   */
  cleanupInactiveClients(timeoutMs: number = 5 * 60 * 1000): void {
    const now = Date.now();
    const inactiveClients: ClientId[] = [];

    for (const [clientId, client] of this.clients) {
      if (now - client.lastActivity > timeoutMs) {
        // Check if WebSocket is still alive
        if (client.socket.readyState !== client.socket.OPEN) {
          inactiveClients.push(clientId);
        }
      }
    }

    // Remove inactive clients
    for (const clientId of inactiveClients) {
      this.removeClient(clientId);
    }
  }

  /**
   * Get all document IDs with clients
   */
  getActiveDocumentIds(): DocumentId[] {
    return Array.from(this.documentClients.keys());
  }

  /**
   * Broadcast to all clients in a document
   */
  broadcastToDocument(
    documentId: DocumentId, 
    message: any, 
    excludeClientId?: ClientId
  ): void {
    const clients = this.getClientsInDocument(documentId);
    
    for (const client of clients) {
      if (client.clientId === excludeClientId) {
        continue;
      }

      if (client.socket.readyState === client.socket.OPEN) {
        try {
          client.socket.send(JSON.stringify(message));
        } catch (error) {
          // Log error but continue with other clients
          console.error(`Error sending to client ${client.clientId}:`, error);
        }
      }
    }
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId: ClientId, message: any): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== client.socket.OPEN) {
      return false;
    }

    try {
      client.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Get summary statistics
   */
  getStats(): {
    totalClients: number;
    activeDocuments: number;
    averageClientsPerDocument: number;
  } {
    const totalClients = this.clients.size;
    const activeDocuments = this.documentClients.size;
    const averageClientsPerDocument = activeDocuments > 0 
      ? Array.from(this.documentClients.values())
          .reduce((sum, clients) => sum + clients.size, 0) / activeDocuments
      : 0;

    return {
      totalClients,
      activeDocuments,
      averageClientsPerDocument,
    };
  }
}