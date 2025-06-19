/**
 * SharedMap implementation for collaborative object/map editing
 */

import { SharedType, SharedTypeEvents, Version, ClientId } from './base.js';
import {
  MapOperationType,
  SetMapOperation,
  DeleteMapOperation,
  BatchMapOperation,
  createMapSetOperation,
  createMapDeleteOperation,
  createMapBatchOperation,
  isMapSetOperation,
  isMapDeleteOperation,
  isMapBatchOperation,
} from './map-operations.js';
import { transformMapOperation, mapOperationsConflict, applyMapOperation } from '../algorithms/map-transform.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { generateOperationId } from '../utils/id-generator.js';

/**
 * Events emitted by SharedMap
 */
export interface SharedMapEvents<T> extends SharedTypeEvents<Record<string, T>> {
  /** Emitted when a key is set */
  set: (key: string, value: T, previousValue?: T) => void;
  
  /** Emitted when a key is deleted */
  delete: (key: string, previousValue?: T) => void;
  
  /** Emitted when multiple operations are applied in batch */
  batch: (operations: (SetMapOperation | DeleteMapOperation)[]) => void;
}

/**
 * Collaborative map/object data type with operational transformation
 */
export class SharedMap<T = any> 
  extends EventEmitter<SharedMapEvents<T>>
  implements SharedType<MapOperationType, Record<string, T>> {
  
  private _data: Record<string, T>;
  private _version: Version;
  private _clientId: ClientId;
  
  constructor(initialData: Record<string, T> = {}, clientId: ClientId, initialVersion: Version = 0) {
    super();
    this._data = { ...initialData };
    this._version = initialVersion;
    this._clientId = clientId;
  }

  /**
   * Current map value
   */
  get value(): Record<string, T> {
    return { ...this._data };
  }

  /**
   * Current version
   */
  get version(): Version {
    return this._version;
  }

  /**
   * Number of keys in the map
   */
  get size(): number {
    return Object.keys(this._data).length;
  }

  /**
   * Set a key-value pair
   */
  set(key: string, value: T): MapOperationType {
    if (typeof key !== 'string') {
      throw new Error('Key must be a string');
    }

    const previousValue = this._data[key];
    const operation = createMapSetOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      key,
      value,
      previousValue
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Get a value by key
   */
  get(key: string): T | undefined {
    return this._data[key];
  }

  /**
   * Check if a key exists
   */
  has(key: string): boolean {
    return key in this._data;
  }

  /**
   * Delete a key
   */
  delete(key: string): MapOperationType | null {
    if (!this.has(key)) {
      return null; // Key doesn't exist, no operation needed
    }

    const previousValue = this._data[key];
    const operation = createMapDeleteOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      key,
      previousValue
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Clear all keys
   */
  clear(): MapOperationType | null {
    const keys = Object.keys(this._data);
    if (keys.length === 0) {
      return null;
    }

    const operations: (SetMapOperation | DeleteMapOperation)[] = keys.map(key => 
      createMapDeleteOperation(
        generateOperationId(this._clientId),
        this._clientId,
        this._version,
        key,
        this._data[key]
      )
    );

    const batchOperation = createMapBatchOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      operations
    );

    this.apply(batchOperation);
    return batchOperation;
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return Object.keys(this._data);
  }

  /**
   * Get all values
   */
  values(): T[] {
    return Object.values(this._data);
  }

  /**
   * Get all entries as [key, value] pairs
   */
  entries(): [string, T][] {
    return Object.entries(this._data);
  }

  /**
   * Update multiple keys in a batch operation
   */
  batch(updates: Record<string, T | undefined>): MapOperationType {
    const operations: (SetMapOperation | DeleteMapOperation)[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value === undefined) {
        // Delete the key
        if (this.has(key)) {
          operations.push(createMapDeleteOperation(
            generateOperationId(this._clientId),
            this._clientId,
            this._version,
            key,
            this._data[key]
          ));
        }
      } else {
        // Set the key
        operations.push(createMapSetOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          key,
          value,
          this._data[key]
        ));
      }
    }

    if (operations.length === 0) {
      throw new Error('Batch operation must contain at least one operation');
    }

    const batchOperation = createMapBatchOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      operations
    );

    this.apply(batchOperation);
    return batchOperation;
  }

  /**
   * Apply an operation to the map
   */
  apply(operation: MapOperationType): Record<string, T> {
    const oldValue = { ...this._data };

    if (isMapSetOperation(operation)) {
      const previousValue = this._data[operation.key];
      this._data[operation.key] = operation.value;
      this.emit('set', operation.key, operation.value, previousValue);
    } else if (isMapDeleteOperation(operation)) {
      const previousValue = this._data[operation.key];
      delete this._data[operation.key];
      this.emit('delete', operation.key, previousValue);
    } else if (isMapBatchOperation(operation)) {
      for (const subOp of operation.operations) {
        if (isMapSetOperation(subOp)) {
          const previousValue = this._data[subOp.key];
          this._data[subOp.key] = subOp.value;
          this.emit('set', subOp.key, subOp.value, previousValue);
        } else if (isMapDeleteOperation(subOp)) {
          const previousValue = this._data[subOp.key];
          delete this._data[subOp.key];
          this.emit('delete', subOp.key, previousValue);
        }
      }
      this.emit('batch', operation.operations);
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
  transform(operationA: MapOperationType, operationB: MapOperationType) {
    const result = transformMapOperation(operationA, operationB);
    
    if (result.wasTransformed) {
      this.emit('transform', operationA, result.operation);
    }
    
    return result;
  }

  /**
   * Check if two operations conflict
   */
  conflicts(operationA: MapOperationType, operationB: MapOperationType): boolean {
    return mapOperationsConflict(operationA, operationB);
  }

  /**
   * Generate operations to transform from one map to another
   */
  generateOperations(oldValue: Record<string, T>, newValue: Record<string, T>): MapOperationType[] {
    const operations: MapOperationType[] = [];
    
    // Find added/changed keys
    for (const [key, newVal] of Object.entries(newValue)) {
      const oldVal = oldValue[key];
      if (oldVal !== newVal) {
        operations.push(createMapSetOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          key,
          newVal,
          oldVal
        ));
      }
    }
    
    // Find deleted keys
    for (const [key, oldVal] of Object.entries(oldValue)) {
      if (!(key in newValue)) {
        operations.push(createMapDeleteOperation(
          generateOperationId(this._clientId),
          this._clientId,
          this._version,
          key,
          oldVal
        ));
      }
    }
    
    return operations;
  }

  /**
   * Check if the map is empty
   */
  isEmpty(): boolean {
    return Object.keys(this._data).length === 0;
  }

  /**
   * Convert map to plain object
   */
  toObject(): Record<string, T> {
    return { ...this._data };
  }

  /**
   * Convert map to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this._data);
  }

  /**
   * Create from JSON string
   */
  static fromJSON<T>(
    json: string, 
    clientId: ClientId, 
    version: Version = 0
  ): SharedMap<T> {
    const data = JSON.parse(json);
    return new SharedMap<T>(data, clientId, version);
  }

  /**
   * Merge another object into this map
   */
  merge(other: Record<string, T>): MapOperationType {
    return this.batch(other);
  }

  /**
   * Create a snapshot of the current state
   */
  toSnapshot(): { value: Record<string, T>; version: Version } {
    return {
      value: { ...this._data },
      version: this._version,
    };
  }

  /**
   * Restore from a snapshot
   */
  fromSnapshot(snapshot: { value: Record<string, T>; version: Version }): void {
    const oldValue = this.value;
    this._data = { ...snapshot.value };
    this._version = snapshot.version;
    this.emit('change', this.value, oldValue);
  }

  /**
   * Create a copy of this SharedMap
   */
  clone(): SharedMap<T> {
    return new SharedMap<T>(this._data, this._clientId, this._version);
  }

  /**
   * Iterate over the map entries
   */
  [Symbol.iterator](): Iterator<[string, T]> {
    return Object.entries(this._data)[Symbol.iterator]();
  }

  /**
   * For each entry in the map
   */
  forEach(callback: (value: T, key: string) => void): void {
    for (const [key, value] of Object.entries(this._data)) {
      callback(value, key);
    }
  }

  /**
   * Map over the map values
   */
  map<U>(callback: (value: T, key: string) => U): Record<string, U> {
    const result: Record<string, U> = {};
    for (const [key, value] of Object.entries(this._data)) {
      result[key] = callback(value, key);
    }
    return result;
  }

  /**
   * Filter the map entries
   */
  filter(callback: (value: T, key: string) => boolean): Record<string, T> {
    const result: Record<string, T> = {};
    for (const [key, value] of Object.entries(this._data)) {
      if (callback(value, key)) {
        result[key] = value;
      }
    }
    return result;
  }

  /**
   * Find a value in the map
   */
  find(callback: (value: T, key: string) => boolean): T | undefined {
    for (const [key, value] of Object.entries(this._data)) {
      if (callback(value, key)) {
        return value;
      }
    }
    return undefined;
  }
}