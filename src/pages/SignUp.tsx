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

// Precise payload type based on your requirement
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

  // Convert uploaded image to base64 string
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

  const getProfile = async () => {
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_BACKEND_URL}/profiles/me`,
        { withCredentials: true, ...getAuthHeaders() },
      );
      console.log("Profile fetched successfully:", response.data);
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const onFinish = async (values: FieldType) => {
    setSubmitting(true);
    try {
      // Constructing the unified payload
      const payload = {
        fullname: values.fullname,
        email: values.email,
        password: values.password,
        avatar: imageUrl, // Base64 string from state
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/signup`,
        payload,
        { withCredentials: true },
      );

      console.log("Signup successful:", data);

      // Auto-login after signup
      login(
        data.user.email,
        data.session.access_token,
        data.session.refresh_token,
      );
      getProfile();

      message.success("Welcome aboard!");
      navigate("/");
    } catch (error: any) {
      message.error(error.response?.data?.message || "Signup failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl shadow-slate-200/50 p-8 border border-slate-100">
        {/* Header Section */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-lg shadow-blue-200">
            <RocketOutlined className="text-3xl text-white" />
          </div>
          <Title
            level={2}
            className="m-0! tracking-tight font-extrabold text-slate-800"
          >
            Create Account
          </Title>
          <Text className="text-slate-400 block mt-1">
            Start your AI-powered interview journey
          </Text>
        </div>

        <Divider className="border-slate-100" />

        <Form
          form={form}
          name="signup"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          className="mt-4"
        >
          {/* Avatar Upload Section */}
          <div className="flex flex-col items-center mb-6">
            <Upload
              name="avatar"
              listType="picture-circle"
              className="avatar-uploader"
              showUploadList={false}
              onChange={handleAvatarChange}
              customRequest={({ onSuccess }) =>
                setTimeout(() => onSuccess?.("ok"), 0)
              } // Prevents upload error on client-side only preview
            >
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt="avatar"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center">
                  {loadingAvatar ? <LoadingOutlined /> : <PlusOutlined />}
                  <div className="mt-1 text-xs font-medium text-slate-400">
                    Avatar
                  </div>
                </div>
              )}
            </Upload>
          </div>

          <Form.Item
            name="fullname"
            label={
              <span className="text-slate-600 font-medium">Full Name</span>
            }
            rules={[{ required: true, message: "Please enter your name!" }]}
          >
            <Input
              prefix={<UserOutlined className="text-slate-300 mr-2" />}
              placeholder="John Doe"
              className="rounded-xl h-11 border-slate-200 focus:border-blue-500"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label={
              <span className="text-slate-600 font-medium">Email Address</span>
            }
            rules={[
              {
                required: true,
                type: "email",
                message: "Enter a valid email!",
              },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-300 mr-2" />}
              placeholder="name@university.edu"
              className="rounded-xl h-11 border-slate-200 focus:border-blue-500"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={<span className="text-slate-600 font-medium">Password</span>}
            rules={[
              {
                required: true,
                min: 6,
                message: "Password must be 6+ characters!",
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-300 mr-2" />}
              placeholder="••••••••"
              className="rounded-xl h-11 border-slate-200 focus:border-blue-500"
            />
          </Form.Item>

          <Form.Item className="mt-8">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              className="h-12 rounded-xl bg-blue-600 hover:bg-blue-700 border-none font-bold text-lg shadow-lg shadow-blue-100"
            >
              Sign Up
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-4">
          <Text className="text-slate-400">
            Already have an account?{" "}
            <a
              href="/signin"
              className="text-blue-600 hover:text-blue-700 font-bold"
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
