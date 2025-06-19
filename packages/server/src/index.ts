/**
 * Real-Time Collaboration Server
 * Main entry point for the collaboration server
 */

export { CollaborationServer } from './server.js';

// Types and interfaces
export * from './types/server-types.js';

// Services
export { DocumentManager } from './services/document-manager.js';
export { ClientManager } from './services/client-manager.js';
export { AuthService } from './services/auth-service.js';
export { MessageHandler } from './services/message-handler.js';

// Re-export core types for convenience
export {
  Operation,
  DocumentId,
  ClientId,
  Version,
} from '@lanemc/core';

// Version information
export const VERSION = '0.1.0';