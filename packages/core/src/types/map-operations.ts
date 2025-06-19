/**
 * Map/Object-specific operations for collaborative object editing
 */

import { Operation, OperationId, ClientId, Version } from './base.js';

/**
 * Base interface for all map operations
 */
export interface MapOperation extends Operation {
  /** Key in the map where this operation applies */
  key: string;
}

/**
 * Set a key-value pair
 */
export interface SetMapOperation extends MapOperation {
  type: 'map-set';
  /** Value to set */
  value: any;
  /** Previous value (for conflict resolution) */
  previousValue?: any;
}

/**
 * Delete a key from the map
 */
export interface DeleteMapOperation extends MapOperation {
  type: 'map-delete';
  /** Previous value that was deleted (for undo/redo) */
  previousValue?: any;
}

/**
 * Batch operation for multiple map changes
 */
export interface BatchMapOperation extends Operation {
  type: 'map-batch';
  /** Array of operations to apply atomically */
  operations: (SetMapOperation | DeleteMapOperation)[];
}

/**
 * Union type for all map operations
 */
export type MapOperationType = 
  | SetMapOperation 
  | DeleteMapOperation 
  | BatchMapOperation;

/**
 * Create a set map operation
 */
export function createMapSetOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  key: string,
  value: any,
  previousValue?: any
): SetMapOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'map-set',
    key,
    value,
    previousValue,
    timestamp: Date.now(),
  };
}

/**
 * Create a delete map operation
 */
export function createMapDeleteOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  key: string,
  previousValue?: any
): DeleteMapOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'map-delete',
    key,
    previousValue,
    timestamp: Date.now(),
  };
}

/**
 * Create a batch map operation
 */
export function createMapBatchOperation(
  id: OperationId,
  clientId: ClientId,
  baseVersion: Version,
  operations: (SetMapOperation | DeleteMapOperation)[]
): BatchMapOperation {
  return {
    id,
    clientId,
    baseVersion,
    type: 'map-batch',
    operations,
    timestamp: Date.now(),
  };
}

/**
 * Helper function to check if an operation is a map operation
 */
export function isMapOperation(operation: Operation): operation is MapOperationType {
  return operation.type.startsWith('map-');
}

/**
 * Helper function to check if an operation is a map set operation
 */
export function isMapSetOperation(operation: Operation): operation is SetMapOperation {
  return operation.type === 'map-set';
}

/**
 * Helper function to check if an operation is a map delete operation
 */
export function isMapDeleteOperation(operation: Operation): operation is DeleteMapOperation {
  return operation.type === 'map-delete';
}

/**
 * Helper function to check if an operation is a map batch operation
 */
export function isMapBatchOperation(operation: Operation): operation is BatchMapOperation {
  return operation.type === 'map-batch';
}