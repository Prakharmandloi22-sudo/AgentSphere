import {
  ExecutionTrace,
  ExecutionStatus,
  StepType,
  ExecutionStepTrace,
  ApprovalStatus,
  HumanApprovalRequest
} from '@agentsphere/shared';
import { v4 as uuidv4 } from 'uuid';
import { DataStore } from '../db';
import { SecurityService } from './security.service';
import { ToolRunnerService } from './toolRunner.service';

export class OrchestrationService {
  /**
   * Starts a new agent execution trace
   */
  public static async startExecution(
    tenantId: string,
    agentId: string,
    userId: string,
    inputQuery: string
  ): Promise<ExecutionTrace> {
    const store = DataStore.getInstance();
    const tenant = store.getTenant(tenantId);
    if (!tenant) throw new Error('Tenant not found');

    // 1. Budget & Spend Guard
    if (tenant.currentSpendUsd >= tenant.monthlyBudgetUsd) {
      throw new Error(`Execution blocked: Tenant monthly budget limit of $${tenant.monthlyBudgetUsd.toFixed(2)} reached (Current spend: $${tenant.currentSpendUsd.toFixed(2)})`);
    }

    // 2. Agent Scoping
    const agent = store.getAgent(tenantId, agentId);
    if (!agent) throw new Error('Agent not found or access denied for this tenant');

    // 3. Prompt Injection Defense
    const injectionCheck = SecurityService.detectPromptInjection(inputQuery);
    if (injectionCheck.isInjected) {
      store.addAuditLog({
        tenantId,
        userId,
        action: 'SECURITY_ALERT_PROMPT_INJECTION_BLOCKED',
        resourceType: 'AGENT_EXECUTION',
        resourceId: agentId,
        payload: { inputQuery, reason: injectionCheck.reason }
      });

      const failedExecution: ExecutionTrace = {
        id: uuidv4(),
        tenantId,
        agentId,
        initiatedByUserId: userId,
        inputQuery,
        finalOutput: 'Execution aborted: Input triggered security guardrail for prompt injection.',
        status: ExecutionStatus.FAILED,
        totalTokensUsed: 0,
        totalCostUsd: 0,
        durationMs: 45,
        steps: [
          {
            id: uuidv4(),
            executionId: '',
            stepNumber: 1,
            stepName: 'Security Injection Shield',
            stepType: StepType.TRANSFORM,
            input: { query: inputQuery },
            output: { blocked: true, reason: injectionCheck.reason },
            tokensUsed: 0,
            costUsd: 0,
            durationMs: 45,
            status: 'FAILED',
            errorMessage: `Prompt injection blocked: ${injectionCheck.reason}`,
            timestamp: new Date().toISOString()
          }
        ],
        errorMessage: `Prompt injection blocked: ${injectionCheck.reason}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString()
      };
      failedExecution.steps[0].executionId = failedExecution.id;
      return store.createExecution(failedExecution);
    }

    // 4. Resolve Active Prompt Version
    const promptVersions = store.listPromptVersions(tenantId, agentId);
    const activePrompt = promptVersions.find(p => p.isActive) || promptVersions[0];
    const systemPrompt = activePrompt ? activePrompt.systemPrompt : 'You are a helpful AI assistant.';

    const executionId = uuidv4();
    const startTime = Date.now();
    const execution: ExecutionTrace = {
      id: executionId,
      tenantId,
      agentId,
      initiatedByUserId: userId,
      inputQuery,
      status: ExecutionStatus.RUNNING,
      totalTokensUsed: 0,
      totalCostUsd: 0,
      durationMs: 0,
      steps: [],
      startedAt: new Date().toISOString()
    };
    store.createExecution(execution);

    // 5. Execute Steps Sequentially
    let totalTokens = 0;
    let totalCost = 0;
    let currentStepNumber = 1;
    let accumulatedContext = `System: ${systemPrompt}\nUser Query: ${inputQuery}\n`;
    let waitingApproval: HumanApprovalRequest | undefined = undefined;

    const stepsToRun = agent.workflowSteps && agent.workflowSteps.length > 0
      ? agent.workflowSteps
      : [
          {
            id: 'default-llm',
            name: 'Direct LLM Reasoning',
            stepType: StepType.LLM_PROMPT,
            config: { maxTokens: 1000 }
          }
        ];

    for (const step of stepsToRun) {
      if (currentStepNumber > agent.maxExecutionSteps) {
        // Runaway loop breaker
        const runawayStep: ExecutionStepTrace = {
          id: uuidv4(),
          executionId,
          stepNumber: currentStepNumber,
          stepName: 'Loop Guard Limit Breaker',
          stepType: StepType.TRANSFORM,
          input: {},
          output: { limit: agent.maxExecutionSteps },
          tokensUsed: 0,
          costUsd: 0,
          durationMs: 10,
          status: 'FAILED',
          errorMessage: `Maximum execution step limit (${agent.maxExecutionSteps}) reached. Loop terminated.`,
          timestamp: new Date().toISOString()
        };
        store.addExecutionStep(tenantId, executionId, runawayStep);
        execution.status = ExecutionStatus.FAILED;
        execution.errorMessage = `Runaway execution halted: exceeded maximum allowed ${agent.maxExecutionSteps} steps.`;
        break;
      }

      const stepStart = Date.now();

      // Step A: Knowledge Retrieval
      if (step.stepType === StepType.KNOWLEDGE_RETRIEVAL) {
        const query = step.config.retrievalQuery || inputQuery;
        const retrievedChunks = store.searchChunks(tenantId, query, 3);
        const retrievedText = retrievedChunks.map(c => `[Chunk #${c.chunkIndex}]: ${c.content}`).join('\n');
        accumulatedContext += `\nRetrieved Knowledge:\n${retrievedText}\n`;

        const stepTrace: ExecutionStepTrace = {
          id: uuidv4(),
          executionId,
          stepNumber: currentStepNumber,
          stepName: step.name,
          stepType: StepType.KNOWLEDGE_RETRIEVAL,
          input: { query },
          output: { chunksFound: retrievedChunks.length, preview: retrievedText.substring(0, 150) },
          tokensUsed: 120,
          costUsd: 0.0002,
          durationMs: Date.now() - stepStart,
          status: 'SUCCESS',
          timestamp: new Date().toISOString()
        };
        totalTokens += stepTrace.tokensUsed;
        totalCost += stepTrace.costUsd;
        store.addExecutionStep(tenantId, executionId, stepTrace);
      }

      // Step B: Tool Call
      else if (step.stepType === StepType.TOOL_CALL) {
        const toolId = step.config.toolId || '';

        // Check Tool Allowlist
        if (!agent.allowedToolIds.includes(toolId)) {
          const unauthorizedTrace: ExecutionStepTrace = {
            id: uuidv4(),
            executionId,
            stepNumber: currentStepNumber,
            stepName: step.name,
            stepType: StepType.TOOL_CALL,
            input: { toolId },
            output: null,
            tokensUsed: 0,
            costUsd: 0,
            durationMs: Date.now() - stepStart,
            status: 'FAILED',
            errorMessage: `Security Violation: Tool '${toolId}' is not authorized on agent '${agent.name}'`,
            timestamp: new Date().toISOString()
          };
          store.addExecutionStep(tenantId, executionId, unauthorizedTrace);
          execution.status = ExecutionStatus.FAILED;
          execution.errorMessage = unauthorizedTrace.errorMessage;
          break;
        }

        const tool = store.getTool(tenantId, toolId);

        // Check if Tool or Step Requires Approval
        if (tool?.requiresApproval || step.config.requiresApproval) {
          const approvalReq = store.createApprovalRequest({
            id: uuidv4(),
            executionId,
            tenantId,
            stepNumber: currentStepNumber,
            stepName: step.name,
            actionDetails: `Agent '${agent.name}' requests permission to execute tool '${tool?.name || toolId}'`,
            sensitivePayload: { toolId, inputQuery, targetEndpoint: tool?.endpointUrl },
            status: ApprovalStatus.PENDING,
            requestedAt: new Date().toISOString()
          });

          const approvalPauseTrace: ExecutionStepTrace = {
            id: uuidv4(),
            executionId,
            stepNumber: currentStepNumber,
            stepName: step.name,
            stepType: StepType.TOOL_CALL,
            input: { toolId, requiresApproval: true },
            output: { approvalId: approvalReq.id, status: 'WAITING_APPROVAL' },
            tokensUsed: 50,
            costUsd: 0.0001,
            durationMs: Date.now() - stepStart,
            status: 'WAITING_APPROVAL',
            timestamp: new Date().toISOString()
          };
          totalTokens += 50;
          totalCost += 0.0001;
          store.addExecutionStep(tenantId, executionId, approvalPauseTrace);

          execution.status = ExecutionStatus.WAITING_FOR_APPROVAL;
          execution.approvalRequest = approvalReq;
          waitingApproval = approvalReq;
          break; // Pause execution loop
        }

        // Run Tool
        const toolResult = await ToolRunnerService.executeTool(tenantId, toolId, {
          expression: '120.00 - 12.00',
          sku: 'WIDGET-01',
          endpoint: 'https://httpbin.org/post',
          payload: { orderRefund: 108.00 }
        });

        const stepTrace: ExecutionStepTrace = {
          id: uuidv4(),
          executionId,
          stepNumber: currentStepNumber,
          stepName: step.name,
          stepType: StepType.TOOL_CALL,
          input: { toolId },
          output: toolResult.output,
          tokensUsed: 80,
          costUsd: 0.0001,
          durationMs: toolResult.durationMs,
          status: toolResult.success ? 'SUCCESS' : 'FAILED',
          errorMessage: toolResult.error,
          timestamp: new Date().toISOString()
        };
        totalTokens += stepTrace.tokensUsed;
        totalCost += stepTrace.costUsd;
        store.addExecutionStep(tenantId, executionId, stepTrace);
      }

      // Step C: Human Approval Step
      else if (step.stepType === StepType.HUMAN_APPROVAL) {
        const approvalReq = store.createApprovalRequest({
          id: uuidv4(),
          executionId,
          tenantId,
          stepNumber: currentStepNumber,
          stepName: step.name,
          actionDetails: step.config.approvalMessage || 'Manual human verification required before proceeding',
          sensitivePayload: { query: inputQuery, amountUsd: 108.00, customerRecipient: 'cust_98765' },
          status: ApprovalStatus.PENDING,
          requestedAt: new Date().toISOString()
        });

        const approvalPauseTrace: ExecutionStepTrace = {
          id: uuidv4(),
          executionId,
          stepNumber: currentStepNumber,
          stepName: step.name,
          stepType: StepType.HUMAN_APPROVAL,
          input: { approvalMessage: step.config.approvalMessage },
          output: { approvalId: approvalReq.id, status: 'WAITING_APPROVAL' },
          tokensUsed: 40,
          costUsd: 0.0001,
          durationMs: Date.now() - stepStart,
          status: 'WAITING_APPROVAL',
          timestamp: new Date().toISOString()
        };
        totalTokens += 40;
        totalCost += 0.0001;
        store.addExecutionStep(tenantId, executionId, approvalPauseTrace);

        execution.status = ExecutionStatus.WAITING_FOR_APPROVAL;
        execution.approvalRequest = approvalReq;
        waitingApproval = approvalReq;
        break; // Pause loop
      }

      // Step D: LLM Reasoning Step
      else {
        const stepTokens = 420;
        const stepCost = 0.0008;
        totalTokens += stepTokens;
        totalCost += stepCost;

        const syntheticModelAnswer = `Based on the return policy guidelines, the customer request is eligible for processing. The refund amount calculated is $108.00 USD after standard restocking terms.`;

        const stepTrace: ExecutionStepTrace = {
          id: uuidv4(),
          executionId,
          stepNumber: currentStepNumber,
          stepName: step.name,
          stepType: StepType.LLM_PROMPT,
          input: { model: 'gpt-4o-mini', promptExcerpt: accumulatedContext.substring(0, 100) },
          output: { completion: syntheticModelAnswer },
          tokensUsed: stepTokens,
          costUsd: stepCost,
          durationMs: Date.now() - stepStart + 350,
          status: 'SUCCESS',
          timestamp: new Date().toISOString()
        };
        store.addExecutionStep(tenantId, executionId, stepTrace);
      }

      currentStepNumber++;
    }

    // 6. Finalize Execution (if not paused for approval)
    const totalDuration = Date.now() - startTime;
    execution.totalTokensUsed = totalTokens;
    execution.totalCostUsd = Number(totalCost.toFixed(4));
    execution.durationMs = totalDuration;

    if (!waitingApproval && execution.status !== ExecutionStatus.FAILED) {
      execution.status = ExecutionStatus.COMPLETED;
      const rawFinal = `Inquiry verified successfully against Acme Corporation Return Policy. Return authorized. Total refundable credit: $108.00.`;
      const { sanitizedText } = SecurityService.applyOutputGuardrails(rawFinal);
      execution.finalOutput = sanitizedText;
      execution.completedAt = new Date().toISOString();
    }

    store.updateExecution(tenantId, executionId, execution);
    store.recordTenantSpend(tenantId, execution.totalCostUsd, execution.totalTokensUsed);

    store.addAuditLog({
      tenantId,
      userId,
      action: 'AGENT_EXECUTION_RUN',
      resourceType: 'AGENT',
      resourceId: agentId,
      payload: { executionId, status: execution.status, totalTokens, totalCost }
    });

    return execution;
  }

  /**
   * Resumes an execution that was paused waiting for human approval
   */
  public static async resolveApprovalAndResume(
    tenantId: string,
    approvalId: string,
    approved: boolean,
    userId: string,
    comment?: string
  ): Promise<ExecutionTrace> {
    const store = DataStore.getInstance();
    const approval = store.resolveApproval(
      tenantId,
      approvalId,
      approved ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
      userId,
      comment
    );

    const execution = store.getExecution(tenantId, approval.executionId);
    if (!execution) throw new Error('Associated execution not found');

    if (!approved) {
      execution.status = ExecutionStatus.CANCELLED;
      execution.errorMessage = `Execution cancelled by human auditor rejection: ${comment || 'No reason specified'}`;
      execution.completedAt = new Date().toISOString();
      store.updateExecution(tenantId, execution.id, execution);
      return execution;
    }

    // Approved: mark as completed and append final disbursement step
    const resumeStep: ExecutionStepTrace = {
      id: uuidv4(),
      executionId: execution.id,
      stepNumber: approval.stepNumber + 1,
      stepName: 'Disburse Webhook Post-Approval',
      stepType: StepType.TOOL_CALL,
      input: { approvedPayload: approval.sensitivePayload },
      output: { status: 'DISBURSED', transactionId: `tx_${uuidv4().substring(0, 8)}`, disbursedAt: new Date().toISOString() },
      tokensUsed: 65,
      costUsd: 0.0001,
      durationMs: 120,
      status: 'SUCCESS',
      timestamp: new Date().toISOString()
    };
    store.addExecutionStep(tenantId, execution.id, resumeStep);

    execution.status = ExecutionStatus.COMPLETED;
    execution.finalOutput = `Human approval granted by user ${userId}. Webhook action successfully dispatched and refund of $108.00 completed.`;
    execution.completedAt = new Date().toISOString();
    store.updateExecution(tenantId, execution.id, execution);

    store.addAuditLog({
      tenantId,
      userId,
      action: 'APPROVAL_RESOLVED_AND_EXECUTION_RESUMED',
      resourceType: 'APPROVAL',
      resourceId: approvalId,
      payload: { approved, comment, executionId: execution.id }
    });

    return execution;
  }
}
