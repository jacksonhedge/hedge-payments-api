const Agent = require('../base/Agent');
const logger = require('../../utils/logger');

/**
 * Bankroll Wizard Agent
 *
 * AI-powered assistant for Bankroll users
 * Provides intelligent recommendations, merchant discovery, savings calculations
 */
class BankrollWizardAgent extends Agent {
  constructor(config) {
    super({
      name: 'BankrollWizardAgent',
      type: 'consumer_assistant',
      team: 'ConsumerExperience',
      ...config
    });

    this.networkDetectionAgent = config.networkDetectionAgent;
    this.ledgerTransferAgent = config.ledgerTransferAgent;
    this.db = config.db;

    logger.info('BankrollWizardAgent initialized');
  }

  /**
   * Perform task
   */
  async performTask(task) {
    const { userId, data } = task;

    switch (task.type) {
      case 'analyze_behavior':
        return await this.analyzeUserBehavior(userId);

      case 'calculate_savings':
        return await this.calculateNetworkSavings(userId);

      case 'smart_p2p':
        return await this.smartP2P(data.from, data.to, data.amount, data.context);

      case 'discover_merchants':
        return await this.discoverNetworkMerchants(data.location, data.interests);

      case 'optimize_balance':
        return await this.optimizeBalance(userId);

      case 'suggest_recruitment':
        return await this.suggestNetworkRecruitment(userId, data.merchantId);

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Analyze user spending behavior
   */
  async analyzeUserBehavior(userId) {
    this.log('info', 'Analyzing user behavior', { userId });

    // TODO: Fetch real transaction data
    const transactions = await this.getUserTransactions(userId);

    const patterns = {
      totalSpend: this.calculateTotalSpend(transactions),
      avgWeeklySpend: this.calculateWeeklyAverage(transactions),
      topMerchants: this.getTopMerchants(transactions),
      peakSpendingDays: this.getPeakDays(transactions),
      networkRatio: this.calculateNetworkRatio(transactions),
      preferredPaymentMethods: this.getPreferredMethods(transactions)
    };

    // Calculate suggested balance (keep 1.2x weekly spending)
    const suggestedBalance = patterns.avgWeeklySpend * 1.2;

    return {
      userId,
      patterns,
      suggestedBalance,
      recommendations: this.generateRecommendations(patterns)
    };
  }

  /**
   * Calculate network savings
   */
  async calculateNetworkSavings(userId) {
    this.log('info', 'Calculating network savings', { userId });

    const transactions = await this.getUserTransactions(userId);

    // Separate internal vs external
    const internalTxns = transactions.filter(t => t.type === 'internal_transfer');
    const externalTxns = transactions.filter(t => t.type === 'external_payment');

    // Calculate volume
    const internalVolume = internalTxns.reduce((sum, t) => sum + t.amount, 0);
    const externalVolume = externalTxns.reduce((sum, t) => sum + t.amount, 0);
    const totalVolume = internalVolume + externalVolume;

    // Calculate actual costs
    const internalFees = internalTxns.reduce((sum, t) => sum + t.fee, 0);
    const externalFees = externalTxns.reduce((sum, t) => sum + t.fee, 0);
    const totalFees = internalFees + externalFees;

    // Calculate what it would have cost if all external
    const wouldHaveCost = totalVolume * 0.029; // 2.9% card fee

    // Calculate savings
    const totalSavings = wouldHaveCost - totalFees;

    return {
      userId,
      totalVolume,
      internalVolume,
      externalVolume,
      networkPercentage: (internalVolume / totalVolume * 100).toFixed(1),
      actualFees: totalFees.toFixed(2),
      wouldHaveCost: wouldHaveCost.toFixed(2),
      youSaved: totalSavings.toFixed(2),
      savingsPercentage: ((totalSavings / wouldHaveCost) * 100).toFixed(1),
      message: this.generateSavingsMessage(totalSavings, internalVolume / totalVolume)
    };
  }

  /**
   * Smart P2P transfer with automatic routing
   */
  async smartP2P(from, to, amount, context = {}) {
    this.log('info', 'Smart P2P routing', { from, to, amount });

    // Detect if recipient is in network
    const recipient = await this.networkDetectionAgent.execute({
      type: 'identify_party',
      data: { identifier: to }
    });

    if (recipient.inNetwork) {
      // ✅ INTERNAL TRANSFER - Cheap and instant!
      const quote = this.ledgerTransferAgent.getTransferQuote(amount);

      return {
        method: 'internal_ledger',
        recipient: recipient.displayName,
        estimatedTime: 'Instant',
        fee: quote.fee.toFixed(2),
        feePercentage: '1%',
        total: (amount + quote.fee).toFixed(2),
        message: `💚 ${recipient.displayName} uses Bankroll! Instant transfer with 1% fee.`,
        savings: (amount * 0.029 - quote.fee).toFixed(2),
        savingsMessage: `You save $${(amount * 0.029 - quote.fee).toFixed(2)} vs. external payment!`
      };
    } else {
      // ❌ EXTERNAL TRANSFER - Offer options
      return {
        method: 'external',
        recipient: to,
        message: `${to} isn't on Bankroll yet. Here are your options:`,
        options: [
          {
            method: 'usdc_solana',
            name: 'Crypto (USDC)',
            time: '~30 seconds',
            fee: (amount * 0.001).toFixed(2),
            feePercentage: '0.1%',
            total: (amount * 1.001).toFixed(2),
            recommended: amount > 100
          },
          {
            method: 'ach',
            name: 'Bank Transfer (ACH)',
            time: '1-3 business days',
            fee: '0.00',
            feePercentage: '0%',
            total: amount.toFixed(2),
            recommended: false
          },
          {
            method: 'card',
            name: 'Instant (Card)',
            time: 'Instant',
            fee: (amount * 0.015).toFixed(2),
            feePercentage: '1.5%',
            total: (amount * 1.015).toFixed(2),
            recommended: amount < 100
          }
        ],
        inviteMessage: `💡 Invite ${to} to Bankroll and you'll both save money on future payments!`,
        referralBonus: 10
      };
    }
  }

  /**
   * Discover network merchants
   */
  async discoverNetworkMerchants(userLocation, userInterests = []) {
    this.log('info', 'Discovering network merchants', { userLocation, userInterests });

    // TODO: Actual database query
    const merchants = await this.queryNetworkMerchants(userLocation, userInterests);

    return {
      location: userLocation,
      merchants: merchants.map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        logo: m.logo,
        acceptsBankroll: true,
        savings: '2.5% vs. card',
        distance: m.distance,
        popularityScore: m.bankrollUsersCount
      })),
      totalFound: merchants.length,
      message: `Found ${merchants.length} businesses near you that accept Bankroll!`,
      totalSavingsAvailable: '2.5% on all purchases'
    };
  }

  /**
   * Optimize user balance
   */
  async optimizeBalance(userId) {
    this.log('info', 'Optimizing balance', { userId });

    const behavior = await this.analyzeUserBehavior(userId);
    const currentBalance = await this.getUserBalance(userId);

    const weeklySpend = behavior.patterns.avgWeeklySpend;
    const optimalBalance = weeklySpend * 1.5; // 1.5 weeks of spending
    const needsTopUp = currentBalance < optimalBalance;

    return {
      userId,
      currentBalance: currentBalance.toFixed(2),
      optimalBalance: optimalBalance.toFixed(2),
      weeklySpend: weeklySpend.toFixed(2),
      needsTopUp,
      topUpAmount: needsTopUp ? (optimalBalance - currentBalance).toFixed(2) : 0,
      reasoning: `Keep enough for 1.5 weeks of spending. ${(behavior.patterns.networkRatio * 100).toFixed(0)}% of your spending is in-network, saving you money!`,
      autoReloadSuggestion: {
        enabled: false,
        minimumBalance: (weeklySpend * 0.5).toFixed(2),
        reloadAmount: weeklySpend.toFixed(2),
        method: 'ach', // Free ACH from linked bank
        frequency: 'when_low'
      }
    };
  }

  /**
   * Suggest network recruitment
   */
  async suggestNetworkRecruitment(userId, merchantId) {
    this.log('info', 'Suggesting network recruitment', { userId, merchantId });

    // Check user's spending with this merchant
    const spending = await this.getUserMerchantSpending(userId, merchantId);

    if (spending.totalSpend < 100) {
      return {
        shouldSuggest: false,
        reason: 'Insufficient spending volume'
      };
    }

    // Calculate potential savings
    const potentialSavings = spending.totalSpend * 0.025; // 2.5% savings
    const referralBonus = 50;

    return {
      shouldSuggest: true,
      merchant: spending.merchantName,
      yourSpending: spending.totalSpend.toFixed(2),
      potentialSavings: potentialSavings.toFixed(2),
      referralBonus,
      totalBenefit: (potentialSavings + referralBonus).toFixed(2),
      message: `You spend $${spending.totalSpend.toFixed(2)}/month at ${spending.merchantName}. If they joined Hedge Payments, you'd save $${potentialSavings.toFixed(2)} + earn a $${referralBonus} referral bonus!`,
      action: 'send_referral_link'
    };
  }

  // ============================================
  // Helper Methods
  // ============================================

  async getUserTransactions(userId) {
    // TODO: Actual database query
    // return await this.db('transactions')
    //   .where({ user_id: userId })
    //   .orderBy('created_at', 'desc')
    //   .limit(100);

    // Mock data for now
    return [];
  }

  async getUserBalance(userId) {
    // TODO: Actual database query
    return 500; // Mock
  }

  async getUserMerchantSpending(userId, merchantId) {
    // TODO: Actual database query
    return {
      merchantId,
      merchantName: 'Example Merchant',
      totalSpend: 500,
      transactionCount: 10
    };
  }

  async queryNetworkMerchants(location, interests) {
    // TODO: Actual database query
    return [];
  }

  calculateTotalSpend(transactions) {
    return transactions.reduce((sum, t) => sum + t.amount, 0);
  }

  calculateWeeklyAverage(transactions) {
    if (transactions.length === 0) return 0;

    const totalSpend = this.calculateTotalSpend(transactions);
    const weeks = this.getWeeksSpan(transactions);
    return weeks > 0 ? totalSpend / weeks : totalSpend;
  }

  getWeeksSpan(transactions) {
    if (transactions.length === 0) return 1;

    const oldest = new Date(transactions[transactions.length - 1].created_at);
    const newest = new Date(transactions[0].created_at);
    const days = (newest - oldest) / (1000 * 60 * 60 * 24);
    return Math.max(days / 7, 1);
  }

  getTopMerchants(transactions) {
    const merchantSpending = {};

    transactions.forEach(t => {
      const merchant = t.merchant_name || 'Unknown';
      merchantSpending[merchant] = (merchantSpending[merchant] || 0) + t.amount;
    });

    return Object.entries(merchantSpending)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));
  }

  getPeakDays(transactions) {
    // TODO: Analyze day of week patterns
    return ['Saturday', 'Sunday'];
  }

  calculateNetworkRatio(transactions) {
    const internal = transactions.filter(t => t.type === 'internal_transfer').length;
    const total = transactions.length;
    return total > 0 ? internal / total : 0;
  }

  getPreferredMethods(transactions) {
    // TODO: Analyze payment method preferences
    return ['internal_transfer', 'card'];
  }

  generateRecommendations(patterns) {
    const recommendations = [];

    if (patterns.networkRatio < 0.5) {
      recommendations.push({
        type: 'increase_network_usage',
        message: 'Use Bankroll more with network merchants to save on fees',
        potentialSavings: (patterns.totalSpend * 0.025).toFixed(2)
      });
    }

    if (patterns.avgWeeklySpend > 500) {
      recommendations.push({
        type: 'vip_tier',
        message: 'You qualify for VIP tier with cashback rewards!',
        benefit: '1.5% cashback on all transactions'
      });
    }

    return recommendations;
  }

  generateSavingsMessage(savings, networkRatio) {
    if (savings < 1) {
      return `Start using Bankroll with network merchants to save money!`;
    }

    if (networkRatio > 0.7) {
      return `🎉 Amazing! You've saved $${savings.toFixed(2)} by using the Bankroll network!`;
    }

    return `You've saved $${savings.toFixed(2)}! Use Bankroll more to save even more.`;
  }
}

module.exports = BankrollWizardAgent;
