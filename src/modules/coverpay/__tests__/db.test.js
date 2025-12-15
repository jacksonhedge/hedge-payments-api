/**
 * CoverPay Database Integration Test
 * Tests Supabase connection and transaction logging
 */
const { checkConnection, transactionRepository } = require('../db');
const { createCoverPay } = require('../index');

async function runDbTests() {
  console.log('=============================================');
  console.log('COVERPAY DATABASE INTEGRATION TESTS');
  console.log('Testing Supabase connection and logging');
  console.log('=============================================\n');

  // Test 1: Check database connection
  console.log('TEST 1: Database Connection');
  console.log('-'.repeat(50));
  const connection = await checkConnection();
  console.log(`Connected: ${connection.connected}`);
  console.log(`Has Service Key: ${connection.hasServiceKey || false}`);
  if (connection.error) {
    console.log(`Error: ${connection.error}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  if (!connection.connected) {
    console.log('❌ Database not connected. Skipping remaining tests.');
    console.log('Make sure SUPABASE_SERVICE_KEY is set in environment.');
    return;
  }

  // Test 2: Create a transaction
  console.log('TEST 2: Create Transaction');
  console.log('-'.repeat(50));
  let transaction;
  try {
    transaction = await transactionRepository.createTransaction({
      merchantId: 'test_merchant',
      merchantOrderId: `test_order_${Date.now()}`,
      customerEmail: 'test@example.com',
      customerPhone: '+1234567890',
      customerName: 'Test User',
      amount: 10000,
      currency: 'USD',
      strategy: 'waterfall',
      metadata: { test: true }
    });
    console.log(`✅ Transaction created: ${transaction.id}`);
    console.log(`   Status: ${transaction.status}`);
    console.log(`   Amount: $${transaction.amount / 100}`);
  } catch (error) {
    console.log(`❌ Failed to create transaction: ${error.message}`);
    return;
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: Log an attempt
  console.log('TEST 3: Log Provider Attempt');
  console.log('-'.repeat(50));
  try {
    const attempt = await transactionRepository.logAttempt({
      transactionId: transaction.id,
      provider: 'klarna',
      amount: 10000,
      attemptOrder: 1,
      status: 'approved',
      providerSessionId: 'mock_session_123',
      providerRedirectUrl: 'https://klarna.com/checkout',
      responseTimeMs: 250,
      providerResponse: { mockResponse: true }
    });
    console.log(`✅ Attempt logged: ${attempt.id}`);
    console.log(`   Provider: ${attempt.provider}`);
    console.log(`   Status: ${attempt.status}`);
    console.log(`   Response time: ${attempt.response_time_ms}ms`);
  } catch (error) {
    console.log(`❌ Failed to log attempt: ${error.message}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Update transaction
  console.log('TEST 4: Update Transaction Status');
  console.log('-'.repeat(50));
  try {
    const updated = await transactionRepository.updateTransaction(transaction.id, {
      status: 'approved',
      finalProvider: 'klarna',
      redirectUrl: 'https://klarna.com/checkout'
    });
    console.log(`✅ Transaction updated`);
    console.log(`   Status: ${updated.status}`);
    console.log(`   Final Provider: ${updated.final_provider}`);
  } catch (error) {
    console.log(`❌ Failed to update transaction: ${error.message}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: Get transaction with attempts
  console.log('TEST 5: Get Transaction with Attempts');
  console.log('-'.repeat(50));
  try {
    const fetched = await transactionRepository.getTransaction(transaction.id);
    console.log(`✅ Transaction fetched`);
    console.log(`   ID: ${fetched.id}`);
    console.log(`   Status: ${fetched.status}`);
    console.log(`   Attempts: ${fetched.bnpl_attempts?.length || 0}`);
  } catch (error) {
    console.log(`❌ Failed to get transaction: ${error.message}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 6: Get analytics
  console.log('TEST 6: Get Analytics');
  console.log('-'.repeat(50));
  try {
    const stats = await transactionRepository.getAnalytics('test_merchant');
    console.log(`✅ Analytics retrieved`);
    console.log(`   Total Transactions: ${stats.totalTransactions}`);
    console.log(`   Approved: ${stats.approved}`);
    console.log(`   Approval Rate: ${stats.approvalRate}%`);
    console.log(`   Total Volume: $${stats.totalVolume / 100}`);
  } catch (error) {
    console.log(`❌ Failed to get analytics: ${error.message}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Test 7: Full integration - process checkout with logging
  console.log('TEST 7: Full Integration - Checkout with DB Logging');
  console.log('-'.repeat(50));
  try {
    const coverpay = createCoverPay({
      enableLogging: true,
      merchantId: 'integration_test_merchant',
      klarna: { enabled: true, mockMode: true, approvalThreshold: 20000 },
      affirm: { enabled: true, mockMode: true, approvalThreshold: 50000 }
    });

    const result = await coverpay.processCheckout({
      amount: 15000,
      customer: {
        email: 'integration@test.com',
        phone: '+1234567890',
        name: 'Integration Test'
      },
      merchant: {
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      },
      strategy: 'waterfall',
      merchantOrderId: `integration_${Date.now()}`
    });

    console.log(`✅ Checkout processed`);
    console.log(`   Success: ${result.success}`);
    console.log(`   Provider: ${result.provider}`);
    console.log(`   Transaction ID: ${result.transactionId}`);

    // Verify in database
    if (result.transactionId) {
      const dbTransaction = await transactionRepository.getTransaction(result.transactionId);
      console.log(`   DB Status: ${dbTransaction?.status}`);
      console.log(`   DB Provider: ${dbTransaction?.final_provider}`);
    }
  } catch (error) {
    console.log(`❌ Integration test failed: ${error.message}`);
  }
  console.log('\n' + '='.repeat(50) + '\n');

  // Summary
  console.log('=============================================');
  console.log('DATABASE TESTS COMPLETE');
  console.log('=============================================');
  console.log('Check Supabase dashboard to verify data:');
  console.log('https://supabase.com/dashboard/project/hrgrqmeaajdmajtbdhla/editor');
  console.log('');
}

// Run tests
runDbTests().catch(console.error);
