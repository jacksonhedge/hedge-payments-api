/**
 * Type definitions for Hedge Payments MCP Server
 */

// OAuth2 token response from Hedge Payments API
export interface TokenResponse {
  success: boolean;
  data: {
    token: string;
    expiresIn: number;
    user: {
      id: string;
      email: string;
      name?: string;
    };
  };
}

// Payment request structure
export interface PaymentRequest {
  amount: number;
  currency: string;
  merchantId: string;
  description?: string;
  metadata?: Record<string, any>;
}

// Payment response from API
export interface PaymentResponse {
  success: boolean;
  data: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    merchantId: string;
    createdAt: string;
    checkoutUrl?: string;
  };
}

// Balance response from API
export interface BalanceResponse {
  success: boolean;
  data: {
    available: Array<{
      amount: number;
      currency: string;
    }>;
    pending: Array<{
      amount: number;
      currency: string;
    }>;
    total: Array<{
      amount: number;
      currency: string;
    }>;
  };
}

// MCP tool context with authentication
export interface ToolContext {
  token: string;
  merchantId: string;
  apiBaseUrl: string;
}

// Error response structure
export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
}
