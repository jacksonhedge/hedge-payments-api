const Agent = require('../base/Agent');
const logger = require('../../utils/logger');
const axios = require('axios');

/**
 * Zapier Agent
 *
 * General-purpose Zapier automation agent
 * Triggers Zaps, manages webhooks, and handles Zapier workflows
 */
class ZapierAgent extends Agent {
  constructor(config) {
    super({
      name: 'ZapierAgent',
      type: 'automation',
      team: 'AutomationManagement',
      ...config
    });

    this.webhooks = config.webhooks || {}; // Zapier webhook URLs
    this.db = config.db;

    // Store active Zap integrations
    this.zaps = new Map();

    logger.info('ZapierAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    const { data } = task;

    switch (task.type) {
      // Trigger Zaps
      case 'trigger_zap':
        return await this.triggerZap(data.zapName, data.payload);

      case 'trigger_webhook':
        return await this.triggerWebhook(data.webhookUrl, data.payload);

      // Network events → Zapier
      case 'send_network_metrics':
        return await this.sendNetworkMetrics(data.metrics);

      case 'send_transaction_event':
        return await this.sendTransactionEvent(data.transaction);

      case 'send_user_event':
        return await this.sendUserEvent(data.event, data.userData);

      // Zapier → System events
      case 'process_incoming_webhook':
        return await this.processIncomingWebhook(data.payload);

      // Zap management
      case 'register_zap':
        return await this.registerZap(data.name, data.webhookUrl, data.config);

      case 'unregister_zap':
        return await this.unregisterZap(data.name);

      case 'list_zaps':
        return await this.listZaps();

      // Batch operations
      case 'batch_trigger':
        return await this.batchTrigger(data.events);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Trigger a registered Zap by name
   */
  async triggerZap(zapName, payload) {
    this.log('info', 'Triggering Zap', { zapName });

    const zap = this.zaps.get(zapName);
    if (!zap) {
      throw new Error(`Zap not registered: ${zapName}`);
    }

    return await this.triggerWebhook(zap.webhookUrl, payload);
  }

  /**
   * Trigger a Zapier webhook
   */
  async triggerWebhook(webhookUrl, payload) {
    this.log('info', 'Triggering webhook', { url: webhookUrl });

    try {
      const response = await axios.post(webhookUrl, {
        ...payload,
        timestamp: new Date().toISOString(),
        source: 'HedgePayments',
        agent: this.name
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      this.emitEvent('zapier:webhook_triggered', {
        webhookUrl,
        status: response.status,
        success: true
      });

      return {
        success: true,
        status: response.status,
        data: response.data
      };

    } catch (error) {
      this.log('error', 'Webhook trigger failed', {
        url: webhookUrl,
        error: error.message
      });

      this.emitEvent('zapier:webhook_failed', {
        webhookUrl,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Send network metrics to Zapier
   */
  async sendNetworkMetrics(metrics) {
    this.log('info', 'Sending network metrics to Zapier');

    const payload = {
      event: 'network_metrics_updated',
      data: {
        networkPercentage: metrics.networkPercentage,
        totalVolume: metrics.totalVolume,
        profitMargin: metrics.profitMargin,
        activeUsers: metrics.activeUsers,
        activeMerchants: metrics.activeMerchants,
        internalVolume: metrics.internalVolume,
        externalVolume: metrics.externalVolume,
        date: metrics.date || new Date().toISOString()
      },
      metadata: {
        triggeredBy: 'NetworkAnalytics',
        timestamp: new Date().toISOString()
      }
    };

    // Trigger registered webhooks for network metrics
    const results = [];
    for (const [name, zap] of this.zaps) {
      if (zap.config?.events?.includes('network_metrics')) {
        const result = await this.triggerWebhook(zap.webhookUrl, payload);
        results.push({ zapName: name, result });
      }
    }

    return {
      triggered: results.length,
      results
    };
  }

  /**
   * Send transaction event to Zapier
   */
  async sendTransactionEvent(transaction) {
    this.log('info', 'Sending transaction event', {
      transactionId: transaction.id,
      type: transaction.type
    });

    const payload = {
      event: 'transaction_completed',
      data: {
        transactionId: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        fee: transaction.fee,
        cost: transaction.cost,
        profit: transaction.profit,
        status: transaction.status,
        fromWalletId: transaction.from_wallet_id,
        toWalletId: transaction.to_wallet_id,
        settledAt: transaction.settled_at,
        createdAt: transaction.created_at
      },
      metadata: {
        isInternalTransfer: transaction.type === 'internal_transfer',
        profitMargin: transaction.cost > 0 ? (transaction.profit / transaction.cost) * 100 : 100,
        timestamp: new Date().toISOString()
      }
    };

    // Trigger registered webhooks for transactions
    const results = [];
    for (const [name, zap] of this.zaps) {
      if (zap.config?.events?.includes('transaction')) {
        const result = await this.triggerWebhook(zap.webhookUrl, payload);
        results.push({ zapName: name, result });
      }
    }

    return {
      triggered: results.length,
      results
    };
  }

  /**
   * Send user event to Zapier
   */
  async sendUserEvent(eventType, userData) {
    this.log('info', 'Sending user event', { eventType });

    const payload = {
      event: eventType, // 'user_created', 'user_verified', 'wallet_created', etc.
      data: userData,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    // Trigger registered webhooks for user events
    const results = [];
    for (const [name, zap] of this.zaps) {
      if (zap.config?.events?.includes('user') || zap.config?.events?.includes(eventType)) {
        const result = await this.triggerWebhook(zap.webhookUrl, payload);
        results.push({ zapName: name, result });
      }
    }

    return {
      triggered: results.length,
      results
    };
  }

  /**
   * Process incoming webhook from Zapier
   */
  async processIncomingWebhook(payload) {
    this.log('info', 'Processing incoming webhook from Zapier', {
      event: payload.event
    });

    // Emit event for other agents to handle
    this.emitEvent('zapier:webhook_received', payload);

    // Handle based on event type
    switch (payload.event) {
      case 'create_user':
        return await this.handleCreateUser(payload.data);

      case 'update_feature_status':
        return await this.handleUpdateFeature(payload.data);

      case 'process_payment':
        return await this.handleProcessPayment(payload.data);

      default:
        this.log('warn', 'Unknown webhook event', { event: payload.event });
        return { received: true, processed: false };
    }
  }

  /**
   * Register a Zap webhook
   */
  async registerZap(name, webhookUrl, config = {}) {
    this.log('info', 'Registering Zap', { name, webhookUrl });

    this.zaps.set(name, {
      name,
      webhookUrl,
      config,
      registeredAt: new Date(),
      triggerCount: 0
    });

    this.emitEvent('zapier:zap_registered', {
      name,
      events: config.events || []
    });

    return {
      success: true,
      name,
      message: 'Zap registered successfully'
    };
  }

  /**
   * Unregister a Zap
   */
  async unregisterZap(name) {
    this.log('info', 'Unregistering Zap', { name });

    const existed = this.zaps.delete(name);

    this.emitEvent('zapier:zap_unregistered', { name });

    return {
      success: existed,
      message: existed ? 'Zap unregistered' : 'Zap not found'
    };
  }

  /**
   * List all registered Zaps
   */
  async listZaps() {
    const zaps = Array.from(this.zaps.values()).map(zap => ({
      name: zap.name,
      webhookUrl: zap.webhookUrl,
      events: zap.config.events || [],
      registeredAt: zap.registeredAt,
      triggerCount: zap.triggerCount
    }));

    return {
      count: zaps.length,
      zaps
    };
  }

  /**
   * Batch trigger multiple events
   */
  async batchTrigger(events) {
    this.log('info', 'Batch triggering events', { count: events.length });

    const results = [];
    const errors = [];

    for (const event of events) {
      try {
        let result;
        switch (event.type) {
          case 'transaction':
            result = await this.sendTransactionEvent(event.data);
            break;
          case 'network_metrics':
            result = await this.sendNetworkMetrics(event.data);
            break;
          case 'user_event':
            result = await this.sendUserEvent(event.eventName, event.data);
            break;
          default:
            result = await this.triggerZap(event.zapName, event.data);
        }
        results.push({ event, success: true, result });
      } catch (error) {
        errors.push({ event, error: error.message });
      }
    }

    return {
      successful: results.length,
      failed: errors.length,
      results,
      errors
    };
  }

  // ============================================
  // Event Handlers (from Zapier → System)
  // ============================================

  async handleCreateUser(data) {
    this.log('info', 'Handling create user from Zapier', { email: data.email });

    // Emit event for user creation
    this.emitEvent('zapier:user_create_requested', data);

    return {
      success: true,
      message: 'User creation event emitted'
    };
  }

  async handleUpdateFeature(data) {
    this.log('info', 'Handling update feature from Zapier', {
      featureId: data.featureId
    });

    // Emit event for roadmap update
    this.emitEvent('zapier:feature_update_requested', data);

    return {
      success: true,
      message: 'Feature update event emitted'
    };
  }

  async handleProcessPayment(data) {
    this.log('info', 'Handling process payment from Zapier', {
      amount: data.amount
    });

    // Emit event for payment processing
    this.emitEvent('zapier:payment_requested', data);

    return {
      success: true,
      message: 'Payment processing event emitted'
    };
  }

  // ============================================
  // Predefined Zap Templates
  // ============================================

  /**
   * Get predefined Zap templates
   */
  getZapTemplates() {
    return {
      daily_metrics: {
        name: 'Daily Network Metrics',
        description: 'Send daily network analytics to Slack/Email',
        trigger: 'network_metrics_updated',
        actions: ['Slack notification', 'Email report'],
        schedule: 'Daily at 9 AM'
      },

      transaction_alert: {
        name: 'High Value Transaction Alert',
        description: 'Alert when transaction > $1000',
        trigger: 'transaction_completed',
        filter: 'amount > 1000',
        actions: ['Slack notification', 'Log to Airtable']
      },

      new_merchant: {
        name: 'New Merchant Onboarding',
        description: 'Trigger when new merchant signs up',
        trigger: 'user_created',
        filter: 'type = merchant',
        actions: ['Send welcome email', 'Create CRM contact', 'Notify sales team']
      },

      feature_shipped: {
        name: 'Feature Shipped Notification',
        description: 'Notify team when feature is completed',
        trigger: 'feature_status_changed',
        filter: 'status = Done',
        actions: ['Slack announcement', 'Update changelog', 'Track in Mixpanel']
      },

      weekly_report: {
        name: 'Weekly Product Report',
        description: 'Generate and distribute weekly report',
        trigger: 'weekly_report_generated',
        actions: ['Email to stakeholders', 'Post to Notion', 'Archive in Google Drive']
      }
    };
  }

  /**
   * Get Zap metrics
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      zaps: {
        registered: this.zaps.size,
        totalTriggers: Array.from(this.zaps.values()).reduce(
          (sum, zap) => sum + zap.triggerCount,
          0
        ),
        list: Array.from(this.zaps.keys())
      }
    };
  }
}

module.exports = ZapierAgent;
