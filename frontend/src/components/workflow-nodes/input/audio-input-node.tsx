import { FileAudio } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function AudioInputNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={FileAudio} mediaType="audio" directOutput />;
}
