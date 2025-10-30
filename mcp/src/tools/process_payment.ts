/**
 * Process Payment Tool
 * Creates a new payment transaction via Hedge Payments API
 */

import axios from 'axios';
import { z } from 'zod';
import { PaymentResponse, ToolContext } from '../types.js';

// Zod schema for payment parameters
export const ProcessPaymentSchema = z.object({
  amount: z.number().positive().describe('Payment amount (must be positive)'),
  currency: z.enum(['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT']).describe('Currency code'),
  description: z.string().optional().describe('Payment description'),
  metadata: z.record(z.any()).optional().describe('Additional metadata'),
});

export type ProcessPaymentParams = z.infer<typeof ProcessPaymentSchema>;

/**
 * Execute payment processing
 */
export async function processPayment(
  params: ProcessPaymentParams,
  context: ToolContext
): Promise<PaymentResponse> {
  try {
    console.log('[ProcessPayment] Creating payment:', {
      amount: params.amount,
      currency: params.currency,
      merchantId: context.merchantId,
    });

    const response = await axios.post<PaymentResponse>(
      `${context.apiBaseUrl}/api/payments`,
      {
        amount: params.amount,
        currency: params.currency,
        merchantId: context.merchantId,
        description: params.description || `Payment of ${params.amount} ${params.currency}`,
        metadata: params.metadata || {},
      },
      {
        headers: {
          Authorization: `Bearer ${context.token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.data.success) {
      throw new Error('Payment creation failed: Invalid response');
    }

    console.log('[ProcessPayment] Payment created successfully:', response.data.data.id);
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      console.error('[ProcessPayment] Error:', { status, message });

      if (status === 401) {
        throw new Error('Payment failed: Authentication token expired or invalid');
      } else if (status === 400) {
        throw new Error(`Payment failed: Invalid parameters - ${message}`);
      } else if (status === 429) {
        throw new Error('Payment failed: Rate limit exceeded');
      } else {
        throw new Error(`Payment failed: ${message}`);
      }
    }
    throw error;
  }
}

// Tool metadata for MCP
export const processPaymentTool = {
  name: 'process_payment',
  description: 'Create a new payment transaction. Returns payment ID and checkout URL for the customer to complete payment.',
  inputSchema: {
    type: 'object',
    properties: {
      amount: {
        type: 'number',
        description: 'Payment amount (must be positive)',
      },
      currency: {
        type: 'string',
        enum: ['USD', 'EUR', 'GBP', 'BTC', 'ETH', 'USDC', 'USDT'],
        description: 'Currency code',
      },
      description: {
        type: 'string',
        description: 'Payment description (optional)',
      },
      metadata: {
        type: 'object',
        description: 'Additional metadata (optional)',
      },
    },
    required: ['amount', 'currency'],
  },
};
