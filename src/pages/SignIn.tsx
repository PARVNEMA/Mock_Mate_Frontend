import React, { useState } from "react";
import { Button, Form, Input, Typography, Divider, message } from "antd";
import { LockOutlined, MailOutlined, LoginOutlined } from "@ant-design/icons";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const { Title, Text } = Typography;

type FieldType = {
  email?: string;
  password?: string;
};

const SignIn: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: FieldType) => {
    setLoading(true);
    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/auth/login`,
        values,
      );

      login(
        data.user.email,
        data.session.access_token,
        data.session.refresh_token,
        data.user.id,
      );

      message.success("Logged in successfully!");
      navigate("/");
    } catch (error: any) {
      message.error(error.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  // Reusable styling for consistent Light/Dark inputs
  const inputClasses = `
    rounded-xl! h-11! transition-all!
    border-slate-200! dark:border-slate-700! 
    bg-white! dark:bg-slate-800/50! 
    text-slate-900! dark:text-slate-100! 
    placeholder:text-slate-400! dark:placeholder:text-slate-500!
    hover:border-indigo-500! dark:hover:border-indigo-400!
    focus:border-indigo-600! dark:focus:border-indigo-500!
  `;

  return (
    <div className="flex justify-center py-8 bg-slate-50 dark:bg-slate-950 px-4 transition-colors duration-500 relative overflow-hidden">
      {/* Dynamic Glow Background */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-4xl bg-indigo-500/5 dark:bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl dark:shadow-black/50 p-8 border border-slate-100 dark:border-slate-800 transition-all duration-300">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-linear-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-xl shadow-indigo-500/20">
            <LoginOutlined className="text-2xl text-white" />
          </div>
          <Title
            level={2}
            className="m-0! font-black! tracking-tight! text-slate-900! dark:text-white!"
          >
            Welcome Back
          </Title>
          <Text className="text-slate-500! dark:text-slate-400! block mt-2 font-medium">
            Sign in to continue your prep
          </Text>
        </div>

        <Divider className="border-slate-100! dark:border-slate-800! my-6!" />

        <Form
          form={form}
          name="signin"
          layout="vertical"
          onFinish={onFinish}
          requiredMark={false}
          className="space-y-1"
        >
          <Form.Item
            name="email"
            label={
              <span className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider ml-1">
                Email Address
              </span>
            }
          >
            <Input
              prefix={<MailOutlined className="text-slate-400 mr-2" />}
              placeholder="name@university.edu"
              className={inputClasses}
            />
          </Form.Item>

          <Form.Item
            name="password"
            label={
              <span className="text-slate-600 dark:text-slate-400 font-bold text-xs uppercase tracking-wider ml-1">
                Password
              </span>
            }
            rules={[{ required: true, message: "Enter your password!" }]}
          >
            <Input.Password
              prefix={<LockOutlined className=" mr-2 text-slate-600" />}
              placeholder="••••••••"
              className={`${inputClasses}`}
            />
          </Form.Item>

          <Form.Item className="mt-8!">
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="h-12 rounded-xl! bg-linear-to-r! from-indigo-600! to-purple-600! border-none! font-bold! text-base! shadow-lg shadow-indigo-500/20 active:scale-[0.98] transition-all"
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center mt-6">
          <Text className="text-slate-500!  dark:text-slate-400! text-sm">
            Don't have an account?{" "}
            <a
              href="/signup"
              className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-bold transition-colors"
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
