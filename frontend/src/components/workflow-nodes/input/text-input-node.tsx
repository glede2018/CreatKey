import { Type } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function TextInputNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={Type} editableKey="text" directOutput />;
}
