/**
 * CoverPay Orchestration Tests
 * Tests waterfall and split routing with all 6 BNPL providers
 */
const { createCoverPay } = require('../index');

async function runTests() {
  console.log('=============================================');
  console.log('COVERPAY ORCHESTRATION TESTS');
  console.log('Testing 6 Providers: Klarna, Affirm, Afterpay,');
  console.log('                     Sezzle, Zip, PayPal');
  console.log('=============================================\n');

  const customer = {
    email: 'test@example.com',
    phone: '+1234567890',
    name: 'Test User',
    firstName: 'Test',
    lastName: 'User'
  };

  const merchant = {
    returnUrl: 'http://localhost:3000/checkout/success',
    cancelUrl: 'http://localhost:3000/checkout/cancel',
    webhookUrl: 'http://localhost:3000/webhooks/bnpl',
    itemDescription: 'Test Purchase'
  };

  // Helper to create CoverPay with all 6 providers
  const createFullCoverPay = () => createCoverPay({
    klarna: { enabled: true, mockMode: true, approvalThreshold: 20000 },    // < $200
    affirm: { enabled: true, mockMode: true, approvalThreshold: 50000 },    // < $500
    afterpay: { enabled: true, mockMode: true, approvalThreshold: 100000 }, // < $1000
    sezzle: { enabled: true, mockMode: true, approvalThreshold: 250000 },   // < $2500
    zip: { enabled: true, mockMode: true, approvalThreshold: 150000 },      // < $1500
    paypal: { enabled: true, mockMode: true, approvalThreshold: 150000 }    // < $1500
  });

  // Test 1: First provider (Klarna) approves
  console.log('TEST 1: Waterfall - Klarna approves $100');
  console.log('-'.repeat(50));
  const result1 = await createFullCoverPay().processCheckout({
    amount: 10000,
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result1.provider}, Success: ${result1.success}`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: Klarna declines, Affirm approves
  console.log('TEST 2: Waterfall - Klarna declines, Affirm approves $300');
  console.log('-'.repeat(50));
  const result2 = await createFullCoverPay().processCheckout({
    amount: 30000,
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result2.provider}, Success: ${result2.success}, Attempts: ${result2.attempts?.length}`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Klarna & Affirm decline, Afterpay approves
  console.log('TEST 3: Waterfall - Klarna & Affirm decline, Afterpay approves $700');
  console.log('-'.repeat(50));
  const result3 = await createFullCoverPay().processCheckout({
    amount: 70000,
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result3.provider}, Success: ${result3.success}, Attempts: ${result3.attempts?.length}`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: First 3 decline, Sezzle approves
  console.log('TEST 4: Waterfall - First 3 decline, Sezzle approves $1200');
  console.log('-'.repeat(50));
  const result4 = await createFullCoverPay().processCheckout({
    amount: 120000,
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result4.provider}, Success: ${result4.success}, Attempts: ${result4.attempts?.length}`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: All 6 providers decline
  console.log('TEST 5: Waterfall - All 6 providers decline $3000');
  console.log('-'.repeat(50));
  const result5 = await createFullCoverPay().processCheckout({
    amount: 300000,
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Success: ${result5.success}, Attempts: ${result5.attempts?.length}`);
  console.log('Decline reasons:');
  result5.attempts?.forEach(a => console.log(`  - ${a.provider}: ${a.reason || 'approved'}`));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 6: Split payment with first 2 providers
  console.log('TEST 6: Split payment - $300 split into $150 + $150');
  console.log('-'.repeat(50));
  const result6 = await createFullCoverPay().processCheckout({
    amount: 30000,
    customer,
    merchant,
    strategy: 'split'
  });
  console.log(`Split: ${result6.split}, Sessions: ${result6.sessions?.length}`);
  result6.sessions?.forEach(s => console.log(`  - ${s.provider}: $${s.amount / 100}`));
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 7: Custom provider order
  console.log('TEST 7: Custom order - PayPal first');
  console.log('-'.repeat(50));
  const coverpay7 = createCoverPay({
    providerOrder: ['paypal', 'sezzle', 'zip', 'afterpay', 'affirm', 'klarna'],
    paypal: { enabled: true, mockMode: true, approvalThreshold: 150000 },
    sezzle: { enabled: true, mockMode: true, approvalThreshold: 250000 },
    zip: { enabled: true, mockMode: true, approvalThreshold: 150000 },
    afterpay: { enabled: true, mockMode: true, approvalThreshold: 100000 },
    affirm: { enabled: true, mockMode: true, approvalThreshold: 50000 },
    klarna: { enabled: true, mockMode: true, approvalThreshold: 20000 }
  });
  const result7 = await coverpay7.processCheckout({
    amount: 5000, // $50 - PayPal min is $30
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result7.provider}, Success: ${result7.success}`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 8: PayPal min amount check ($30 minimum)
  console.log('TEST 8: PayPal minimum amount check ($25 - below $30 min)');
  console.log('-'.repeat(50));
  const coverpay8 = createCoverPay({
    providerOrder: ['paypal', 'klarna'],
    paypal: { enabled: true, mockMode: true, approvalThreshold: 150000 },
    klarna: { enabled: true, mockMode: true, approvalThreshold: 20000 }
  });
  const result8 = await coverpay8.processCheckout({
    amount: 2500, // $25 - below PayPal $30 min
    customer,
    merchant,
    strategy: 'waterfall'
  });
  console.log(`Provider: ${result8.provider}, Success: ${result8.success}`);
  console.log(`(PayPal declined due to min amount, Klarna approved)`);
  console.log('\n' + '='.repeat(50) + '\n');

  // Summary
  console.log('=============================================');
  console.log('TEST SUMMARY');
  console.log('=============================================');
  console.log(`Test 1 (Klarna approves):       ${result1.success && result1.provider === 'klarna' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 2 (Affirm fallback):       ${result2.success && result2.provider === 'affirm' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 3 (Afterpay fallback):     ${result3.success && result3.provider === 'afterpay' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 4 (Sezzle fallback):       ${result4.success && result4.provider === 'sezzle' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 5 (All 6 decline):         ${!result5.success && result5.attempts?.length === 6 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 6 (Split payment):         ${result6.success && result6.split ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 7 (Custom order):          ${result7.success && result7.provider === 'paypal' ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Test 8 (Min amount fallback):   ${result8.success && result8.provider === 'klarna' ? '✅ PASS' : '❌ FAIL'}`);
  console.log('=============================================\n');

  // Provider credentials info
  console.log('PROVIDER SETUP INFO:');
  console.log('---------------------------------------------');
  console.log('Set these environment variables to use real APIs:\n');
  console.log('1. KLARNA:');
  console.log('   KLARNA_API_KEY, KLARNA_API_SECRET');
  console.log('   Portal: https://portal.klarna.com/\n');
  console.log('2. AFFIRM:');
  console.log('   AFFIRM_PUBLIC_KEY, AFFIRM_PRIVATE_KEY');
  console.log('   Portal: https://sandbox.affirm.com/dashboard/\n');
  console.log('3. AFTERPAY:');
  console.log('   AFTERPAY_MERCHANT_ID, AFTERPAY_SECRET_KEY');
  console.log('   Portal: https://portal.sandbox.afterpay.com/\n');
  console.log('4. SEZZLE:');
  console.log('   SEZZLE_PUBLIC_KEY, SEZZLE_PRIVATE_KEY');
  console.log('   Portal: https://dashboard.sezzle.com/\n');
  console.log('5. ZIP:');
  console.log('   ZIP_API_KEY, ZIP_API_SECRET, ZIP_MERCHANT_ID');
  console.log('   Portal: https://merchant.us.zip.co/\n');
  console.log('6. PAYPAL:');
  console.log('   PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET');
  console.log('   Portal: https://developer.paypal.com/dashboard/\n');
}

// Run tests
runTests().catch(console.error);
