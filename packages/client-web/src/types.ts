/**
 * Type definitions for the web client SDK
 */

import { Operation, DocumentId, ClientId, Version } from '@rtcc/core';

/**
 * Configuration options for the collaboration client
 */
export interface CollabClientConfig {
  /** WebSocket server URL */
  serverUrl: string;
  
  /** Authentication token */
  token?: string;
  
  /** Client identifier (auto-generated if not provided) */
  clientId?: ClientId;
  
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  
  /** Reconnection options */
  reconnection?: {
    enabled: boolean;
    attempts: number;
    delay: number;
    delayMax: number;
  };
  
  /** Additional headers for WebSocket connection */
  headers?: Record<string, string>;
}

/**
 * Connection states
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

/**
 * Message types for WebSocket communication
 */
export enum MessageType {
  // Connection management
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  AUTHENTICATE = 'authenticate',
  
  // Document management
  JOIN_DOCUMENT = 'join_document',
  LEAVE_DOCUMENT = 'leave_document',
  DOCUMENT_STATE = 'document_state',
  
  // Operations
  OPERATION = 'operation',
  OPERATION_ACK = 'operation_ack',
  OPERATION_TRANSFORM = 'operation_transform',
  
  // Presence
  PRESENCE_UPDATE = 'presence_update',
  PRESENCE_STATE = 'presence_state',
  USER_JOIN = 'user_join',
  USER_LEAVE = 'user_leave',
  
  // Errors
  ERROR = 'error',
}

/**
 * Base message structure
 */
export interface BaseMessage {
  type: MessageType;
  id?: string;
  timestamp: number;
}

/**
 * Authentication message
 */
export interface AuthMessage extends BaseMessage {
  type: MessageType.AUTHENTICATE;
  token?: string;
  clientId: ClientId;
}

/**
 * Document join message
 */
export interface JoinDocumentMessage extends BaseMessage {
  type: MessageType.JOIN_DOCUMENT;
  documentId: DocumentId;
}

/**
 * Document state message
 */
export interface DocumentStateMessage extends BaseMessage {
  type: MessageType.DOCUMENT_STATE;
  documentId: DocumentId;
  state: any;
  version: Version;
  users: UserPresence[];
}

/**
 * Operation message
 */
export interface OperationMessage extends BaseMessage {
  type: MessageType.OPERATION;
  documentId: DocumentId;
  operation: Operation;
}

/**
 * Operation acknowledgment message
 */
export interface OperationAckMessage extends BaseMessage {
  type: MessageType.OPERATION_ACK;
  operationId: string;
  version: Version;
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
 * Presence update message
 */
export interface PresenceUpdateMessage extends BaseMessage {
  type: MessageType.PRESENCE_UPDATE;
  documentId: DocumentId;
  presence: UserPresence;
}

/**
 * Error message
 */
export interface ErrorMessage extends BaseMessage {
  type: MessageType.ERROR;
  code: string;
  message: string;
  details?: any;
}

/**
 * Union type for all messages
 */
export type Message = 
  | AuthMessage
  | JoinDocumentMessage
  | DocumentStateMessage
  | OperationMessage
  | OperationAckMessage
  | PresenceUpdateMessage
  | ErrorMessage;

/**
 * Document schema definition
 */
export interface DocumentSchema {
  type: 'text' | 'list' | 'map' | 'composite';
  fields?: Record<string, DocumentSchema>;
  itemType?: DocumentSchema;
  initialValue?: any;
}

/**
 * Events emitted by the collaboration client
 */
export interface CollabClientEvents {
  /** Connection state changed */
  connectionStateChange: (state: ConnectionState) => void;
  
  /** Connected to server */
  connected: () => void;
  
  /** Disconnected from server */
  disconnected: (reason?: string) => void;
  
  /** Error occurred */
  error: (error: Error) => void;
  
  /** Message received from server */
  message: (message: Message) => void;
  
  /** User joined document */
  userJoined: (documentId: DocumentId, user: UserPresence) => void;
  
  /** User left document */
  userLeft: (documentId: DocumentId, user: UserPresence) => void;
  
  /** Presence updated */
  presenceUpdate: (documentId: DocumentId, presence: UserPresence) => void;
}