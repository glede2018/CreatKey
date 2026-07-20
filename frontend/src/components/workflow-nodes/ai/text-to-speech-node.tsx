import { AudioLines } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function TextToSpeechNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={AudioLines} editableKey="text" />;
}

