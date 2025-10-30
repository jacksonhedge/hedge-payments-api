/**
 * MCP Server Entry Point with Streamable HTTP Transport
 * Exposes /mcp endpoint for Claude Desktop integration
 */

import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { HedgePaymentsMCPServer } from './mcp-server.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const API_BASE_URL =
  process.env.API_BASE_URL || 'https://hedge-payments-api.onrender.com';

// Create Express app
const app = express();
app.use(express.json());

// Global MCP server instance
let mcpServer: HedgePaymentsMCPServer | null = null;

/**
 * Health check endpoint
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'Hedge Payments MCP Server is running',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

/**
 * MCP endpoint - Streamable HTTP transport
 * Handles authentication and tool calls
 */
app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const { method, params } = req.body;

    console.log('[HTTP] Received MCP request:', { method, params });

    // Initialize MCP server if needed
    if (!mcpServer) {
      mcpServer = new HedgePaymentsMCPServer(API_BASE_URL);
    }

    // Handle authentication
    if (method === 'authenticate') {
      const { email, password } = params;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          error: 'Email and password are required',
        });
      }

      await mcpServer.authenticate(email, password);

      return res.json({
        success: true,
        message: 'Authentication successful',
      });
    }

    // Handle tool listing
    if (method === 'tools/list') {
      const tools = await mcpServer.listTools();

      return res.json({
        success: true,
        data: { tools },
      });
    }

    // Handle tool calls
    if (method === 'tools/call') {
      const { name, arguments: args } = params;

      if (!mcpServer.getContext()) {
        return res.status(401).json({
          success: false,
          error: 'Not authenticated. Please authenticate first.',
        });
      }

      const result = await mcpServer.callTool(name, args);

      return res.json({
        success: true,
        data: result,
      });
    }

    // Unknown method
    return res.status(400).json({
      success: false,
      error: `Unknown method: ${method}`,
    });
  } catch (error) {
    console.error('[HTTP] Error handling MCP request:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
});

/**
 * API information endpoint
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    name: 'Hedge Payments MCP Server',
    version: '1.0.0',
    description: 'Model Context Protocol server for Hedge Payments API',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST)',
    },
    documentation: 'https://github.com/jacksonhedge/hedge-payments-api/tree/main/mcp',
  });
});

/**
 * Start the server
 */
app.listen(PORT, () => {
  console.log(`\n🚀 Hedge Payments MCP Server running on port ${PORT}`);
  console.log(`📡 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API Base URL: ${API_BASE_URL}\n`);
});
