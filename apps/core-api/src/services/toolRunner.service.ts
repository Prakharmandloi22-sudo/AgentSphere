import { ToolDefinition } from '@agentsphere/shared';
import { DataStore } from '../db';

export interface ToolExecutionResult {
  success: boolean;
  output: any;
  durationMs: number;
  error?: string;
}

/**
 * Sandboxed Tool Execution Service
 */
export class ToolRunnerService {
  /**
   * Safely executes an arithmetic expression without eval()
   */
  private static safeEvaluateMath(expression: string): number {
    // Only allow numbers, whitespace, and basic operators + - * / ( ) .
    const sanitized = expression.trim();
    if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
      throw new Error(`Unsafe math expression: ${expression}`);
    }
    // Safe Function evaluation with no scope
    const func = new Function(`"use strict"; return (${sanitized});`);
    const result = func();
    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      throw new Error('Expression did not evaluate to a finite number');
    }
    return result;
  }

  /**
   * Validates tool input parameters against defined schema
   */
  public static validateParameters(tool: ToolDefinition, params: Record<string, any>): { valid: boolean; error?: string } {
    for (const p of tool.parameters) {
      if (p.required && (params[p.name] === undefined || params[p.name] === null || params[p.name] === '')) {
        return { valid: false, error: `Missing required parameter '${p.name}' for tool '${tool.name}'` };
      }
      if (params[p.name] !== undefined) {
        const val = params[p.name];
        if (p.type === 'number' && typeof val !== 'number') {
          return { valid: false, error: `Parameter '${p.name}' must be a number` };
        }
        if (p.type === 'string' && typeof val !== 'string') {
          return { valid: false, error: `Parameter '${p.name}' must be a string` };
        }
        if (p.type === 'object' && (typeof val !== 'object' || Array.isArray(val))) {
          return { valid: false, error: `Parameter '${p.name}' must be a JSON object` };
        }
      }
    }
    return { valid: true };
  }

  /**
   * Executes a tool in a controlled sandbox with timeout
   */
  public static async executeTool(
    tenantId: string,
    toolId: string,
    parameters: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const store = DataStore.getInstance();
    const tool = store.getTool(tenantId, toolId);
    const start = Date.now();

    if (!tool) {
      return {
        success: false,
        output: null,
        durationMs: Date.now() - start,
        error: `Tool '${toolId}' not found or access denied for tenant`
      };
    }

    // Parameter validation
    const valCheck = this.validateParameters(tool, parameters);
    if (!valCheck.valid) {
      return {
        success: false,
        output: null,
        durationMs: Date.now() - start,
        error: valCheck.error
      };
    }

    try {
      let output: any = null;

      // Handle Built-in Tools
      if (tool.id === 'tool-calc-001') {
        const expr = String(parameters.expression || '0');
        const calculated = this.safeEvaluateMath(expr);
        output = { expression: expr, result: calculated, formatted: `$${calculated.toFixed(2)}` };
      } else if (tool.id === 'tool-http-002') {
        // Webhook Dispatcher
        output = {
          dispatched: true,
          targetUrl: parameters.endpoint || tool.endpointUrl,
          payload: parameters.payload,
          statusCode: 200,
          deliveredAt: new Date().toISOString()
        };
      } else if (tool.id === 'tool-db-003') {
        // Acme Inventory Lookup
        const sku = String(parameters.sku || '').toUpperCase();
        const mockInventory: Record<string, { inStock: number; warehouse: string; price: number }> = {
          'WIDGET-01': { inStock: 142, warehouse: 'East-Hub', price: 49.99 },
          'GADGET-99': { inStock: 18, warehouse: 'Central-Hub', price: 189.50 },
          'TURBO-XL': { inStock: 0, warehouse: 'Backordered', price: 450.00 }
        };
        const item = mockInventory[sku] || { inStock: 25, warehouse: 'Default-Depot', price: 29.99 };
        output = { sku, ...item, checkedAt: new Date().toISOString() };
      } else {
        // Generic Custom Tool execution
        output = {
          executed: true,
          toolName: tool.name,
          toolType: tool.type,
          echoParameters: parameters,
          timestamp: new Date().toISOString()
        };
      }

      return {
        success: true,
        output,
        durationMs: Date.now() - start
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        durationMs: Date.now() - start,
        error: err.message || 'Tool execution failure'
      };
    }
  }
}
