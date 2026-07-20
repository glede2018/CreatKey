import { Handle, Position } from "@xyflow/react";
import type { WorkflowPort } from "@/types";

interface NodePortsProps {
  inputs: WorkflowPort[];
  outputs: WorkflowPort[];
}

function portTop(index: number) {
  return 72 + index * 30;
}

export function NodePorts({ inputs, outputs }: NodePortsProps) {
  return (
    <>
      {inputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="target"
          position={Position.Left}
          className={`ck-node-handle ck-port-${port.type} !size-3 !border-2`}
          style={{ top: portTop(index) }}
          title={`${port.label} · ${port.type}${port.multiple ? " · 可多连" : ""}`}
        />
      ))}
      {outputs.map((port, index) => (
        <Handle
          key={port.id}
          id={port.id}
          type="source"
          position={Position.Right}
          className={`ck-node-handle ck-port-${port.type} !size-3 !border-2`}
          style={{ top: outputs.length === 1 ? "50%" : portTop(index) }}
          title={`${port.label} · ${port.type}`}
        />
      ))}
    </>
  );
}

