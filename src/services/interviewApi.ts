import axios from "axios";
import type {
  InterviewReport,
  InterviewSessionOut,
  StartInterviewResponse,
} from "../types/interview";

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

const authHeaders = (accessToken: string) => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

const getStoredAccessToken = (): string =>
  String(localStorage.getItem("accessToken") || "").trim();

const getStoredRefreshToken = (): string =>
  String(localStorage.getItem("refreshToken") || "").trim();

const saveSessionTokens = (
  accessToken: string,
  refreshToken?: string | null,
): void => {
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};

const isUnauthorized = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401;

const resolveAccessToken = (accessToken?: string): string =>
  String(accessToken || "").trim() || getStoredAccessToken();

const refreshAccessToken = async (): Promise<string> => {
  const baseUrl = requireBackendBaseUrl();
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await axios.post<{
    session?: { access_token?: string; refresh_token?: string };
  }>(`${baseUrl}/auth/refresh`, { refresh_token: refreshToken });

  const session = response.data?.session;
  const nextAccessToken = String(session?.access_token || "").trim();
  const nextRefreshToken = String(session?.refresh_token || "").trim();

  if (!nextAccessToken) {
    throw new Error("Refresh failed: access token missing");
  }

  saveSessionTokens(nextAccessToken, nextRefreshToken || refreshToken);
  return nextAccessToken;
};

const withAuthRetry = async <T>(
  request: (token: string) => Promise<T>,
  initialToken?: string,
): Promise<T> => {
  const token = resolveAccessToken(initialToken);
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

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const asString = (value: unknown): string => String(value || "").trim();

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeSession = (payload: unknown): InterviewSessionOut => {
  const raw = asRecord(payload);
  const session = asRecord(raw?.session) ?? raw ?? {};

  return {
    id: asString(session.id ?? session.session_id),
    status: asString(session.status),
    job_role: asString(session.job_role),
    max_questions: asNumber(
      session.max_questions ?? session.total_questions,
      0,
    ),
    current_question_index: asNumber(
      session.current_question_index ?? session.question_index,
      0,
    ),
    llm_mode: asString(session.llm_mode) as InterviewSessionOut["llm_mode"],
    llm_provider: asString(
      session.llm_provider,
    ) as InterviewSessionOut["llm_provider"],
    llm_model: asString(session.llm_model),
    started_at: session.started_at ? asString(session.started_at) : null,
    completed_at: session.completed_at ? asString(session.completed_at) : null,
  };
};

const normalizeReport = (payload: unknown): InterviewReport => {
  const raw = asRecord(payload);
  return (asRecord(raw?.report) ?? raw ?? {}) as InterviewReport;
};

const normalizeStartResponse = (payload: unknown): StartInterviewResponse => {
  const raw = asRecord(payload);
  const session = asRecord(raw?.session);
  const firstQuestion = asRecord(raw?.first_question);

  return {
    session_id: asString(raw?.session_id ?? session?.id ?? session?.session_id),
    status: asString(raw?.status ?? session?.status),
    first_question: {
      id: asString(firstQuestion?.id ?? firstQuestion?.question_id),
      question_text: asString(firstQuestion?.question_text),
      index: asNumber(firstQuestion?.index ?? firstQuestion?.question_index, 0),
    },
    llm_provider: asString(
      raw?.llm_provider ?? session?.llm_provider,
    ) as StartInterviewResponse["llm_provider"],
    llm_mode: asString(
      raw?.llm_mode ?? session?.llm_mode,
    ) as StartInterviewResponse["llm_mode"],
  };
};

export const startInterview = async (params: {
  formData: FormData;
  accessToken: string;
}): Promise<StartInterviewResponse> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.post<StartInterviewResponse>(
      `${baseUrl}/interviews/start`,
      params.formData,
      {
        ...authHeaders(token),
        // Let Axios set the proper boundary header; we just signal multipart intent.
        headers: {
          ...authHeaders(token).headers,
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return normalizeStartResponse(response.data);
  }, params.accessToken);
};

export const getInterviewSession = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewSessionOut> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get<InterviewSessionOut>(
      `${baseUrl}/interviews/${params.sessionId}`,
      authHeaders(token),
    );
    return normalizeSession(response.data);
  }, params.accessToken);
};

export const finishInterview = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewReport> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.post<InterviewReport>(
      `${baseUrl}/interviews/${params.sessionId}/finish`,
      {},
      authHeaders(token),
    );
    return normalizeReport(response.data);
  }, params.accessToken);
};

export const getInterviewReport = async (params: {
  sessionId: string;
  accessToken: string;
}): Promise<InterviewReport> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get<InterviewReport>(
      `${baseUrl}/interviews/${params.sessionId}/report`,
      authHeaders(token),
    );
    return normalizeReport(response.data);
  }, params.accessToken);
};

