/**
 * CoverPay Orchestration Tests
 * Demonstrates waterfall and split routing strategies
 */
const { createCoverPay, KlarnaProvider, AffirmProvider } = require('../index');

async function runTests() {
  console.log('=================================');
  console.log('COVERPAY ORCHESTRATION TESTS');
  console.log('=================================\n');

  // Test 1: Waterfall - First provider approves
  console.log('TEST 1: Waterfall - First provider approves ($100)');
  console.log('-'.repeat(50));
  const coverpay1 = createCoverPay({
    klarna: { enabled: true, approvalThreshold: 20000 }, // Approves under $200
    affirm: { enabled: true, approvalThreshold: 50000 }
  });

  const result1 = await coverpay1.processCheckout({
    amount: 10000, // $100
    customer: { email: 'test@example.com', phone: '+1234567890', name: 'Test User' },
    merchant: { returnUrl: 'http://localhost:3000', webhookUrl: 'http://localhost:3000/webhooks' },
    strategy: 'waterfall'
  });

  console.log('Result:', JSON.stringify(result1, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Waterfall - First declines, second approves
  console.log('TEST 2: Waterfall - First declines, second approves ($300)');
  console.log('-'.repeat(50));
  const coverpay2 = createCoverPay({
    klarna: { enabled: true, approvalThreshold: 20000 }, // Declines over $200
    affirm: { enabled: true, approvalThreshold: 50000 }  // Approves under $500
  });

  const result2 = await coverpay2.processCheckout({
    amount: 30000, // $300
    customer: { email: 'test@example.com', phone: '+1234567890', name: 'Test User' },
    merchant: { returnUrl: 'http://localhost:3000', webhookUrl: 'http://localhost:3000/webhooks' },
    strategy: 'waterfall'
  });

  console.log('Result:', JSON.stringify(result2, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Waterfall - All decline
  console.log('TEST 3: Waterfall - All providers decline ($600)');
  console.log('-'.repeat(50));
  const coverpay3 = createCoverPay({
    klarna: { enabled: true, approvalThreshold: 20000 },
    affirm: { enabled: true, approvalThreshold: 50000 }
  });

  const result3 = await coverpay3.processCheckout({
    amount: 60000, // $600
    customer: { email: 'test@example.com', phone: '+1234567890', name: 'Test User' },
    merchant: { returnUrl: 'http://localhost:3000', webhookUrl: 'http://localhost:3000/webhooks' },
    strategy: 'waterfall'
  });

  console.log('Result:', JSON.stringify(result3, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Split payment
  console.log('TEST 4: Split payment - $300 split into $150 + $150');
  console.log('-'.repeat(50));
  const coverpay4 = createCoverPay({
    klarna: { enabled: true, approvalThreshold: 20000 }, // Approves $150
    affirm: { enabled: true, approvalThreshold: 50000 }  // Approves $150
  });

  const result4 = await coverpay4.processCheckout({
    amount: 30000, // $300
    customer: { email: 'test@example.com', phone: '+1234567890', name: 'Test User' },
    merchant: { returnUrl: 'http://localhost:3000', webhookUrl: 'http://localhost:3000/webhooks' },
    strategy: 'split'
  });

  console.log('Result:', JSON.stringify(result4, null, 2));
  console.log('\n' + '='.repeat(50) + '\n');

  // Summary
  console.log('=================================');
  console.log('TEST SUMMARY');
  console.log('=================================');
  console.log(`Test 1 (First approves):     ${result1.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Fallback approves):  ${result2.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (All decline):        ${!result3.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Split payment):      ${result4.success && result4.split ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=================================\n');
}

// Run tests
runTests().catch(console.error);
