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
  Divider,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  InboxOutlined,
  RocketOutlined,
  SettingOutlined,
  FilePdfOutlined,
  LinkOutlined,
} from "@ant-design/icons";
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

const PROVIDER_LINKS: Record<string, { label: string; url: string }> = {
  gemini: {
    label: "Google AI Studio",
    url: "https://aistudio.google.com/app/apikey",
  },
  openai: {
    label: "OpenAI Dashboard",
    url: "https://platform.openai.com/api-keys",
  },
  anthropic: {
    label: "Anthropic Console",
    url: "https://console.anthropic.com/settings/keys",
  },
};

const isPdfFile = (file: File): boolean => {
  return (
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
  );
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  const e = err as any;
  return (
    e.response?.data?.detail ||
    e.response?.data?.message ||
    e.message ||
    "Unknown error"
  );
};

function InterviewSetup() {
  const navigate = useNavigate();
  const [form] = Form.useForm<SetupFormValues>();
  const [resumeFileList, setResumeFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // --- Real-time Validation Watchers ---
  const watchJobRole = Form.useWatch("job_role", form);
  const watchLlmMode = Form.useWatch("llm_mode", form);
  const watchApiKey = Form.useWatch("api_key", form);

  const isFormInvalid = useMemo(() => {
    const hasResume = resumeFileList.length > 0;
    const hasRole = watchJobRole && watchJobRole.trim() !== "";
    const needsKey = watchLlmMode === "own_api_key";
    const hasKey = watchApiKey && watchApiKey.trim() !== "";

    if (!hasResume || !hasRole) return true;
    if (needsKey && !hasKey) return true;
    return false;
  }, [resumeFileList, watchJobRole, watchLlmMode, watchApiKey]);

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const onSubmit = async (values: SetupFormValues) => {
    if (!accessToken) {
      message.error("Please sign in before starting.");
      navigate("/signin");
      return;
    }

    const resume = resumeFileList[0]?.originFileObj as File | undefined;
    if (!resume || !isPdfFile(resume)) {
      message.error("Please upload a valid PDF resume.");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("resume_file", resume);
      formData.append("job_role", values.job_role.trim());
      formData.append("max_questions", String(values.max_questions));
      formData.append("llm_mode", values.llm_mode);
      formData.append("llm_provider", values.llm_provider || "gemini");
      formData.append("interview_type", values.interview_type);

      if (values.llm_mode === "own_api_key") {
        formData.append("api_key", values.api_key?.trim() || "");
      }

      const started = await startInterview({ formData, accessToken });
      form.setFieldValue("api_key", "");
      navigate(`/interview/${started.session_id}`, {
        state: { firstQuestion: started.first_question },
      });
    } catch (err: unknown) {
      message.error(getErrorText(err));
    } finally {
      setSubmitting(false);
    }
  };

  const inputBase = `
        rounded-xl! h-11! transition-all!
        border-slate-200! dark:border-slate-800! 
        bg-white! dark:bg-slate-900! 
        text-slate-900! dark:text-slate-100! 
        placeholder:text-slate-400! dark:placeholder:text-slate-500!
        hover:border-indigo-500! dark:hover:border-indigo-400!
        focus:border-indigo-600! dark:focus:border-indigo-500!
        [&_input]:bg-transparent! [&_input]:dark:text-slate-100!
        [&_.ant-select-selector]:bg-transparent! [&_.ant-select-selector]:border-none!
        [&_.ant-input-number-input]:dark:text-slate-100!
        [&_.ant-input-password-icon_svg]:dark:fill-slate-400!
    `;

  const labelText =
    "text-slate-600 dark:text-slate-400 font-bold text-[13px] uppercase tracking-wider ml-1";

  return (
    <div className="max-w-7xl mx-auto min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 transition-colors duration-500 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-96 bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="mx-auto relative">
        <header className="mb-8! text-center! md:text-left">
          <Title
            level={2}
            className="text-5xl! font-black! tracking-tighter! text-slate-900! dark:text-white! mb-4"
          >
            Interview Setup
          </Title>
        </header>

        <Card className="rounded-3xl! shadow-xl dark:shadow-black/60 border border-slate-200! dark:border-slate-800! bg-white! dark:bg-slate-900! overflow-hidden">
          <Form<SetupFormValues>
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={DEFAULTS}
            onFinish={onSubmit}
            className="p-2 dark:[&_.ant-form-item-label_label]:text-slate-400"
          >
            {/* 1. Resume Upload Section */}
            <div className="">
              <div className="flex items-center gap-2 mb-4 ml-1">
                <FilePdfOutlined className="text-indigo-500!" />
                <span className={labelText}>Upload Resume</span>
              </div>
              <Upload.Dragger
                accept=".pdf"
                multiple={false}
                fileList={resumeFileList}
                beforeUpload={() => false}
                onChange={(info) => setResumeFileList(info.fileList.slice(-1))}
                onRemove={() => setResumeFileList([])}
                className="group bg-slate-50! dark:bg-slate-800/20! border-slate-200! dark:border-slate-800! hover:border-indigo-400! transition-all rounded-2xl! overflow-hidden"
              >
                <p className="ant-upload-drag-icon mb-2!">
                  <InboxOutlined className="text-indigo-500" />
                </p>
                <p className="ant-upload-text text-slate-700! dark:text-slate-300! font-semibold">
                  {resumeFileList.length > 0
                    ? "Resume Uploaded"
                    : "Click or drag PDF resume here"}
                </p>
                <p className="ant-upload-hint text-slate-500! dark:text-slate-500! text-xs">
                  {resumeFileList.length > 0
                    ? resumeFileList[0].name
                    : "AI parses your resume to generate personalized technical questions."}
                </p>
              </Upload.Dragger>
            </div>

            <Divider className="border-slate-100! dark:border-slate-800! my-2!" />

            {/* 2. Job Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-10!">
              <Form.Item
                name="job_role"
                label={<span className={labelText}>Target Job Role</span>}
                className="md:col-span-8"
              >
                <Input
                  placeholder="e.g. Senior MERN Stack Developer"
                  className={inputBase}
                />
              </Form.Item>

              <Form.Item
                name="max_questions"
                label={<span className={labelText}>Questions</span>}
                className="md:col-span-4"
              >
                <InputNumber
                  min={1}
                  max={30}
                  className={`${inputBase} w-full! flex! items-center! dark:[&_.ant-input-number-handler-wrap]:bg-slate-800! dark:[&_.ant-input-number-handler-wrap]:border-slate-700!`}
                />
              </Form.Item>
            </div>

            <Form.Item
              name="interview_type"
              label={<span className={labelText}>Session Focus</span>}
            >
              <Select
                className={inputBase}
                popupClassName="dark:bg-slate-900! dark:border-slate-800! [&_.ant-select-item]:dark:text-slate-300! [&_.ant-select-item-option-selected]:dark:bg-indigo-600!"
                options={[
                  { value: "TR", label: "Technical Round (TR)" },
                  { value: "HR", label: "Behavioral / HR Round" },
                  { value: "MR", label: "Managerial Round" },
                  { value: "MIXED", label: "Comprehensive (Mixed)" },
                ]}
              />
            </Form.Item>

            {/* 3. LLM Configuration Section */}
            <div className="flex items-center gap-2">
              <SettingOutlined className="text-indigo-500!" />
              <span className={labelText}>Engine Configuration</span>
            </div>

            <div className="p-2 mt-2 bg-slate-50! dark:bg-slate-800/30! rounded-2xl border border-slate-100 dark:border-slate-800">
              <Form.Item name="llm_mode" className="mb-0!">
                <Radio.Group
                  className="w-full"
                  onChange={(e) => {
                    if (e.target.value === "project_gemini_key") {
                      form.setFieldsValue({
                        llm_provider: "gemini",
                        api_key: "",
                      });
                    }
                  }}
                >
                  <div className="flex flex-col gap-4">
                    <Radio
                      value="project_gemini_key"
                      className="w-full! dark:text-slate-300!"
                    >
                      System Gemini Key (Default)
                    </Radio>
                    <Radio
                      value="own_api_key"
                      className="w-full! dark:text-slate-300!"
                    >
                      Personal API Key (BYOK)
                    </Radio>
                  </div>
                </Radio.Group>
              </Form.Item>

              <Form.Item shouldUpdate noStyle>
                {() => {
                  const mode = form.getFieldValue("llm_mode");
                  const provider = form.getFieldValue("llm_provider");
                  if (mode !== "own_api_key") return null;
                  const linkInfo = PROVIDER_LINKS[provider];

                  return (
                    <div>
                      <div className="grid grid-cols-1 animate-in fade-in duration-300 mt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Form.Item
                            name="llm_provider"
                            label={
                              <span className={labelText}>AI Provider</span>
                            }
                            rules={[{ required: true }]}
                          >
                            <Select
                              className={inputBase}
                              popupClassName="dark:bg-slate-900! [&_.ant-select-item]:dark:text-slate-300!"
                              options={[
                                { value: "gemini", label: "Google Gemini" },
                                { value: "openai", label: "OpenAI GPT" },
                                {
                                  value: "anthropic",
                                  label: "Anthropic Claude",
                                },
                              ]}
                            />
                          </Form.Item>

                          <Form.Item
                            name="api_key"
                            label={<span className={labelText}>API Key</span>}
                            rules={[
                              {
                                required: mode === "own_api_key",
                                message: "Key required",
                              },
                            ]}
                          >
                            <Input.Password
                              placeholder="Paste key here..."
                              className={inputBase}
                            />
                          </Form.Item>
                        </div>
                        {linkInfo && (
                          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                            <LinkOutlined className="text-indigo-500" />
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              Don't have a key? Get it from{" "}
                              <a
                                href={linkInfo.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline"
                              >
                                {linkInfo.label}
                              </a>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }}
              </Form.Item>
            </div>

            <div className="mt-4 mb-2">
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={submitting}
                disabled={isFormInvalid}
                icon={<RocketOutlined />}
                className={`h-14 rounded-2xl! font-bold! text-base! shadow-xl transition-all 
                  ${
                    isFormInvalid
                      ? "bg-slate-100! dark:bg-slate-800! text-slate-400! border-transparent! cursor-not-allowed"
                      : "bg-linear-to-r from-indigo-600 to-purple-600 border-none! text-white! shadow-indigo-500/20 active:scale-[0.98]"
                  } 
                  disabled:hover:text-gray-500!`}
              >
                Launch AI Interview
              </Button>
            </div>
          </Form>
        </Card>
      </div>
    </div>
  );
}

export default InterviewSetup;
