/**
 * Collaborative document implementation
 */

import {
  EventEmitter,
  Operation,
  DocumentId,
  ClientId,
  Version,
  SharedText,
  SharedList,
  SharedMap,
  transformTextOperation,
  transformListOperation,
  transformMapOperation,
} from '@lanemc/core';
import { DocumentSchema, UserPresence } from '../types.js';

/**
 * Events emitted by CollabDocument
 */
export interface CollabDocumentEvents<T> {
  /** Document state changed */
  change: (newState: T, oldState: T) => void;
  
  /** Operation applied */
  operation: (operation: Operation) => void;
  
  /** Remote operation received */
  remoteOperation: (operation: Operation) => void;
  
  /** Document synchronized with server */
  synced: (version: Version) => void;
  
  /** User presence updated */
  presenceUpdate: (presence: UserPresence) => void;
  
  /** User joined */
  userJoined: (user: UserPresence) => void;
  
  /** User left */
  userLeft: (user: UserPresence) => void;
  
  /** Document left */
  leave: () => void;
  
  /** Allow additional events */
  [key: string]: (...args: any[]) => void;
}

/**
 * Collaborative document that manages shared data and operations
 */
export class CollabDocument<T = any> extends EventEmitter<CollabDocumentEvents<T>> {
  private documentId: DocumentId;
  private clientId: ClientId;
  private schema?: DocumentSchema;
  private version: Version = 0;
  private sharedData: any;
  private pendingOperations: Operation[] = [];
  private presence: Map<ClientId, UserPresence> = new Map();
  private isJoined = false;

  constructor(documentId: DocumentId, clientId: ClientId, schema?: DocumentSchema) {
    super();
    this.documentId = documentId;
    this.clientId = clientId;
    this.schema = schema;
    
    // Initialize shared data based on schema
    this.initializeSharedData();
  }

  /**
   * Document ID
   */
  get id(): DocumentId {
    return this.documentId;
  }

  /**
   * Current document version
   */
  get currentVersion(): Version {
    return this.version;
  }

  /**
   * Get the shared data
   */
  get data(): T {
    if (this.sharedData instanceof SharedText) {
      return this.sharedData.value as T;
    } else if (this.sharedData instanceof SharedList) {
      return this.sharedData.value as T;
    } else if (this.sharedData instanceof SharedMap) {
      return this.sharedData.value as T;
    } else if (typeof this.sharedData === 'object' && this.sharedData !== null) {
      // Composite document
      const result: any = {};
      for (const [key, value] of Object.entries(this.sharedData)) {
        if (value instanceof SharedText || value instanceof SharedList || value instanceof SharedMap) {
          result[key] = value.value;
        } else {
          result[key] = value;
        }
      }
      return result as T;
    }
    
    return this.sharedData as T;
  }

  /**
   * Check if document is joined
   */
  get joined(): boolean {
    return this.isJoined;
  }

  /**
   * Get shared text (for text documents)
   */
  getText(): SharedText {
    if (!(this.sharedData instanceof SharedText)) {
      throw new Error('Document is not a text document');
    }
    return this.sharedData;
  }

  /**
   * Get shared list (for list documents)
   */
  getList<ItemType = any>(): SharedList<ItemType> {
    if (!(this.sharedData instanceof SharedList)) {
      throw new Error('Document is not a list document');
    }
    return this.sharedData;
  }

  /**
   * Get shared map (for map documents)
   */
  getMap<ValueType = any>(): SharedMap<ValueType> {
    if (!(this.sharedData instanceof SharedMap)) {
      throw new Error('Document is not a map document');
    }
    return this.sharedData;
  }

  /**
   * Get a field from a composite document
   */
  getField<FieldType = any>(fieldName: string): FieldType {
    if (typeof this.sharedData !== 'object' || this.sharedData === null) {
      throw new Error('Document is not a composite document');
    }
    
    const field = this.sharedData[fieldName];
    if (!field) {
      throw new Error(`Field '${fieldName}' not found`);
    }
    
    if (field instanceof SharedText || field instanceof SharedList || field instanceof SharedMap) {
      return field.value as FieldType;
    }
    
    return field as FieldType;
  }

  /**
   * Get a shared field object from a composite document
   */
  getSharedField(fieldName: string): SharedText | SharedList | SharedMap {
    if (typeof this.sharedData !== 'object' || this.sharedData === null) {
      throw new Error('Document is not a composite document');
    }
    
    const field = this.sharedData[fieldName];
    if (!field) {
      throw new Error(`Field '${fieldName}' not found`);
    }
    
    if (!(field instanceof SharedText || field instanceof SharedList || field instanceof SharedMap)) {
      throw new Error(`Field '${fieldName}' is not a shared type`);
    }
    
    return field;
  }

  /**
   * Apply a local operation
   */
  applyLocalOperation(operation: Operation): void {
    const oldState = this.data;
    
    // Apply operation to shared data
    this.applyOperationToSharedData(operation);
    
    // Add to pending operations
    this.pendingOperations.push(operation);
    
    // Emit events
    this.emit('operation', operation);
    this.emit('change', this.data, oldState);
  }

  /**
   * Apply a remote operation from the server
   */
  applyRemoteOperation(operation: Operation): void {
    const oldState = this.data;
    
    // Transform against pending operations
    let transformedOperation = operation;
    for (const pendingOp of this.pendingOperations) {
      transformedOperation = this.transformOperation(transformedOperation, pendingOp);
    }
    
    // Apply transformed operation
    this.applyOperationToSharedData(transformedOperation);
    
    // Update version
    this.version = Math.max(this.version, operation.baseVersion + 1);
    
    // Emit events
    this.emit('remoteOperation', transformedOperation);
    this.emit('change', this.data, oldState);
  }

  /**
   * Update document state from server
   */
  updateState(state: any, version: Version): void {
    const oldState = this.data;
    
    // Update shared data
    this.updateSharedDataState(state);
    
    // Update version
    this.version = version;
    
    // Clear pending operations (they're now synchronized)
    this.pendingOperations = [];
    
    // Mark as joined
    this.isJoined = true;
    
    // Emit events
    this.emit('synced', version);
    this.emit('change', this.data, oldState);
  }

  /**
   * Update user presence
   */
  updatePresence(users: UserPresence[]): void {
    // Update presence map
    this.presence.clear();
    for (const user of users) {
      this.presence.set(user.clientId, user);
    }
  }

  /**
   * Update a single user's presence
   */
  updateUserPresence(userPresence: UserPresence): void {
    const wasPresent = this.presence.has(userPresence.clientId);
    this.presence.set(userPresence.clientId, userPresence);
    
    this.emit('presenceUpdate', userPresence);
    
    if (!wasPresent) {
      this.emit('userJoined', userPresence);
    }
  }

  /**
   * Remove user presence
   */
  removeUserPresence(clientId: ClientId): void {
    const user = this.presence.get(clientId);
    if (user) {
      this.presence.delete(clientId);
      this.emit('userLeft', user);
    }
  }

  /**
   * Get current users in the document
   */
  getUsers(): UserPresence[] {
    return Array.from(this.presence.values());
  }

  /**
   * Get user by client ID
   */
  getUser(clientId: ClientId): UserPresence | undefined {
    return this.presence.get(clientId);
  }

  /**
   * Leave the document
   */
  leave(): void {
    this.isJoined = false;
    this.presence.clear();
    this.pendingOperations = [];
    this.emit('leave');
  }

  /**
   * Initialize shared data based on schema
   */
  private initializeSharedData(): void {
    if (!this.schema) {
      // Default to text document
      this.sharedData = new SharedText('', this.clientId);
      return;
    }

    switch (this.schema.type) {
      case 'text':
        this.sharedData = new SharedText(
          this.schema.initialValue || '', 
          this.clientId
        );
        break;
      
      case 'list':
        this.sharedData = new SharedList(
          this.schema.initialValue || [], 
          this.clientId
        );
        break;
      
      case 'map':
        this.sharedData = new SharedMap(
          this.schema.initialValue || {}, 
          this.clientId
        );
        break;
      
      case 'composite':
        this.sharedData = {};
        if (this.schema.fields) {
          for (const [fieldName, fieldSchema] of Object.entries(this.schema.fields)) {
            switch (fieldSchema.type) {
              case 'text':
                this.sharedData[fieldName] = new SharedText(
                  fieldSchema.initialValue || '', 
                  this.clientId
                );
                break;
              case 'list':
                this.sharedData[fieldName] = new SharedList(
                  fieldSchema.initialValue || [], 
                  this.clientId
                );
                break;
              case 'map':
                this.sharedData[fieldName] = new SharedMap(
                  fieldSchema.initialValue || {}, 
                  this.clientId
                );
                break;
            }
          }
        }
        break;
      
      default:
        throw new Error(`Unsupported document type: ${this.schema.type}`);
    }

    // Set up event listeners for shared data
    this.setupSharedDataListeners();
  }

  /**
   * Set up event listeners for shared data
   */
  private setupSharedDataListeners(): void {
    const setupListeners = (sharedType: SharedText | SharedList | SharedMap) => {
      sharedType.on('operation', (operation) => {
        this.applyLocalOperation(operation);
      });
    };

    if (this.sharedData instanceof SharedText || 
        this.sharedData instanceof SharedList || 
        this.sharedData instanceof SharedMap) {
      setupListeners(this.sharedData);
    } else if (typeof this.sharedData === 'object' && this.sharedData !== null) {
      // Composite document
      for (const field of Object.values(this.sharedData)) {
        if (field instanceof SharedText || field instanceof SharedList || field instanceof SharedMap) {
          setupListeners(field);
        }
      }
    }
  }

  /**
   * Apply operation to the appropriate shared data
   */
  private applyOperationToSharedData(operation: Operation): void {
    // Determine which shared data to apply to based on operation type or field
    if (this.sharedData instanceof SharedText && operation.type.startsWith('text-')) {
      this.sharedData.apply(operation as any); // TextOperationType
    } else if (this.sharedData instanceof SharedList && operation.type.startsWith('list-')) {
      this.sharedData.apply(operation as any); // ListOperationType
    } else if (this.sharedData instanceof SharedMap && operation.type.startsWith('map-')) {
      this.sharedData.apply(operation as any); // MapOperationType
    } else if (typeof this.sharedData === 'object' && this.sharedData !== null) {
      // Composite document - operation should specify field
      // For now, assume operation has a field property (would need to extend operation types)
      // This is simplified - in real implementation, operations would include field information
    }
  }

  /**
   * Transform one operation against another
   */
  private transformOperation(operationA: Operation, operationB: Operation): Operation {
    if (operationA.type.startsWith('text-') && operationB.type.startsWith('text-')) {
      // Import types are needed for proper casting
      const result = transformTextOperation(
        operationA as any, // TextOperationType
        operationB as any  // TextOperationType
      );
      return result.operation;
    } else if (operationA.type.startsWith('list-') && operationB.type.startsWith('list-')) {
      const result = transformListOperation(
        operationA as any, // ListOperationType
        operationB as any  // ListOperationType
      );
      return result.operation;
    } else if (operationA.type.startsWith('map-') && operationB.type.startsWith('map-')) {
      const result = transformMapOperation(
        operationA as any, // MapOperationType
        operationB as any  // MapOperationType
      );
      return result.operation;
    }
    
    // No transformation needed for different types
    return operationA;
  }

  /**
   * Update shared data state from server snapshot
   */
  private updateSharedDataState(state: any): void {
    if (this.sharedData instanceof SharedText) {
      this.sharedData.fromSnapshot({ value: state, version: this.version });
    } else if (this.sharedData instanceof SharedList) {
      this.sharedData.fromSnapshot({ value: state, version: this.version });
    } else if (this.sharedData instanceof SharedMap) {
      this.sharedData.fromSnapshot({ value: state, version: this.version });
    } else if (typeof this.sharedData === 'object' && this.sharedData !== null) {
      // Composite document
      for (const [fieldName, fieldValue] of Object.entries(state)) {
        const sharedField = this.sharedData[fieldName];
        if (sharedField instanceof SharedText || 
            sharedField instanceof SharedList || 
            sharedField instanceof SharedMap) {
          sharedField.fromSnapshot({ value: fieldValue as any, version: this.version });
        }
      }
    }
  }
}