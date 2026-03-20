import { useLocation, useNavigate } from "react-router-dom";
import {
  Tag,
  Radio,
  Button,
  Card,
  Typography,
  Result,
  Spin,
  message,
} from "antd";
import { DownloadOutlined, LeftOutlined } from "@ant-design/icons";
import axios from "axios";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Title, Text, Paragraph } = Typography;

interface QuizState {
  skills: string[];
  role: string;
  type: "quick" | "job-role";
}

interface QuizQuestion {
  id: string;
  question_text: string;
  options: string[];
  topic_tag: string;
}

interface QuizResult {
  score_percentage: number;
  correct_answers: number;
  total_questions: number;
  review: {
    question_id: string;
    question_text: string;
    options: string[];
    selected_option: number;
    correct_option: number;
    explanation: string;
  }[];
}

function Quiz() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as QuizState | null;

  const skills = state?.skills ?? [];
  const role = state?.role ?? "";
  const quizType = state?.type ?? "quick";

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, number>
  >({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getAuthHeaders = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` },
  });

  const getQuestions = async () => {
    setLoading(true);
    try {
      const payload = {
        type: quizType,
        skill_names: quizType === "quick" ? skills : [],
        job_description: quizType === "job-role" ? role : "",
        num_questions: 10,
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/start`,
        payload,
        getAuthHeaders(),
      );
      setQuestions(data.questions);
      console.log("Questions fetched successfully");
    } catch (error) {
      message.error("Error loading quiz questions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getQuestions();
  }, []);

  const handleSelect = (questionId: string, optionIndex: number) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleSubmit = async () => {
    // 1. Validation: Ensure all questions are answered to prevent backend math errors
    if (Object.keys(selectedAnswers).length < questions.length) {
      message.warning("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      // 2. Construct the payload to match your working JSON exactly
      const payload = {
        session_type: String(quizType), // "quick" or "job-role"
        selected_skills: quizType === "quick" ? skills : [],
        job_description: quizType === "job-role" ? String(role) : "", // Ensure empty string, not null
        extracted_skills: quizType === "quick" ? skills : [],
        answers: questions.map((q) => ({
          question_id: q.id,
          selected_option: Number(selectedAnswers[q.id]), // Ensure it's a Number
        })),
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/submit`,
        payload,
        getAuthHeaders(),
      );

      setQuizResult(data);
      message.success("Quiz submitted successfully!");
    } catch (error: any) {
      console.error("Submission Error Details:", error.response?.data);
      const backendError = error.response?.data?.detail;
      message.error(
        typeof backendError === "string"
          ? backendError
          : "Submission failed (500)",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Quiz Assessment Report", 14, 20);
    doc.setFontSize(10);
    doc.text(
      `Focus: ${quizType === "quick" ? skills.join(", ") : role}`,
      14,
      30,
    );
    doc.text(`Score: ${quizResult?.score_percentage}%`, 14, 35);

    const rows = quizResult?.review.map((item, idx) => [
      idx + 1,
      item.question_text,
      item.options[item.selected_option] || "Skipped",
      item.options[item.correct_option],
      item.explanation,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [["#", "Question", "Your Answer", "Correct Answer", "Explanation"]],
      body: rows || [],
      styles: { fontSize: 7 },
    });

    doc.save("quiz_results.pdf");
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh]">
        <Spin size="large" description="AI is preparing your questions..." />
      </div>
    );

  if (quizResult) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card className="shadow-lg rounded-2xl mb-8 text-center bg-white">
          <Result
            status={quizResult.score_percentage >= 50 ? "success" : "warning"}
            title={`Your Result: ${quizResult.score_percentage}%`}
            subTitle={`Correct: ${quizResult.correct_answers} / ${quizResult.total_questions}`}
            extra={[
              <Button
                type="primary"
                key="pdf"
                icon={<DownloadOutlined />}
                onClick={downloadPDF}
                size="large"
                shape="round"
              >
                Download PDF
              </Button>,
              <Button
                key="back"
                onClick={() => navigate("/")}
                size="large"
                shape="round"
              >
                Back Home
              </Button>,
            ]}
          />
        </Card>

        <div className="space-y-4">
          {quizResult.review.map((item, idx) => (
            <Card key={idx} className="rounded-xl border-slate-100 shadow-sm">
              <Text strong className="block mb-4 text-lg">
                {idx + 1}. {item.question_text}
              </Text>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {item.options.map((opt, i) => {
                  let color = "bg-slate-50 border-slate-100 text-slate-500";
                  if (i === item.correct_option)
                    color =
                      "bg-green-50 border-green-200 text-green-700 font-bold";
                  if (i === item.selected_option && i !== item.correct_option)
                    color = "bg-red-50 border-red-200 text-red-700 font-bold";
                  return (
                    <div key={i} className={`p-3 rounded-xl border ${color}`}>
                      {opt}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-xs italic text-indigo-900 leading-relaxed">
                <strong>Explanation:</strong> {item.explanation}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <header className="mb-10">
        <Button
          icon={<LeftOutlined />}
          type="text"
          onClick={() => navigate("/")}
          className="mb-2"
        >
          Cancel
        </Button>
        <Title level={2}>
          {quizType === "quick" ? "Skill Practice" : "Role Assessment"}
        </Title>
        <div className="flex gap-2">
          {quizType === "quick" ? (
            skills.map((s) => (
              <Tag color="blue" key={s} className="rounded-full px-3">
                {s}
              </Tag>
            ))
          ) : (
            <Tag color="purple" className="rounded-full px-4 text-md">
              {role}
            </Tag>
          )}
        </div>
      </header>

      <div className="space-y-8">
        {questions.map((q, idx) => (
          <Card
            key={q.id}
            title={
              <Text className="text-xs text-slate-400 uppercase tracking-widest">
                Question {idx + 1}
              </Text>
            }
            className="rounded-2xl shadow-sm overflow-hidden"
          >
            <Paragraph className="text-lg font-semibold text-slate-800 mb-6">
              {q.question_text}
            </Paragraph>
            <Radio.Group
              onChange={(e) => handleSelect(q.id, e.target.value)}
              value={selectedAnswers[q.id]}
              className="w-full"
            >
              <div className="flex flex-col gap-3">
                {q.options.map((opt, i) => (
                  <Radio
                    key={i}
                    value={i}
                    className={`p-4 border rounded-2xl w-full transition-all ${selectedAnswers[q.id] === i ? "border-indigo-500 bg-indigo-50" : "border-slate-200"}`}
                  >
                    {opt}
                  </Radio>
                ))}
              </div>
            </Radio.Group>
          </Card>
        ))}
      </div>

      <Button
        type="primary"
        size="large"
        block
        onClick={handleSubmit}
        loading={submitting}
        disabled={Object.keys(selectedAnswers).length < questions.length}
        className="mt-12 h-16 rounded-2xl bg-indigo-600 font-bold text-lg border-none shadow-xl shadow-indigo-100"
      >
        Submit Assessment
      </Button>
    </div>
  );
}

export default Quiz;
