import { AudioLines } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function SpeechToTextNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={AudioLines} mediaType="audio" />;
}

