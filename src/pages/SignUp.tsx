import React, { useState } from "react";
import {
  Button,
  Form,
  Input,
  Typography,
  Upload,
  message,
  Divider,
} from "antd";
import {
  LockOutlined,
  MailOutlined,
  RocketOutlined,
  UserOutlined,
  PlusOutlined,
  LoadingOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UploadChangeParam } from "antd/es/upload";
import type { RcFile, UploadFile } from "antd/es/upload/interface";

const { Title, Text } = Typography;

type FieldType = {
  fullname?: string;
  email?: string;
  password?: string;
  avatar?: string;
};

const SignUp: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();

  const [loadingAvatar, setLoadingAvatar] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>("");

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  const getBase64 = (img: RcFile, callback: (url: string) => void) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => callback(reader.result as string));
    reader.readAsDataURL(img);
  };

  const handleAvatarChange = (info: UploadChangeParam<UploadFile>) => {
    if (info.file.status === "uploading") {
      setLoadingAvatar(true);
      return;
    }
    if (info.file.status === "done" || info.file.originFileObj) {
      getBase64(info.file.originFileObj as RcFile, (url) => {
        setLoadingAvatar(false);
        setImageUrl(url);
      });
    }
  };

  const onFinish = async (values: FieldType) => {
    setSubmitting(true);
    try {
      const payload = {
        fullname: values.fullname,
        email: values.email,
        password: values.password,
        avatar: imageUrl,
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/signup`,
        payload,
      );

      login(
        data.user.email,
        data.session.access_token,
        data.session.refresh_token,
        data.user.id,
      );

      // Auto-trigger profile fetch to ensure DB sync
      await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/profiles/me`,
        getAuthHeaders(),
      );

      message.success("Welcome aboard!");
      navigate("/");
    } catch (error: any) {
      message.error(error.response?.data?.message || "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  };

  // Modern Input Styling for Light/Dark
  const inputStyles =
    "rounded-xl h-11 border-slate-200! dark:border-slate-700! bg-white! dark:bg-slate-800! text-slate-900! dark:text-slate-100! placeholder:text-slate-400! dark:placeholder:text-slate-500! hover:border-blue-500! transition-all";

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-12 transition-colors duration-300 relative overflow-hidden">
      {/* Abstract Background Blur */}
      <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl dark:shadow-black/40 p-8 border border-slate-100 dark:border-slate-800">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-linear-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-xl shadow-blue-500/20">
            <RocketOutlined className="text-2xl text-white" />
          </div>
          <Title
            level={2}
            className="m-0! font-black! tracking-tight! text-slate-900! dark:text-white!"
          >
            Create Account
          </Title>
          <Text className="text-slate-500! dark:text-slate-400! block mt-2 text-sm font-medium">
            Start your AI-powered interview journey
          </Text>
        </div>

        <Divider className="border-slate-100! dark:border-slate-800! my-6!" />

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          className="space-y-1"
        >
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <Upload
              name="avatar"
              listType="picture-circle"
              className="avatar-uploader bg-transparent!"
              showUploadList={false}
              onChange={handleAvatarChange}
              customRequest={({ onSuccess }) =>
                setTimeout(() => onSuccess?.("ok"), 0)
              }
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="avatar"
                  className="w-full h-full rounded-full object-cover border-2 border-white dark:border-slate-800 shadow-sm"
                />
              ) : (
                <div className="flex flex-col items-center text-slate-400 dark:text-slate-500">
                  {loadingAvatar ? (
                    <LoadingOutlined />
                  ) : (
                    <PlusOutlined className="text-lg" />
                  )}
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider">
                    Upload
                  </div>
                </div>
              )}
            </Upload>
          </div>

          <Form.Item
            name="fullname"
            label={
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider ml-1">
                Full Name
              </span>
            }
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input
              prefix={<UserOutlined className="text-slate-400 mr-2" />}
              placeholder="John Doe"
              className={inputStyles}
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider ml-1">
                Email Address
              </span>
            }
            rules={[
              {
                required: true,
                type: "email",
                message: "Valid email required",
              },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-400 mr-2" />}
              placeholder="name@university.edu"
              className={inputStyles}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <span className="text-slate-600 dark:text-slate-400 font-semibold text-xs uppercase tracking-wider ml-1">
                Password
              </span>
            }
            rules={[{ required: true, min: 6, message: "Min 6 characters" }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400 mr-2" />}
              placeholder="••••••••"
              className={inputStyles}
            />
          </Form.Item>

          <Form.Item className="mt-8! mb-2!">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              className="h-12 rounded-xl! bg-blue-600! hover:bg-blue-700! dark:bg-indigo-600! dark:hover:bg-indigo-500! border-none! font-bold! text-base! shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
            >
              Create My Account
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4">
          <Text className="text-slate-500! dark:text-slate-400! text-sm">
            Already have an account?{" "}
            <a
              href="/signin"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-700 font-bold transition-colors"
            >
              Sign In
            </a>
          </Text>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
