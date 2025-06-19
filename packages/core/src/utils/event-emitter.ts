/**
 * Simple event emitter implementation for shared types and clients
 */

export type EventListener<T extends any[]> = (...args: T) => void;

/**
 * Generic event emitter class
 */
export class EventEmitter<
  Events extends Record<string, (...args: any[]) => void>
> {
  private listeners: Map<keyof Events, Set<EventListener<any>>> = new Map();

  /**
   * Add an event listener
   */
  on<K extends keyof Events>(event: K, listener: Events[K]): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  /**
   * Remove an event listener
   */
  off<K extends keyof Events>(event: K, listener: Events[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Add a one-time event listener
   */
  once<K extends keyof Events>(event: K, listener: Events[K]): void {
    const onceListener = ((...args: Parameters<Events[K]>) => {
      this.off(event, onceListener as Events[K]);
      listener(...args);
    }) as Events[K];
    
    this.on(event, onceListener);
  }

  /**
   * Emit an event to all listeners
   */
  emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      // Create a copy of the listeners set to avoid issues if listeners are modified during emission
      const listenersArray = Array.from(eventListeners);
      for (const listener of listenersArray) {
        try {
          listener(...args);
        } catch (error) {
          // Log error but don't break other listeners
          console.error('Error in event listener:', error);
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all listeners if no event specified
   */
  removeAllListeners<K extends keyof Events>(event?: K): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof Events>(event: K): number {
    const eventListeners = this.listeners.get(event);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): (keyof Events)[] {
    return Array.from(this.listeners.keys());
  }

  /**
   * Check if there are any listeners for an event
   */
  hasListeners<K extends keyof Events>(event: K): boolean {
    return this.listenerCount(event) > 0;
  }
}