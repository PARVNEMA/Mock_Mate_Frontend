export type LLMMode = "own_api_key" | "project_gemini_key";

export type LLMProvider = "gemini" | "openai" | "anthropic";

export type InterviewType = "TR" | "HR" | "MR" | "MIXED";

export type InterviewQuestion = {
  id: string;
  question_text: string;
  index: number;
};

export type StartInterviewResponse = {
  session_id: string;
  status: "active" | "pending" | "completed" | "aborted" | string;
  first_question: InterviewQuestion;
  llm_provider: LLMProvider;
  llm_mode: LLMMode;
};

export type InterviewSessionOut = {
  id: string;
  status: string;
  job_role: string;
  max_questions: number;
  current_question_index: number;
  llm_mode: LLMMode;
  llm_provider: LLMProvider;
  llm_model: string;
  started_at?: string | null;
  completed_at?: string | null;
};

export type InterviewEvaluation = {
  score?: number;
  feedback?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  [key: string]: unknown;
};

export type InterviewReport = {
  overall_score?: number;
  summary?: string;
  strengths?: string[] | string;
  weaknesses?: string[] | string;
  [key: string]: unknown;
};

export type WsEnvelope = {
  type: string;
  session_id: string;
  request_id?: string;
  payload?: Record<string, unknown>;
  ts?: string;
};

export type WsErrorPayload = {
  code: string;
  message: string;
};

export const isWsEnvelope = (value: unknown): value is WsEnvelope => {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.type === "string" && typeof v.session_id === "string";
};

