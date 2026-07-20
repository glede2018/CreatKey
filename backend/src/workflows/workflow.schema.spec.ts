import { describe, expect, it } from "vitest";
import {
  collectExecutionIssues,
  executionDefinition,
  validateDag,
  workflowDefinitionSchema,
} from "./workflow.schema";

const node = (id: string) => ({
  id,
  type: "workflow",
  position: { x: 0, y: 0 },
  data: { label: id, config: {} },
});
const typedNode = (id: string, kind: string, label = id) => ({
  id,
  type: "workflow",
  position: { x: 0, y: 0 },
  data: { kind, label, config: {} },
});
describe("workflow DAG validation", () => {
  it("accepts an empty draft but rejects executing it", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [],
      edges: [],
    });
    expect(() => validateDag(graph)).not.toThrow();
    expect(collectExecutionIssues(graph)).toEqual([
      { nodeId: "", message: "工作流不能为空" },
    ]);
  });

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

  it("accepts matching typed ports", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [typedNode("image", "input.image"), typedNode("edit", "ai.image-to-image")],
      edges: [{ id: "image-edit", source: "image", sourceHandle: "image", target: "edit", targetHandle: "image" }],
    });
    expect(() => validateDag(graph)).not.toThrow();
  });

  it("rejects incompatible typed ports", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [typedNode("audio", "input.audio"), typedNode("edit", "ai.image-to-image")],
      edges: [{ id: "audio-edit", source: "audio", sourceHandle: "audio", target: "edit", targetHandle: "image" }],
    });
    expect(() => validateDag(graph)).toThrow(/不兼容/);
  });

  it("allows multiple images only on multi-value input ports", () => {
    const base = {
      schemaVersion: 1 as const,
      nodes: [typedNode("a", "input.image"), typedNode("b", "input.image"), typedNode("multi", "ai.multi-image-to-image")],
      edges: [
        { id: "a-multi", source: "a", sourceHandle: "image", target: "multi", targetHandle: "images" },
        { id: "b-multi", source: "b", sourceHandle: "image", target: "multi", targetHandle: "images" },
      ],
    };
    expect(() => validateDag(workflowDefinitionSchema.parse(base))).not.toThrow();
  });

  it("reports missing executable inputs with node ids", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [typedNode("prompt", "input.text"), typedNode("image", "ai.text-to-image")],
      edges: [],
    });
    expect(collectExecutionIssues(graph)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ nodeId: "prompt", message: "文本输入不能为空" }),
        expect.objectContaining({ nodeId: "image", portId: "prompt" }),
      ]),
    );
  });

  it("accepts required inputs supplied by valid upstream edges", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [
        { ...typedNode("prompt", "input.text"), data: { kind: "input.text", label: "文本", config: { text: "生成海报" } } },
        { ...typedNode("image", "ai.text-to-image"), data: { kind: "ai.text-to-image", label: "文生图", config: { model: "qwen-image" } } },
      ],
      edges: [{ id: "prompt-image", source: "prompt", sourceHandle: "text", target: "image", targetHandle: "prompt" }],
    });
    expect(collectExecutionIssues(graph)).toEqual([]);
  });

  it("requires at least two images for multi-image generation", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [
        { ...typedNode("source", "input.image"), data: { kind: "input.image", label: "图片", config: { media: { id: "1" } } } },
        { ...typedNode("multi", "ai.multi-image-to-image"), data: { kind: "ai.multi-image-to-image", label: "多图生图", config: { model: "qwen-image", prompt: "融合" } } },
      ],
      edges: [{ id: "one-image", source: "source", sourceHandle: "image", target: "multi", targetHandle: "images" }],
    });
    expect(collectExecutionIssues(graph)).toEqual(
      expect.arrayContaining([expect.objectContaining({ nodeId: "multi", portId: "images" })]),
    );
  });

  it("selects only a target node and its upstream dependencies", () => {
    const graph = workflowDefinitionSchema.parse({
      schemaVersion: 1,
      nodes: [node("source"), node("target"), node("downstream"), node("independent")],
      edges: [
        { id: "source-target", source: "source", target: "target" },
        { id: "target-downstream", source: "target", target: "downstream" },
      ],
    });
    const selected = executionDefinition(graph, "target");
    expect(selected.nodes.map((item) => item.id)).toEqual(["source", "target"]);
    expect(selected.edges.map((item) => item.id)).toEqual(["source-target"]);
  });
});
