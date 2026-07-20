import { WandSparkles } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function TextToImageNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={WandSparkles} editableKey="prompt" />;
}

