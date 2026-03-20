import React from "react";
import { Button, Form, Input, Typography, Divider } from "antd";
import { LockOutlined, MailOutlined, LoginOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const { Title, Text } = Typography;

type FieldType = {
  email?: string;
  password?: string;
  remember?: boolean;
};

const SignIn: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values: FieldType) => {
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
        values,
        {
        },
      );
      console.log("Login successful:", data);
      login(
        data.user.email,
        data.session.access_token,
        data.session.refresh_token,
        data.user.id,
      );
      navigate("/");
    } catch (error: any) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/60 p-8 border border-slate-100">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <LoginOutlined className="text-2xl text-indigo-600" />
          </div>
          <Title level={2} className="m-0! tracking-tight">
            Welcome Back
          </Title>
          <Text className="text-slate-500 block mt-2">
            Sign in to continue your interview prep
          </Text>
        </div>

        <Divider className="border-slate-100" />

        <Form
          form={form}
          name="signin"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          initialValues={{ remember: true }}
          className="mt-6"
        >
          <Form.Item
            name="email"
            label={
              <span className="text-slate-600 font-medium">Email Address</span>
            }
            rules={[
              {
                required: true,
                type: "email",
                message: "Please enter your registered email!",
              },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-slate-400 mr-2" />}
              placeholder="name@university.edu"
              className="rounded-lg h-11 border-slate-200 hover:border-indigo-400 focus:border-indigo-500"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <div className="flex justify-between w-full">
                <span className="text-slate-600 font-medium">Password</span>
              </div>
            }
            rules={[{ required: true, message: "Please enter your password!" }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400 mr-2" />}
              placeholder="••••••••"
              className="rounded-lg h-11 border-slate-200 hover:border-indigo-400 focus:border-indigo-500"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              className="h-12 rounded-lg bg-indigo-600 hover:bg-indigo-700 border-none font-semibold text-lg shadow-lg shadow-indigo-200"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-6">
          <Text className="text-slate-500">
            Don't have an account?{" "}
            <a
              href="/signup"
              className="text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Sign Up
            </a>
          </Text>
        </div>
      </div>
    </div>
  );
};

export default SignIn;
