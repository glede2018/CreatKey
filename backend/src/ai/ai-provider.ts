export interface AiProvider {
  readonly id: string;
  execute(
    kind: string,
    model: string,
    config: Record<string, unknown>,
    inputs: any[],
  ): Promise<unknown>;
}

