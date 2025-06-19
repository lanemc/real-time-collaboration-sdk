/**
 * Real-Time Collaboration SDK - Web Client
 * Main entry point for the web client library
 */

// Main client class
export { CollabClient } from './client/collab-client.js';
export { CollabDocument } from './client/collab-document.js';

// Types and interfaces
export * from './types.js';

// Transport layer
export { WebSocketTransport } from './transports/websocket-transport.js';

// Re-export core types for convenience
export {
  SharedText,
  SharedList,
  SharedMap,
  Operation,
  DocumentId,
  ClientId,
  Version,
} from '@lanemc/core';

// Version information
export const VERSION = '0.1.0';