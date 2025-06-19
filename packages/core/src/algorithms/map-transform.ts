/**
 * Operational Transformation algorithms for map operations
 */

import { TransformResult } from '../types/base.js';
import {
  MapOperationType,
  SetMapOperation,
  DeleteMapOperation,
  BatchMapOperation,
  isMapSetOperation,
  isMapDeleteOperation,
  isMapBatchOperation,
} from '../types/map-operations.js';

/**
 * Transform operation A against operation B for map operations
 */
export function transformMapOperation(
  operationA: MapOperationType,
  operationB: MapOperationType
): TransformResult<MapOperationType> {
  // Handle batch operations
  if (isMapBatchOperation(operationA)) {
    return transformBatchOperation(operationA, operationB);
  }
  
  if (isMapBatchOperation(operationB)) {
    return transformAgainstBatch(operationA, operationB);
  }
  
  // Set vs Set
  if (isMapSetOperation(operationA) && isMapSetOperation(operationB)) {
    return transformSetSet(operationA, operationB);
  }
  
  // Set vs Delete
  if (isMapSetOperation(operationA) && isMapDeleteOperation(operationB)) {
    return transformSetDelete(operationA, operationB);
  }
  
  // Delete vs Set
  if (isMapDeleteOperation(operationA) && isMapSetOperation(operationB)) {
    return transformDeleteSet(operationA, operationB);
  }
  
  // Delete vs Delete
  if (isMapDeleteOperation(operationA) && isMapDeleteOperation(operationB)) {
    return transformDeleteDelete(operationA, operationB);
  }
  
  // Default case - no transformation needed
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform Set against Set
 * When two sets happen on the same key, we need conflict resolution
 */
function transformSetSet(
  operationA: SetMapOperation,
  operationB: SetMapOperation
): TransformResult<SetMapOperation> {
  if (operationA.key !== operationB.key) {
    // Different keys - no conflict
    return { operation: operationA, wasTransformed: false };
  }
  
  // Same key - conflict resolution needed
  // Use timestamp-based resolution (last write wins)
  // or client ID for deterministic resolution
  if (operationA.timestamp > operationB.timestamp || 
      (operationA.timestamp === operationB.timestamp && operationA.clientId > operationB.clientId)) {
    // A wins - but we need to update previousValue to B's value
    const transformed: SetMapOperation = {
      ...operationA,
      previousValue: operationB.value,
    };
    return { operation: transformed, wasTransformed: true };
  } else {
    // B wins - A becomes a no-op or should be dropped
    // For now, we'll keep A but mark it as transformed
    return { operation: operationA, wasTransformed: true };
  }
}

/**
 * Transform Set against Delete
 */
function transformSetDelete(
  operationA: SetMapOperation,
  operationB: DeleteMapOperation
): TransformResult<SetMapOperation> {
  if (operationA.key !== operationB.key) {
    // Different keys - no conflict
    return { operation: operationA, wasTransformed: false };
  }
  
  // Same key - the delete removes the key, so set will create it again
  // Update previousValue to undefined since the key was deleted
  const transformed: SetMapOperation = {
    ...operationA,
    previousValue: undefined,
  };
  return { operation: transformed, wasTransformed: true };
}

/**
 * Transform Delete against Set
 */
function transformDeleteSet(
  operationA: DeleteMapOperation,
  operationB: SetMapOperation
): TransformResult<DeleteMapOperation> {
  if (operationA.key !== operationB.key) {
    // Different keys - no conflict
    return { operation: operationA, wasTransformed: false };
  }
  
  // Same key - the set operation changes the value, so delete should use the new value
  const transformed: DeleteMapOperation = {
    ...operationA,
    previousValue: operationB.value,
  };
  return { operation: transformed, wasTransformed: true };
}

/**
 * Transform Delete against Delete
 */
function transformDeleteDelete(
  operationA: DeleteMapOperation,
  operationB: DeleteMapOperation
): TransformResult<DeleteMapOperation> {
  if (operationA.key !== operationB.key) {
    // Different keys - no conflict
    return { operation: operationA, wasTransformed: false };
  }
  
  // Same key - both trying to delete the same key
  // The first one wins, second becomes no-op
  if (operationA.timestamp > operationB.timestamp || 
      (operationA.timestamp === operationB.timestamp && operationA.clientId > operationB.clientId)) {
    // A wins
    return { operation: operationA, wasTransformed: false };
  } else {
    // B wins - A becomes no-op
    return { operation: operationA, wasTransformed: true };
  }
}

/**
 * Transform a batch operation against another operation
 */
function transformBatchOperation(
  operationA: BatchMapOperation,
  operationB: MapOperationType
): TransformResult<BatchMapOperation> {
  let wasTransformed = false;
  const transformedOperations: (SetMapOperation | DeleteMapOperation)[] = [];
  
  for (const subOp of operationA.operations) {
    const result = transformMapOperation(subOp, operationB);
    transformedOperations.push(result.operation as SetMapOperation | DeleteMapOperation);
    if (result.wasTransformed) {
      wasTransformed = true;
    }
  }
  
  if (wasTransformed) {
    const transformed: BatchMapOperation = {
      ...operationA,
      operations: transformedOperations,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform an operation against a batch operation
 */
function transformAgainstBatch(
  operationA: MapOperationType,
  operationB: BatchMapOperation
): TransformResult<MapOperationType> {
  let current = operationA;
  let wasTransformed = false;
  
  for (const subOp of operationB.operations) {
    const result = transformMapOperation(current, subOp);
    current = result.operation;
    if (result.wasTransformed) {
      wasTransformed = true;
    }
  }
  
  return { operation: current, wasTransformed };
}

/**
 * Check if two map operations conflict
 */
export function mapOperationsConflict(
  operationA: MapOperationType,
  operationB: MapOperationType
): boolean {
  // Extract keys from operations
  const getKeys = (op: MapOperationType): string[] => {
    if (isMapBatchOperation(op)) {
      return op.operations.map(subOp => subOp.key);
    } else if ('key' in op) {
      return [op.key];
    }
    return [];
  };
  
  const keysA = getKeys(operationA);
  const keysB = getKeys(operationB);
  
  // Check if any keys overlap
  for (const keyA of keysA) {
    if (keysB.includes(keyA)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Optimize map operations by merging compatible operations
 */
export function optimizeMapOperations(operations: MapOperationType[]): MapOperationType[] {
  if (operations.length === 0) return [];
  
  // Group operations by key
  const keyGroups = new Map<string, MapOperationType[]>();
  const batchOps: BatchMapOperation[] = [];
  
  for (const op of operations) {
    if (isMapBatchOperation(op)) {
      batchOps.push(op);
    } else if ('key' in op) {
      const key = op.key;
      if (!keyGroups.has(key)) {
        keyGroups.set(key, []);
      }
      keyGroups.get(key)!.push(op);
    }
  }
  
  const result: MapOperationType[] = [];
  
  // Process each key group
  for (const [key, ops] of keyGroups) {
    if (ops.length === 1) {
      result.push(ops[0]);
    } else {
      // Find the last operation for this key (latest timestamp)
      const lastOp = ops.reduce((latest, current) => 
        current.timestamp > latest.timestamp ? current : latest
      );
      result.push(lastOp);
    }
  }
  
  // Add batch operations (they can't be optimized easily)
  result.push(...batchOps);
  
  return result;
}

/**
 * Apply a map operation to a state object
 */
export function applyMapOperation(
  state: Record<string, any>,
  operation: MapOperationType
): Record<string, any> {
  const newState = { ...state };
  
  if (isMapSetOperation(operation)) {
    newState[operation.key] = operation.value;
  } else if (isMapDeleteOperation(operation)) {
    delete newState[operation.key];
  } else if (isMapBatchOperation(operation)) {
    for (const subOp of operation.operations) {
      if (isMapSetOperation(subOp)) {
        newState[subOp.key] = subOp.value;
      } else if (isMapDeleteOperation(subOp)) {
        delete newState[subOp.key];
      }
    }
  }
  
  return newState;
}

/**
 * Generate operations to transform one map state to another
 */
export function generateMapOperations(
  oldState: Record<string, any>,
  newState: Record<string, any>,
  clientId: string,
  baseVersion: number
): MapOperationType[] {
  const operations: MapOperationType[] = [];
  const operationId = () => `${clientId}-${Date.now()}-${Math.random()}`;
  
  // Find added/changed keys
  for (const [key, newValue] of Object.entries(newState)) {
    const oldValue = oldState[key];
    if (oldValue !== newValue) {
      operations.push({
        id: operationId(),
        clientId,
        baseVersion,
        type: 'map-set',
        key,
        value: newValue,
        previousValue: oldValue,
        timestamp: Date.now(),
      });
    }
  }
  
  // Find deleted keys
  for (const [key, oldValue] of Object.entries(oldState)) {
    if (!(key in newState)) {
      operations.push({
        id: operationId(),
        clientId,
        baseVersion,
        type: 'map-delete',
        key,
        previousValue: oldValue,
        timestamp: Date.now(),
      });
    }
  }
  
  return operations;
}