import axios from "axios";

export type ResumeAnalysisResult = {
  overallScore?: number;
  atsCompatibilityScore?: number;
  strengths?: string[];
  weaknesses?: string[];
  sectionFeedback?: Array<{
    section: string;
    feedback: string;
    score?: number;
  }>;
  missingKeywords?: string[];
  improvementSuggestions?: string[];
  summary?: string;
};

const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL || "")
  .trim()
  .replace(/\/$/, "");

const authHeaders = (accessToken: string) => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

const getStoredAccessToken = (): string =>
  String(localStorage.getItem("accessToken") || "").trim();

const resolveAccessToken = (accessToken?: string): string =>
  String(accessToken || "").trim() || getStoredAccessToken();

const isUnauthorized = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401;

const normalizeResume = (value: unknown): ResumeAnalysisResult => {
  if (!value || typeof value !== "object") {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const normalizeScore = (input: unknown): number | undefined => {
    if (typeof input === "number" && Number.isFinite(input)) {
      return input;
    }

    if (typeof input === "string" && input.trim() !== "") {
      const parsed = Number(input);
      return Number.isFinite(parsed) ? parsed : undefined;
    }

    return undefined;
  };

  return {
    overallScore: normalizeScore(raw.overall_score ?? raw.overallScore),
    atsCompatibilityScore: normalizeScore(
      raw.ats_compatibility_score ?? raw.atsCompatibilityScore,
    ),
    strengths: Array.isArray(raw.strengths)
      ? raw.strengths.map((item) => String(item))
      : undefined,
    weaknesses: Array.isArray(raw.weaknesses)
      ? raw.weaknesses.map((item) => String(item))
      : undefined,
    sectionFeedback: Array.isArray(raw.section_feedback)
      ? raw.section_feedback.map((item) => {
          const sectionItem = item as Record<string, unknown>;
          return {
            section: String(sectionItem.section || ""),
            feedback: String(sectionItem.feedback || ""),
            score: normalizeScore(sectionItem.score),
          };
        })
      : undefined,
    missingKeywords: Array.isArray(raw.missing_keywords)
      ? raw.missing_keywords.map((item) => String(item))
      : undefined,
    improvementSuggestions: Array.isArray(raw.improvement_suggestions)
      ? raw.improvement_suggestions.map((item) => String(item))
      : undefined,
    summary: String(raw.summary || "").trim() || undefined,
  };
};

const refreshAccessToken = async (): Promise<string> => {
  const refreshToken = String(
    localStorage.getItem("refreshToken") || "",
  ).trim();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await axios.post<{
    session?: { access_token?: string; refresh_token?: string };
  }>(`${backendBaseUrl}/auth/refresh`, { refresh_token: refreshToken });

  const session = response.data?.session;
  const nextAccessToken = String(session?.access_token || "").trim();
  const nextRefreshToken = String(
    session?.refresh_token || refreshToken,
  ).trim();

  if (!nextAccessToken) {
    throw new Error("Refresh failed: access token missing");
  }

  localStorage.setItem("accessToken", nextAccessToken);
  localStorage.setItem("refreshToken", nextRefreshToken);
  return nextAccessToken;
};

const withAuthRetry = async <T>(
  request: (token: string) => Promise<T>,
  accessToken?: string,
): Promise<T> => {
  const token = resolveAccessToken(accessToken);

  if (!token) {
    throw new Error("Missing access token");
  }

  try {
    return await request(token);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }
  }

  const refreshedToken = await refreshAccessToken();
  return request(refreshedToken);
};

export const uploadResume = async (params: {
  file: File;
  accessToken?: string;
  targetRole?: string;
}): Promise<ResumeAnalysisResult> => {
  const formData = new FormData();
  formData.append("resume_file", params.file, params.file.name);
  const targetRole = String(params.targetRole || "Software Engineer").trim();
  const query = new URLSearchParams({ target_role: targetRole }).toString();

  return withAuthRetry(async (token) => {
    const response = await axios.post<ResumeAnalysisResult>(
      `${backendBaseUrl}/resume/parse?${query}`,
      formData,
      {
        ...authHeaders(token),
      },
    );

    return normalizeResume(response.data);
  }, params.accessToken);
};
