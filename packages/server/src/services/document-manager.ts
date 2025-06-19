/**
 * Document management service for the collaboration server
 */

import { EventEmitter, Operation, DocumentId, ClientId, Version } from '@thesaasdevkit/rtc-core';
import { DocumentState, PersistenceAdapter } from '../types/server-types.js';

/**
 * Events emitted by DocumentManager
 */
export interface DocumentManagerEvents {
  /** Document created */
  documentCreated: (documentId: DocumentId, document: DocumentState) => void;
  
  /** Document updated */
  documentUpdated: (documentId: DocumentId, document: DocumentState) => void;
  
  /** Operation applied to document */
  operationApplied: (documentId: DocumentId, operation: Operation) => void;
  
  /** Client joined document */
  clientJoined: (documentId: DocumentId, clientId: ClientId) => void;
  
  /** Client left document */
  clientLeft: (documentId: DocumentId, clientId: ClientId) => void;
  
  /** Allow additional events */
  [key: string]: (...args: any[]) => void;
}

/**
 * Manages collaborative documents and their operations
 */
export class DocumentManager extends EventEmitter<DocumentManagerEvents> {
  private documents = new Map<DocumentId, DocumentState>();
  private persistenceAdapter?: PersistenceAdapter;
  private operationCount = 0;

  constructor(persistenceConfig?: { enabled: boolean; adapter?: PersistenceAdapter }) {
    super();
    
    if (persistenceConfig?.enabled && persistenceConfig.adapter) {
      this.persistenceAdapter = persistenceConfig.adapter;
    }
  }

  /**
   * Get or create a document
   */
  async getOrCreateDocument(documentId: DocumentId, schema?: any): Promise<DocumentState> {
    let document = this.documents.get(documentId);
    
    if (!document) {
      // Try to load from persistence
      if (this.persistenceAdapter) {
        const loaded = await this.persistenceAdapter.loadDocument(documentId);
        document = loaded || undefined;
      }
      
      // Create new document if not found
      if (!document) {
        document = this.createNewDocument(documentId, schema);
        this.emit('documentCreated', documentId, document);
      }
      
      this.documents.set(documentId, document);
    }
    
    return document;
  }

  /**
   * Get a document by ID
   */
  getDocument(documentId: DocumentId): DocumentState | undefined {
    return this.documents.get(documentId);
  }

  /**
   * Apply an operation to a document
   */
  async applyOperation(documentId: DocumentId, operation: Operation): Promise<Version> {
    const document = this.documents.get(documentId);
    if (!document) {
      throw new Error(`Document ${documentId} not found`);
    }

    // Transform operation against any operations that happened since its base version
    const transformedOperation = this.transformOperation(document, operation);
    
    // Apply the transformed operation
    this.applyOperationToDocument(document, transformedOperation);
    
    // Increment operation count
    this.operationCount++;
    
    // Save to persistence if enabled
    if (this.persistenceAdapter) {
      await this.persistenceAdapter.saveOperation(documentId, transformedOperation);
      await this.persistenceAdapter.saveDocument(document);
    }
    
    // Emit events
    this.emit('operationApplied', documentId, transformedOperation);
    this.emit('documentUpdated', documentId, document);
    
    return document.version;
  }

  /**
   * Add a client to a document
   */
  addClientToDocument(documentId: DocumentId, clientId: ClientId): void {
    const document = this.documents.get(documentId);
    if (document) {
      document.clients.add(clientId);
      this.emit('clientJoined', documentId, clientId);
    }
  }

  /**
   * Remove a client from a document
   */
  removeClientFromDocument(documentId: DocumentId, clientId: ClientId): void {
    const document = this.documents.get(documentId);
    if (document) {
      document.clients.delete(clientId);
      this.emit('clientLeft', documentId, clientId);
      
      // Clean up empty documents (optional)
      if (document.clients.size === 0) {
        // Could implement cleanup logic here
      }
    }
  }

  /**
   * Get list of active document IDs
   */
  getActiveDocuments(): DocumentId[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get number of active documents
   */
  getDocumentCount(): number {
    return this.documents.size;
  }

  /**
   * Get total operation count
   */
  getTotalOperations(): number {
    return this.operationCount;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: DocumentId): Promise<void> {
    const document = this.documents.get(documentId);
    if (!document) {
      return;
    }

    // Remove all clients
    document.clients.clear();
    
    // Remove from memory
    this.documents.delete(documentId);
    
    // Remove from persistence
    if (this.persistenceAdapter) {
      await this.persistenceAdapter.deleteDocument(documentId);
    }
  }

  /**
   * Create a new document
   */
  private createNewDocument(documentId: DocumentId, schema?: any): DocumentState {
    const now = Date.now();
    
    // Initialize data based on schema
    let initialData: any = '';
    if (schema) {
      switch (schema.type) {
        case 'text':
          initialData = schema.initialValue || '';
          break;
        case 'list':
          initialData = schema.initialValue || [];
          break;
        case 'map':
          initialData = schema.initialValue || {};
          break;
        case 'composite':
          initialData = {};
          if (schema.fields) {
            for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
              initialData[fieldName] = (fieldSchema as any).initialValue || '';
            }
          }
          break;
      }
    }

    return {
      id: documentId,
      version: 0,
      data: initialData,
      operations: [],
      clients: new Set(),
      createdAt: now,
      updatedAt: now,
      schema,
    };
  }

  /**
   * Transform an operation against document's state
   */
  private transformOperation(document: DocumentState, operation: Operation): Operation {
    // Find operations that happened after the operation's base version
    const laterOperations = document.operations.filter(
      op => op.baseVersion >= operation.baseVersion
    );

    let transformedOperation = operation;
    
    // Transform against each later operation
    for (const laterOp of laterOperations) {
      transformedOperation = this.transformOperationPair(transformedOperation, laterOp);
    }
    
    return transformedOperation;
  }

  /**
   * Transform one operation against another
   */
  private transformOperationPair(opA: Operation, opB: Operation): Operation {
    // This is simplified - in reality, we'd use the specific transform functions
    // from the core package based on operation types
    
    // For now, just return the original operation
    // In full implementation, would call appropriate transform functions:
    // - transformTextOperation for text operations
    // - transformListOperation for list operations
    // - transformMapOperation for map operations
    
    return opA;
  }

  /**
   * Apply an operation to document data
   */
  private applyOperationToDocument(document: DocumentState, operation: Operation): void {
    // Update base version for the operation
    operation.baseVersion = document.version;
    
    // Add to operations list
    document.operations.push(operation);
    
    // Apply to document data based on operation type
    this.applyOperationToData(document, operation);
    
    // Increment version
    document.version++;
    document.updatedAt = Date.now();
    
    // Trim operations list if it gets too large
    if (document.operations.length > 1000) {
      // Keep only recent operations
      document.operations = document.operations.slice(-500);
    }
  }

  /**
   * Apply operation to document data
   */
  private applyOperationToData(document: DocumentState, operation: Operation): void {
    // This is simplified - in reality, we'd apply operations properly
    // based on the document schema and operation type
    
    switch (operation.type) {
      case 'text-insert':
        if (typeof document.data === 'string') {
          const insertOp = operation as any;
          const before = document.data.substring(0, insertOp.position);
          const after = document.data.substring(insertOp.position);
          document.data = before + insertOp.text + after;
        }
        break;
        
      case 'text-delete':
        if (typeof document.data === 'string') {
          const deleteOp = operation as any;
          const before = document.data.substring(0, deleteOp.position);
          const after = document.data.substring(deleteOp.position + deleteOp.length);
          document.data = before + after;
        }
        break;
        
      case 'list-insert':
        if (Array.isArray(document.data)) {
          const insertOp = operation as any;
          document.data.splice(insertOp.index, 0, insertOp.item);
        }
        break;
        
      case 'list-delete':
        if (Array.isArray(document.data)) {
          const deleteOp = operation as any;
          document.data.splice(deleteOp.index, deleteOp.count || 1);
        }
        break;
        
      case 'map-set':
        if (typeof document.data === 'object' && document.data !== null) {
          const setOp = operation as any;
          document.data[setOp.key] = setOp.value;
        }
        break;
        
      case 'map-delete':
        if (typeof document.data === 'object' && document.data !== null) {
          const deleteOp = operation as any;
          delete document.data[deleteOp.key];
        }
        break;
    }
  }
}