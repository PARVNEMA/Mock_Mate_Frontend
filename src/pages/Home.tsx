import React from "react";
import { Card, Button, Typography, Row, Col } from "antd";
import {
  ThunderboltOutlined,
  VideoCameraOutlined,
  ArrowRightOutlined,
  HistoryOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text } = Typography;

const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        {/* Welcome Section */}
        <header className="mb-12">
          <Title level={1} className="mb-2! font-extrabold! tracking-tight">
            Level up your career.
          </Title>
          <Text className="text-slate-500 text-lg">
            Practice technical concepts or jump into a full AI-simulated
            interview.
          </Text>
        </header>

        {/* Primary Actions */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card
              hoverable
              className="h-full rounded-2xl border-none shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group"
              onClick={() => navigate("/quizselector")}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <ThunderboltOutlined className="text-2xl text-amber-500" />
                </div>
                <Title level={3} className="mb-2!">
                  Quiz Module
                </Title>
                <Text className="text-slate-500 mb-8 grow">
                  Test your knowledge on specific topics like MERN, Python, or
                  DSA with AI-generated questions.
                </Text>
                <Button
                  type="text"
                  className="p-0 text-amber-600 font-bold flex items-center gap-2"
                >
                  Start Practice <ArrowRightOutlined />
                </Button>
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card
              hoverable
              className="h-full rounded-2xl border-none shadow-sm hover:shadow-xl transition-all duration-300 bg-indigo-600 group"
              onClick={() => navigate("/interviewselector")}
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <VideoCameraOutlined className="text-2xl text-white" />
                </div>
                <Title level={3} className="mb-2! text-white!">
                  AI Interview
                </Title>
                <Text className="text-indigo-100 mb-8 grow">
                  A full-scale mock interview with real-time feedback on your
                  tone, eye contact, and accuracy.
                </Text>
                <Button
                  type="text"
                  className="p-0 text-white font-bold flex items-center gap-2"
                >
                  Launch Session <ArrowRightOutlined />
                </Button>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Secondary Stats/History (Placeholder) */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-slate-50 rounded-lg text-slate-400">
              <HistoryOutlined />
            </div>
            <div>
              <Text className="block text-xs font-bold text-slate-400 uppercase">
                Total Sessions
              </Text>
              <Title level={4} className="m-0!">
                0
              </Title>
            </div>
          </div>
          <div className="p-6 bg-white rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="p-3 bg-slate-50 rounded-lg text-slate-400">
              <LineChartOutlined />
            </div>
            <div>
              <Text className="block text-xs font-bold text-slate-400 uppercase">
                Avg. Accuracy
              </Text>
              <Title level={4} className="m-0!">
                0%
              </Title>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
