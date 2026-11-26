import { ToolDefinition, ToolParameter } from '@agentsphere/shared';

export interface ToolExecutionResult {
  success: boolean;
  output?: any;
  error?: string;
  durationMs: number;
}

export class ToolExecutorService {
  /**
   * Validates arguments against tool schema parameters
   */
  public static validateParameters(tool: ToolDefinition, args: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const param of tool.parameters) {
      const val = args[param.name];
      if (param.required && (val === undefined || val === null || val === '')) {
        errors.push(`Missing required parameter: '${param.name}'`);
        continue;
      }

      if (val !== undefined && val !== null) {
        const actualType = Array.isArray(val) ? 'array' : typeof val;
        if (param.type === 'number' && typeof val !== 'number') {
          errors.push(`Parameter '${param.name}' expected number, got ${actualType}`);
        } else if (param.type === 'string' && typeof val !== 'string') {
          errors.push(`Parameter '${param.name}' expected string, got ${actualType}`);
        } else if (param.type === 'boolean' && typeof val !== 'boolean') {
          errors.push(`Parameter '${param.name}' expected boolean, got ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Executes a tool in a sandboxed, timed environment
   */
  public static async execute(tool: ToolDefinition, args: Record<string, any>): Promise<ToolExecutionResult> {
    const start = Date.now();

    // 1. Parameter Validation
    const validation = this.validateParameters(tool, args);
    if (!validation.valid) {
      return {
        success: false,
        error: `Parameter validation failed: ${validation.errors.join(', ')}`,
        durationMs: Date.now() - start
      };
    }

    // 2. Simulated Safe Sandboxed Execution for registered tools
    try {
      if (tool.name.includes('refund') || tool.name.includes('payment')) {
        return {
          success: true,
          output: {
            transactionId: `tx_ref_${Math.floor(Math.random() * 899999 + 100000)}`,
            status: 'PROCESSED',
            amount: args.amount_usd || 100,
            recipient: args.customer_id || 'cust_default',
            note: 'Disbursement authorized and executed in payment gateway.'
          },
          durationMs: Date.now() - start
        };
      }

      if (tool.name.includes('customer') || tool.name.includes('crm')) {
        return {
          success: true,
          output: {
            customerId: args.customer_id || 'cust_101',
            accountStatus: 'ACTIVE',
            lifetimeValueUsd: 2450.00,
            tier: 'VIP',
            verifiedEmail: 'client@example.com'
          },
          durationMs: Date.now() - start
        };
      }

      if (tool.name.includes('inventory') || tool.name.includes('search')) {
        return {
          success: true,
          output: {
            itemFound: true,
            partNumber: args.part_number || 'SKU-99',
            stockCount: 42,
            warehouseLocation: 'Bay-7, Rack-3'
          },
          durationMs: Date.now() - start
        };
      }

      // Default sandbox response
      return {
        success: true,
        output: {
          message: `Executed tool '${tool.name}' successfully in sandbox environment.`,
          appliedParams: args
        },
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Tool execution failed: ${err.message}`,
        durationMs: Date.now() - start
      };
    }
  }
}
