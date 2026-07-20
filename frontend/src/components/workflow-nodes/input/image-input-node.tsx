import { Image } from "lucide-react";
import type { WorkflowNodeComponentProps } from "../types";
import { ConfigurableNode } from "../shared/configurable-node";

export function ImageInputNode(props: WorkflowNodeComponentProps) {
  return <ConfigurableNode {...props} icon={Image} mediaType="image" directOutput />;
}
