import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Select, Upload, Button, message, Card, Typography } from "antd";
import { UploadOutlined, RobotOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { createPost, updatePost, generatePostContent } from "../services/blogApi";
import type { BlogPost } from "../types/blog";
import type { UploadFile } from "antd/es/upload/interface";

const { Text } = Typography;

interface CreatePostModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (post: BlogPost) => void;
  initialData?: Partial<BlogPost> | null;
  editingPost?: BlogPost | null;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({
  open,
  onClose,
  onSuccess,
  initialData,
  editingPost,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // AI Generator state inside modal
  const [showAiSection, setShowAiSection] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (editingPost) {
        form.setFieldsValue({
          title: editingPost.title,
          content: editingPost.content,
          visibility: editingPost.visibility || "PUBLIC",
        });
      } else if (initialData) {
        form.setFieldsValue({
          title: initialData.title || "",
          content: initialData.content || "",
          visibility: initialData.visibility || "PUBLIC",
        });
      } else {
        form.resetFields();
      }
      setFileList([]);
      setShowAiSection(false);
      setAiPrompt("");
    }
  }, [open, initialData, editingPost, form]);

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim()) {
      message.warning("Please enter a prompt or topic for AI generation.");
      return;
    }

    setAiLoading(true);
    try {
      const generatedText = await generatePostContent(aiPrompt);

      // Current title or suggest one
      const currentTitle = form.getFieldValue("title");
      if (!currentTitle) {
        const suggestedTitle =
          aiPrompt.length > 50 ? aiPrompt.substring(0, 50) + "..." : aiPrompt;
        form.setFieldsValue({ title: suggestedTitle });
      }

      form.setFieldsValue({ content: generatedText });
      message.success("AI content generated and populated into the editor!");
      setShowAiSection(false);
    } catch (err: any) {
      console.error(err);
      message.error(err.response?.data?.message || "Failed to generate AI content.");
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const rawFiles: File[] = fileList
        .map((f) => f.originFileObj as File)
        .filter(Boolean);

      let resultPost: BlogPost;
      if (editingPost) {
        resultPost = await updatePost(
          editingPost.id,
          values.title,
          values.content,
          values.visibility,
          rawFiles
        );
        message.success("Post updated successfully!");
      } else {
        resultPost = await createPost(
          values.title,
          values.content,
          values.visibility,
          rawFiles
        );
        message.success("Post published successfully!");
      }

      onSuccess(resultPost);
      onClose();
    } catch (err: any) {
      if (err.response?.data?.message) {
        message.error(err.response.data.message);
      } else if (err.response?.data?.detail) {
        message.error(err.response.data.detail);
      } else {
        message.error("Failed to save post.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div className="flex items-center justify-between pr-8">
          <span className="text-xl font-black text-slate-900 dark:text-white">
            {editingPost ? "Edit Blog / Note" : "Create New Blog / Note"}
          </span>
          <Button
            type="text"
            icon={<RobotOutlined className="text-indigo-600 dark:text-indigo-400" />}
            onClick={() => setShowAiSection(!showAiSection)}
            className="rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
          >
            {showAiSection ? "Close AI Writer" : "✨ Write with AI"}
          </Button>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={720}
      footer={[
        <Button key="cancel" onClick={onClose} className="rounded-xl font-semibold">
          Cancel
        </Button>,
        <Button
          key="submit"
          type="primary"
          loading={loading}
          onClick={handleSubmit}
          className="h-10 rounded-xl bg-indigo-600 font-bold hover:bg-indigo-500"
        >
          {editingPost ? "Update Post" : "Publish Post"}
        </Button>,
      ]}
      className="dark:bg-slate-900"
    >
      {/* Inline AI Generator Assistant */}
      {showAiSection && (
        <Card className="mb-4 mt-2 border-indigo-200 dark:border-slate-700 bg-indigo-50/60 dark:bg-slate-800/60 rounded-2xl shadow-inner">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Text className="font-bold text-indigo-700 dark:text-indigo-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ThunderboltOutlined /> AI Note Generator Assistant
              </Text>
              <Text className="text-[10px] text-slate-400">
                Populates your title & content directly
              </Text>
            </div>
            <Input.TextArea
              rows={2}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Write comprehensive study notes on Microservices Architecture design patterns..."
              className="rounded-xl text-sm"
            />
            <div className="flex justify-end gap-2">
              <Button
                size="small"
                onClick={() => setShowAiSection(false)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                type="primary"
                size="small"
                loading={aiLoading}
                onClick={handleGenerateAi}
                icon={<ThunderboltOutlined />}
                className="rounded-lg bg-linear-to-r from-indigo-600 to-purple-600 font-bold border-none"
              >
                Generate & Fill
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Form form={form} layout="vertical" className="mt-2 space-y-2">
        <Form.Item
          name="title"
          label={
            <span className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Title / Topic
            </span>
          }
          rules={[{ required: true, message: "Title is required" }]}
        >
          <Input
            placeholder="e.g. System Design Interview Notes: Distributed Caching"
            className="h-11 rounded-xl text-sm"
          />
        </Form.Item>

        <Form.Item
          name="visibility"
          label={
            <span className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Visibility
            </span>
          }
          initialValue="PUBLIC"
        >
          <Select className="h-11 rounded-xl">
            <Select.Option value="PUBLIC">🌍 Public (Everyone can view)</Select.Option>
            <Select.Option value="PRIVATE">🔒 Private (Only me)</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="content"
          label={
            <div className="flex items-center justify-between w-full">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Content / Notes
              </span>
              {!showAiSection && (
                <button
                  type="button"
                  onClick={() => setShowAiSection(true)}
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <RobotOutlined /> Write with AI
                </button>
              )}
            </div>
          }
          rules={[{ required: true, message: "Content is required" }]}
        >
          <Input.TextArea
            rows={8}
            placeholder="Write your study notes, insights, or interview questions here... (or click 'Write with AI' above)"
            className="rounded-xl text-sm"
          />
        </Form.Item>

        <Form.Item
          label={
            <span className="font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Attachments / Images (Optional)
            </span>
          }
        >
          <Upload
            fileList={fileList}
            beforeUpload={() => false}
            onChange={({ fileList: newFileList }) => setFileList(newFileList)}
            multiple
            listType="picture"
          >
            <Button icon={<UploadOutlined />} className="rounded-xl font-semibold">
              Select Image Files
            </Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default CreatePostModal;
