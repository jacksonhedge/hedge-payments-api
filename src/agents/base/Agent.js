const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Base Agent Class
 * All agents inherit from this class
 */
class Agent {
  constructor(config) {
    this.id = config.id || uuidv4();
    this.name = config.name || 'UnnamedAgent';
    this.type = config.type || 'generic';
    this.team = config.team || null;
    this.manager = config.manager || null;
    this.eventBus = config.eventBus;
    this.orchestrator = config.orchestrator;

    // Agent state
    this.state = 'idle'; // idle | working | error | paused
    this.isActive = true;

    // Metrics
    this.metrics = {
      tasksExecuted: 0,
      tasksSucceeded: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      lastActive: null,
      createdAt: new Date(),
      errors: []
    };

    // Configuration
    this.config = {
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 30000,
      ...config
    };

    logger.info(`Agent initialized: ${this.name} (${this.id})`);
    this.emitEvent('agent:started', { agentId: this.id, name: this.name });
  }

  /**
   * Execute a task
   * This is the main entry point for all agent work
   */
  async execute(task) {
    const startTime = Date.now();
    const taskId = task.id || uuidv4();

    try {
      this.setState('working');
      this.metrics.tasksExecuted++;
      this.metrics.lastActive = new Date();

      logger.debug(`[${this.name}] Executing task ${taskId}`, {
        agentId: this.id,
        taskId,
        taskType: task.type
      });

      // Validate task
      this.validateTask(task);

      // Execute the task with timeout
      const result = await this.executeWithTimeout(
        () => this.performTask(task),
        this.config.timeout
      );

      // Task succeeded
      this.metrics.tasksSucceeded++;
      this.metrics.totalExecutionTime += Date.now() - startTime;
      this.setState('idle');

      logger.info(`[${this.name}] Task completed: ${taskId}`, {
        agentId: this.id,
        taskId,
        duration: Date.now() - startTime
      });

      this.emitEvent('agent:task_completed', {
        agentId: this.id,
        taskId,
        duration: Date.now() - startTime,
        result
      });

      return result;

    } catch (error) {
      // Task failed
      this.metrics.tasksFailed++;
      this.metrics.errors.push({
        taskId,
        error: error.message,
        timestamp: new Date()
      });

      // Keep only last 100 errors
      if (this.metrics.errors.length > 100) {
        this.metrics.errors = this.metrics.errors.slice(-100);
      }

      this.setState('error');

      logger.error(`[${this.name}] Task failed: ${taskId}`, {
        agentId: this.id,
        taskId,
        error: error.message,
        stack: error.stack
      });

      this.emitEvent('agent:task_failed', {
        agentId: this.id,
        taskId,
        error: error.message
      });

      // Return to idle after error handling
      setTimeout(() => {
        if (this.state === 'error') {
          this.setState('idle');
        }
      }, 5000);

      throw error;
    }
  }

  /**
   * Perform the actual task
   * Override this in subclasses
   */
  async performTask(task) {
    throw new Error(`performTask not implemented in ${this.name}`);
  }

  /**
   * Validate task before execution
   * Override this in subclasses for custom validation
   */
  validateTask(task) {
    if (!task) {
      throw new Error('Task is required');
    }
    if (!task.type) {
      throw new Error('Task type is required');
    }
  }

  /**
   * Execute task with timeout
   */
  async executeWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Task timeout')), timeout)
      )
    ]);
  }

  /**
   * Execute task with retries
   */
  async executeWithRetries(fn, maxRetries = this.config.maxRetries) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt);
          logger.warn(`[${this.name}] Retry attempt ${attempt}/${maxRetries} after ${delay}ms`, {
            agentId: this.id,
            error: error.message
          });
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  calculateRetryDelay(attempt) {
    return Math.min(
      this.config.retryDelay * Math.pow(2, attempt - 1),
      30000 // Max 30 seconds
    );
  }

  /**
   * Set agent state
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;

    if (oldState !== newState) {
      logger.debug(`[${this.name}] State changed: ${oldState} → ${newState}`, {
        agentId: this.id
      });

      this.emitEvent('agent:state_changed', {
        agentId: this.id,
        oldState,
        newState
      });
    }
  }

  /**
   * Emit event on event bus
   */
  emitEvent(event, payload) {
    if (this.eventBus) {
      this.eventBus.emit(event, {
        ...payload,
        agentId: this.id,
        agentName: this.name,
        timestamp: new Date()
      });
    }
  }

  /**
   * Subscribe to events
   */
  subscribe(event, handler) {
    if (this.eventBus) {
      this.eventBus.subscribe(event, handler, this.id);
    }
  }

  /**
   * Get agent metrics
   */
  getMetrics() {
    const successRate = this.metrics.tasksExecuted > 0
      ? this.metrics.tasksSucceeded / this.metrics.tasksExecuted
      : 0;

    const avgExecutionTime = this.metrics.tasksSucceeded > 0
      ? this.metrics.totalExecutionTime / this.metrics.tasksSucceeded
      : 0;

    return {
      agentId: this.id,
      name: this.name,
      type: this.type,
      team: this.team,
      state: this.state,
      isActive: this.isActive,
      tasksExecuted: this.metrics.tasksExecuted,
      tasksSucceeded: this.metrics.tasksSucceeded,
      tasksFailed: this.metrics.tasksFailed,
      successRate: successRate.toFixed(3),
      avgExecutionTime: `${Math.round(avgExecutionTime)}ms`,
      lastActive: this.metrics.lastActive,
      recentErrors: this.metrics.errors.slice(-5),
      uptime: Date.now() - this.metrics.createdAt.getTime()
    };
  }

  /**
   * Get agent status
   */
  getStatus() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      team: this.team,
      state: this.state,
      isActive: this.isActive,
      lastActive: this.metrics.lastActive
    };
  }

  /**
   * Pause agent
   */
  pause() {
    this.isActive = false;
    this.setState('paused');
    logger.info(`[${this.name}] Agent paused`, { agentId: this.id });
  }

  /**
   * Resume agent
   */
  resume() {
    this.isActive = true;
    this.setState('idle');
    logger.info(`[${this.name}] Agent resumed`, { agentId: this.id });
  }

  /**
   * Shutdown agent
   */
  async shutdown() {
    logger.info(`[${this.name}] Shutting down...`, { agentId: this.id });
    this.isActive = false;
    this.setState('shutdown');
    this.emitEvent('agent:shutdown', { agentId: this.id });
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log helper
   */
  log(level, message, meta = {}) {
    logger[level](message, {
      agentId: this.id,
      agentName: this.name,
      ...meta
    });
  }
}

module.exports = Agent;
