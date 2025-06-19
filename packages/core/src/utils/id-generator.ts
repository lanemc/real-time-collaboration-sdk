/**
 * Utility functions for generating unique identifiers
 */

/**
 * Generate a unique identifier for operations, documents, or clients
 */
export function generateId(): string {
  // Use timestamp + random for uniqueness
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
  return `${timestamp}-${random}`;
}

/**
 * Generate a client-specific operation ID
 */
export function generateOperationId(clientId: string): string {
  return `${clientId}-${generateId()}`;
}

/**
 * Generate a document ID
 */
export function generateDocumentId(): string {
  return `doc-${generateId()}`;
}

/**
 * Check if a string is a valid ID format
 */
export function isValidId(id: string): boolean {
  return typeof id === 'string' && id.length > 0 && /^[a-zA-Z0-9\-_]+$/.test(id);
}