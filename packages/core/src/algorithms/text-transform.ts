/**
 * Operational Transformation algorithms for text operations
 * Based on proven OT algorithms from literature
 */

import { TransformResult } from '../types/base.js';
import {
  TextOperationType,
  InsertTextOperation,
  DeleteTextOperation,
  RetainTextOperation,
  isInsertOperation,
  isDeleteOperation,
  isRetainOperation,
} from '../types/text-operations.js';

/**
 * Transform operation A against operation B
 * This implements the core OT transformation logic for text
 */
export function transformTextOperation(
  operationA: TextOperationType,
  operationB: TextOperationType
): TransformResult<TextOperationType> {
  // Insert vs Insert
  if (isInsertOperation(operationA) && isInsertOperation(operationB)) {
    return transformInsertInsert(operationA, operationB);
  }
  
  // Insert vs Delete
  if (isInsertOperation(operationA) && isDeleteOperation(operationB)) {
    return transformInsertDelete(operationA, operationB);
  }
  
  // Delete vs Insert
  if (isDeleteOperation(operationA) && isInsertOperation(operationB)) {
    return transformDeleteInsert(operationA, operationB);
  }
  
  // Delete vs Delete
  if (isDeleteOperation(operationA) && isDeleteOperation(operationB)) {
    return transformDeleteDelete(operationA, operationB);
  }
  
  // Retain operations don't need transformation in basic text model
  if (isRetainOperation(operationA) || isRetainOperation(operationB)) {
    return { operation: operationA, wasTransformed: false };
  }
  
  // Default case - no transformation needed
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform Insert against Insert
 * When two inserts happen at the same position, we need to decide ordering
 */
function transformInsertInsert(
  operationA: InsertTextOperation,
  operationB: InsertTextOperation
): TransformResult<InsertTextOperation> {
  if (operationA.position <= operationB.position) {
    // A comes before or at same position as B
    // A's position doesn't change
    return { operation: operationA, wasTransformed: false };
  } else {
    // A comes after B, so A's position shifts by B's text length
    const transformed: InsertTextOperation = {
      ...operationA,
      position: operationA.position + operationB.text.length,
    };
    return { operation: transformed, wasTransformed: true };
  }
}

/**
 * Transform Insert against Delete
 * The insert position might need adjustment based on where the delete occurs
 */
function transformInsertDelete(
  operationA: InsertTextOperation,
  operationB: DeleteTextOperation
): TransformResult<InsertTextOperation> {
  if (operationA.position <= operationB.position) {
    // Insert comes before delete - no change needed
    return { operation: operationA, wasTransformed: false };
  } else if (operationA.position >= operationB.position + operationB.length) {
    // Insert comes after the deleted range - adjust position
    const transformed: InsertTextOperation = {
      ...operationA,
      position: operationA.position - operationB.length,
    };
    return { operation: transformed, wasTransformed: true };
  } else {
    // Insert is within the deleted range - move to start of deleted range
    const transformed: InsertTextOperation = {
      ...operationA,
      position: operationB.position,
    };
    return { operation: transformed, wasTransformed: true };
  }
}

/**
 * Transform Delete against Insert
 * The delete range might need adjustment based on where the insert occurs
 */
function transformDeleteInsert(
  operationA: DeleteTextOperation,
  operationB: InsertTextOperation
): TransformResult<DeleteTextOperation> {
  if (operationB.position <= operationA.position) {
    // Insert comes before delete - shift delete position
    const transformed: DeleteTextOperation = {
      ...operationA,
      position: operationA.position + operationB.text.length,
    };
    return { operation: transformed, wasTransformed: true };
  } else if (operationB.position >= operationA.position + operationA.length) {
    // Insert comes after delete - no change needed
    return { operation: operationA, wasTransformed: false };
  } else {
    // Insert is within delete range - expand delete to include inserted text
    const transformed: DeleteTextOperation = {
      ...operationA,
      length: operationA.length + operationB.text.length,
    };
    return { operation: transformed, wasTransformed: true };
  }
}

/**
 * Transform Delete against Delete
 * Handle overlapping or adjacent deletes
 */
function transformDeleteDelete(
  operationA: DeleteTextOperation,
  operationB: DeleteTextOperation
): TransformResult<DeleteTextOperation> {
  const aStart = operationA.position;
  const aEnd = operationA.position + operationA.length;
  const bStart = operationB.position;
  const bEnd = operationB.position + operationB.length;
  
  // No overlap - B comes after A
  if (bStart >= aEnd) {
    return { operation: operationA, wasTransformed: false };
  }
  
  // No overlap - B comes before A
  if (bEnd <= aStart) {
    const transformed: DeleteTextOperation = {
      ...operationA,
      position: operationA.position - operationB.length,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  // Overlapping deletes - need to adjust based on overlap
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlapLength = overlapEnd - overlapStart;
  
  if (overlapLength > 0) {
    // There's an overlap - reduce A's length by the overlap
    const newLength = operationA.length - overlapLength;
    const newPosition = bStart < aStart ? aStart - (bStart < aStart ? Math.min(operationB.length, aStart - bStart) : 0) : aStart;
    
    if (newLength <= 0) {
      // A is completely covered by B - make it a no-op
      const transformed: DeleteTextOperation = {
        ...operationA,
        position: newPosition,
        length: 0,
      };
      return { operation: transformed, wasTransformed: true };
    }
    
    const transformed: DeleteTextOperation = {
      ...operationA,
      position: newPosition,
      length: newLength,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  return { operation: operationA, wasTransformed: false };
}

/**
 * Check if two text operations conflict
 */
export function textOperationsConflict(
  operationA: TextOperationType,
  operationB: TextOperationType
): boolean {
  // Two operations conflict if they operate on overlapping ranges
  const getRangeA = getOperationRange(operationA);
  const getRangeB = getOperationRange(operationB);
  
  // Check for range overlap
  return getRangeA.start < getRangeB.end && getRangeB.start < getRangeA.end;
}

/**
 * Get the range (start, end) that an operation affects
 */
function getOperationRange(operation: TextOperationType): { start: number; end: number } {
  if (isInsertOperation(operation)) {
    return { start: operation.position, end: operation.position };
  } else if (isDeleteOperation(operation)) {
    return { start: operation.position, end: operation.position + operation.length };
  } else if (isRetainOperation(operation)) {
    return { start: operation.position, end: operation.position + operation.length };
  }
  
  return { start: 0, end: 0 };
}

/**
 * Compose multiple text operations into a single operation
 * This is useful for optimizing operation sequences
 */
export function composeTextOperations(operations: TextOperationType[]): TextOperationType[] {
  if (operations.length === 0) return [];
  if (operations.length === 1) return operations;
  
  const result: TextOperationType[] = [];
  let current = operations[0];
  
  for (let i = 1; i < operations.length; i++) {
    const next = operations[i];
    
    // Try to merge consecutive operations
    if (canMergeOperations(current, next)) {
      current = mergeOperations(current, next);
    } else {
      result.push(current);
      current = next;
    }
  }
  
  result.push(current);
  return result;
}

/**
 * Check if two operations can be merged
 */
function canMergeOperations(op1: TextOperationType, op2: TextOperationType): boolean {
  // Only merge operations from the same client
  if (op1.clientId !== op2.clientId) return false;
  
  // Can merge consecutive inserts
  if (isInsertOperation(op1) && isInsertOperation(op2)) {
    return op1.position + op1.text.length === op2.position;
  }
  
  // Can merge consecutive deletes
  if (isDeleteOperation(op1) && isDeleteOperation(op2)) {
    return op1.position === op2.position;
  }
  
  return false;
}

/**
 * Merge two compatible operations
 */
function mergeOperations(op1: TextOperationType, op2: TextOperationType): TextOperationType {
  if (isInsertOperation(op1) && isInsertOperation(op2)) {
    return {
      ...op1,
      text: op1.text + op2.text,
    };
  }
  
  if (isDeleteOperation(op1) && isDeleteOperation(op2)) {
    return {
      ...op1,
      length: op1.length + op2.length,
    };
  }
  
  return op1;
}