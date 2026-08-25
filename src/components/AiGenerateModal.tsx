import React, { useState } from "react";
import { Modal, Input, Button, message, Typography, Card, Spin } from "antd";
import { RobotOutlined, ThunderboltOutlined, CheckOutlined } from "@ant-design/icons";
import { generatePostContent } from "../services/blogApi";

const { Text, Title } = Typography;

interface AiGenerateModalProps {
  open: boolean;
  onClose: () => void;
  onUseGeneratedContent: (title: string, content: string) => void;
}

const AiGenerateModal: React.FC<AiGenerateModalProps> = ({
  open,
  onClose,
  onUseGeneratedContent,
}) => {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string>("");

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      message.warning("Please enter a topic or prompt for AI generation.");
      return;
    }

    setLoading(true);
    try {
      const content = await generatePostContent(prompt);
      setGeneratedContent(content);
      message.success("AI Content generated successfully!");
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to generate content.");
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const suggestedTitle =
      prompt.length > 50 ? prompt.substring(0, 50) + "..." : prompt;
    onUseGeneratedContent(suggestedTitle, generatedContent);
    setPrompt("");
    setGeneratedContent("");
    onClose();
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <RobotOutlined className="text-2xl" />
          <span className="text-xl font-black text-slate-900 dark:text-white">
            Generate Blog / Notes with AI ✨
          </span>
        </div>
      }
      open={open}
      onCancel={() => {
        setPrompt("");
        setGeneratedContent("");
        onClose();
      }}
      footer={null}
      width={700}
      className="dark:bg-slate-900"
    >
      <div className="py-4 space-y-4">
        <Text className="text-slate-600 dark:text-slate-300 block text-sm font-medium">
          Enter what you want AI to write about. For example: *"System Design principles for Senior Frontend Engineers"* or *"Top 10 Java Concurrent Data Structures with Examples"*.
        </Text>

        <div className="flex gap-2">
          <Input.TextArea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe topic or paste notes outline..."
            rows={3}
            className="rounded-xl text-sm"
          />
        </div>

        <Button
          type="primary"
          block
          loading={loading}
          onClick={handleGenerate}
          className="h-11 rounded-xl bg-linear-to-r from-indigo-600 to-purple-600 border-none font-bold text-base shadow-md hover:opacity-90"
        >
          {loading ? "Generating Notes..." : "Generate AI Content"}
        </Button>

        {loading && (
          <div className="py-12 text-center">
            <Spin size="large" />
            <Text className="block mt-4 text-slate-500 font-medium animate-pulse">
              Crafting comprehensive study notes with AI...
            </Text>
          </div>
        )}

        {generatedContent && !loading && (
          <Card className="mt-4 border-indigo-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-slate-800/40 rounded-2xl shadow-inner">
            <div className="flex items-center justify-between mb-3 border-b border-indigo-100 dark:border-slate-700 pb-2">
              <Title level={5} className="m-0! text-indigo-700! dark:text-indigo-300! font-bold flex items-center gap-2">
                <ThunderboltOutlined /> Generated Draft Preview
              </Title>
              <Button
                type="primary"
                onClick={handleApply}
                icon={<CheckOutlined />}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold"
              >
                Use in Editor
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 p-2 font-mono leading-relaxed">
              {generatedContent}
            </div>
          </Card>
        )}
      </div>
    </Modal>
  );
};

export default AiGenerateModal;
