/**
 * Type definitions for the collaboration server
 */

import { WebSocket } from 'ws';
import { Operation, DocumentId, ClientId, Version } from '@rtc-sdk/core';

/**
 * Server configuration options
 */
export interface ServerConfig {
  /** Port to listen on */
  port: number;
  
  /** Host to bind to */
  host?: string;
  
  /** CORS configuration */
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
  };
  
  /** Authentication configuration */
  auth?: {
    required: boolean;
    secret?: string;
    verify?: (token: string) => Promise<ClientInfo | null>;
  };
  
  /** Rate limiting */
  rateLimit?: {
    windowMs: number;
    max: number;
  };
  
  /** Document persistence */
  persistence?: {
    enabled: boolean;
    adapter?: PersistenceAdapter;
  };
  
  /** Logging configuration */
  logging?: {
    level: 'error' | 'warn' | 'info' | 'debug';
  };
}

/**
 * Client information
 */
export interface ClientInfo {
  clientId: ClientId;
  userId?: string;
  name?: string;
  avatar?: string;
  permissions?: string[];
}

/**
 * Connected client
 */
export interface ConnectedClient {
  clientId: ClientId;
  socket: WebSocket;
  info: ClientInfo;
  documents: Set<DocumentId>;
  lastActivity: number;
  presence: Map<DocumentId, UserPresence>;
}

/**
 * User presence information
 */
export interface UserPresence {
  clientId: ClientId;
  userId?: string;
  name?: string;
  avatar?: string;
  cursor?: {
    position: number;
    selection?: [number, number];
  };
  lastSeen: number;
  isOnline: boolean;
}

/**
 * Document state in memory
 */
export interface DocumentState {
  id: DocumentId;
  version: Version;
  data: any;
  operations: Operation[];
  clients: Set<ClientId>;
  createdAt: number;
  updatedAt: number;
  schema?: any;
}

/**
 * Persistence adapter interface
 */
export interface PersistenceAdapter {
  /** Save document state */
  saveDocument(document: DocumentState): Promise<void>;
  
  /** Load document state */
  loadDocument(documentId: DocumentId): Promise<DocumentState | null>;
  
  /** Save operation */
  saveOperation(documentId: DocumentId, operation: Operation): Promise<void>;
  
  /** Load operations since version */
  loadOperations(documentId: DocumentId, sinceVersion: Version): Promise<Operation[]>;
  
  /** Delete document */
  deleteDocument(documentId: DocumentId): Promise<void>;
  
  /** List all documents */
  listDocuments(): Promise<DocumentId[]>;
}

/**
 * Message types for server-client communication
 */
export enum ServerMessageType {
  // Connection
  AUTH_REQUIRED = 'auth_required',
  AUTH_SUCCESS = 'auth_success',
  AUTH_FAILED = 'auth_failed',
  
  // Document
  DOCUMENT_JOINED = 'document_joined',
  DOCUMENT_LEFT = 'document_left',
  DOCUMENT_STATE = 'document_state',
  
  // Operations
  OPERATION_APPLIED = 'operation_applied',
  OPERATION_FAILED = 'operation_failed',
  
  // Presence
  PRESENCE_UPDATE = 'presence_update',
  USER_JOINED = 'user_joined',
  USER_LEFT = 'user_left',
  
  // Errors
  ERROR = 'error',
  
  // System
  PING = 'ping',
  PONG = 'pong',
}

/**
 * Base server message
 */
export interface BaseServerMessage {
  type: ServerMessageType;
  id?: string;
  timestamp: number;
}

/**
 * Authentication required message
 */
export interface AuthRequiredMessage extends BaseServerMessage {
  type: ServerMessageType.AUTH_REQUIRED;
}

/**
 * Authentication success message
 */
export interface AuthSuccessMessage extends BaseServerMessage {
  type: ServerMessageType.AUTH_SUCCESS;
  clientInfo: ClientInfo;
}

/**
 * Authentication failed message
 */
export interface AuthFailedMessage extends BaseServerMessage {
  type: ServerMessageType.AUTH_FAILED;
  reason: string;
}

/**
 * Document joined message
 */
export interface DocumentJoinedMessage extends BaseServerMessage {
  type: ServerMessageType.DOCUMENT_JOINED;
  documentId: DocumentId;
  version: Version;
  state: any;
  users: UserPresence[];
}

/**
 * Operation applied message
 */
export interface OperationAppliedMessage extends BaseServerMessage {
  type: ServerMessageType.OPERATION_APPLIED;
  documentId: DocumentId;
  operation: Operation;
}

/**
 * Server error message
 */
export interface ServerErrorMessage extends BaseServerMessage {
  type: ServerMessageType.ERROR;
  code: string;
  message: string;
  details?: any;
}

/**
 * Server message union type
 */
export type ServerMessage = 
  | AuthRequiredMessage
  | AuthSuccessMessage
  | AuthFailedMessage
  | DocumentJoinedMessage
  | OperationAppliedMessage
  | ServerErrorMessage;

/**
 * Error codes
 */
export enum ErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  INVALID_OPERATION = 'INVALID_OPERATION',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVER_ERROR = 'SERVER_ERROR',
}

/**
 * Server events
 */
export interface ServerEvents {
  /** Client connected */
  clientConnected: (client: ConnectedClient) => void;
  
  /** Client disconnected */
  clientDisconnected: (client: ConnectedClient, reason?: string) => void;
  
  /** Client joined document */
  documentJoined: (documentId: DocumentId, client: ConnectedClient) => void;
  
  /** Client left document */
  documentLeft: (documentId: DocumentId, client: ConnectedClient) => void;
  
  /** Operation received */
  operationReceived: (documentId: DocumentId, operation: Operation, client: ConnectedClient) => void;
  
  /** Operation applied */
  operationApplied: (documentId: DocumentId, operation: Operation) => void;
  
  /** Error occurred */
  error: (error: Error, client?: ConnectedClient) => void;
  
  /** Allow additional events */
  [key: string]: (...args: any[]) => void;
}