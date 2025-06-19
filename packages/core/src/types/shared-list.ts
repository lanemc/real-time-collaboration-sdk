/**
 * SharedList implementation for collaborative list editing
 */

import { SharedType, SharedTypeEvents, Version, ClientId } from './base.js';
import {
  ListOperationType,
  InsertListOperation,
  DeleteListOperation,
  ReplaceListOperation,
  MoveListOperation,
  createListInsertOperation,
  createListDeleteOperation,
  createListReplaceOperation,
  createListMoveOperation,
  isListInsertOperation,
  isListDeleteOperation,
  isListReplaceOperation,
  isListMoveOperation,
} from './list-operations.js';
import { transformListOperation, listOperationsConflict } from '../algorithms/list-transform.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { generateOperationId } from '../utils/id-generator.js';

/**
 * Events emitted by SharedList
 */
export interface SharedListEvents<T> extends SharedTypeEvents<T[]> {
  /** Emitted when an item is inserted */
  insert: (index: number, item: T) => void;
  
  /** Emitted when an item is deleted */
  delete: (index: number, item: T) => void;
  
  /** Emitted when an item is replaced */
  replace: (index: number, newItem: T, oldItem: T) => void;
  
  /** Emitted when an item is moved */
  move: (fromIndex: number, toIndex: number, item: T) => void;
}

/**
 * Collaborative list data type with operational transformation
 */
export class SharedList<T = any> 
  extends EventEmitter<SharedListEvents<T>>
  implements SharedType<ListOperationType, T[]> {
  
  private _items: T[];
  private _version: Version;
  private _clientId: ClientId;
  
  constructor(initialItems: T[] = [], clientId: ClientId, initialVersion: Version = 0) {
    super();
    this._items = [...initialItems];
    this._version = initialVersion;
    this._clientId = clientId;
  }

  /**
   * Current list value
   */
  get value(): T[] {
    return [...this._items];
  }

  /**
   * Current version
   */
  get version(): Version {
    return this._version;
  }

  /**
   * Number of items in the list
   */
  get length(): number {
    return this._items.length;
  }

  /**
   * Insert an item at a specific index
   */
  insert(index: number, item: T): ListOperationType {
    if (index < 0 || index > this._items.length) {
      throw new Error(`Invalid index: ${index}. List length is ${this._items.length}`);
    }

    const operation = createListInsertOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      index,
      item
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Add an item to the end of the list
   */
  push(item: T): ListOperationType {
    return this.insert(this._items.length, item);
  }

  /**
   * Add an item to the beginning of the list
   */
  unshift(item: T): ListOperationType {
    return this.insert(0, item);
  }

  /**
   * Delete an item at a specific index
   */
  delete(index: number, count: number = 1): ListOperationType {
    if (index < 0 || index >= this._items.length) {
      throw new Error(`Invalid index: ${index}. List length is ${this._items.length}`);
    }

    if (count <= 0) {
      throw new Error('Delete count must be positive');
    }

    // Adjust count if it exceeds available items
    const actualCount = Math.min(count, this._items.length - index);

    const operation = createListDeleteOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      index,
      actualCount
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Remove the last item from the list
   */
  pop(): ListOperationType | null {
    if (this._items.length === 0) {
      return null;
    }
    return this.delete(this._items.length - 1);
  }

  /**
   * Remove the first item from the list
   */
  shift(): ListOperationType | null {
    if (this._items.length === 0) {
      return null;
    }
    return this.delete(0);
  }

  /**
   * Replace an item at a specific index
   */
  replace(index: number, newItem: T): ListOperationType {
    if (index < 0 || index >= this._items.length) {
      throw new Error(`Invalid index: ${index}. List length is ${this._items.length}`);
    }

    const oldItem = this._items[index];
    const operation = createListReplaceOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      index,
      newItem,
      oldItem
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Set an item at a specific index (alias for replace)
   */
  set(index: number, item: T): ListOperationType {
    return this.replace(index, item);
  }

  /**
   * Move an item from one index to another
   */
  move(fromIndex: number, toIndex: number): ListOperationType {
    if (fromIndex < 0 || fromIndex >= this._items.length) {
      throw new Error(`Invalid fromIndex: ${fromIndex}. List length is ${this._items.length}`);
    }

    if (toIndex < 0 || toIndex >= this._items.length) {
      throw new Error(`Invalid toIndex: ${toIndex}. List length is ${this._items.length}`);
    }

    if (fromIndex === toIndex) {
      throw new Error('fromIndex and toIndex cannot be the same');
    }

    const operation = createListMoveOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      fromIndex,
      toIndex
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Get an item at a specific index
   */
  get(index: number): T | undefined {
    if (index < 0 || index >= this._items.length) {
      return undefined;
    }
    return this._items[index];
  }

  /**
   * Check if the list contains an item
   */
  includes(item: T): boolean {
    return this._items.includes(item);
  }

  /**
   * Find the index of an item
   */
  indexOf(item: T): number {
    return this._items.indexOf(item);
  }

  /**
   * Clear all items from the list
   */
  clear(): ListOperationType | null {
    if (this._items.length === 0) {
      return null;
    }
    
    return this.delete(0, this._items.length);
  }

  /**
   * Apply an operation to the list
   */
  apply(operation: ListOperationType): T[] {
    const oldValue = [...this._items];

    if (isListInsertOperation(operation)) {
      this._items.splice(operation.index, 0, operation.item);
      this.emit('insert', operation.index, operation.item);
    } else if (isListDeleteOperation(operation)) {
      const deletedItems = this._items.splice(operation.index, operation.count || 1);
      for (let i = 0; i < deletedItems.length; i++) {
        this.emit('delete', operation.index + i, deletedItems[i]);
      }
    } else if (isListReplaceOperation(operation)) {
      const oldItem = this._items[operation.index];
      this._items[operation.index] = operation.item;
      this.emit('replace', operation.index, operation.item, oldItem);
    } else if (isListMoveOperation(operation)) {
      const [movedItem] = this._items.splice(operation.index, 1);
      this._items.splice(operation.targetIndex, 0, movedItem);
      this.emit('move', operation.index, operation.targetIndex, movedItem);
    }

    // Update version if this is a newer operation
    if (operation.baseVersion >= this._version) {
      this._version = operation.baseVersion + 1;
    }

    // Emit change event
    this.emit('change', this.value, oldValue);
    this.emit('operation', operation);

    return this.value;
  }

  /**
   * Transform this operation against another operation
   */
  transform(operationA: ListOperationType, operationB: ListOperationType) {
    const result = transformListOperation(operationA, operationB);
    
    if (result.wasTransformed) {
      this.emit('transform', operationA, result.operation);
    }
    
    return result;
  }

  /**
   * Check if two operations conflict
   */
  conflicts(operationA: ListOperationType, operationB: ListOperationType): boolean {
    return listOperationsConflict(operationA, operationB);
  }

  /**
   * Generate operations to transform from one list to another
   */
  generateOperations(oldValue: T[], newValue: T[]): ListOperationType[] {
    const operations: ListOperationType[] = [];
    
    // Simple approach: find differences and generate operations
    // This can be optimized with more sophisticated diff algorithms
    const maxLength = Math.max(oldValue.length, newValue.length);
    
    for (let i = 0; i < maxLength; i++) {
      const oldItem = i < oldValue.length ? oldValue[i] : undefined;
      const newItem = i < newValue.length ? newValue[i] : undefined;
      
      if (oldItem === undefined && newItem !== undefined) {
        // Insert new item
        operations.push(createListInsertOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          i,
          newItem
        ));
      } else if (oldItem !== undefined && newItem === undefined) {
        // Delete old item
        operations.push(createListDeleteOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          i,
          1
        ));
      } else if (oldItem !== newItem && oldItem !== undefined && newItem !== undefined) {
        // Replace item
        operations.push(createListReplaceOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          i,
          newItem,
          oldItem
        ));
      }
    }
    
    return operations;
  }

  /**
   * Convert list to array
   */
  toArray(): T[] {
    return [...this._items];
  }

  /**
   * Check if the list is empty
   */
  isEmpty(): boolean {
    return this._items.length === 0;
  }

  /**
   * Get a slice of the list
   */
  slice(start?: number, end?: number): T[] {
    return this._items.slice(start, end);
  }

  /**
   * Create a snapshot of the current state
   */
  toSnapshot(): { value: T[]; version: Version } {
    return {
      value: [...this._items],
      version: this._version,
    };
  }

  /**
   * Restore from a snapshot
   */
  fromSnapshot(snapshot: { value: T[]; version: Version }): void {
    const oldValue = this.value;
    this._items = [...snapshot.value];
    this._version = snapshot.version;
    this.emit('change', this.value, oldValue);
  }

  /**
   * Create a copy of this SharedList
   */
  clone(): SharedList<T> {
    return new SharedList<T>(this._items, this._clientId, this._version);
  }

  /**
   * Iterate over the list
   */
  [Symbol.iterator](): Iterator<T> {
    return this._items[Symbol.iterator]();
  }

  /**
   * For each item in the list
   */
  forEach(callback: (item: T, index: number) => void): void {
    this._items.forEach(callback);
  }

  /**
   * Map over the list
   */
  map<U>(callback: (item: T, index: number) => U): U[] {
    return this._items.map(callback);
  }

  /**
   * Filter the list
   */
  filter(callback: (item: T, index: number) => boolean): T[] {
    return this._items.filter(callback);
  }

  /**
   * Find an item in the list
   */
  find(callback: (item: T, index: number) => boolean): T | undefined {
    return this._items.find(callback);
  }

  /**
   * Find the index of an item in the list
   */
  findIndex(callback: (item: T, index: number) => boolean): number {
    return this._items.findIndex(callback);
  }
}