import { useEffect, useMemo, useState } from "react";
import { Button, Card, Spin, Tag, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { getInterviewReport } from "../services/interviewApi";
import type { InterviewReport } from "../types/interview";

const { Title, Text, Paragraph } = Typography;

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return [value];
  return [];
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (!err || typeof err !== "object") return "Unknown error";
  const e = err as { message?: unknown; response?: unknown };
  const messageText = typeof e.message === "string" ? e.message : "";
  const response = e.response as
    | { data?: { detail?: unknown; message?: unknown } }
    | undefined;
  const detail = response?.data?.detail;
  const apiMessage = response?.data?.message;
  if (typeof detail === "string") return detail;
  if (typeof apiMessage === "string") return apiMessage;
  return messageText || "Unknown error";
};

function InterviewReportPage() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<InterviewReport | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    if (!accessToken) {
      message.error("Please sign in to view your report.");
      navigate("/signin");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const r = await getInterviewReport({ sessionId, accessToken });
        if (!cancelled) setReport(r);
      } catch (err: unknown) {
        message.error(getErrorText(err) || "Failed to load report.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate, sessionId]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="rounded-2xl">
          <Text>Missing session id.</Text>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="rounded-2xl">
          <Text>No report found for this session.</Text>
          <div className="mt-4">
            <Button onClick={() => navigate("/")}>Back Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  const strengths = asStringArray(report.strengths);
  const weaknesses = asStringArray(report.weaknesses);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="max-w-4xl mx-auto space-y-5">
        <Card className="rounded-2xl shadow-sm border border-slate-100">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <Title level={3} className="m-0! tracking-tight">
                Interview Report
              </Title>
              <Text className="text-slate-500">Session: {sessionId}</Text>
            </div>
            {typeof report.overall_score === "number" && (
              <Tag color="geekblue">Overall: {report.overall_score}</Tag>
            )}
          </div>

          {report.summary && (
            <Paragraph className="mt-4 text-slate-700">
              {String(report.summary)}
            </Paragraph>
          )}

          <div className="flex gap-3 mt-6">
            <Button onClick={() => navigate("/")}>Back Home</Button>
            <Button type="primary" className="bg-indigo-600 border-none" onClick={() => navigate("/interview")}>
              New Interview
            </Button>
          </div>
        </Card>

        {strengths.length > 0 && (
          <Card className="rounded-2xl shadow-sm border border-slate-100">
            <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Strengths
            </Text>
            <ul className="list-disc pl-5 mt-3 text-slate-700">
              {strengths.map((s, idx) => (
                <li key={idx}>{s}</li>
              ))}
            </ul>
          </Card>
        )}

        {weaknesses.length > 0 && (
          <Card className="rounded-2xl shadow-sm border border-slate-100">
            <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Weaknesses
            </Text>
            <ul className="list-disc pl-5 mt-3 text-slate-700">
              {weaknesses.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

export default InterviewReportPage;
