/**
 * SharedText implementation for collaborative text editing
 */

import { SharedType, SharedTypeEvents, Version, ClientId } from './base.js';
import {
  TextOperationType,
  InsertTextOperation,
  DeleteTextOperation,
  createInsertOperation,
  createDeleteOperation,
  isInsertOperation,
  isDeleteOperation,
} from './text-operations.js';
import { transformTextOperation, textOperationsConflict } from '../algorithms/text-transform.js';
import { EventEmitter } from '../utils/event-emitter.js';
import { generateOperationId } from '../utils/id-generator.js';

/**
 * Events emitted by SharedText
 */
export interface SharedTextEvents extends SharedTypeEvents<string> {
  /** Emitted when text is inserted */
  insert: (position: number, text: string) => void;
  
  /** Emitted when text is deleted */
  delete: (position: number, length: number) => void;
  
  /** Emitted when cursor position changes (for presence) */
  cursor: (clientId: ClientId, position: number) => void;
}

/**
 * Collaborative text data type with operational transformation
 */
export class SharedText 
  extends EventEmitter<SharedTextEvents>
  implements SharedType<TextOperationType, string> {
  
  private _value: string;
  private _version: Version;
  private _clientId: ClientId;
  
  constructor(initialValue: string = '', clientId: ClientId, initialVersion: Version = 0) {
    super();
    this._value = initialValue;
    this._version = initialVersion;
    this._clientId = clientId;
  }

  /**
   * Current text value
   */
  get value(): string {
    return this._value;
  }

  /**
   * Current version
   */
  get version(): Version {
    return this._version;
  }

  /**
   * Insert text at a specific position
   */
  insert(position: number, text: string): TextOperationType {
    if (position < 0 || position > this._value.length) {
      throw new Error(`Invalid position: ${position}. Text length is ${this._value.length}`);
    }

    if (text.length === 0) {
      throw new Error('Cannot insert empty text');
    }

    const operation = createInsertOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      position,
      text
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Delete text at a specific position
   */
  delete(position: number, length: number = 1): TextOperationType {
    if (position < 0 || position >= this._value.length) {
      throw new Error(`Invalid position: ${position}. Text length is ${this._value.length}`);
    }

    if (length <= 0) {
      throw new Error('Delete length must be positive');
    }

    // Adjust length if it exceeds available text
    const actualLength = Math.min(length, this._value.length - position);

    const operation = createDeleteOperation(
      generateOperationId(this._clientId),
      this._clientId,
      this._version,
      position,
      actualLength
    );

    this.apply(operation);
    return operation;
  }

  /**
   * Replace text in a range
   */
  replace(position: number, length: number, newText: string): TextOperationType[] {
    const operations: TextOperationType[] = [];
    
    // First delete the existing text
    if (length > 0) {
      operations.push(this.delete(position, length));
    }
    
    // Then insert the new text
    if (newText.length > 0) {
      operations.push(this.insert(position, newText));
    }
    
    return operations;
  }

  /**
   * Set the entire text value (generates operations for the change)
   */
  setText(newText: string): TextOperationType[] {
    return this.generateOperations(this._value, newText);
  }

  /**
   * Apply an operation to the text
   */
  apply(operation: TextOperationType): string {
    const oldValue = this._value;

    if (isInsertOperation(operation)) {
      // Insert text at position
      const before = this._value.substring(0, operation.position);
      const after = this._value.substring(operation.position);
      this._value = before + operation.text + after;
      
      this.emit('insert', operation.position, operation.text);
    } else if (isDeleteOperation(operation)) {
      // Delete text at position
      const before = this._value.substring(0, operation.position);
      const after = this._value.substring(operation.position + operation.length);
      this._value = before + after;
      
      this.emit('delete', operation.position, operation.length);
    }

    // Update version if this is a newer operation
    if (operation.baseVersion >= this._version) {
      this._version = operation.baseVersion + 1;
    }

    // Emit change event
    this.emit('change', this._value, oldValue);
    this.emit('operation', operation);

    return this._value;
  }

  /**
   * Transform this operation against another operation
   */
  transform(operationA: TextOperationType, operationB: TextOperationType) {
    const result = transformTextOperation(operationA, operationB);
    
    if (result.wasTransformed) {
      this.emit('transform', operationA, result.operation);
    }
    
    return result;
  }

  /**
   * Check if two operations conflict
   */
  conflicts(operationA: TextOperationType, operationB: TextOperationType): boolean {
    return textOperationsConflict(operationA, operationB);
  }

  /**
   * Generate operations to transform from one text value to another
   */
  generateOperations(oldValue: string, newValue: string): TextOperationType[] {
    const operations: TextOperationType[] = [];
    
    // Simple diff algorithm - can be improved with more sophisticated algorithms
    const commonPrefix = this.findCommonPrefix(oldValue, newValue);
    const commonSuffix = this.findCommonSuffix(
      oldValue.substring(commonPrefix), 
      newValue.substring(commonPrefix)
    );
    
    const oldMiddle = oldValue.substring(
      commonPrefix, 
      oldValue.length - commonSuffix
    );
    const newMiddle = newValue.substring(
      commonPrefix, 
      newValue.length - commonSuffix
    );
    
    // Delete old middle section
    if (oldMiddle.length > 0) {
      operations.push(createDeleteOperation(
        generateOperationId(this._clientId),
        this._clientId,
        this._version,
        commonPrefix,
        oldMiddle.length
      ));
    }
    
    // Insert new middle section
    if (newMiddle.length > 0) {
      operations.push(createInsertOperation(
        generateOperationId(this._clientId),
        this._clientId,
        this._version,
        commonPrefix,
        newMiddle
      ));
    }
    
    return operations;
  }

  /**
   * Get a substring of the text
   */
  substring(start: number, end?: number): string {
    return this._value.substring(start, end);
  }

  /**
   * Get the length of the text
   */
  get length(): number {
    return this._value.length;
  }

  /**
   * Check if the text is empty
   */
  isEmpty(): boolean {
    return this._value.length === 0;
  }

  /**
   * Clear all text
   */
  clear(): TextOperationType | null {
    if (this.isEmpty()) {
      return null;
    }
    
    return this.delete(0, this._value.length);
  }

  /**
   * Find the longest common prefix between two strings
   */
  private findCommonPrefix(a: string, b: string): number {
    let i = 0;
    const maxLength = Math.min(a.length, b.length);
    
    while (i < maxLength && a[i] === b[i]) {
      i++;
    }
    
    return i;
  }

  /**
   * Find the longest common suffix between two strings
   */
  private findCommonSuffix(a: string, b: string): number {
    let i = 0;
    const maxLength = Math.min(a.length, b.length);
    
    while (i < maxLength && a[a.length - 1 - i] === b[b.length - 1 - i]) {
      i++;
    }
    
    return i;
  }

  /**
   * Create a snapshot of the current state
   */
  toSnapshot(): { value: string; version: Version } {
    return {
      value: this._value,
      version: this._version,
    };
  }

  /**
   * Restore from a snapshot
   */
  fromSnapshot(snapshot: { value: string; version: Version }): void {
    const oldValue = this._value;
    this._value = snapshot.value;
    this._version = snapshot.version;
    this.emit('change', this._value, oldValue);
  }

  /**
   * Convert to string representation
   */
  toString(): string {
    return this._value;
  }

  /**
   * Create a copy of this SharedText
   */
  clone(): SharedText {
    const cloned = new SharedText(this._value, this._clientId, this._version);
    return cloned;
  }
}