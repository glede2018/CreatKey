import { MessageSquareText } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function MultimodalToTextNode(props: WorkflowNodeComponentProps) {
  return (
    <ConfigurableNode
      {...props}
      icon={MessageSquareText}
      editableKey="text"
      mediaType="image"
      multipleMedia
    />
  );
}

