import axios from "axios";
import type { RoadmapResponse } from "../types/roadmap";

const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL || "").replace(
  /\/$/,
  "",
);

const requireBackendBaseUrl = (): string => {
  if (!backendBaseUrl) {
    throw new Error("Missing VITE_BACKEND_URL in .env");
  }
  return backendBaseUrl;
};

export const generateRoadmap = async (
  targetRole: string = "Software Engineer",
): Promise<RoadmapResponse> => {
  const baseUrl = requireBackendBaseUrl();
  const rawToken = localStorage.getItem("accessToken");
  const token = String(rawToken || "").trim();
  const headers: Record<string, string> = {};

  if (token && token !== "undefined" && token !== "null") {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await axios.post<RoadmapResponse>(
    `${baseUrl}/roadmap/generate`,
    null,
    {
      params: { target_role: targetRole },
      headers,
    },
  );
  return response.data;
};
