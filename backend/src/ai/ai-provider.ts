export interface AiProvider {
  readonly id: string;
  execute(
    kind: string,
    model: string,
    config: Record<string, unknown>,
    inputs: any[],
    context?: AiExecutionContext,
  ): Promise<unknown>;
}

export interface AiExecutionContext {
  modelDbId: string;
  userId?: string;
  workflowRunId?: string;
  nodeRunId?: string;
  chargedKeys: number;
  pricingSnapshot: Record<string, unknown>;
}
