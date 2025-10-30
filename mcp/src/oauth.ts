/**
 * OAuth2 Token Exchange Authentication
 * Exchanges merchant email/password for JWT token
 */

import axios from 'axios';
import { TokenResponse } from './types.js';

export class OAuth2Client {
  private apiBaseUrl: string;
  private tokenCache: Map<string, { token: string; expiresAt: number }> = new Map();

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Exchange merchant credentials for JWT token
   */
  async authenticate(email: string, password: string): Promise<string> {
    const cacheKey = `${email}:${password}`;

    // Check cache first
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log('[OAuth2] Using cached token');
      return cached.token;
    }

    try {
      console.log(`[OAuth2] Authenticating merchant: ${email}`);

      const response = await axios.post<TokenResponse>(
        `${this.apiBaseUrl}/api/auth/login`,
        { email, password },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data.success) {
        throw new Error('Authentication failed: Invalid response');
      }

      const { token, expiresIn } = response.data.data;

      // Cache token (with 5 minute buffer before expiry)
      const expiresAt = Date.now() + (expiresIn - 300) * 1000;
      this.tokenCache.set(cacheKey, { token, expiresAt });

      console.log('[OAuth2] Authentication successful');
      return token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const message = error.response?.data?.error?.message || error.message;

        if (status === 401) {
          throw new Error(`Authentication failed: Invalid credentials`);
        } else if (status === 429) {
          throw new Error(`Authentication failed: Rate limit exceeded`);
        } else {
          throw new Error(`Authentication failed: ${message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Validate token is still valid
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/api/auth/me`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      return response.data.success === true;
    } catch {
      return false;
    }
  }

  /**
   * Clear token cache
   */
  clearCache(): void {
    this.tokenCache.clear();
  }
}
