import type { WorkflowNodeData } from "@/types";

export interface WorkflowNodeComponentProps {
  id: string;
  data: WorkflowNodeData;
  selected: boolean;
}

