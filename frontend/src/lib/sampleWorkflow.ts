import type { Edge, Node } from "@xyflow/react";

export function getSampleWorkflow(): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [
    {
      id: "up-img",
      type: "uploadImage",
      position: { x: 40, y: 120 },
      data: { label: "Upload Image" },
    },
    {
      id: "crop",
      type: "cropImage",
      position: { x: 320, y: 120 },
      data: { label: "Crop", xPercent: 10, yPercent: 10, widthPercent: 80, heightPercent: 80 },
    },
    {
      id: "t-sys-1",
      type: "text",
      position: { x: 40, y: 320 },
      data: {
        label: "System (LLM 1)",
        value: "You are a professional marketing copywriter.",
      },
    },
    {
      id: "t-user-1",
      type: "text",
      position: { x: 40, y: 480 },
      data: {
        label: "User (LLM 1)",
        value: "Product: Wireless Bluetooth Headphones. Write a short product description.",
      },
    },
    {
      id: "llm-1",
      type: "llm",
      position: { x: 600, y: 280 },
      data: { label: "LLM 1", model: "gemini-2.0-flash" },
    },
    {
      id: "up-vid",
      type: "uploadVideo",
      position: { x: 40, y: 680 },
      data: { label: "Upload Video" },
    },
    {
      id: "extract",
      type: "extractFrame",
      position: { x: 320, y: 680 },
      data: { label: "Extract Frame", timestamp: "50%" },
    },
    {
      id: "t-sys-2",
      type: "text",
      position: { x: 920, y: 120 },
      data: {
        label: "System (LLM 2)",
        value:
          "You are a social media manager. Create a tweet-length marketing post using the product description and both images.",
      },
    },
    {
      id: "llm-2",
      type: "llm",
      position: { x: 1180, y: 360 },
      data: { label: "LLM 2 (merge)", model: "gemini-2.0-flash" },
    },
  ];

  const edges: Edge[] = [
    {
      id: "e1",
      source: "up-img",
      target: "crop",
      sourceHandle: "output",
      targetHandle: "image_url",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e2",
      source: "t-sys-1",
      target: "llm-1",
      sourceHandle: "output",
      targetHandle: "system_prompt",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e3",
      source: "t-user-1",
      target: "llm-1",
      sourceHandle: "output",
      targetHandle: "user_message",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e4",
      source: "crop",
      target: "llm-1",
      sourceHandle: "output",
      targetHandle: "images",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e5",
      source: "up-vid",
      target: "extract",
      sourceHandle: "output",
      targetHandle: "video_url",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e6",
      source: "t-sys-2",
      target: "llm-2",
      sourceHandle: "output",
      targetHandle: "system_prompt",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e7",
      source: "llm-1",
      target: "llm-2",
      sourceHandle: "output",
      targetHandle: "user_message",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e8",
      source: "crop",
      target: "llm-2",
      sourceHandle: "output",
      targetHandle: "images",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
    {
      id: "e9",
      source: "extract",
      target: "llm-2",
      sourceHandle: "output",
      targetHandle: "images",
      animated: true,
      style: { stroke: "#8b5cf6", strokeWidth: 1.5 },
    },
  ];

  return { nodes, edges };
}
