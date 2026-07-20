import { Video } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function ImageToVideoNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={Video} editableKey="prompt" mediaType="image" />;
}

