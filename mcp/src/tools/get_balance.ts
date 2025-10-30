/**
 * Get Balance Tool
 * Retrieves merchant account balance from Hedge Payments API
 */

import axios from 'axios';
import { z } from 'zod';
import { BalanceResponse, ToolContext } from '../types.js';

// Zod schema for balance parameters (no parameters needed, but keeping for consistency)
export const GetBalanceSchema = z.object({});

export type GetBalanceParams = z.infer<typeof GetBalanceSchema>;

/**
 * Execute balance retrieval
 */
export async function getBalance(
  params: GetBalanceParams,
  context: ToolContext
): Promise<BalanceResponse> {
  try {
    console.log('[GetBalance] Fetching balance for merchant:', context.merchantId);

    const response = await axios.get<BalanceResponse>(
      `${context.apiBaseUrl}/api/balance`,
      {
        headers: {
          Authorization: `Bearer ${context.token}`,
        },
      }
    );

    if (!response.data.success) {
      throw new Error('Balance retrieval failed: Invalid response');
    }

    console.log('[GetBalance] Balance retrieved successfully');
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.error?.message || error.message;

      console.error('[GetBalance] Error:', { status, message });

      if (status === 401) {
        throw new Error('Balance retrieval failed: Authentication token expired or invalid');
      } else if (status === 429) {
        throw new Error('Balance retrieval failed: Rate limit exceeded');
      } else {
        throw new Error(`Balance retrieval failed: ${message}`);
      }
    }
    throw error;
  }
}

// Tool metadata for MCP
export const getBalanceTool = {
  name: 'get_balance',
  description: 'Retrieve the merchant account balance. Returns available, pending, and total balances across all supported currencies.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
};
