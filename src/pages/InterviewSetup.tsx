import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  message,
  Radio,
  Select,
  Typography,
  Upload,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { InboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { startInterview } from "../services/interviewApi";
import type { InterviewType, LLMMode, LLMProvider } from "../types/interview";

const { Title, Text } = Typography;

type SetupFormValues = {
  job_role: string;
  max_questions: number;
  interview_type: InterviewType;
  llm_mode: LLMMode;
  llm_provider: LLMProvider;
  api_key?: string;
};

const DEFAULTS: SetupFormValues = {
  job_role: "",
  max_questions: 8,
  interview_type: "TR",
  llm_mode: "project_gemini_key",
  llm_provider: "gemini",
  api_key: "",
};

const isPdfFile = (file: File): boolean => {
  const byType = file.type === "application/pdf";
  const byName = file.name.toLowerCase().endsWith(".pdf");
  return byType || byName;
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (!err || typeof err !== "object") return "Unknown error";
  const e = err as { message?: unknown; response?: unknown };
  const messageText = typeof e.message === "string" ? e.message : "";
  const response = e.response as
    | { data?: { detail?: unknown; message?: unknown } }
    | undefined;
  const detail = response?.data?.detail;
  const apiMessage = response?.data?.message;
  if (typeof detail === "string") return detail;
  if (typeof apiMessage === "string") return apiMessage;
  return messageText || "Unknown error";
};

function InterviewSetup() {
  const navigate = useNavigate();
  const [form] = Form.useForm<SetupFormValues>();

  const [resumeFileList, setResumeFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const onSubmit = async (values: SetupFormValues) => {
    if (!accessToken) {
      message.error("Please sign in before starting an interview.");
      navigate("/signin");
      return;
    }

    const resume = resumeFileList[0]?.originFileObj as File | undefined;
    if (!resume) {
      message.error("Please upload your resume PDF.");
      return;
    }
    if (!isPdfFile(resume)) {
      message.error("Resume must be a PDF file.");
      return;
    }

    // Enforce backend validation rules client-side to provide immediate feedback.
    if (values.llm_mode === "project_gemini_key") {
      if (values.llm_provider !== "gemini") {
        message.error("Project key mode only supports Gemini.");
        return;
      }
    } else {
      if (!values.api_key?.trim()) {
        message.error("Please enter your API key for BYOK mode.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("resume_file", resume);
      formData.append("job_role", values.job_role.trim());
      formData.append("max_questions", String(values.max_questions ?? 8));
      formData.append("llm_mode", values.llm_mode);
      formData.append("llm_provider", values.llm_provider);
      formData.append("interview_type", values.interview_type);

      // Only send api_key when the backend expects it.
      if (values.llm_mode === "own_api_key") {
        formData.append("api_key", values.api_key?.trim() || "");
      }

      const started = await startInterview({ formData, accessToken });

      // Never persist keys; clear input state after the request completes.
      form.setFieldValue("api_key", "");

      navigate(`/interview/${started.session_id}`, {
        state: { firstQuestion: started.first_question },
      });
    } catch (err: unknown) {
      message.error(getErrorText(err) || "Failed to start interview.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <Title level={2} className="m-0! tracking-tight">
            Start an AI Interview
          </Title>
          <Text className="text-slate-500">
            Upload your resume and choose how the interviewer should run the
            session.
          </Text>
        </header>

        <Card className="rounded-2xl shadow-sm border border-slate-100">
          <Form<SetupFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={DEFAULTS}
            onFinish={onSubmit}
          >
            <Form.Item
              label={<span className="text-slate-700 font-medium">Resume</span>}
              required
            >
              <Upload.Dragger
                accept=".pdf,application/pdf"
                multiple={false}
                fileList={resumeFileList}
                beforeUpload={() => false}
                onChange={(info) => {
                  // Keep only the latest file to match backend expectation.
                  setResumeFileList(info.fileList.slice(-1));
                }}
                onRemove={() => {
                  setResumeFileList([]);
                }}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Click or drag a PDF resume here
                </p>
                <p className="ant-upload-hint">
                  Your resume is uploaded for parsing and interview generation.
                </p>
              </Upload.Dragger>
            </Form.Item>

            <Form.Item
              name="job_role"
              label={
                <span className="text-slate-700 font-medium">Job Role</span>
              }
              rules={[
                { required: true, message: "Please enter a job role." },
                { min: 2, max: 120, message: "Job role must be 2-120 chars." },
              ]}
            >
              <Input
                placeholder="e.g. Frontend Developer (React)"
                className="h-11 rounded-xl"
              />
            </Form.Item>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Form.Item
                name="max_questions"
                label={
                  <span className="text-slate-700 font-medium">
                    Max Questions
                  </span>
                }
                rules={[{ required: true, message: "Enter max questions." }]}
              >
                <InputNumber
                  min={1}
                  max={30}
                  className="w-full h-11"
                />
              </Form.Item>

              <Form.Item
                name="interview_type"
                label={
                  <span className="text-slate-700 font-medium">
                    Interview Type
                  </span>
                }
                rules={[{ required: true, message: "Select interview type." }]}
              >
                <Select
                  options={[
                    { value: "TR", label: "Technical (TR)" },
                    { value: "HR", label: "HR / Behavioral (HR)" },
                    { value: "MR", label: "Managerial (MR)" },
                    { value: "MIXED", label: "Mixed (MIXED)" },
                  ]}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="llm_mode"
              label={
                <span className="text-slate-700 font-medium">LLM Mode</span>
              }
            >
              <Radio.Group
                onChange={(e) => {
                  const nextMode = e.target.value as LLMMode;
                  if (nextMode === "project_gemini_key") {
                    // Backend requires provider=gemini and forbids api_key in project mode.
                    form.setFieldValue("llm_provider", "gemini");
                    form.setFieldValue("api_key", "");
                  }
                }}
              >
                <Radio value="project_gemini_key">Use project Gemini key</Radio>
                <Radio value="own_api_key">Use my own API key (BYOK)</Radio>
              </Radio.Group>
            </Form.Item>

            <Form.Item shouldUpdate noStyle>
              {() => {
                const mode = form.getFieldValue("llm_mode") as LLMMode;
                const providerDisabled = mode === "project_gemini_key";
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Form.Item
                      name="llm_provider"
                      label={
                        <span className="text-slate-700 font-medium">
                          Provider
                        </span>
                      }
                      rules={[
                        { required: true, message: "Select an LLM provider." },
                      ]}
                    >
                      <Select
                        disabled={providerDisabled}
                        options={[
                          { value: "gemini", label: "Gemini" },
                          { value: "openai", label: "OpenAI" },
                          { value: "anthropic", label: "Anthropic" },
                        ]}
                      />
                    </Form.Item>

                    <Form.Item
                      name="api_key"
                      label={
                        <span className="text-slate-700 font-medium">
                          API Key
                        </span>
                      }
                      rules={
                        mode === "own_api_key"
                          ? [{ required: true, message: "API key is required." }]
                          : []
                      }
                    >
                      <Input.Password
                        disabled={mode !== "own_api_key"}
                        placeholder={
                          mode === "own_api_key"
                            ? "Paste your API key (used for this session only)"
                            : "Not required for project key mode"
                        }
                        className="h-11 rounded-xl"
                      />
                    </Form.Item>
                  </div>
                );
              }}
            </Form.Item>

            <div className="flex gap-3 mt-2">
              <Button onClick={() => navigate("/")} className="rounded-xl">
                Cancel
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={submitting}
                className="rounded-xl bg-indigo-600 border-none"
              >
                Start Interview
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default InterviewSetup;
