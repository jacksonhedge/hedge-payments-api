/**
 * MCP Server Implementation
 * Registers tools and handles MCP protocol communication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OAuth2Client } from './oauth.js';
import {
  processPayment,
  ProcessPaymentSchema,
  processPaymentTool,
} from './tools/process_payment.js';
import {
  getBalance,
  GetBalanceSchema,
  getBalanceTool,
} from './tools/get_balance.js';
import { ToolContext } from './types.js';

export class HedgePaymentsMCPServer {
  private server: Server;
  private oauth: OAuth2Client;
  private apiBaseUrl: string;
  private context: ToolContext | null = null;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    this.oauth = new OAuth2Client(apiBaseUrl);

    this.server = new Server(
      {
        name: 'hedge-payments-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  /**
   * Setup MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [processPaymentTool, getBalanceTool],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Ensure authentication context exists
      if (!this.context) {
        throw new Error(
          'Not authenticated. Please authenticate with merchant credentials first.'
        );
      }

      try {
        switch (name) {
          case 'process_payment': {
            const params = ProcessPaymentSchema.parse(args);
            const result = await processPayment(params, this.context);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'get_balance': {
            const params = GetBalanceSchema.parse(args);
            const result = await getBalance(params, this.context);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                {
                  success: false,
                  error: errorMessage,
                },
                null,
                2
              ),
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Authenticate merchant and setup context
   */
  async authenticate(email: string, password: string): Promise<void> {
    try {
      const token = await this.oauth.authenticate(email, password);

      // Extract merchant ID from token or use email as fallback
      // In production, you'd decode the JWT to get the user ID
      const merchantId = email.split('@')[0]; // Simplified for demo

      this.context = {
        token,
        merchantId,
        apiBaseUrl: this.apiBaseUrl,
      };

      console.log('[MCP Server] Authentication successful');
    } catch (error) {
      console.error('[MCP Server] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('[MCP Server] Started successfully');
  }

  /**
   * Get the underlying Server instance
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Get authentication context
   */
  getContext(): ToolContext | null {
    return this.context;
  }

  /**
   * List available tools (for HTTP endpoint)
   */
  async listTools() {
    return [processPaymentTool, getBalanceTool];
  }

  /**
   * Call a tool by name (for HTTP endpoint)
   */
  async callTool(name: string, args: any) {
    // Ensure authentication context exists
    if (!this.context) {
      throw new Error(
        'Not authenticated. Please authenticate with merchant credentials first.'
      );
    }

    try {
      switch (name) {
        case 'process_payment': {
          const params = ProcessPaymentSchema.parse(args);
          const result = await processPayment(params, this.context);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case 'get_balance': {
          const params = GetBalanceSchema.parse(args);
          const result = await getBalance(params, this.context);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: errorMessage,
              },
              null,
              2
            ),
          },
        ],
        isError: true,
      };
    }
  }
}
