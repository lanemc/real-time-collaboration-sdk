/**
 * Base types and interfaces for the Real-Time Collaboration Core
 */

/**
 * Unique identifier for operations
 */
export type OperationId = string;

/**
 * Unique identifier for documents
 */
export type DocumentId = string;

/**
 * Unique identifier for users/clients
 */
export type ClientId = string;

/**
 * Version/revision number for documents
 */
export type Version = number;

/**
 * Base operation interface that all operations must implement
 */
export interface Operation {
  /** Unique identifier for this operation */
  id: OperationId;
  
  /** Client that generated this operation */
  clientId: ClientId;
  
  /** Document version this operation is based on */
  baseVersion: Version;
  
  /** Type of operation (insert, delete, set, etc.) */
  type: string;
  
  /** Timestamp when operation was created */
  timestamp: number;
}

/**
 * Result of transforming one operation against another
 */
export interface TransformResult<T extends Operation> {
  /** The transformed operation */
  operation: T;
  
  /** Whether the operation was modified during transformation */
  wasTransformed: boolean;
}

/**
 * Interface for objects that can apply operations
 */
export interface Applicable<T extends Operation, S> {
  /**
   * Apply an operation to the current state
   */
  apply(operation: T): S;
}

/**
 * Interface for objects that can transform operations
 */
export interface Transformable<T extends Operation> {
  /**
   * Transform operation A against operation B
   * Returns A' such that applying B then A' has the same effect as applying A then B'
   */
  transform(operationA: T, operationB: T): TransformResult<T>;
}

/**
 * Base shared data type interface
 */
export interface SharedType<T extends Operation, S> 
  extends Applicable<T, S>, Transformable<T> {
  
  /** Current state/value of this shared type */
  readonly value: S;
  
  /** Current version of this shared type */
  readonly version: Version;
  
  /** Generate operations for changing this type */
  generateOperations(oldValue: S, newValue: S): T[];
  
  /** Check if two operations conflict */
  conflicts(operationA: T, operationB: T): boolean;
}

/**
 * Document state containing multiple shared types
 */
export interface DocumentState {
  /** Document identifier */
  id: DocumentId;
  
  /** Current version */
  version: Version;
  
  /** Map of field names to their shared types */
  fields: Record<string, any>;
  
  /** Metadata about the document */
  metadata: {
    createdAt: number;
    updatedAt: number;
    createdBy: ClientId;
  };
}

/**
 * Event types for shared data changes
 */
export interface SharedTypeEvents<S> {
  /** Emitted when the value changes */
  change: (newValue: S, oldValue: S) => void;
  
  /** Emitted when an operation is applied */
  operation: (operation: Operation) => void;
  
  /** Emitted when operations are transformed */
  transform: (original: Operation, transformed: Operation) => void;
}

/**
 * Generic event emitter interface
 */
export interface EventEmitter<Events extends Record<string, (...args: any[]) => void>> {
  on<K extends keyof Events>(event: K, listener: Events[K]): void;
  off<K extends keyof Events>(event: K, listener: Events[K]): void;
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void;
}