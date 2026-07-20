import { FileVideo } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function VideoInputNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={FileVideo} mediaType="video" directOutput />;
}
