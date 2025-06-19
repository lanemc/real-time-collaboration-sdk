/**
 * Authentication service for the collaboration server
 */

import { EventEmitter, ClientId } from '@rtcc/core';
import { ClientInfo } from '../types/server-types.js';

/**
 * Authentication configuration
 */
export interface AuthConfig {
  required: boolean;
  secret?: string;
  verify?: (token: string) => Promise<ClientInfo | null>;
}

/**
 * Events emitted by AuthService
 */
export interface AuthServiceEvents {
  /** Client authenticated successfully */
  clientAuthenticated: (clientId: ClientId, clientInfo: ClientInfo) => void;
  
  /** Authentication failed */
  authenticationFailed: (clientId: ClientId, reason: string) => void;
}

/**
 * Handles client authentication and authorization
 */
export class AuthService extends EventEmitter<AuthServiceEvents> {
  private config: AuthConfig;
  private authenticatedClients = new Map<ClientId, ClientInfo>();

  constructor(config?: AuthConfig) {
    super();
    
    this.config = {
      required: false,
      ...config,
    };
  }

  /**
   * Check if authentication is required
   */
  isAuthRequired(): boolean {
    return this.config.required;
  }

  /**
   * Authenticate a client with a token
   */
  async authenticateClient(clientId: ClientId, token?: string): Promise<ClientInfo | null> {
    // If auth is not required, create a basic client info
    if (!this.config.required) {
      const clientInfo: ClientInfo = {
        clientId,
        name: `User ${clientId.substring(0, 8)}`,
      };
      
      this.authenticatedClients.set(clientId, clientInfo);
      this.emit('clientAuthenticated', clientId, clientInfo);
      return clientInfo;
    }

    // If auth is required but no token provided
    if (!token) {
      this.emit('authenticationFailed', clientId, 'Token required');
      return null;
    }

    try {
      let clientInfo: ClientInfo | null = null;

      // Use custom verification function if provided
      if (this.config.verify) {
        clientInfo = await this.config.verify(token);
      } else {
        // Basic JWT verification (simplified)
        clientInfo = await this.verifyJWT(token, clientId);
      }

      if (clientInfo) {
        this.authenticatedClients.set(clientId, clientInfo);
        this.emit('clientAuthenticated', clientId, clientInfo);
        return clientInfo;
      } else {
        this.emit('authenticationFailed', clientId, 'Invalid token');
        return null;
      }

    } catch (error) {
      this.emit('authenticationFailed', clientId, `Authentication error: ${error}`);
      return null;
    }
  }

  /**
   * Check if a client is authenticated
   */
  isClientAuthenticated(clientId: ClientId): boolean {
    return this.authenticatedClients.has(clientId);
  }

  /**
   * Get client info for an authenticated client
   */
  getClientInfo(clientId: ClientId): ClientInfo | null {
    return this.authenticatedClients.get(clientId) || null;
  }

  /**
   * Update client info
   */
  updateClientInfo(clientId: ClientId, updates: Partial<ClientInfo>): void {
    const clientInfo = this.authenticatedClients.get(clientId);
    if (clientInfo) {
      Object.assign(clientInfo, updates);
      this.authenticatedClients.set(clientId, clientInfo);
    }
  }

  /**
   * Remove client authentication
   */
  removeClient(clientId: ClientId): void {
    this.authenticatedClients.delete(clientId);
  }

  /**
   * Check if client has permission for an action
   */
  checkPermission(clientId: ClientId, permission: string): boolean {
    const clientInfo = this.authenticatedClients.get(clientId);
    if (!clientInfo) {
      return false;
    }

    // If no permissions array, allow all actions
    if (!clientInfo.permissions) {
      return true;
    }

    // Check if client has the specific permission or admin permission
    return clientInfo.permissions.includes(permission) || 
           clientInfo.permissions.includes('admin');
  }

  /**
   * Check if client can access a document
   */
  canAccessDocument(clientId: ClientId, documentId: string): boolean {
    // For now, all authenticated clients can access any document
    // In a real implementation, this would check document-specific permissions
    return this.isClientAuthenticated(clientId);
  }

  /**
   * Check if client can edit a document
   */
  canEditDocument(clientId: ClientId, documentId: string): boolean {
    // Check basic access first
    if (!this.canAccessDocument(clientId, documentId)) {
      return false;
    }

    // Check edit permission
    return this.checkPermission(clientId, 'edit') || 
           this.checkPermission(clientId, `edit:${documentId}`);
  }

  /**
   * Get all authenticated clients
   */
  getAuthenticatedClients(): ClientInfo[] {
    return Array.from(this.authenticatedClients.values());
  }

  /**
   * Get authentication statistics
   */
  getStats(): {
    authenticatedClients: number;
    authRequired: boolean;
  } {
    return {
      authenticatedClients: this.authenticatedClients.size,
      authRequired: this.config.required,
    };
  }

  /**
   * Verify JWT token (simplified implementation)
   */
  private async verifyJWT(token: string, clientId: ClientId): Promise<ClientInfo | null> {
    try {
      // This is a simplified JWT verification
      // In a real implementation, you would use a proper JWT library
      // and verify the signature with your secret key
      
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      // Decode payload (without signature verification for this demo)
      const payload = JSON.parse(atob(parts[1]));
      
      // Check expiration
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return null;
      }

      // Create client info from JWT payload
      const clientInfo: ClientInfo = {
        clientId,
        userId: payload.sub || payload.userId,
        name: payload.name || payload.displayName,
        avatar: payload.avatar || payload.picture,
        permissions: payload.permissions || ['read', 'edit'],
      };

      return clientInfo;

    } catch (error) {
      return null;
    }
  }

  /**
   * Create a simple demo token (for testing purposes)
   */
  static createDemoToken(userData: {
    userId: string;
    name: string;
    permissions?: string[];
  }): string {
    const payload = {
      sub: userData.userId,
      name: userData.name,
      permissions: userData.permissions || ['read', 'edit'],
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24 hours
    };

    // Create a simple token (not secure, for demo only)
    const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
    const encodedPayload = btoa(JSON.stringify(payload));
    
    return `${header}.${encodedPayload}.demo-signature`;
  }

  /**
   * Validate client session (check if still valid)
   */
  async validateClientSession(clientId: ClientId): Promise<boolean> {
    const clientInfo = this.authenticatedClients.get(clientId);
    if (!clientInfo) {
      return false;
    }

    // In a real implementation, you might check if the token is still valid,
    // check with an external auth service, etc.
    
    return true;
  }

  /**
   * Refresh client authentication
   */
  async refreshClientAuth(clientId: ClientId, newToken: string): Promise<boolean> {
    try {
      const clientInfo = await this.authenticateClient(clientId, newToken);
      return clientInfo !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Revoke client authentication
   */
  revokeClientAuth(clientId: ClientId): void {
    this.authenticatedClients.delete(clientId);
  }
}