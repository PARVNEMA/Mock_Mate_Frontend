import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import {
  Button,
  Card,
  Input,
  message,
  Spin,
  Tag,
  Typography,
  Space,
} from "antd";
import {
  AudioOutlined,
  SendOutlined,
  StopOutlined,
  RobotOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SpeechRecognition, {
  useSpeechRecognition,
} from "react-speech-recognition";
import { Avatar } from "../components/Avatar";
import { synthesizeSarvamSpeech } from "../services/sarvamTts";
import { useInterviewSocket } from "../hooks/useInterviewSocket";
import {
  createVisemeTrackFromTranscript,
  type VisemeCue,
  type VisemeName,
} from "../utils/lipsync";
import { finishInterview, getInterviewSession } from "../services/interviewApi";
import type {
  InterviewEvaluation,
  InterviewQuestion,
  InterviewReport,
  InterviewSessionOut,
  WsEnvelope,
  WsErrorPayload,
} from "../types/interview";

const { Title, Text, Paragraph } = Typography;

// --- Helper Utilities ---

const tagBaseClass =
  "flex items-center justify-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide shadow-sm";

const toWsUrl = (httpBaseUrl: string): string => {
  const trimmed = String(httpBaseUrl || "")
    .trim()
    .replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.replace(/^http/, "ws");
};

const nowIso = () => new Date().toISOString();

const asStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (typeof value === "string") return [value];
  return [];
};

const getErrorText = (err: unknown): string => {
  if (typeof err === "string") return err;
  const e = err as {
    response?: { data?: { detail?: string; message?: string } };
    message?: string;
  };
  return (
    e.response?.data?.detail ||
    e.response?.data?.message ||
    e.message ||
    "Unknown error"
  );
};

function InterviewRoom() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const [sessionMeta, setSessionMeta] = useState<InterviewSessionOut | null>(
    null,
  );
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);

  const navState = (location.state ?? null) as {
    firstQuestion?: InterviewQuestion;
  } | null;
  const [question, setQuestion] = useState<InterviewQuestion | null>(
    navState?.firstQuestion ?? null,
  );
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(
    null,
  );
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [typedAnswer, setTypedAnswer] = useState("");

  // --- Avatar & Audio States ---
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeViseme, setActiveViseme] = useState<VisemeName>("viseme_sil");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const visemeTrackRef = useRef<VisemeCue[]>([]);
  const visemeRafRef = useRef<number | null>(null);
  const cueIndexRef = useRef(0);
  const lastVisemeRef = useRef<VisemeName>("viseme_sil");

  // --- Handlers ---

  const isLastQuestion =
    question && sessionMeta
      ? question.index + 1 === sessionMeta.max_questions
      : false;

  const stopVisemeLoop = useCallback(() => {
    if (visemeRafRef.current !== null) {
      cancelAnimationFrame(visemeRafRef.current);
      visemeRafRef.current = null;
    }
  }, []);

  const resetVisemes = useCallback(() => {
    stopVisemeLoop();
    cueIndexRef.current = 0;
    lastVisemeRef.current = "viseme_sil";
    visemeTrackRef.current = [];
    setActiveViseme("viseme_sil");
  }, [stopVisemeLoop]);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioObjectUrlRef.current) {
      URL.revokeObjectURL(audioObjectUrlRef.current);
      audioObjectUrlRef.current = null;
    }
    setIsSpeaking(false);
    resetVisemes();
  }, [resetVisemes]);

  const speakQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      stopSpeaking();
      setIsSpeaking(true);

      try {
        const blob = await synthesizeSarvamSpeech({
          text: trimmed,
        });
        const url = URL.createObjectURL(blob);
        audioObjectUrlRef.current = url;
        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = url;

        audio.onloadedmetadata = () => {
          visemeTrackRef.current = createVisemeTrackFromTranscript(
            trimmed,
            audio.duration,
          );
          const loop = () => {
            const t = audio.currentTime;
            while (
              cueIndexRef.current < visemeTrackRef.current.length &&
              t >= visemeTrackRef.current[cueIndexRef.current].end
            ) {
              cueIndexRef.current += 1;
            }
            const cue = visemeTrackRef.current[cueIndexRef.current];
            const nextV = cue ? cue.viseme : "viseme_sil";
            if (lastVisemeRef.current !== nextV) {
              lastVisemeRef.current = nextV;
              setActiveViseme(nextV);
            }
            visemeRafRef.current = requestAnimationFrame(loop);
          };
          visemeRafRef.current = requestAnimationFrame(loop);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          resetVisemes();
        };
        await audio.play();
      } catch {
        setIsSpeaking(false);
        resetVisemes();
        message.error("TTS failed. Please check backend config.");
      }
    },
    [resetVisemes, stopSpeaking],
  );

  const onWsMessage = useCallback(
    (msg: WsEnvelope) => {
      if (msg.type === "question.next") {
        setIsWaitingForNext(false);
        const p = msg.payload ?? {};
        const nextQ = {
          id: String(p.question_id || p.id),
          question_text: String(p.question_text),
          index: Number(p.index ?? p.question_index ?? 0),
        };
        setQuestion(nextQ);
        setSessionMeta((current) =>
          current
            ? { ...current, current_question_index: nextQ.index }
            : current,
        );
        setEvaluation(null);
        setTypedAnswer("");
        if (autoSpeak && nextQ.question_text)
          speakQuestion(nextQ.question_text);
      } else if (msg.type === "answer.evaluation") {
        setEvaluation(msg.payload ?? {});
        setIsWaitingForNext(false);
      } else if (msg.type === "session.complete") {
        setSessionMeta((current) =>
          current ? { ...current, status: "completed" } : current,
        );
        setReport((msg.payload ?? {}) as InterviewReport);
      } else if (msg.type === "error") {
        const payload = (msg.payload ?? {}) as WsErrorPayload;
        message.error(payload.message || "Interview socket error.");
      }
    },
    [autoSpeak, speakQuestion],
  );

  const wsUrl = useMemo(
    () => toWsUrl(import.meta.env.VITE_BACKEND_URL) + "/interviews/ws",
    [],
  );
  const { isConnected, send } = useInterviewSocket({
    wsUrl,
    sessionId: sessionId!,
    accessToken,
    onMessage: onWsMessage,
  });

  const {
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();
  const sttDrivesTypedAnswerRef = useRef(false);

  const navigateToReport = useCallback(
    (nextReport?: InterviewReport | null) => {
      if (!sessionId) return;
      navigate(`/interview/${sessionId}/report`, {
        replace: true,
        state: nextReport ? { report: nextReport } : undefined,
      });
    },
    [navigate, sessionId],
  );

  useEffect(() => {
    if (listening && sttDrivesTypedAnswerRef.current) {
      setTypedAnswer(`${finalTranscript} ${interimTranscript}`.trim());
    }
  }, [finalTranscript, interimTranscript, listening]);

  useEffect(() => {
    if (!sessionId) {
      message.error("Interview session not found.");
      navigate("/interview", { replace: true });
      return;
    }
    if (!accessToken) {
      message.error("Please sign in to continue the interview.");
      navigate("/signin", { replace: true });
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const session = await getInterviewSession({ sessionId, accessToken });
        if (cancelled) return;

        setSessionMeta(session);
        if (
          (session.status === "completed" || session.status === "aborted") &&
          !report
        ) {
          navigateToReport();
        }
      } catch (err: unknown) {
        if (!cancelled) {
          message.error(
            getErrorText(err) || "Failed to load interview session.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMeta(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate, navigateToReport, report, sessionId]);

  useEffect(() => {
    if (!report) return;
    navigateToReport(report);
  }, [navigateToReport, report]);

  useEffect(() => {
    return () => {
      SpeechRecognition.stopListening();
      stopSpeaking();
      if (audioObjectUrlRef.current) {
        URL.revokeObjectURL(audioObjectUrlRef.current);
        audioObjectUrlRef.current = null;
      }
    };
  }, [stopSpeaking]);

  const startListening = () => {
    if (!browserSupportsSpeechRecognition)
      return message.error("STT not supported.");
    if (!isMicrophoneAvailable) {
      return message.error("Microphone access is blocked.");
    }
    resetTranscript();
    sttDrivesTypedAnswerRef.current = true;
    SpeechRecognition.startListening({
      continuous: true,
      interimResults: true,
    });
  };

  const submitAnswerText = (text: string) => {
    if (!text.trim()) return message.warning("Answer cannot be empty.");

    SpeechRecognition.stopListening();

    setIsWaitingForNext(true); // ✅ START LOADING

    send({
      type: "answer.final",
      session_id: sessionId!,
      request_id: `final-${nowIso()}`,
      payload: { transcript_text: text.trim() },
    });

    resetTranscript();
    setTypedAnswer("");
  };

  const strengths = asStringArray(evaluation?.strengths);
  const weaknesses = asStringArray(evaluation?.weaknesses);

  const handleFinishSession = useCallback(async () => {
    if (!sessionId) return;
    if (!accessToken) {
      message.error("Please sign in to finish the interview.");
      navigate("/signin", { replace: true });
      return;
    }

    setFinishing(true);
    try {
      SpeechRecognition.stopListening();
      stopSpeaking();
      const finalReport = await finishInterview({ sessionId, accessToken });
      setSessionMeta((current) =>
        current ? { ...current, status: "completed" } : current,
      );
      setReport(finalReport);
      message.success("Interview finished.");
    } catch (err: unknown) {
      message.error(getErrorText(err) || "Failed to finish interview.");
    } finally {
      setFinishing(false);
    }
  }, [accessToken, navigate, sessionId, stopSpeaking]);

  if (loadingMeta)
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-slate-950">
        <Spin size="large" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 px-4 py-8 transition-colors duration-300">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Title
              level={2}
              className="m-0 font-black tracking-tight dark:text-white"
            >
              Interview Room
            </Title>

            {/* FIXED TAGS */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Tag
                className={tagBaseClass}
                color={isConnected ? "green" : "red"}
              >
                {isConnected ? "WS Connected" : "WS Disconnected"}
              </Tag>

              <Tag className={tagBaseClass} color="blue">
                {sessionMeta?.llm_provider || "Provider"}
              </Tag>

              <Tag className={tagBaseClass} color="gold">
                {sessionMeta?.job_role || "Interview"}
              </Tag>

              <Tag className={tagBaseClass} color="purple">
                Q {(question?.index ?? 0) + 1} /{" "}
                {sessionMeta?.max_questions || "-"}
              </Tag>
            </div>
          </div>

          <Space>
            <Button
              className="rounded-xl border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              onClick={() => setAutoSpeak(!autoSpeak)}
            >
              Voice: {autoSpeak ? "Auto" : "Manual"}
            </Button>

            <Button
              danger
              type="primary"
              loading={finishing}
              className="rounded-xl bg-red-500 hover:bg-red-600 border-none font-semibold"
              onClick={handleFinishSession}
            >
              Finish Session
            </Button>
          </Space>
        </header>

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT PANEL */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
              {/* CARD HEADER */}
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                <Text className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  AI Interviewer
                </Text>

                <Space>
                  <Button
                    size="small"
                    type="text"
                    icon={<AudioOutlined />}
                    onClick={() => speakQuestion(question?.question_text || "")}
                  />
                  <Button
                    size="small"
                    type="text"
                    danger
                    icon={<StopOutlined />}
                    onClick={stopSpeaking}
                  />
                </Space>
              </div>

              {/* AVATAR */}
              <div className="h-112.5 bg-slate-950">
                <Canvas camera={{ position: [0, 1.4, 2.2], fov: 35 }}>
                  <ambientLight intensity={0.6} />
                  <pointLight position={[10, 10, 10]} />
                  <Environment preset="studio" />

                  <group position={[0, -1.2, 0]}>
                    <Avatar
                      activeViseme={activeViseme}
                      isSpeaking={isSpeaking}
                    />
                  </group>

                  <OrbitControls enableZoom={false} enablePan={false} />
                </Canvas>
              </div>
            </Card>
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-7 space-y-6">
            {/* QUESTION */}
            <Card className="rounded-3xl shadow-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="p-6">
                <Text className="text-indigo-600 uppercase text-sm font-bold block mb-2">
                  Interview Question
                </Text>

                {isWaitingForNext ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <Spin size="large" />
                    <Text className="text-slate-500 dark:text-slate-400">
                      {isLastQuestion
                        ? "Evaluating response for final report..."
                        : "Evaluating your answer for next question..."}
                    </Text>
                  </div>
                ) : (
                  <Paragraph className="text-lg font-semibold text-slate-900 dark:text-white m-0">
                    {question?.question_text ||
                      "Ready for your first question?"}
                  </Paragraph>
                )}
              </div>
            </Card>

            {/* ANSWER */}
            <Card className="rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="p-6">
                {/* HEADER */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                      <UserOutlined className="text-indigo-600" />
                    </div>
                    <Text className="font-semibold dark:text-slate-200">
                      Your Response
                    </Text>
                  </div>

                  <Space>
                    <Button
                      icon={<AudioOutlined />}
                      onClick={
                        listening
                          ? SpeechRecognition.stopListening
                          : startListening
                      }
                      className={`rounded-full px-4 ${
                        listening
                          ? "bg-red-500 text-white border-none animate-pulse"
                          : "dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {listening ? "Recording..." : "Voice"}
                    </Button>

                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      disabled={isWaitingForNext}
                      onClick={() => submitAnswerText(typedAnswer)}
                      className="rounded-full bg-indigo-600 border-none px-6 font-semibold"
                    >
                      Submit
                    </Button>
                  </Space>
                </div>

                {/* STT DISPLAY */}
                <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl p-4 min-h-30 mb-4 border border-slate-200 dark:border-slate-800 font-mono text-sm">
                  <Text className="text-slate-800 dark:text-slate-100">
                    {finalTranscript || (listening ? "" : "Microphone idle...")}
                  </Text>
                  <Text className="text-indigo-400 ml-1 italic">
                    {interimTranscript}
                  </Text>
                </div>

                {/* TEXT INPUT */}
                <Input.TextArea
                  value={typedAnswer}
                  onChange={(e) => {
                    sttDrivesTypedAnswerRef.current = false;
                    setTypedAnswer(e.target.value);
                  }}
                  placeholder="Speak or type your answer..."
                  className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border-none p-4 text-base dark:text-slate-200"
                  autoSize={{ minRows: 4, maxRows: 8 }}
                />
              </div>
            </Card>

            {/* EVALUATION */}
            {evaluation && (
              <Card className="rounded-3xl shadow-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <Title
                      level={4}
                      className="m-0 flex items-center gap-2 dark:text-white"
                    >
                      <RobotOutlined /> Evaluation
                    </Title>

                    <Tag className={tagBaseClass} color="blue">
                      Score: {evaluation.score}
                    </Tag>
                  </div>

                  <Paragraph className="text-slate-600 dark:text-slate-400 italic mb-4">
                    "{evaluation.feedback}"
                  </Paragraph>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 dark:bg-green-500/10 rounded-2xl">
                      <Text className="text-green-600 text-xs font-bold uppercase block mb-2">
                        Strengths
                      </Text>
                      <ul className="space-y-1 text-sm">
                        {strengths.map((s, i) => (
                          <li
                            key={i}
                            className="text-green-700 dark:text-green-400"
                          >
                            • {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 bg-red-50 dark:bg-red-500/10 rounded-2xl">
                      <Text className="text-red-600 text-xs font-bold uppercase block mb-2">
                        Weaknesses
                      </Text>
                      <ul className="space-y-1 text-sm">
                        {weaknesses.map((w, i) => (
                          <li
                            key={i}
                            className="text-red-700 dark:text-red-400"
                          >
                            • {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
}

export default InterviewRoom;
