import { useState } from "react";
import {
  Upload,
  Input,
  Button,
  Card,
  Typography,
  Select,
  InputNumber,
  Radio,
  message,
} from "antd";
import {
  InboxOutlined,
  RocketOutlined,
  KeyOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const { Title, Text } = Typography;
const { Dragger } = Upload;

const InterviewSelector = () => {
  const [file, setFile] = useState<File | null>(null);
  const [jobRole, setJobRole] = useState("");
  const [maxQuestions, setMaxQuestions] = useState(8);
  const [llmMode, setLlmMode] = useState("project_gemini_key");
  const [llmProvider, setLlmProvider] = useState("gemini");
  const [apiKey, setApiKey] = useState("");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleStartInterview = async () => {
    if (!file || !jobRole) {
      return message.error("Please upload a resume and specify a job role.");
    }

    if (llmMode === "own_api_key" && !apiKey) {
      return message.error("Please provide your API key.");
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("resume_file", file);
    formData.append("job_role", jobRole);
    formData.append("max_questions", maxQuestions.toString());
    formData.append("llm_mode", llmMode);

    // If using project key, force gemini. Otherwise, use the selection.
    const finalProvider =
      llmMode === "project_gemini_key" ? "gemini" : llmProvider;
    formData.append("llm_provider", finalProvider);

    if (llmMode === "own_api_key") {
      formData.append("api_key", apiKey);
    }

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/interviews/start`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
          },
        },
      );

      message.success("Interview session initialized!");
      navigate(`/interview/${data.session_id}`, {
        state: {
          initialQuestion: data.first_question,
          provider: finalProvider,
        },
      });
    } catch (error: any) {
      console.error(error);
      message.error(
        error.response?.data?.detail || "Failed to start interview.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <div className="text-center mb-10">
        <Title level={2} className="mb-2">
          AI Interview Setup
        </Title>
        <Text className="text-slate-500">
          Configure your session and upload your resume to begin.
        </Text>
      </div>

      <Card className="rounded-2xl shadow-sm border-slate-100 p-2">
        <div className="space-y-6">
          {/* 1. Resume Upload */}
          <div>
            <Text strong className="block mb-3 text-slate-700">
              1. Upload Resume (PDF/DOCX)
            </Text>
            <Dragger
              beforeUpload={(file) => {
                setFile(file);
                return false;
              }}
              maxCount={1}
              onRemove={() => setFile(null)}
              className="bg-slate-50 border-2 border-dashed border-slate-200 hover:border-indigo-400 transition-colors"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined className="text-indigo-500" />
              </p>
              <p className="ant-upload-text font-medium">
                Click or drag resume to this area
              </p>
              <p className="ant-upload-hint text-xs">
                Only .pdf or .docx files are supported
              </p>
            </Dragger>
          </div>

          {/* 2. Job Role & 3. Max Questions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Text strong className="block mb-2 text-slate-700">
                2. Target Job Role
              </Text>
              <Input
                placeholder="e.g. Senior Backend Engineer"
                value={jobRole}
                onChange={(e) => setJobRole(e.target.value)}
                className="rounded-lg h-11"
              />
            </div>
            <div>
              <Text strong className="block mb-2 text-slate-700">
                3. Question Count
              </Text>
              <InputNumber
                min={1}
                max={20}
                value={maxQuestions}
                onChange={(val) => setMaxQuestions(val || 8)}
                className="w-full rounded-lg h-11 flex items-center"
              />
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* 4. LLM Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <SettingOutlined className="text-indigo-500" />
              <Text strong className="text-slate-700">
                Interview Engine Configuration
              </Text>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
              <Text className="block mb-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Connection Mode
              </Text>
              <Radio.Group
                value={llmMode}
                onChange={(e) => setLlmMode(e.target.value)}
                className="w-full"
              >
                <div className="flex flex-col gap-3">
                  <Radio value="project_gemini_key" className="m-0">
                    <span className="text-sm">Use System Default (Gemini)</span>
                  </Radio>
                  <Radio value="own_api_key" className="m-0">
                    <span className="text-sm">Use Personal API Key</span>
                  </Radio>
                </div>
              </Radio.Group>

              {/* Only show Provider and API Key if "own_api_key" is selected */}
              {llmMode === "own_api_key" && (
                <div className="mt-6 pt-4 border-t border-slate-200 space-y-4 animate-in fade-in duration-300">
                  <div>
                    <Text className="block mb-2 text-sm text-slate-600">
                      Select Provider
                    </Text>
                    <Select
                      value={llmProvider}
                      onChange={setLlmProvider}
                      className="w-full h-10"
                      options={[
                        { value: "gemini", label: "Google Gemini" },
                        { value: "openai", label: "OpenAI GPT" },
                        { value: "anthropic", label: "Anthropic Claude" },
                      ]}
                    />
                  </div>

                  <div>
                    <Text className="block mb-2 text-sm text-slate-600">
                      Enter API Key
                    </Text>
                    <Input.Password
                      prefix={<KeyOutlined className="text-slate-400" />}
                      placeholder={`${llmProvider.toUpperCase()} API Key`}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="rounded-lg h-10"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            type="primary"
            block
            size="large"
            onClick={handleStartInterview}
            loading={loading}
            icon={<RocketOutlined />}
            className="bg-indigo-600 hover:bg-indigo-700 h-14 rounded-xl font-bold shadow-lg shadow-indigo-100 border-none mt-4"
          >
            Start Interview Session
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default InterviewSelector;
