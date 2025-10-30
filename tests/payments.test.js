const request = require('supertest');
const app = require('../src/app');

describe('Payment Endpoints', () => {
  let authToken;
  let paymentId;

  beforeAll(async () => {
    // Login to get auth token
    const res = await request(app).post('/api/auth/login').send({
      email: 'test@example.com',
      password: 'password123',
      merchantId: 'merchant123',
    });
    authToken = res.body.data.token;
  });

  describe('POST /api/payments', () => {
    it('should create a payment successfully', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100.5,
          currency: 'USD',
          customerEmail: 'customer@example.com',
          customerName: 'John Doe',
          description: 'Test payment',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('paymentId');

      paymentId = res.body.data.paymentId;
    });

    it('should fail without authentication', async () => {
      const res = await request(app).post('/api/payments').send({
        amount: 100.5,
        currency: 'USD',
        customerEmail: 'customer@example.com',
      });

      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid amount', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -10,
          currency: 'USD',
          customerEmail: 'customer@example.com',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid email', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          currency: 'USD',
          customerEmail: 'invalid-email',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should fail with invalid currency', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 100,
          currency: 'INVALID',
          customerEmail: 'customer@example.com',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/:paymentId', () => {
    it('should get payment details', async () => {
      // First create a payment
      const createRes = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50,
          currency: 'USD',
          customerEmail: 'customer@example.com',
        });

      const paymentId = createRes.body.data.paymentId;

      const res = await request(app)
        .get(`/api/payments/${paymentId}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should fail without authentication', async () => {
      const res = await request(app).get('/api/payments/test-payment-id');

      expect(res.statusCode).toBe(401);
    });
  });
});
