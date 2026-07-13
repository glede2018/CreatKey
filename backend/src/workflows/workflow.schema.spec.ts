import { describe, expect, it } from "vitest";
import { validateDag, workflowDefinitionSchema } from "./workflow.schema";

const node = (id: string) => ({
  id,
  type: "workflow",
  position: { x: 0, y: 0 },
  data: { label: id, config: {} },
});
describe("workflow DAG validation", () => {
  it("accepts fan-out and fan-in DAGs", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [node("a"), node("b"), node("c"), node("d")],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ac", source: "a", target: "c" },
        { id: "bd", source: "b", target: "d" },
        { id: "cd", source: "c", target: "d" },
      ],
    });
    expect(() => validateDag(graph)).not.toThrow();
  });
  it("rejects cycles", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [node("a"), node("b")],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "ba", source: "b", target: "a" },
      ],
    });
    expect(() => validateDag(graph)).toThrow(/环路/);
  });
  it("rejects edges to missing nodes", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [node("a")],
      edges: [{ id: "ax", source: "a", target: "x" }],
    });
    expect(() => validateDag(graph)).toThrow(/不存在/);
  });
});
