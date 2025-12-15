const logger = require('../utils/logger');
const { getInstance: getEventBus } = require('./base/EventBus');

// Agents
const NetworkDetectionAgent = require('./network/NetworkDetectionAgent');
const LedgerTransferAgent = require('./network/LedgerTransferAgent');
const BankrollWizardAgent = require('./consumer/BankrollWizardAgent');

/**
 * CoinFlow Orchestrator
 *
 * The master agent that coordinates all sub-agents
 * Handles routing decisions, agent management, and system-wide coordination
 */
class CoinFlowOrchestrator {
  constructor(config = {}) {
    this.config = config;
    this.eventBus = getEventBus();
    this.agents = new Map();
    this.teams = new Map();
    this.isInitialized = false;

    logger.info('CoinFlowOrchestrator created');
  }

  /**
   * Initialize the orchestrator and all agents
   */
  async initialize() {
    if (this.isInitialized) {
      logger.warn('Orchestrator already initialized');
      return;
    }

    logger.info('Initializing CoinFlowOrchestrator...');

    try {
      // Initialize core agents
      await this.initializeNetworkOperationsTeam();
      await this.initializeConsumerExperienceTeam();

      // TODO: Initialize other teams as they're built
      // await this.initializePaymentProcessingTeam();
      // await this.initializeMerchantExperienceTeam();
      // await this.initializeComplianceTeam();

      // Subscribe to important events
      this.subscribeToEvents();

      this.isInitialized = true;
      logger.info('CoinFlowOrchestrator initialized successfully', {
        totalAgents: this.agents.size,
        teams: Array.from(this.teams.keys())
      });

      this.eventBus.emit('orchestrator:initialized', {
        totalAgents: this.agents.size
      });

    } catch (error) {
      logger.error('Failed to initialize orchestrator', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize Network Operations Team
   */
  async initializeNetworkOperationsTeam() {
    logger.info('Initializing Network Operations Team...');

    // Create agents
    const networkDetectionAgent = new NetworkDetectionAgent({
      eventBus: this.eventBus,
      orchestrator: this,
      db: this.config.db
    });

    const ledgerTransferAgent = new LedgerTransferAgent({
      eventBus: this.eventBus,
      orchestrator: this,
      db: this.config.db,
      networkDetectionAgent,
      feePercentage: this.config.ledgerFeePercentage || 0.01
    });

    // Register agents
    this.registerAgent('network_detection', networkDetectionAgent);
    this.registerAgent('ledger_transfer', ledgerTransferAgent);

    // Create team
    this.registerTeam('NetworkOperations', {
      manager: 'network_detection',
      agents: ['network_detection', 'ledger_transfer']
    });

    logger.info('Network Operations Team initialized');
  }

  /**
   * Initialize Consumer Experience Team
   */
  async initializeConsumerExperienceTeam() {
    logger.info('Initializing Consumer Experience Team...');

    const networkDetectionAgent = this.getAgent('network_detection');
    const ledgerTransferAgent = this.getAgent('ledger_transfer');

    const bankrollWizardAgent = new BankrollWizardAgent({
      eventBus: this.eventBus,
      orchestrator: this,
      db: this.config.db,
      networkDetectionAgent,
      ledgerTransferAgent
    });

    this.registerAgent('bankroll_wizard', bankrollWizardAgent);

    this.registerTeam('ConsumerExperience', {
      manager: 'bankroll_wizard',
      agents: ['bankroll_wizard']
    });

    logger.info('Consumer Experience Team initialized');
  }

  /**
   * Register an agent
   */
  registerAgent(key, agent) {
    if (this.agents.has(key)) {
      logger.warn(`Agent ${key} already registered, overwriting`);
    }

    this.agents.set(key, agent);
    logger.debug(`Agent registered: ${key} (${agent.name})`);
  }

  /**
   * Register a team
   */
  registerTeam(name, config) {
    this.teams.set(name, config);
    logger.debug(`Team registered: ${name}`, config);
  }

  /**
   * Get an agent by key
   */
  getAgent(key) {
    const agent = this.agents.get(key);
    if (!agent) {
      throw new Error(`Agent not found: ${key}`);
    }
    return agent;
  }

  /**
   * Subscribe to important events
   */
  subscribeToEvents() {
    // Monitor network transfers
    this.eventBus.subscribe('network:transfer_completed', (payload) => {
      logger.info('Network transfer completed', {
        transactionId: payload.transactionId,
        amount: payload.amount,
        profit: payload.fee
      });
    });

    // Monitor agent errors
    this.eventBus.subscribe('agent:task_failed', (payload) => {
      logger.error('Agent task failed', {
        agentId: payload.agentId,
        agentName: payload.agentName,
        error: payload.error
      });
    });
  }

  /**
   * Route a payment through the appropriate agent(s)
   */
  async routePayment(paymentRequest) {
    logger.info('Routing payment', {
      from: paymentRequest.from,
      to: paymentRequest.to,
      amount: paymentRequest.amount
    });

    // Step 1: Detect network membership
    const networkDetectionAgent = this.getAgent('network_detection');

    const [sender, recipient] = await Promise.all([
      networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: paymentRequest.from }
      }),
      networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: paymentRequest.to }
      })
    ]);

    // Step 2: Make routing decision
    if (sender.inNetwork && recipient.inNetwork) {
      // ✅ INTERNAL TRANSFER - Use ledger
      logger.info('Routing to internal ledger transfer', {
        from: sender.id,
        to: recipient.id,
        savings: '100% margin!'
      });

      const ledgerTransferAgent = this.getAgent('ledger_transfer');

      return await ledgerTransferAgent.execute({
        type: 'internal_transfer',
        data: {
          from: sender.walletId,
          to: recipient.walletId,
          amount: paymentRequest.amount,
          currency: paymentRequest.currency || 'USD',
          memo: paymentRequest.memo
        }
      });

    } else {
      // ❌ EXTERNAL TRANSFER - Use CoinFlow
      logger.info('Routing to external payment', {
        senderInNetwork: sender.inNetwork,
        recipientInNetwork: recipient.inNetwork
      });

      // TODO: Implement external payment agent
      throw new Error('External payment agent not yet implemented');
    }
  }

  /**
   * Smart P2P transfer (user-friendly wrapper)
   */
  async smartP2P(from, to, amount, context = {}) {
    const bankrollWizard = this.getAgent('bankroll_wizard');

    return await bankrollWizard.execute({
      type: 'smart_p2p',
      data: { from, to, amount, context }
    });
  }

  /**
   * Calculate network savings for a user
   */
  async calculateSavings(userId) {
    const bankrollWizard = this.getAgent('bankroll_wizard');

    return await bankrollWizard.execute({
      type: 'calculate_savings',
      userId
    });
  }

  /**
   * Get transfer quote
   */
  async getTransferQuote(from, to, amount) {
    // Detect if internal or external
    const networkDetectionAgent = this.getAgent('network_detection');

    const [sender, recipient] = await Promise.all([
      networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: from }
      }),
      networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: to }
      })
    ]);

    if (sender.inNetwork && recipient.inNetwork) {
      // Internal transfer quote
      const ledgerTransferAgent = this.getAgent('ledger_transfer');
      return ledgerTransferAgent.getTransferQuote(amount);
    } else {
      // External transfer quote
      // TODO: Implement when external payment agent is ready
      return {
        method: 'external',
        amount,
        fee: amount * 0.029 + 0.30,
        feePercentage: '2.9% + $0.30',
        total: amount + (amount * 0.029 + 0.30),
        estimatedTime: '3 minutes'
      };
    }
  }

  /**
   * Get all agent metrics
   */
  getAllMetrics() {
    const metrics = {};

    this.agents.forEach((agent, key) => {
      metrics[key] = agent.getMetrics();
    });

    return {
      orchestrator: {
        totalAgents: this.agents.size,
        teams: this.teams.size,
        isInitialized: this.isInitialized
      },
      eventBus: this.eventBus.getStats(),
      agents: metrics
    };
  }

  /**
   * Get agent statuses
   */
  getAgentStatuses() {
    const statuses = {};

    this.agents.forEach((agent, key) => {
      statuses[key] = agent.getStatus();
    });

    return statuses;
  }

  /**
   * Health check
   */
  async healthCheck() {
    const statuses = this.getAgentStatuses();
    const unhealthyAgents = Object.entries(statuses).filter(
      ([key, status]) => !status.isActive || status.state === 'error'
    );

    return {
      healthy: unhealthyAgents.length === 0,
      totalAgents: this.agents.size,
      activeAgents: Object.values(statuses).filter(s => s.isActive).length,
      unhealthyAgents: unhealthyAgents.map(([key, status]) => ({
        key,
        name: status.name,
        state: status.state
      }))
    };
  }

  /**
   * Shutdown orchestrator and all agents
   */
  async shutdown() {
    logger.info('Shutting down CoinFlowOrchestrator...');

    // Shutdown all agents
    const shutdownPromises = [];
    this.agents.forEach(agent => {
      shutdownPromises.push(agent.shutdown());
    });

    await Promise.allSettled(shutdownPromises);

    // Shutdown event bus
    this.eventBus.shutdown();

    this.isInitialized = false;
    logger.info('CoinFlowOrchestrator shut down');
  }
}

// Singleton instance
let instance = null;

module.exports = {
  CoinFlowOrchestrator,
  getInstance: (config) => {
    if (!instance) {
      instance = new CoinFlowOrchestrator(config);
    }
    return instance;
  }
};
