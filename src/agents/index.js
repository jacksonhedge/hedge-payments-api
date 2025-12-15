/**
 * Agents Index
 * Central export point for all agents and orchestrator
 */

// Orchestrator
const { CoinFlowOrchestrator, getInstance: getOrchestrator } = require('./CoinFlowOrchestrator');

// Base Classes
const Agent = require('./base/Agent');
const { EventBus, getInstance: getEventBus } = require('./base/EventBus');

// Network Operations Team
const NetworkDetectionAgent = require('./network/NetworkDetectionAgent');
const LedgerTransferAgent = require('./network/LedgerTransferAgent');

// Consumer Experience Team
const BankrollWizardAgent = require('./consumer/BankrollWizardAgent');

// Product Management Team
const ProductRoadmapAgent = require('./product/ProductRoadmapAgent');

// Automation Team
const NotionAgent = require('./automation/NotionAgent');
const ZapierAgent = require('./automation/ZapierAgent');

// Sales Team
const SalesAgent = require('./sales/SalesAgent');
const UserAdoptionAgent = require('./sales/UserAdoptionAgent');

module.exports = {
  // Orchestrator
  CoinFlowOrchestrator,
  getOrchestrator,

  // Base
  Agent,
  EventBus,
  getEventBus,

  // Network Operations
  NetworkDetectionAgent,
  LedgerTransferAgent,

  // Consumer Experience
  BankrollWizardAgent,

  // Product Management
  ProductRoadmapAgent,

  // Automation
  NotionAgent,
  ZapierAgent,

  // Sales
  SalesAgent,
  UserAdoptionAgent
};
