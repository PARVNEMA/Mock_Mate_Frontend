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
import {
  DownloadOutlined,
  LeftOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const { Title, Text, Paragraph } = Typography;

interface QuizState {
  skills: string[];
  role: string;
  type: "quick" | "job-role";
  questionCount: number;
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
  const questionCount = state?.questionCount ?? 10;

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
        num_questions: questionCount,
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/start`,
        payload,
        getAuthHeaders(),
      );
      setQuestions(data.questions);
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
    if (Object.keys(selectedAnswers).length < questions.length) {
      message.warning("Please answer all questions before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        session_type: String(quizType),
        selected_skills: quizType === "quick" ? skills : [],
        job_description: quizType === "job-role" ? String(role) : "",
        extracted_skills: quizType === "quick" ? skills : [],
        answers: questions.map((q) => ({
          question_id: q.id,
          selected_option: Number(selectedAnswers[q.id]),
        })),
      };

      const { data } = await axios.post(
        `${import.meta.env.VITE_BACKEND_URL}/quizzes/submit`,
        payload,
        getAuthHeaders(),
      );

      setQuizResult(data);
      message.success("Quiz submitted successfully!");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error: any) {
      message.error("Submission failed (500)");
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
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save("quiz_results.pdf");
  };

  if (loading)
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
        <Spin size="large" />
        <Text className="mt-4 text-slate-500! dark:text-slate-400! animate-pulse font-medium">
          AI is preparing your custom challenge...
        </Text>
      </div>
    );

  if (quizResult) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <Card className="shadow-2xl rounded-3xl! mb-10 text-center bg-white dark:bg-slate-900 border-slate-200! dark:border-slate-800!">
            <Result
              status={quizResult.score_percentage >= 70 ? "success" : "warning"}
              title={
                <span className="text-slate-900! dark:text-white! font-black text-3xl tracking-tight">
                  {quizResult.score_percentage}%
                </span>
              }
              subTitle={
                <span className="text-slate-500! dark:text-slate-400! text-lg">
                  Performance: {quizResult.correct_answers} /{" "}
                  {quizResult.total_questions} Correct
                </span>
              }
              extra={[
                <Button
                  type="primary"
                  key="pdf"
                  icon={<DownloadOutlined />}
                  onClick={downloadPDF}
                  size="large"
                  className="rounded-xl! h-12! bg-indigo-600! border-none! shadow-lg shadow-indigo-500/20 hover:scale-105! transition-all font-bold"
                >
                  Download Results
                </Button>,
                <Button
                  key="back"
                  onClick={() => navigate("/")}
                  size="large"
                  className="rounded-xl! h-12! dark:bg-slate-800! dark:text-white! dark:border-slate-700! hover:border-indigo-500! font-bold"
                >
                  Dashboard
                </Button>,
              ]}
            />
          </Card>

          <div className="space-y-6">
            <Title
              level={4}
              className="dark:text-slate-300! px-2 my-6 uppercase tracking-widest text-sm! font-black"
            >
              Review & Explanations
            </Title>
            {quizResult.review.map((item, idx) => (
              <Card
                key={idx}
                className="rounded-2xl! border-slate-200! dark:border-slate-800! shadow-sm bg-white dark:bg-slate-900 overflow-hidden mb-6!"
              >
                <div className="flex items-start gap-5 p-2">
                  <div className="mt-1">
                    {item.selected_option === item.correct_option ? (
                      <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full flex">
                        <CheckCircleOutlined className="text-green-600 dark:text-green-400 text-xl" />
                      </div>
                    ) : (
                      <div className="bg-red-100 dark:bg-red-900/30 p-2 rounded-full flex">
                        <CloseCircleOutlined className="text-red-600 dark:text-red-400 text-xl" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <Text
                      strong
                      className="block mb-6 text-xl! text-slate-800! dark:text-slate-100! leading-relaxed"
                    >
                      {idx + 1}. {item.question_text}
                    </Text>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {item.options.map((opt, i) => {
                        let style = "p-5 rounded-2xl border-2 transition-all ";
                        if (i === item.correct_option)
                          style +=
                            "bg-green-50! dark:bg-green-950/20! border-green-200! dark:border-green-800/50! text-green-700! dark:text-green-400! font-black";
                        else if (i === item.selected_option)
                          style +=
                            "bg-red-50! dark:bg-red-950/20! border-red-200! dark:border-red-800/50! text-red-700! dark:text-red-400! font-black";
                        else
                          style +=
                            "bg-slate-50! dark:bg-slate-800/20! border-slate-100! dark:border-slate-800! text-slate-500! dark:text-slate-500!";

                        return (
                          <div key={i} className={style}>
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-8 p-6 bg-indigo-50 dark:bg-indigo-900/10 rounded-2xl border-l-4 border-indigo-500">
                      <Text className="text-base! text-slate-700! dark:text-slate-300! leading-loose italic">
                        <strong className="not-italic uppercase text-xs tracking-widest font-black text-indigo-600 dark:text-indigo-400 mr-2">
                          Explanation:
                        </strong>
                        {item.explanation}
                      </Text>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 dark:bg-slate-950 min-h-screen transition-all duration-500 py-10">
      <header className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <Button
            icon={<LeftOutlined />}
            type="text"
            onClick={() => navigate("/")}
            className="mb-4! pl-0! text-slate-400! hover:text-indigo-500! transition-colors font-bold uppercase tracking-widest text-[10px]!"
          >
            Cancel Session
          </Button>
          <Title
            level={2}
            className="m-0! font-black! tracking-tighter! text-slate-900! dark:text-white!"
          >
            {quizType === "quick" ? "Skill Sprint" : "Job Role Simulation"}
          </Title>
        </div>
        <div className="flex gap-2 flex-wrap">
          {quizType === "quick" ? (
            skills.map((s) => (
              <Tag
                key={s}
                color="blue"
                className="rounded-full! px-4! py-1! border-none! font-bold shadow-sm uppercase text-[10px]"
              >
                {s}
              </Tag>
            ))
          ) : (
            <Tag
              color="purple"
              className="rounded-full! px-5! py-1! border-none! font-bold shadow-sm uppercase text-[10px]"
            >
              {role}
            </Tag>
          )}
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        {questions.map((q, idx) => (
          <Card
            key={q.id}
            title={
              <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                Question {idx + 1}
              </span>
            }
            className="rounded-4xl! shadow-xl dark:shadow-black/40 border-none bg-white dark:bg-slate-900 overflow-hidden my-4!"
          >
            <Paragraph className="text-xl! font-bold text-slate-800! dark:text-slate-100! mb-10 leading-tight">
              {q.question_text}
            </Paragraph>
            <Radio.Group
              onChange={(e) => handleSelect(q.id, e.target.value)}
              value={selectedAnswers[q.id]}
              className="w-full"
            >
              <div className="grid grid-cols-1 gap-4">
                {q.options.map((opt, i) => {
                  const isSelected = selectedAnswers[q.id] === i;
                  return (
                    <Radio
                      key={i}
                      value={i}
                      className={`
                        w-full rounded-2xl! border-2! p-2! transition-all relative
                        ${
                          isSelected
                            ? "bg-indigo-50! dark:bg-indigo-900/20! border-indigo-500! text-indigo-700! dark:text-indigo-300!"
                            : "bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 text-slate-600 dark:text-slate-400"
                        }
                      `}
                    >
                      <span className="ml-2 text-lg font-medium">{opt}</span>
                    </Radio>
                  );
                })}
              </div>
            </Radio.Group>
          </Card>
        ))}
      </div>

      <div className="max-w-7xl mx-auto px-4 lg:px-8 mt-12 pb-20">
        <Button
          type="primary"
          size="large"
          block
          onClick={handleSubmit}
          loading={submitting}
          disabled={Object.keys(selectedAnswers).length < questions.length}
          className="h-16 rounded-3xl! bg-indigo-600! hover:bg-indigo-700! border-none! font-black! text-lg! shadow-2xl shadow-indigo-500/40 disabled:bg-slate-200! dark:disabled:bg-slate-800! transition-all active:scale-95"
        >
          {submitting ? "Analyzing Responses..." : "Complete Assessment"}
        </Button>

        {Object.keys(selectedAnswers).length < questions.length && (
          <div className="text-center mt-4 animate-pulse">
            <Text className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
              Please finalize all {questions.length} responses to proceed
            </Text>
          </div>
        )}
      </div>
    </div>
  );
}

export default Quiz;
