const Agent = require('../base/Agent');
const logger = require('../../utils/logger');
const { v4: uuidv4 } = require('uuid');

/**
 * Ledger Transfer Agent
 *
 * Handles internal network transfers (Bankroll ←→ Hedge Payments merchants)
 * Pure database operations - NO external API calls
 * Zero cost, 100% profit margin
 */
class LedgerTransferAgent extends Agent {
  constructor(config) {
    super({
      name: 'LedgerTransferAgent',
      type: 'ledger_transfer',
      team: 'NetworkOperations',
      ...config
    });

    this.db = config.db; // Database connection
    this.networkDetectionAgent = config.networkDetectionAgent;

    // Business configuration
    this.feePercentage = config.feePercentage || 0.01; // 1%
    this.minFee = config.minFee || 0.01; // $0.01
    this.maxAmount = config.maxAmount || 10000; // $10,000 per transfer

    // Metrics specific to ledger transfers
    this.transferMetrics = {
      totalVolume: 0,
      totalFees: 0,
      totalProfit: 0, // Same as fees since cost is $0
      totalTransfers: 0
    };

    logger.info('LedgerTransferAgent initialized', {
      feePercentage: this.feePercentage,
      maxAmount: this.maxAmount
    });
  }

  /**
   * Perform task - execute internal network transfer
   */
  async performTask(task) {
    const { from, to, amount, currency, memo } = task.data;

    switch (task.type) {
      case 'internal_transfer':
        return await this.executeInternalTransfer({
          from,
          to,
          amount,
          currency,
          memo
        });

      case 'validate_transfer':
        return await this.validateTransfer({ from, to, amount, currency });

      case 'get_transfer_quote':
        return this.getTransferQuote(amount);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Execute internal network transfer
   */
  async executeInternalTransfer({ from, to, amount, currency = 'USD', memo }) {
    this.log('info', 'Executing internal transfer', {
      from,
      to,
      amount,
      currency
    });

    // Step 1: Verify both parties are in network
    await this.verifyNetworkParties(from, to);

    // Step 2: Validate transfer
    await this.validateTransfer({ from, to, amount, currency });

    // Step 3: Calculate fee
    const fee = this.calculateFee(amount);

    // Step 4: Execute atomic database transfer
    const transaction = await this.atomicTransfer({
      fromWalletId: from,
      toWalletId: to,
      amount,
      currency,
      fee,
      memo
    });

    // Step 5: Update metrics
    this.updateMetrics({ amount, fee });

    // Step 6: Emit success event
    this.emitEvent('network:transfer_completed', {
      transactionId: transaction.id,
      fromWalletId: from,
      toWalletId: to,
      amount,
      fee,
      currency
    });

    this.log('info', 'Internal transfer completed', {
      transactionId: transaction.id,
      amount,
      fee,
      profit: fee // 100% margin!
    });

    return transaction;
  }

  /**
   * Verify both parties are in the network
   */
  async verifyNetworkParties(from, to) {
    if (!this.networkDetectionAgent) {
      throw new Error('NetworkDetectionAgent not configured');
    }

    const [sender, recipient] = await Promise.all([
      this.networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: from }
      }),
      this.networkDetectionAgent.execute({
        type: 'identify_party',
        data: { identifier: to }
      })
    ]);

    if (!sender.inNetwork) {
      throw new Error(`Sender not in network: ${from}`);
    }

    if (!recipient.inNetwork) {
      throw new Error(`Recipient not in network: ${to}`);
    }

    return { sender, recipient };
  }

  /**
   * Validate transfer before execution
   */
  async validateTransfer({ from, to, amount, currency }) {
    // Validate amount
    if (amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (amount > this.maxAmount) {
      throw new Error(`Amount exceeds maximum: ${this.maxAmount}`);
    }

    // Validate currency
    if (currency !== 'USD') {
      throw new Error('Only USD supported currently');
    }

    // Validate from !== to
    if (from === to) {
      throw new Error('Cannot transfer to self');
    }

    // Check sender balance
    const senderBalance = await this.getWalletBalance(from, currency);
    const fee = this.calculateFee(amount);
    const totalRequired = amount + fee;

    if (senderBalance < totalRequired) {
      throw new Error(
        `Insufficient balance. Required: ${totalRequired}, Available: ${senderBalance}`
      );
    }

    return {
      valid: true,
      fee,
      totalRequired,
      senderBalance
    };
  }

  /**
   * Execute atomic database transfer
   * This is where the magic happens - pure ledger operation!
   */
  async atomicTransfer({ fromWalletId, toWalletId, amount, currency, fee, memo }) {
    // TODO: Replace with actual database transaction
    // For now, this is a placeholder showing the structure

    /*
    return await this.db.transaction(async (trx) => {
      // 1. Debit sender (amount + fee)
      await trx('wallet_balances')
        .where({ wallet_id: fromWalletId, currency })
        .decrement('available_balance', amount + fee);

      // 2. Credit recipient (amount only)
      await trx('wallet_balances')
        .where({ wallet_id: toWalletId, currency })
        .increment('available_balance', amount);

      // 3. Record transaction
      const txn = await trx('transactions').insert({
        id: uuidv4(),
        from_wallet_id: fromWalletId,
        to_wallet_id: toWalletId,
        amount,
        currency,
        type: 'internal_transfer',
        status: 'completed',
        fee,
        cost: 0, // Zero cost for internal transfers!
        profit: fee, // 100% margin
        memo,
        settled_at: new Date(),
        created_at: new Date()
      }).returning('*');

      // 4. Record ledger entries (double-entry accounting)
      await trx('ledger_entries').insert([
        {
          transaction_id: txn[0].id,
          wallet_id: fromWalletId,
          type: 'debit',
          amount: amount + fee,
          currency,
          balance_after: await this.getBalanceAfter(trx, fromWalletId, currency)
        },
        {
          transaction_id: txn[0].id,
          wallet_id: toWalletId,
          type: 'credit',
          amount,
          currency,
          balance_after: await this.getBalanceAfter(trx, toWalletId, currency)
        }
      ]);

      return txn[0];
    });
    */

    // MOCK IMPLEMENTATION for now
    const transaction = {
      id: uuidv4(),
      from_wallet_id: fromWalletId,
      to_wallet_id: toWalletId,
      amount,
      currency,
      type: 'internal_transfer',
      status: 'completed',
      fee,
      cost: 0,
      profit: fee,
      memo,
      settled_at: new Date(),
      created_at: new Date()
    };

    this.log('debug', 'Mock transfer executed', { transaction });

    return transaction;
  }

  /**
   * Get wallet balance
   */
  async getWalletBalance(walletId, currency) {
    // TODO: Actual database query
    // return await this.db('wallet_balances')
    //   .where({ wallet_id: walletId, currency })
    //   .first()
    //   .then(row => row?.available_balance || 0);

    // MOCK: Return sufficient balance for testing
    return 10000;
  }

  /**
   * Calculate transfer fee
   */
  calculateFee(amount) {
    const fee = amount * this.feePercentage;
    return Math.max(fee, this.minFee);
  }

  /**
   * Get transfer quote
   */
  getTransferQuote(amount) {
    const fee = this.calculateFee(amount);

    return {
      amount,
      fee,
      feePercentage: this.feePercentage,
      totalCost: amount + fee,
      recipient_receives: amount,
      network_profit: fee, // 100% margin since cost is $0
      settlement_time: 'Instant (<1 second)',
      method: 'internal_ledger',
      cost_to_platform: 0
    };
  }

  /**
   * Update metrics
   */
  updateMetrics({ amount, fee }) {
    this.transferMetrics.totalVolume += amount;
    this.transferMetrics.totalFees += fee;
    this.transferMetrics.totalProfit += fee; // Same as fees!
    this.transferMetrics.totalTransfers += 1;
  }

  /**
   * Get ledger transfer metrics
   */
  getTransferMetrics() {
    const avgTransactionSize = this.transferMetrics.totalTransfers > 0
      ? this.transferMetrics.totalVolume / this.transferMetrics.totalTransfers
      : 0;

    const avgFee = this.transferMetrics.totalTransfers > 0
      ? this.transferMetrics.totalFees / this.transferMetrics.totalTransfers
      : 0;

    return {
      ...this.transferMetrics,
      avgTransactionSize: avgTransactionSize.toFixed(2),
      avgFee: avgFee.toFixed(2),
      profitMargin: '100%' // Always 100% for internal transfers!
    };
  }

  /**
   * Get combined metrics (agent + transfer specific)
   */
  getMetrics() {
    const baseMetrics = super.getMetrics();
    const transferMetrics = this.getTransferMetrics();

    return {
      ...baseMetrics,
      ledgerTransfers: transferMetrics
    };
  }

  /**
   * Reverse a transfer (refund)
   */
  async reverseTransfer(transactionId, reason) {
    this.log('info', 'Reversing transfer', { transactionId, reason });

    // TODO: Implement reversal logic
    // 1. Fetch original transaction
    // 2. Create reverse transaction
    // 3. Update balances
    // 4. Record reversal

    throw new Error('Transfer reversal not yet implemented');
  }
}

module.exports = LedgerTransferAgent;
