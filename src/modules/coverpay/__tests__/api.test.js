/**
 * CoverPay API Endpoint Tests
 * Tests the REST API endpoints for BNPL orchestration
 */
const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper to make HTTP requests
function makeRequest(method, path, data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(body)
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=============================================');
  console.log('COVERPAY API ENDPOINT TESTS');
  console.log('=============================================\n');

  let testsPassed = 0;
  let testsFailed = 0;

  // Test 1: Health check (public)
  console.log('TEST 1: Health Check');
  console.log('-'.repeat(50));
  try {
    const res = await makeRequest('GET', '/api/coverpay/health');
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(res.body, null, 2));
    if (res.status === 200 && res.body.success) {
      console.log('Result: PASS\n');
      testsPassed++;
    } else {
      console.log('Result: FAIL\n');
      testsFailed++;
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('Result: FAIL (server may not be running)\n');
    testsFailed++;
  }

  // Test 2: Checkout without auth (should fail)
  console.log('TEST 2: Checkout without auth (expect 401)');
  console.log('-'.repeat(50));
  try {
    const res = await makeRequest('POST', '/api/coverpay/checkout', {
      amount: 10000,
      customer: {
        email: 'test@example.com',
        phone: '+1234567890',
        name: 'Test User'
      },
      merchant: {
        returnUrl: 'http://localhost:3000/success',
        cancelUrl: 'http://localhost:3000/cancel'
      }
    });
    console.log(`Status: ${res.status}`);
    if (res.status === 401) {
      console.log('Result: PASS (correctly requires auth)\n');
      testsPassed++;
    } else {
      console.log('Result: FAIL (should require auth)\n');
      testsFailed++;
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('Result: FAIL\n');
    testsFailed++;
  }

  // Test 3: Webhook endpoint (public)
  console.log('TEST 3: Webhook endpoint (public)');
  console.log('-'.repeat(50));
  try {
    const res = await makeRequest('POST', '/api/coverpay/webhook', {
      provider: 'klarna',
      event: 'checkout.completed',
      transactionId: '00000000-0000-0000-0000-000000000000',
      status: 'approved'
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(res.body, null, 2));
    if (res.status === 200) {
      console.log('Result: PASS\n');
      testsPassed++;
    } else {
      console.log('Result: FAIL\n');
      testsFailed++;
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('Result: FAIL\n');
    testsFailed++;
  }

  // Test 4: Provider-specific webhook
  console.log('TEST 4: Provider-specific webhook');
  console.log('-'.repeat(50));
  try {
    const res = await makeRequest('POST', '/api/coverpay/webhook/affirm', {
      event: 'order.approved',
      sessionId: 'test_session_123'
    });
    console.log(`Status: ${res.status}`);
    console.log(`Response:`, JSON.stringify(res.body, null, 2));
    if (res.status === 200) {
      console.log('Result: PASS\n');
      testsPassed++;
    } else {
      console.log('Result: FAIL\n');
      testsFailed++;
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    console.log('Result: FAIL\n');
    testsFailed++;
  }

  // Summary
  console.log('=============================================');
  console.log('TEST SUMMARY');
  console.log('=============================================');
  console.log(`Passed: ${testsPassed}`);
  console.log(`Failed: ${testsFailed}`);
  console.log(`Total: ${testsPassed + testsFailed}`);
  console.log('=============================================\n');

  if (testsFailed > 0) {
    console.log('Note: Some tests may have failed because the server is not running.');
    console.log('Start the server with: npm start');
    console.log('Then run these tests again.');
  }
}

// Run tests
runTests().catch(console.error);
