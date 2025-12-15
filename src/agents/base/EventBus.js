const logger = require('../../utils/logger');

/**
 * Event Bus for Agent Communication
 * Enables pub/sub pattern for decoupled agent communication
 */
class EventBus {
  constructor() {
    this.handlers = {};
    this.eventHistory = [];
    this.maxHistorySize = 1000;

    logger.info('EventBus initialized');
  }

  /**
   * Subscribe to an event
   */
  subscribe(event, handler, agentId = null) {
    if (!this.handlers[event]) {
      this.handlers[event] = [];
    }

    const subscription = {
      handler,
      agentId,
      subscribedAt: new Date()
    };

    this.handlers[event].push(subscription);

    logger.debug(`EventBus: Subscription added`, {
      event,
      agentId,
      totalSubscribers: this.handlers[event].length
    });

    // Return unsubscribe function
    return () => this.unsubscribe(event, handler);
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(event, handler) {
    if (!this.handlers[event]) return;

    this.handlers[event] = this.handlers[event].filter(
      sub => sub.handler !== handler
    );

    logger.debug(`EventBus: Subscription removed`, {
      event,
      remainingSubscribers: this.handlers[event].length
    });
  }

  /**
   * Emit an event
   */
  async emit(event, payload = {}) {
    const eventData = {
      event,
      payload,
      timestamp: new Date(),
      eventId: this.generateEventId()
    };

    // Add to history
    this.eventHistory.push(eventData);
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }

    logger.debug(`EventBus: Event emitted`, {
      event,
      eventId: eventData.eventId,
      payloadKeys: Object.keys(payload)
    });

    // Get handlers for this event
    const handlers = this.handlers[event] || [];

    // Execute all handlers
    const results = await Promise.allSettled(
      handlers.map(({ handler, agentId }) =>
        this.executeHandler(handler, eventData, agentId)
      )
    );

    // Log any handler failures
    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      logger.error(`EventBus: ${failures.length} handler(s) failed for event ${event}`, {
        event,
        failures: failures.map(f => f.reason.message)
      });
    }

    return {
      event,
      eventId: eventData.eventId,
      handlersExecuted: handlers.length,
      handlersSucceeded: results.filter(r => r.status === 'fulfilled').length,
      handlersFailed: failures.length
    };
  }

  /**
   * Execute a handler with error handling
   */
  async executeHandler(handler, eventData, agentId) {
    try {
      await handler(eventData.payload, eventData);
    } catch (error) {
      logger.error(`EventBus: Handler error`, {
        event: eventData.event,
        eventId: eventData.eventId,
        agentId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Subscribe to multiple events at once
   */
  subscribeMany(events, handler, agentId = null) {
    const unsubscribers = events.map(event =>
      this.subscribe(event, handler, agentId)
    );

    // Return function to unsubscribe from all
    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Emit multiple events
   */
  async emitMany(events) {
    return Promise.all(
      events.map(({ event, payload }) => this.emit(event, payload))
    );
  }

  /**
   * Get event history
   */
  getHistory(options = {}) {
    const { event, agentId, limit = 100, since } = options;

    let history = [...this.eventHistory];

    // Filter by event
    if (event) {
      history = history.filter(e => e.event === event);
    }

    // Filter by agentId
    if (agentId) {
      history = history.filter(e => e.payload.agentId === agentId);
    }

    // Filter by timestamp
    if (since) {
      const sinceDate = new Date(since);
      history = history.filter(e => e.timestamp >= sinceDate);
    }

    // Limit results
    return history.slice(-limit);
  }

  /**
   * Get statistics
   */
  getStats() {
    const eventCounts = {};
    this.eventHistory.forEach(e => {
      eventCounts[e.event] = (eventCounts[e.event] || 0) + 1;
    });

    return {
      totalEvents: this.eventHistory.length,
      eventTypes: Object.keys(this.handlers).length,
      totalSubscriptions: Object.values(this.handlers).reduce(
        (sum, handlers) => sum + handlers.length,
        0
      ),
      eventCounts,
      mostActiveEvent: Object.entries(eventCounts)
        .sort((a, b) => b[1] - a[1])[0]?.[0] || null
    };
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.eventHistory = [];
    logger.info('EventBus: History cleared');
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Wait for an event
   */
  waitFor(event, timeout = 30000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        reject(new Error(`Timeout waiting for event: ${event}`));
      }, timeout);

      const unsubscribe = this.subscribe(event, (payload) => {
        clearTimeout(timer);
        unsubscribe();
        resolve(payload);
      });
    });
  }

  /**
   * Wait for multiple events
   */
  async waitForAll(events, timeout = 30000) {
    return Promise.all(
      events.map(event => this.waitFor(event, timeout))
    );
  }

  /**
   * Shutdown event bus
   */
  shutdown() {
    logger.info('EventBus: Shutting down');
    this.handlers = {};
    this.clearHistory();
  }
}

// Singleton instance
let instance = null;

module.exports = {
  EventBus,
  getInstance: () => {
    if (!instance) {
      instance = new EventBus();
    }
    return instance;
  }
};
