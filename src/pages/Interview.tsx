import { useEffect, useState, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Card,
  Button,
  Input,
  Typography,
  message,
  Tag,
  Space,
  Modal,
  Spin,
  Progress,
  Divider,
} from "antd";
import {
  SendOutlined,
  StopOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
  TrophyOutlined,
  ArrowRightOutlined,
  CloudSyncOutlined,
} from "@ant-design/icons";
import axios from "axios";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface QuestionPayload {
  question_id: string;
  question_text: string;
  index: number;
}

interface InterviewReport {
  session_id: string;
  overall_score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  status: string;
}

const Interview = () => {
  const { session_id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const socketRef = useRef<WebSocket | null>(null);

  // States
  const [currentQuestion, setCurrentQuestion] =
    useState<QuestionPayload | null>(location.state?.initialQuestion || null);
  const [answer, setAnswer] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);

  // --- 1. WebSocket Logic ---

  const sendWsMessage = (type: string, payload: any) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      const envelope = {
        type,
        session_id,
        request_id: crypto.randomUUID(),
        payload,
        ts: new Date().toISOString(),
      };
      console.log(`[WS SEND] Type: ${type}`, envelope);
      socketRef.current.send(JSON.stringify(envelope));
    } else {
      console.error(
        `[WS SEND FAIL] Socket not open. Type: ${type}, ReadyState: ${socketRef.current?.readyState}`,
      );
    }
  };

  useEffect(() => {
    let isMounted = true;
    const token = localStorage.getItem("accessToken");

    console.log(`[WS INIT] Starting connection for session: ${session_id}`);

    // Using 127.0.0.1 to match your backend error log
    const wsUrl = `${import.meta.env.VITE_WS_URL}/interviews/ws`;
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      if (!isMounted) return;
      console.log("[WS OPEN] Connection established with server");
      setIsConnected(true);

      // Join the session
      sendWsMessage("session.join", {
        session_id,
        access_token: token,
      });
    };

    socket.onmessage = (event) => {
      if (!isMounted) return;
      const data = JSON.parse(event.data);
      console.log("[WS RECEIVE] Incoming message:", data);

      const { type, payload } = data;

      switch (type) {
        case "question.next":
          console.log("[FLOW] Moving to next question");
          setCurrentQuestion(payload);
          setAnswer("");
          setFeedback(null);
          setIsProcessing(false);
          break;

        case "answer.evaluation":
          console.log("[FLOW] Received intermediate feedback");
          setFeedback(payload.feedback);
          break;

        case "session.complete":
          console.log("[FLOW] Interview completed via WebSocket");
          setReport(payload);
          break;

        case "error":
          console.error("[WS ERROR PAYLOAD]", payload);
          message.error(`Session Error: ${payload.message}`);
          setIsProcessing(false);
          break;

        default:
          console.warn("[WS] Received unknown message type:", type);
      }
    };

    socket.onclose = (event) => {
      if (isMounted) {
        setIsConnected(false);
        console.log(
          `[WS CLOSE] Connection closed. Code: ${event.code}, Reason: ${event.reason}`,
        );
      }
    };

    socket.onerror = (err) => {
      console.error("[WS ERROR] Native WebSocket error observed:", err);
    };

    return () => {
      console.log("[WS CLEANUP] Unmounting component, closing socket");
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.close(1000, "Component Unmounted");
      }
    };
  }, [session_id]);

  // --- 2. Action Handlers ---

  const handleSendFinalAnswer = () => {
    if (!answer.trim() || isProcessing) return;

    console.log("[ACTION] Submitting final answer");
    setIsProcessing(true);
    sendWsMessage("answer.final", {
      transcript_text: answer,
    });
  };

  const handleFinishEarly = () => {
    Modal.confirm({
      title: "End Interview Early?",
      icon: <StopOutlined style={{ color: "#ff4d4f" }} />,
      content:
        "This will conclude the session and generate a report based on your answers so far.",
      okText: "Generate Report",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          console.log("[API POST] Calling finish endpoint...");
          setIsProcessing(true);
          const { data } = await axios.post(
            `${import.meta.env.VITE_BACKEND_URL}/interviews/${session_id}/finish`,
            {},
            {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("accessToken")}`,
              },
            },
          );
          console.log("[API SUCCESS] Report received:", data);
          setReport(data);

          // Clean up WebSocket since we are done
          sendWsMessage("session.finish", {});
        } catch (error: any) {
          console.error(
            "[API ERROR] Finish failed:",
            error.response?.data || error.message,
          );
          message.error("Could not generate report. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // --- 3. Views ---

  if (report) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 animate-in fade-in zoom-in duration-500">
        <Card className="rounded-3xl shadow-2xl border-none overflow-hidden bg-white">
          <div className="bg-indigo-600 p-10 text-center text-white">
            <TrophyOutlined className="text-6xl mb-4 text-amber-400" />
            <Title level={1} className="m-0! text-white">
              Interview Result
            </Title>
            <Text className="text-indigo-100 opacity-80">
              Final Performance Review
            </Text>
          </div>

          <div className="p-10">
            <div className="flex flex-col md:flex-row gap-10 items-center mb-10">
              <Progress
                type="circle"
                percent={report.overall_score}
                strokeColor={{ "0%": "#4f46e5", "100%": "#818cf8" }}
                size={160}
                format={(p) => (
                  <span className="text-2xl font-bold text-slate-800">
                    {p}%
                  </span>
                )}
              />
              <div>
                <Title level={4}>Overall Feedback</Title>
                <Paragraph className="text-slate-600 text-lg italic">
                  "{report.summary}"
                </Paragraph>
              </div>
            </div>

            <Divider />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card
                className="bg-green-50 border-green-100 rounded-xl"
                title={
                  <span className="text-green-700">
                    <CheckCircleOutlined /> Strengths
                  </span>
                }
              >
                {report.strengths.map((s, i) => (
                  <Paragraph key={i} className="mb-2 text-green-800">
                    • {s}
                  </Paragraph>
                ))}
              </Card>
              <Card
                className="bg-amber-50 border-amber-100 rounded-xl"
                title={
                  <span className="text-amber-700">
                    <InfoCircleOutlined /> Areas to Improve
                  </span>
                }
              >
                {report.weaknesses.map((w, i) => (
                  <Paragraph key={i} className="mb-2 text-amber-800">
                    • {w}
                  </Paragraph>
                ))}
              </Card>
            </div>

            <Button
              type="primary"
              block
              size="large"
              className="mt-10 h-14 rounded-xl bg-indigo-600 font-bold"
              onClick={() => navigate("/")}
            >
              Return to Home <ArrowRightOutlined />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <div className="flex justify-between items-center mb-8">
        <Space orientation="vertical" size={0}>
          <Space>
            <Title level={3} className="m-0!">
              AI Interview Room
            </Title>
            <Tag
              color={isConnected ? "green" : "red"}
              icon={isConnected ? <CloudSyncOutlined /> : <LoadingOutlined />}
            >
              {isConnected ? "Connected" : "Reconnecting..."}
            </Tag>
          </Space>
          <Text type="secondary" className="text-xs">
            ID: {session_id}
          </Text>
        </Space>
        <Button
          danger
          type="text"
          onClick={handleFinishEarly}
          icon={<StopOutlined />}
        >
          Finish Early
        </Button>
      </div>

      <Card className="rounded-3xl shadow-xl border-none overflow-hidden bg-white">
        <div className="p-8 bg-indigo-600">
          <Text className="text-indigo-200 uppercase tracking-tighter text-xs font-bold">
            Question {currentQuestion ? currentQuestion.index + 1 : "-"}
          </Text>
          <Paragraph className="text-white text-2xl font-medium mt-4 mb-0">
            {currentQuestion?.question_text ||
              "Preparing the next challenge..."}
          </Paragraph>
        </div>

        {feedback && (
          <div className="px-8 py-3 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
            <InfoCircleOutlined className="text-amber-600" />
            <Text className="text-amber-700 text-sm">{feedback}</Text>
          </div>
        )}

        <div className="p-8">
          <Text strong className="block mb-4 text-slate-400 text-xs uppercase">
            Your Response
          </Text>
          <TextArea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Structure your thoughts and type your answer..."
            autoSize={{ minRows: 6, maxRows: 12 }}
            disabled={isProcessing || !isConnected}
            className="text-lg rounded-2xl border-slate-200 bg-slate-50 focus:bg-white p-6 transition-all"
          />

          <div className="mt-8 flex justify-end items-center gap-6">
            {isProcessing && (
              <Space className="text-indigo-600 italic">
                <Spin indicator={<LoadingOutlined spin />} />
                <Text>Analyzing your answer...</Text>
              </Space>
            )}
            <Button
              type="primary"
              size="large"
              onClick={handleSendFinalAnswer}
              loading={isProcessing}
              disabled={!answer.trim() || !isConnected}
              icon={<SendOutlined />}
              className="h-14 px-12 rounded-2xl bg-indigo-600 font-bold text-lg border-none shadow-lg"
            >
              Submit Answer
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default Interview;
