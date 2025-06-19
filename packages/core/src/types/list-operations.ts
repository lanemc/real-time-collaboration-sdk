/**
 * List-specific operations for collaborative list editing
 */

import { Operation, OperationId, ClientId, Version } from './base.js';

/**
 * Base interface for all list operations
 */
export interface ListOperation extends Operation {
  /** Index in the list where this operation applies */
  index: number;
}

/**
 * Insert an item at a specific index
 */
export interface InsertListOperation extends ListOperation {
  type: 'list-insert';
  /** Item to insert */
  item: any;
}

/**
 * Delete an item at a specific index
 */
export interface DeleteListOperation extends ListOperation {
  type: 'list-delete';
  /** Number of items to delete (default: 1) */
  count?: number;
}

/**
 * Replace an item at a specific index
 */
export interface ReplaceListOperation extends ListOperation {
  type: 'list-replace';
  /** New item value */
  item: any;
  /** Old item value (for conflict resolution) */
  oldItem?: any;
}

/**
 * Move an item from one index to another
 */
export interface MoveListOperation extends ListOperation {
  type: 'list-move';
  /** Target index to move to */
  targetIndex: number;
}

/**
 * Union type for all list operations
 */
export type ListOperationType = 
  | InsertListOperation 
  | DeleteListOperation 
  | ReplaceListOperation
  | MoveListOperation;

/**
 * Create an insert list operation
 */
export function createListInsertOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  index: number,
  item: any
): InsertListOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'list-insert',
    index,
    item,
    timestamp: Date.now(),
  };
}

/**
 * Create a delete list operation
 */
export function createListDeleteOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  index: number,
  count: number = 1
): DeleteListOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'list-delete',
    index,
    count,
    timestamp: Date.now(),
  };
}

/**
 * Create a replace list operation
 */
export function createListReplaceOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  index: number,
  item: any,
  oldItem?: any
): ReplaceListOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'list-replace',
    index,
    item,
    oldItem,
    timestamp: Date.now(),
  };
}

/**
 * Create a move list operation
 */
export function createListMoveOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  index: number,
  targetIndex: number
): MoveListOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'list-move',
    index,
    targetIndex,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to check if an operation is a list operation
 */
export function isListOperation(operation: Operation): operation is ListOperationType {
  return operation.type.startsWith('list-');
}

/**
 * Helper function to check if an operation is a list insert operation
 */
export function isListInsertOperation(operation: Operation): operation is InsertListOperation {
  return operation.type === 'list-insert';
}

/**
 * Helper function to check if an operation is a list delete operation
 */
export function isListDeleteOperation(operation: Operation): operation is DeleteListOperation {
  return operation.type === 'list-delete';
}

/**
 * Helper function to check if an operation is a list replace operation
 */
export function isListReplaceOperation(operation: Operation): operation is ReplaceListOperation {
  return operation.type === 'list-replace';
}

/**
 * Helper function to check if an operation is a list move operation
 */
export function isListMoveOperation(operation: Operation): operation is MoveListOperation {
  return operation.type === 'list-move';
}