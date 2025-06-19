/**
 * Operational Transformation algorithms for list operations
 */

import { TransformResult } from '../types/base.js';
import {
  ListOperationType,
  InsertListOperation,
  DeleteListOperation,
  ReplaceListOperation,
  MoveListOperation,
  isListInsertOperation,
  isListDeleteOperation,
  isListReplaceOperation,
  isListMoveOperation,
} from '../types/list-operations.js';

/**
 * Transform operation A against operation B for list operations
 */
export function transformListOperation(
  operationA: ListOperationType,
  operationB: ListOperationType
): TransformResult<ListOperationType> {
  // Insert vs Insert
  if (isListInsertOperation(operationA) && isListInsertOperation(operationB)) {
    return transformInsertInsert(operationA, operationB);
  }
  
  // Insert vs Delete
  if (isListInsertOperation(operationA) && isListDeleteOperation(operationB)) {
    return transformInsertDelete(operationA, operationB);
  }
  
  // Delete vs Insert
  if (isListDeleteOperation(operationA) && isListInsertOperation(operationB)) {
    return transformDeleteInsert(operationA, operationB);
  }
  
  // Delete vs Delete
  if (isListDeleteOperation(operationA) && isListDeleteOperation(operationB)) {
    return transformDeleteDelete(operationA, operationB);
  }
  
  // Replace operations
  if (isListReplaceOperation(operationA)) {
    return transformReplace(operationA, operationB);
  }
  
  if (isListReplaceOperation(operationB)) {
    return transformAgainstReplace(operationA, operationB);
  }
  
  // Move operations
  if (isListMoveOperation(operationA)) {
    return transformMove(operationA, operationB);
  }
  
  if (isListMoveOperation(operationB)) {
    return transformAgainstMove(operationA, operationB);
  }
  
  // Default case - no transformation needed
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform Insert against Insert
 */
function transformInsertInsert(
  operationA: InsertListOperation,
  operationB: InsertListOperation
): TransformResult<InsertListOperation> {
  if (operationA.index <= operationB.index) {
    // A comes before or at same position as B
    return { operation: operationA, wasTransformed: false };
  } else {
    // A comes after B, so A's index shifts by 1
    const transformed: InsertListOperation = {
      ...operationA,
      index: operationA.index + 1,
    };
    return { operation: transformed, wasTransformed: true };
  }
}

/**
 * Transform Insert against Delete
 */
function transformInsertDelete(
  operationA: InsertListOperation,
  operationB: DeleteListOperation
): TransformResult<InsertListOperation> {
  const deleteCount = operationB.count || 1;
  
  if (operationA.index <= operationB.index) {
    // Insert comes before delete - no change needed
    return { operation: operationA, wasTransformed: false };
  } else if (operationA.index >= operationB.index + deleteCount) {
    // Insert comes after the deleted range - adjust index
    const transformed: InsertListOperation = {
      ...operationA,
      index: operationA.index - deleteCount,
    };
    return { operation: transformed, wasTransformed: true };
  } else {
    // Insert is within the deleted range - move to start of deleted range
    const transformed: InsertListOperation = {
      ...operationA,
      index: operationB.index,
    };
    return { operation: transformed, wasTransformed: true };
  }
}

/**
 * Transform Delete against Insert
 */
function transformDeleteInsert(
  operationA: DeleteListOperation,
  operationB: InsertListOperation
): TransformResult<DeleteListOperation> {
  const deleteCount = operationA.count || 1;
  
  if (operationB.index <= operationA.index) {
    // Insert comes before delete - shift delete index
    const transformed: DeleteListOperation = {
      ...operationA,
      index: operationA.index + 1,
    };
    return { operation: transformed, wasTransformed: true };
  } else if (operationB.index >= operationA.index + deleteCount) {
    // Insert comes after delete - no change needed
    return { operation: operationA, wasTransformed: false };
  } else {
    // Insert is within delete range - no change needed (delete will remove the inserted item too)
    return { operation: operationA, wasTransformed: false };
  }
}

/**
 * Transform Delete against Delete
 */
function transformDeleteDelete(
  operationA: DeleteListOperation,
  operationB: DeleteListOperation
): TransformResult<DeleteListOperation> {
  const aCount = operationA.count || 1;
  const bCount = operationB.count || 1;
  const aStart = operationA.index;
  const aEnd = operationA.index + aCount;
  const bStart = operationB.index;
  const bEnd = operationB.index + bCount;
  
  // No overlap - B comes after A
  if (bStart >= aEnd) {
    return { operation: operationA, wasTransformed: false };
  }
  
  // No overlap - B comes before A
  if (bEnd <= aStart) {
    const transformed: DeleteListOperation = {
      ...operationA,
      index: operationA.index - bCount,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  // Overlapping deletes
  const overlapStart = Math.max(aStart, bStart);
  const overlapEnd = Math.min(aEnd, bEnd);
  const overlapCount = overlapEnd - overlapStart;
  
  if (overlapCount > 0) {
    const newCount = aCount - overlapCount;
    const newIndex = bStart < aStart ? aStart - Math.min(bCount, aStart - bStart) : aStart;
    
    if (newCount <= 0) {
      // A is completely covered by B - make it a no-op
      const transformed: DeleteListOperation = {
        ...operationA,
        index: newIndex,
        count: 0,
      };
      return { operation: transformed, wasTransformed: true };
    }
    
    const transformed: DeleteListOperation = {
      ...operationA,
      index: newIndex,
      count: newCount,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform Replace operation against another operation
 */
function transformReplace(
  operationA: ReplaceListOperation,
  operationB: ListOperationType
): TransformResult<ReplaceListOperation> {
  if (isListInsertOperation(operationB)) {
    if (operationB.index <= operationA.index) {
      const transformed: ReplaceListOperation = {
        ...operationA,
        index: operationA.index + 1,
      };
      return { operation: transformed, wasTransformed: true };
    }
  } else if (isListDeleteOperation(operationB)) {
    const deleteCount = operationB.count || 1;
    
    if (operationA.index >= operationB.index && operationA.index < operationB.index + deleteCount) {
      // The item being replaced is deleted - operation becomes no-op
      // We could either drop it or convert to insert
      return { operation: operationA, wasTransformed: false };
    } else if (operationA.index >= operationB.index + deleteCount) {
      const transformed: ReplaceListOperation = {
        ...operationA,
        index: operationA.index - deleteCount,
      };
      return { operation: transformed, wasTransformed: true };
    }
  } else if (isListReplaceOperation(operationB) && operationB.index === operationA.index) {
    // Concurrent replace at same index - use timestamp or client ID for tie-breaking
    if (operationA.timestamp > operationB.timestamp || 
        (operationA.timestamp === operationB.timestamp && operationA.clientId > operationB.clientId)) {
      return { operation: operationA, wasTransformed: false };
    } else {
      // This operation loses - becomes no-op or should be dropped
      return { operation: operationA, wasTransformed: false };
    }
  }
  
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform operation against Replace
 */
function transformAgainstReplace(
  operationA: ListOperationType,
  operationB: ReplaceListOperation
): TransformResult<ListOperationType> {
  // Replace doesn't affect indices of other operations
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform Move operation against another operation
 */
function transformMove(
  operationA: MoveListOperation,
  operationB: ListOperationType
): TransformResult<MoveListOperation> {
  let sourceIndex = operationA.index;
  let targetIndex = operationA.targetIndex;
  let wasTransformed = false;
  
  if (isListInsertOperation(operationB)) {
    if (operationB.index <= sourceIndex) {
      sourceIndex++;
      wasTransformed = true;
    }
    if (operationB.index <= targetIndex) {
      targetIndex++;
      wasTransformed = true;
    }
  } else if (isListDeleteOperation(operationB)) {
    const deleteCount = operationB.count || 1;
    
    if (sourceIndex >= operationB.index && sourceIndex < operationB.index + deleteCount) {
      // Source item is deleted - operation becomes invalid
      return { operation: operationA, wasTransformed: false };
    } else if (sourceIndex >= operationB.index + deleteCount) {
      sourceIndex -= deleteCount;
      wasTransformed = true;
    }
    
    if (targetIndex >= operationB.index + deleteCount) {
      targetIndex -= deleteCount;
      wasTransformed = true;
    } else if (targetIndex >= operationB.index) {
      targetIndex = operationB.index;
      wasTransformed = true;
    }
  }
  
  if (wasTransformed) {
    const transformed: MoveListOperation = {
      ...operationA,
      index: sourceIndex,
      targetIndex: targetIndex,
    };
    return { operation: transformed, wasTransformed: true };
  }
  
  return { operation: operationA, wasTransformed: false };
}

/**
 * Transform operation against Move
 */
function transformAgainstMove(
  operationA: ListOperationType,
  operationB: MoveListOperation
): TransformResult<ListOperationType> {
  // Move operations can affect indices depending on the direction and range
  const sourceIndex = operationB.index;
  const targetIndex = operationB.targetIndex;
  
  if (sourceIndex === targetIndex) {
    // No-op move
    return { operation: operationA, wasTransformed: false };
  }
  
  let transformed = { ...operationA };
  let wasTransformed = false;
  
  if ('index' in transformed) {
    const opIndex = transformed.index;
    
    if (sourceIndex < targetIndex) {
      // Moving forward
      if (opIndex === sourceIndex) {
        transformed.index = targetIndex;
        wasTransformed = true;
      } else if (opIndex > sourceIndex && opIndex <= targetIndex) {
        transformed.index = opIndex - 1;
        wasTransformed = true;
      }
    } else {
      // Moving backward
      if (opIndex === sourceIndex) {
        transformed.index = targetIndex;
        wasTransformed = true;
      } else if (opIndex >= targetIndex && opIndex < sourceIndex) {
        transformed.index = opIndex + 1;
        wasTransformed = true;
      }
    }
  }
  
  return { operation: transformed as ListOperationType, wasTransformed };
}

/**
 * Check if two list operations conflict
 */
export function listOperationsConflict(
  operationA: ListOperationType,
  operationB: ListOperationType
): boolean {
  // Operations conflict if they operate on the same index
  if ('index' in operationA && 'index' in operationB) {
    return operationA.index === operationB.index;
  }
  
  return false;
}