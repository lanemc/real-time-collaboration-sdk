/**
 * Real-Time Collaboration Core (RTCC)
 * Main entry point for core operational transformation algorithms and types
 */

// Base types and interfaces
export * from './types/base.js';

// Text operations and transformations
export * from './types/text-operations.js';
export * from './algorithms/text-transform.js';
export * from './types/shared-text.js';

// List operations and transformations  
export * from './types/list-operations.js';
export * from './algorithms/list-transform.js';
export * from './types/shared-list.js';

// Map operations and transformations
export * from './types/map-operations.js';
export * from './algorithms/map-transform.js';
export * from './types/shared-map.js';

// Utility functions
export { generateId } from './utils/id-generator.js';
export { EventEmitter } from './utils/event-emitter.js';

// Version information
export const VERSION = '0.1.0';