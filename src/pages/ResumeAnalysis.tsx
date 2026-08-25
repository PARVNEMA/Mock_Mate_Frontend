import { useState } from "react";
import {
  Button,
  Card,
  Divider,
  Input,
  Tag,
  Typography,
  Upload,
  message,
  Descriptions,
  List,
} from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import {
  FilePdfOutlined,
  InboxOutlined,
  CheckCircleOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { uploadResume, type ResumeAnalysisResult } from "../services/resumeApi";

const { Title, Text, Paragraph } = Typography;

const isPdfFile = (file: File): boolean =>
  file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

const getErrorText = (error: unknown): string => {
  if (typeof error === "string") {
    return error;
  }

  const err = error as {
    response?: { data?: { detail?: string; message?: string } };
    message?: string;
  };

  return String(
    err.response?.data?.detail ||
      err.response?.data?.message ||
      err.message ||
      "Unknown error",
  );
};

const ResumeAnalysis = () => {
  const [resumeFileList, setResumeFileList] = useState<UploadFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [targetRole, setTargetRole] = useState("Software Engineer");
  const [selectedResume, setSelectedResume] =
    useState<ResumeAnalysisResult | null>(null);

  const onUpload = async () => {
    const accessToken = String(localStorage.getItem("accessToken") || "").trim();
    if (!accessToken) {
      message.warning("Please sign in before using resume analysis.");
      return;
    }

    const file = resumeFileList[0]?.originFileObj as File | undefined;
    if (!file || !isPdfFile(file)) {
      message.error("Please upload a valid PDF resume.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await uploadResume({
        file,
        accessToken,
        targetRole: targetRole.trim() || "Software Engineer",
      });
      setSelectedResume(result);
      setResumeFileList([]);
      message.success("Resume analysis completed.");
    } catch (error) {
      message.error(getErrorText(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <div className="mb-8 text-center md:text-left">
        <Title
          level={2}
          className="mb-2! text-4xl! font-black! tracking-tight! text-slate-900! dark:text-white!"
        >
          Resume Analysis
        </Title>
        <Text className="text-slate-500! dark:text-slate-400!">
          Upload a PDF and analyze it against the backend resume parser.
        </Text>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-3xl! border border-slate-200! bg-white! dark:border-slate-800! dark:bg-slate-900!">
          <div className="mb-4 flex items-center gap-2">
            <FilePdfOutlined className="text-indigo-500!" />
            <Text className="font-bold uppercase tracking-widest text-slate-500! dark:text-slate-400!">
              Upload PDF Resume
            </Text>
          </div>

          <Input
            size="large"
            value={targetRole}
            onChange={(event) => setTargetRole(event.target.value)}
            placeholder="Enter target role for resume analysis"
            className="mb-4"
          />

          <Upload.Dragger
            accept=".pdf"
            multiple={false}
            fileList={resumeFileList}
            beforeUpload={() => false}
            onChange={(info) => setResumeFileList(info.fileList.slice(-1))}
            onRemove={() => setResumeFileList([])}
          >
            <p className="ant-upload-drag-icon mb-2!">
              <InboxOutlined className="text-indigo-500" />
            </p>
            <p className="ant-upload-text text-slate-700! dark:text-slate-300! font-semibold">
              {resumeFileList.length > 0
                ? "Resume ready to analyze"
                : "Click or drag a PDF here"}
            </p>
            <p className="ant-upload-hint text-slate-500! dark:text-slate-500! text-xs">
              {resumeFileList.length > 0
                ? resumeFileList[0].name
                : "Upload the resume to receive ATS and role-fit analysis."}
            </p>
          </Upload.Dragger>

          <Button
            type="primary"
            size="large"
            loading={submitting}
            onClick={onUpload}
            className="mt-4 h-11! rounded-xl! bg-indigo-600!"
          >
            Analyze Resume
          </Button>
        </Card>

        <Card className="rounded-3xl! border border-slate-200! bg-white! dark:border-slate-800! dark:bg-slate-900!">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircleOutlined className="text-emerald-500!" />
            <Text className="font-bold uppercase tracking-widest text-slate-500! dark:text-slate-400!">
              Latest Resume Insight
            </Text>
          </div>

          {selectedResume ? (
            <div className="space-y-4">
              <Descriptions
                bordered
                column={1}
                size="small"
                className="dark:[&_.ant-descriptions-title]:text-white!"
              >
                <Descriptions.Item label="Overall Score">
                  {selectedResume.overallScore ?? "Not available"}
                </Descriptions.Item>
                <Descriptions.Item label="ATS Compatibility">
                  {selectedResume.atsCompatibilityScore ?? "Not available"}
                </Descriptions.Item>
              </Descriptions>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  Strengths
                </Text>
                <div className="flex flex-wrap gap-2">
                  {(selectedResume.strengths?.length
                    ? selectedResume.strengths
                    : ["No strengths returned by the backend."]
                  ).map((item) => (
                    <Tag key={item} color="processing">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  Weaknesses
                </Text>
                <ul className="list-disc space-y-1 pl-5 text-slate-600! dark:text-slate-300!">
                  {(selectedResume.weaknesses?.length
                    ? selectedResume.weaknesses
                    : ["No weaknesses returned by the backend."]
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  Section Feedback
                </Text>
                <List
                  dataSource={selectedResume.sectionFeedback ?? []}
                  locale={{ emptyText: "No section feedback available." }}
                  renderItem={(item) => (
                    <List.Item>
                      <div>
                        <Text strong>{item.section}</Text>
                        <div className="text-slate-600! dark:text-slate-300!">
                          {item.feedback}
                        </div>
                        {typeof item.score === "number" ? (
                          <Tag color="gold">Score: {item.score}</Tag>
                        ) : null}
                      </div>
                    </List.Item>
                  )}
                />
              </div>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  Missing Keywords
                </Text>
                <div className="flex flex-wrap gap-2">
                  {(selectedResume.missingKeywords?.length
                    ? selectedResume.missingKeywords
                    : ["No missing keywords returned by the backend."]
                  ).map((item) => (
                    <Tag key={item} color="error">
                      {item}
                    </Tag>
                  ))}
                </div>
              </div>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  Improvement Suggestions
                </Text>
                <ul className="list-disc space-y-1 pl-5 text-slate-600! dark:text-slate-300!">
                  {(selectedResume.improvementSuggestions?.length
                    ? selectedResume.improvementSuggestions
                    : ["No improvement suggestions returned by the backend."]
                  ).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <Text
                  strong
                  className="block mb-2 text-slate-700! dark:text-slate-200!"
                >
                  AI Summary
                </Text>
                <Paragraph className="text-slate-600! dark:text-slate-300!">
                  {selectedResume.summary ||
                    "No summary returned by the backend yet."}
                </Paragraph>
              </div>
            </div>
          ) : (
            <Text className="text-slate-500! dark:text-slate-400!">
              No resume analysis results yet. Upload a PDF to begin.
            </Text>
          )}
        </Card>
      </div>

      <Divider className="my-8! border-slate-200! dark:border-slate-800!" />

      <Card className="rounded-3xl! border border-slate-200! bg-white! dark:border-slate-800! dark:bg-slate-900!">
        <div className="mb-4 flex items-center gap-2">
          <UserOutlined className="text-indigo-500!" />
          <Text className="font-bold uppercase tracking-widest text-slate-500! dark:text-slate-400!">
            Resume Output Contract
          </Text>
        </div>

        <Text className="text-slate-500! dark:text-slate-400!">
          The frontend now consumes the score-based response shape returned by
          the parser endpoint, including ATS score, strengths, weaknesses,
          section feedback, missing keywords, and improvement suggestions.
        </Text>
      </Card>
    </div>
  );
};

export default ResumeAnalysis;
