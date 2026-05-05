import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Divider, Spin, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  downloadGdReportPdf,
  getGdEvaluation,
} from "../services/gdApi";
import type { GdParticipantEvaluation } from "../types/gd";

const { Title, Text } = Typography;

const scoreColor = (value?: number | null): string => {
  if (value === null || value === undefined) return "bg-slate-300";
  if (value >= 7) return "bg-emerald-500";
  if (value >= 4) return "bg-amber-500";
  return "bg-rose-500";
};

const scoreWidth = (value?: number | null): string => {
  if (value === null || value === undefined) return "0%";
  const normalized = Math.max(0, Math.min(10, value));
  return `${normalized * 10}%`;
};

function ScoreRow({ label, value }: { label: string; value?: number | null }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Text className="text-slate-700 dark:text-slate-300">{label}</Text>
        <Text className="font-bold text-slate-900 dark:text-white">
          {value === null || value === undefined ? "N/A" : value}
        </Text>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div className={`h-full ${scoreColor(value)}`} style={{ width: scoreWidth(value) }} />
      </div>
    </div>
  );
}

export default function GdReport() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState("");
  const [evaluations, setEvaluations] = useState<GdParticipantEvaluation[]>([]);

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );
  const myUserId = useMemo(() => String(localStorage.getItem("userId") || ""), []);

  useEffect(() => {
    if (!sessionId) return;
    if (!accessToken) {
      message.error("Please sign in to view GD report.");
      navigate("/signin");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await getGdEvaluation({ sessionId, accessToken });
        if (!cancelled) setEvaluations(response.evaluations || []);
      } catch (err: any) {
        message.error(err?.response?.data?.detail || "Failed to load GD evaluation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate, sessionId]);

  const onDownload = async (participantId: string, participantName: string) => {
    if (!sessionId || !accessToken) return;
    try {
      setDownloadingId(participantId);
      const blob = await downloadGdReportPdf({ sessionId, participantId, accessToken });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `report_${participantName.replace(/\s+/g, "_") || participantId}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err: any) {
      message.error(err?.response?.data?.detail || "Failed to download PDF report.");
    } finally {
      setDownloadingId("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center">
        <Spin size="large" />
        <Text className="mt-4 dark:text-slate-400">Loading GD evaluation report...</Text>
      </div>
    );
  }

  if (!sessionId || evaluations.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
        <Card className="max-w-xl w-full rounded-2xl">
          <Alert
            type="warning"
            showIcon
            message="No evaluation found for this session."
            description="The host may still be ending the session. Try again in a few seconds."
          />
          <Button className="mt-4" onClick={() => navigate("/gd")}>
            Back to GD Lobby
          </Button>
        </Card>
      </div>
    );
  }

  const groupEval = evaluations[0]?.group_eval;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Card className="rounded-3xl!">
          <Title level={2} className="m-0!">GD Evaluation Report</Title>
          <Text className="text-slate-500">Session: {sessionId}</Text>
        </Card>

        <Card className="rounded-3xl!">
          <Title level={4}>Group Dynamics</Title>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Text>Dominant Speaker: {groupEval?.dominant_speaker || "N/A"}</Text>
            <Text>Most Passive: {groupEval?.most_passive || "N/A"}</Text>
            <Text>Fairness Score: {groupEval?.fairness_score ?? "N/A"}</Text>
            <Text>Collaboration Score: {groupEval?.collaboration_score ?? "N/A"}</Text>
          </div>
          <Divider />
          <div className="space-y-2">
            {(groupEval?.group_observations || []).map((item, idx) => (
              <Text key={idx} className="block text-slate-600 dark:text-slate-300">
                - {item}
              </Text>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {evaluations.map((ev) => {
            const isMe = myUserId && ev.participant_id === myUserId;
            return (
              <Card key={ev.participant_id} className={`rounded-3xl! ${isMe ? "border-indigo-400!" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Title level={5} className="m-0!">{ev.participant_name || ev.participant_id}</Title>
                    <Text className="text-slate-500">{isMe ? "You" : ev.participant_id}</Text>
                  </div>
                  <Button
                    loading={downloadingId === ev.participant_id}
                    onClick={() => onDownload(ev.participant_id, ev.participant_name)}
                  >
                    Download PDF
                  </Button>
                </div>

                <Divider />
                <div className="space-y-3">
                  <ScoreRow label="Communication Quality" value={ev.personal_eval?.communication_quality} />
                  <ScoreRow label="Clarity & Structure" value={ev.personal_eval?.clarity_structure} />
                  <ScoreRow label="Vocabulary & Grammar" value={ev.personal_eval?.vocabulary_grammar} />
                  <ScoreRow label="Confidence & Fluency" value={ev.personal_eval?.confidence_fluency} />
                </div>

                <Divider />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Text strong>Strengths</Text>
                    {(ev.personal_eval?.strengths || []).map((s, idx) => (
                      <Text key={idx} className="block text-emerald-600">- {s}</Text>
                    ))}
                  </div>
                  <div>
                    <Text strong>Weaknesses</Text>
                    {(ev.personal_eval?.weaknesses || []).map((w, idx) => (
                      <Text key={idx} className="block text-rose-600">- {w}</Text>
                    ))}
                  </div>
                  <div>
                    <Text strong>Suggestions</Text>
                    {(ev.personal_eval?.suggestions || []).map((s, idx) => (
                      <Text key={idx} className="block text-indigo-600">- {s}</Text>
                    ))}
                  </div>
                </div>

                <Divider />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Text>Words: {ev.stats?.word_count ?? 0}</Text>
                  <Text>Turns: {ev.stats?.turn_count ?? 0}</Text>
                  <Text>Interruptions: {ev.stats?.interruptions ?? 0}</Text>
                  <Text>Interrupted: {ev.stats?.times_interrupted ?? 0}</Text>
                  <Text>Fillers: {ev.stats?.filler_count ?? 0}</Text>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
