export interface RoadmapNodePosition {
  x: number;
  y: number;
}

export interface RoadmapNodeData {
  title: string;
  description: string;
  link: string;
}

export interface RoadmapNode {
  id: string;
  type: "turbo" | string;
  position: RoadmapNodePosition;
  data: RoadmapNodeData;
}

export interface RoadmapEdge {
  id: string;
  source: string;
  target: string;
}

export interface RoadmapResponse {
  roadmapTitle: string;
  description: string;
  duration: string;
  initialNodes: RoadmapNode[];
  initialEdges: RoadmapEdge[];
}
