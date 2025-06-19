/**
 * Text-specific operations for collaborative text editing
 */

import { Operation, OperationId, ClientId, Version } from './base.js';

/**
 * Base interface for all text operations
 */
export interface TextOperation extends Operation {
  /** Position in the text where this operation applies */
  position: number;
}

/**
 * Insert text at a specific position
 */
export interface InsertTextOperation extends TextOperation {
  type: 'text-insert';
  /** Text to insert */
  text: string;
  /** Optional attributes for rich text */
  attributes?: Record<string, any>;
}

/**
 * Delete text at a specific position
 */
export interface DeleteTextOperation extends TextOperation {
  type: 'text-delete';
  /** Number of characters to delete */
  length: number;
}

/**
 * Retain text (no-op, used for positioning in complex operations)
 */
export interface RetainTextOperation extends TextOperation {
  type: 'text-retain';
  /** Number of characters to retain */
  length: number;
  /** Optional attributes to apply to retained text */
  attributes?: Record<string, any>;
}

/**
 * Union type for all text operations
 */
export type TextOperationType = 
  | InsertTextOperation 
  | DeleteTextOperation 
  | RetainTextOperation;

/**
 * Create an insert text operation
 */
export function createInsertOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  position: number,
  text: string,
  attributes?: Record<string, any>
): InsertTextOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'text-insert',
    position,
    text,
    attributes,
    timestamp: Date.now(),
  };
}

/**
 * Create a delete text operation
 */
export function createDeleteOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  position: number,
  length: number
): DeleteTextOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'text-delete',
    position,
    length,
    timestamp: Date.now(),
  };
}

/**
 * Create a retain text operation
 */
export function createRetainOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  position: number,
  length: number,
  attributes?: Record<string, any>
): RetainTextOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'text-retain',
    position,
    length,
    attributes,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to check if an operation is a text operation
 */
export function isTextOperation(operation: Operation): operation is TextOperationType {
  return operation.type.startsWith('text-');
}

/**
 * Helper function to check if an operation is an insert operation
 */
export function isInsertOperation(operation: Operation): operation is InsertTextOperation {
  return operation.type === 'text-insert';
}

/**
 * Helper function to check if an operation is a delete operation
 */
export function isDeleteOperation(operation: Operation): operation is DeleteTextOperation {
  return operation.type === 'text-delete';
}

/**
 * Helper function to check if an operation is a retain operation
 */
export function isRetainOperation(operation: Operation): operation is RetainTextOperation {
  return operation.type === 'text-retain';
}