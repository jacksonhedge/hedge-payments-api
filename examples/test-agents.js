/**
 * Test Agents Example
 *
 * This file demonstrates how to use the agent system
 * Run with: node examples/test-agents.js
 */

const { getOrchestrator } = require('../src/agents');

async function main() {
  console.log('='.repeat(60));
  console.log('Agent System Test');
  console.log('='.repeat(60));
  console.log('');

  // Initialize orchestrator
  console.log('1. Initializing orchestrator...');
  const orchestrator = getOrchestrator({
    db: null, // TODO: Add actual database connection
    ledgerFeePercentage: 0.01 // 1%
  });

  await orchestrator.initialize();
  console.log('✅ Orchestrator initialized');
  console.log('');

  // Test 1: Network Detection
  console.log('2. Testing Network Detection...');
  const networkDetection = orchestrator.getAgent('network_detection');

  const testIdentifiers = [
    '@johndoe',
    'user@example.com',
    '+15550100',
    'merchant_abc123',
    'example.com'
  ];

  for (const identifier of testIdentifiers) {
    const result = await networkDetection.execute({
      type: 'identify_party',
      data: { identifier }
    });

    console.log(`   ${identifier}:`, result.inNetwork ? '✓ In Network' : '✗ External');
  }
  console.log('');

  // Test 2: Transfer Quote
  console.log('3. Testing Transfer Quotes...');
  const ledgerTransfer = orchestrator.getAgent('ledger_transfer');

  const amounts = [10, 50, 100, 500];
  for (const amount of amounts) {
    const quote = ledgerTransfer.getTransferQuote(amount);
    console.log(`   $${amount} transfer:`);
    console.log(`      Fee: $${quote.fee.toFixed(2)} (${quote.feePercentage * 100}%)`);
    console.log(`      Total: $${quote.totalCost.toFixed(2)}`);
    console.log(`      Profit: $${quote.network_profit.toFixed(2)} (100% margin!)`);
  }
  console.log('');

  // Test 3: Smart P2P
  console.log('4. Testing Smart P2P...');
  try {
    const p2pResult = await orchestrator.smartP2P(
      'user_123',
      '@janedoe',
      50
    );

    console.log(`   Method: ${p2pResult.method}`);
    console.log(`   Message: ${p2pResult.message}`);

    if (p2pResult.method === 'internal_ledger') {
      console.log(`   ✅ Internal transfer - Fast & Cheap!`);
      console.log(`   Fee: $${p2pResult.fee}`);
      console.log(`   Savings: $${p2pResult.savings}`);
    } else {
      console.log(`   ❌ External transfer - Options available`);
      p2pResult.options.forEach(opt => {
        console.log(`      - ${opt.name}: ${opt.time}, Fee: $${opt.fee}`);
      });
    }
  } catch (error) {
    console.log(`   ⚠️  P2P test skipped (requires full setup)`);
  }
  console.log('');

  // Test 4: User Behavior Analysis
  console.log('5. Testing User Behavior Analysis...');
  try {
    const bankrollWizard = orchestrator.getAgent('bankroll_wizard');
    const behavior = await bankrollWizard.execute({
      type: 'analyze_behavior',
      userId: 'user_123'
    });

    console.log(`   Weekly Spending: $${behavior.patterns.avgWeeklySpend.toFixed(2)}`);
    console.log(`   Suggested Balance: $${behavior.suggestedBalance.toFixed(2)}`);
    console.log(`   Network Ratio: ${(behavior.patterns.networkRatio * 100).toFixed(0)}%`);
  } catch (error) {
    console.log(`   ⚠️  Behavior analysis skipped (requires database)`);
  }
  console.log('');

  // Test 5: System Metrics
  console.log('6. System Metrics...');
  const metrics = orchestrator.getAllMetrics();

  console.log(`   Total Agents: ${metrics.orchestrator.totalAgents}`);
  console.log(`   Total Teams: ${metrics.orchestrator.teams}`);
  console.log(`   EventBus:`);
  console.log(`      Total Events: ${metrics.eventBus.totalEvents}`);
  console.log(`      Event Types: ${metrics.eventBus.eventTypes}`);
  console.log(`      Subscriptions: ${metrics.eventBus.totalSubscriptions}`);

  console.log('');
  console.log('   Agent Performance:');
  Object.entries(metrics.agents).forEach(([key, agentMetrics]) => {
    console.log(`      ${agentMetrics.name}:`);
    console.log(`         Tasks: ${agentMetrics.tasksExecuted}`);
    console.log(`         Success Rate: ${agentMetrics.successRate}`);
    console.log(`         Avg Time: ${agentMetrics.avgExecutionTime}`);

    // Show ledger-specific metrics
    if (agentMetrics.ledgerTransfers) {
      console.log(`         Volume: $${agentMetrics.ledgerTransfers.totalVolume}`);
      console.log(`         Profit: $${agentMetrics.ledgerTransfers.totalProfit}`);
      console.log(`         Margin: ${agentMetrics.ledgerTransfers.profitMargin}`);
    }
  });

  console.log('');

  // Test 6: Health Check
  console.log('7. Health Check...');
  const health = await orchestrator.healthCheck();

  console.log(`   System Health: ${health.healthy ? '✅ Healthy' : '❌ Unhealthy'}`);
  console.log(`   Active Agents: ${health.activeAgents}/${health.totalAgents}`);

  if (health.unhealthyAgents.length > 0) {
    console.log('   Unhealthy Agents:');
    health.unhealthyAgents.forEach(agent => {
      console.log(`      - ${agent.name}: ${agent.state}`);
    });
  }

  console.log('');

  // Shutdown
  console.log('8. Shutting down...');
  await orchestrator.shutdown();
  console.log('✅ Shutdown complete');

  console.log('');
  console.log('='.repeat(60));
  console.log('Test Complete!');
  console.log('='.repeat(60));
}

// Run tests
main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
