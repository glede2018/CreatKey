import { Video } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function TextToVideoNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={Video} editableKey="prompt" />;
}

