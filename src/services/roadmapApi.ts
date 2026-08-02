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
  const response = await axios.post<RoadmapResponse>(
    `${baseUrl}/roadmap/generate`,
    null,
    {
      params: { target_role: targetRole },
      headers: {
        Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
      },
    },
  );
  return response.data;
};
