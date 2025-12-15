/**
 * HTTP Utilities for BNPL Provider API Calls
 * Includes retry logic, timeout handling, and error normalization
 */

const DEFAULT_TIMEOUT = 10000; // 10 seconds
const DEFAULT_RETRIES = 2;
const RETRY_DELAY = 1000; // 1 second

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an HTTP request with timeout, retries, and error handling
 * @param {string} url - Request URL
 * @param {object} options - Fetch options (method, headers, body, etc.)
 * @param {object} config - Additional config (timeout, retries, retryDelay)
 * @returns {Promise<object>} - Parsed JSON response
 */
async function httpRequest(url, options = {}, config = {}) {
  const timeout = config.timeout || DEFAULT_TIMEOUT;
  const maxRetries = config.retries ?? DEFAULT_RETRIES;
  const retryDelay = config.retryDelay || RETRY_DELAY;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Parse response
      const data = await response.json().catch(() => ({}));

      // Check for HTTP errors
      if (!response.ok) {
        const error = new Error(data.message || data.error || `HTTP ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;

    } catch (error) {
      lastError = error;

      // Don't retry on client errors (4xx) except 429 (rate limit)
      if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
        throw normalizeError(error);
      }

      // Don't retry on abort (timeout)
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${timeout}ms`);
        timeoutError.code = 'TIMEOUT';
        throw timeoutError;
      }

      // Retry on network errors or 5xx/429
      if (attempt < maxRetries) {
        console.log(`[HTTP] Retry ${attempt + 1}/${maxRetries} after error: ${error.message}`);
        await sleep(retryDelay * (attempt + 1)); // Exponential backoff
        continue;
      }
    }
  }

  throw normalizeError(lastError);
}

/**
 * Normalize errors to consistent format
 */
function normalizeError(error) {
  const normalized = new Error(error.message || 'Unknown error');
  normalized.code = error.code || error.status || 'UNKNOWN';
  normalized.status = error.status;
  normalized.data = error.data;
  normalized.original = error;
  return normalized;
}

/**
 * Build Basic Auth header
 */
function basicAuth(username, password) {
  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Build Bearer Auth header
 */
function bearerAuth(token) {
  return `Bearer ${token}`;
}

module.exports = {
  httpRequest,
  normalizeError,
  basicAuth,
  bearerAuth,
  sleep,
  DEFAULT_TIMEOUT,
  DEFAULT_RETRIES
};
