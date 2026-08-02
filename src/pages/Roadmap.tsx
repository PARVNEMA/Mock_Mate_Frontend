import React, { useState, useRef, useCallback } from "react";
import { Typography, Input, Button, Spin, Alert } from "antd";
import {
  SearchOutlined,
  LinkOutlined,
  RocketOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { generateRoadmap } from "../services/roadmapApi";
import type { RoadmapResponse, RoadmapNode } from "../types/roadmap";

const { Title, Text, Paragraph } = Typography;

// ----- constants ----------------------------------------------------------
const NODE_WIDTH = 260;
const NODE_HEIGHT = 140;
const SCALE = 1.35; // multiply backend coords to add comfortable spacing

// ----- helpers ------------------------------------------------------------
const NODE_COLORS = [
  { from: "#6366f1", to: "#8b5cf6" }, // indigo → purple
  { from: "#0ea5e9", to: "#6366f1" }, // sky → indigo
  { from: "#8b5cf6", to: "#ec4899" }, // purple → pink
  { from: "#10b981", to: "#0ea5e9" }, // emerald → sky
  { from: "#f59e0b", to: "#ef4444" }, // amber → red
  { from: "#ec4899", to: "#f59e0b" }, // pink → amber
];

function getNodeColor(index: number) {
  return NODE_COLORS[index % NODE_COLORS.length];
}

// derive canvas size from node positions
function canvasSize(nodes: RoadmapNode[]) {
  let maxX = 0;
  let maxY = 0;
  for (const n of nodes) {
    maxX = Math.max(maxX, n.position.x * SCALE + NODE_WIDTH + 60);
    maxY = Math.max(maxY, n.position.y * SCALE + NODE_HEIGHT + 60);
  }
  return { width: Math.max(maxX, 900), height: Math.max(maxY, 600) };
}

// build lookup: id → node
function nodeMap(nodes: RoadmapNode[]): Record<string, RoadmapNode> {
  return Object.fromEntries(nodes.map((n) => [n.id, n]));
}

// ----- sub-components -----------------------------------------------------

interface NodeCardProps {
  node: RoadmapNode;
  index: number;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, index }) => {
  const color = getNodeColor(index);
  const x = node.position.x * SCALE;
  const y = node.position.y * SCALE;

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: NODE_WIDTH,
        minHeight: NODE_HEIGHT,
        zIndex: 2,
      }}
      className="roadmap-node-card group"
    >
      {/* Gradient header strip */}
      <div
        className="roadmap-node-header"
        style={{
          background: `linear-gradient(135deg, ${color.from}, ${color.to})`,
        }}
      >
        <span className="roadmap-node-index">{index + 1}</span>
        <span className="roadmap-node-title">{node.data.title}</span>
        {node.data.link && (
          <a
            href={node.data.link}
            target="_blank"
            rel="noopener noreferrer"
            className="roadmap-node-link-btn"
            onClick={(e) => e.stopPropagation()}
            title="Open resource"
          >
            <LinkOutlined />
          </a>
        )}
      </div>

      {/* Body */}
      <div className="roadmap-node-body">
        <p className="roadmap-node-desc">{node.data.description}</p>
      </div>

      {/* Glow ring on hover */}
      <div
        className="roadmap-node-glow"
        style={{
          background: `linear-gradient(135deg, ${color.from}40, ${color.to}40)`,
        }}
      />
    </div>
  );
};

const DEFAULT_ROADMAP: RoadmapResponse = {
  roadmapTitle: "Software Engineer Learning Path",
  description:
    "A comprehensive journey from computer science fundamentals to advanced system architecture. This roadmap covers the essential technical skills, specialized tracks, and high-level design principles required for a modern software engineering career.",
  duration: "12-18 months",
  initialNodes: [
    {
      id: "1",
      type: "turbo",
      position: { x: 250, y: 0 },
      data: {
        title: "Programming Fundamentals",
        description:
          "Master the basics of a core language like Python, Java, or C++. Focus on variables, loops, and OOP.",
        link: "https://www.freecodecamp.org/learn/scientific-computing-with-python/python-for-beginners/",
      },
    },
    {
      id: "2",
      type: "turbo",
      position: { x: 250, y: 200 },
      data: {
        title: "Data Structures & Algorithms",
        description:
          "Learn how to organize data efficiently and solve complex problems using Big O notation and common patterns.",
        link: "https://www.geeksforgeeks.org/data-structures/",
      },
    },
    {
      id: "3",
      type: "turbo",
      position: { x: 250, y: 400 },
      data: {
        title: "Version Control (Git)",
        description:
          "Understand how to track changes, collaborate with teams, and manage code repositories using Git and GitHub.",
        link: "https://git-scm.com/doc",
      },
    },
    {
      id: "4",
      type: "turbo",
      position: { x: 250, y: 600 },
      data: {
        title: "Databases & Storage",
        description:
          "Learn Relational (PostgreSQL) and NoSQL (MongoDB) databases, including schema design and ACID properties.",
        link: "https://sqlzoo.net/",
      },
    },
    {
      id: "5a",
      type: "turbo",
      position: { x: -100, y: 850 },
      data: {
        title: "Frontend Specialization",
        description:
          "Build interactive user interfaces using HTML, CSS, JavaScript, and frameworks like React or Vue.",
        link: "https://developer.mozilla.org/en-US/docs/Learn",
      },
    },
    {
      id: "5b",
      type: "turbo",
      position: { x: 250, y: 850 },
      data: {
        title: "Backend Specialization",
        description:
          "Develop server-side logic, RESTful APIs, and authentication using Node.js, Go, or Ruby on Rails.",
        link: "https://roadmap.sh/backend",
      },
    },
    {
      id: "5c",
      type: "turbo",
      position: { x: 600, y: 850 },
      data: {
        title: "DevOps & Infrastructure",
        description:
          "Learn about containerization (Docker), orchestration (Kubernetes), and CI/CD pipelines.",
        link: "https://www.docker.com/get-started",
      },
    },
    {
      id: "6",
      type: "turbo",
      position: { x: 250, y: 1100 },
      data: {
        title: "System Design",
        description:
          "Design scalable, distributed systems. Learn about load balancing, caching, and microservices.",
        link: "https://github.com/donnemartin/system-design-primer",
      },
    },
    {
      id: "7",
      type: "turbo",
      position: { x: 250, y: 1300 },
      data: {
        title: "Testing & Quality Assurance",
        description:
          "Ensure code reliability through Unit, Integration, and End-to-End testing methodologies.",
        link: "https://www.atlassian.com/continuous-delivery/software-testing/types-of-software-testing",
      },
    },
  ],
  initialEdges: [
    { id: "e1-2", source: "1", target: "2" },
    { id: "e2-3", source: "2", target: "3" },
    { id: "e3-4", source: "3", target: "4" },
    { id: "e4-5a", source: "4", target: "5a" },
    { id: "e4-5b", source: "4", target: "5b" },
    { id: "e4-5c", source: "4", target: "5c" },
    { id: "e5a-6", source: "5a", target: "6" },
    { id: "e5b-6", source: "5b", target: "6" },
    { id: "e5c-6", source: "5c", target: "6" },
    { id: "e6-7", source: "6", target: "7" },
  ],
};

const Roadmap: React.FC = () => {
  const [role, setRole] = useState("Software Engineer");
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(
    DEFAULT_ROADMAP,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleGenerate = useCallback(async () => {
    const trimmedRole = role.trim();

    if (!trimmedRole) {
      setError("Please enter a target role to generate a roadmap.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await generateRoadmap(trimmedRole);
      setRoadmap(data);
      setHasGenerated(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Failed to generate roadmap.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [role]);

  const lookup = roadmap ? nodeMap(roadmap.initialNodes) : {};
  const canvas = roadmap
    ? canvasSize(roadmap.initialNodes)
    : { width: 0, height: 0 };

  return (
    <div className="roadmap-page">
      {/* ── Hero / Search ── */}
      <div className="roadmap-hero">
        <div className="roadmap-hero-bg" />
        <div className="roadmap-hero-content">
          <Title level={1} className="roadmap-hero-title">
            Your <span className="roadmap-hero-gradient">Career Roadmap</span>
          </Title>

          <Paragraph className="roadmap-hero-sub">
            Enter a target role and get a personalised step-by-step learning
            roadmap generated instantly by AI.
          </Paragraph>

          <div className="roadmap-search-row">
            <Input
              id="roadmap-role-input"
              size="large"
              placeholder="e.g. Software Engineer, Data Scientist…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              onPressEnter={handleGenerate}
              prefix={<SearchOutlined className="roadmap-search-icon" />}
              className="roadmap-search-input"
              disabled={loading}
            />
            <Button
              id="roadmap-generate-btn"
              type="primary"
              size="large"
              icon={hasGenerated ? <ReloadOutlined /> : <RocketOutlined />}
              loading={loading}
              onClick={handleGenerate}
              disabled={!role.trim()}
              className="roadmap-generate-btn"
            >
              {hasGenerated ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="roadmap-content-area">
        {/* Error */}
        {error && (
          <div className="roadmap-error-wrapper">
            <Alert
              type="error"
              message="Generation Failed"
              description={error}
              showIcon
              closable
              onClose={() => setError(null)}
            />
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="roadmap-loading">
            <Spin size="large" />
            <p className="roadmap-loading-text">
              Crafting your roadmap with AI…
            </p>
            <div className="roadmap-skeleton-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="roadmap-skeleton-card" />
              ))}
            </div>
          </div>
        )}

        {/* Roadmap info strip */}
        {roadmap && !loading && (
          <>
            <div className="roadmap-info-strip">
              <div className="roadmap-info-block">
                <Text className="roadmap-info-label">Roadmap</Text>
                <Text className="roadmap-info-value">
                  {roadmap.roadmapTitle}
                </Text>
              </div>
              <div className="roadmap-info-divider" />
              <div className="roadmap-info-block">
                <ClockCircleOutlined className="roadmap-info-clock" />
                <Text className="roadmap-info-value">{roadmap.duration}</Text>
              </div>
              <div className="roadmap-info-divider" />
              <div className="roadmap-info-block">
                <Text className="roadmap-info-label">Steps</Text>
                <Text className="roadmap-info-value">
                  {roadmap.initialNodes.length}
                </Text>
              </div>
            </div>

            {roadmap.description && (
              <p className="roadmap-description">{roadmap.description}</p>
            )}

            {/* ── Graph canvas ── */}
            <div className="roadmap-canvas-wrapper">
              <div
                ref={canvasRef}
                className="roadmap-canvas"
                style={{ width: canvas.width, height: canvas.height }}
              >
                {/* SVG edges */}
                <svg
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: canvas.width,
                    height: canvas.height,
                    zIndex: 1,
                    pointerEvents: "none",
                    overflow: "visible",
                  }}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#6366f1"
                        opacity="0.7"
                      />
                    </marker>
                  </defs>

                  {roadmap.initialEdges.map((edge) => {
                    const src = lookup[edge.source];
                    const tgt = lookup[edge.target];
                    if (!src || !tgt) return null;

                    const x1 = src.position.x * SCALE + NODE_WIDTH / 2;
                    const y1 = src.position.y * SCALE + NODE_HEIGHT;
                    const x2 = tgt.position.x * SCALE + NODE_WIDTH / 2;
                    const y2 = tgt.position.y * SCALE;

                    const midY = (y1 + y2) / 2;

                    return (
                      <path
                        key={edge.id}
                        d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                        fill="none"
                        stroke="url(#edgeGrad)"
                        strokeWidth="2"
                        strokeDasharray="6 3"
                        opacity="0.65"
                        markerEnd="url(#arrowhead)"
                      />
                    );
                  })}

                  {/* Gradient for edges */}
                  <defs>
                    <linearGradient
                      id="edgeGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Nodes */}
                {roadmap.initialNodes.map((node, i) => (
                  <NodeCard key={node.id} node={node} index={i} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Roadmap;
