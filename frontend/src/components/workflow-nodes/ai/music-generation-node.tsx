import { Music } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function MusicGenerationNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={Music} editableKey="prompt" />;
}

