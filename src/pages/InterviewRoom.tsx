import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Button, Card, Input, message, Spin, Tag, Typography } from "antd";
import { AudioOutlined, SendOutlined, StopOutlined } from "@ant-design/icons";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { Avatar } from "../components/Avatar";
import { synthesizeSarvamSpeech } from "../services/sarvamTts";
import { useInterviewSocket } from "../hooks/useInterviewSocket";
import {
  createVisemeTrackFromTranscript,
  type VisemeCue,
  type VisemeName,
} from "../utils/lipsync";
import {
  finishInterview,
  getInterviewSession,
} from "../services/interviewApi";
import type {
  InterviewEvaluation,
  InterviewQuestion,
  InterviewReport,
  InterviewSessionOut,
  WsEnvelope,
  WsErrorPayload,
} from "../types/interview";

const { Title, Text, Paragraph } = Typography;

const toWsUrl = (httpBaseUrl: string): string => {
  const trimmed = String(httpBaseUrl || "").trim().replace(/\/$/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("https://")) return trimmed.replace("https://", "wss://");
  if (trimmed.startsWith("http://")) return trimmed.replace("http://", "ws://");
  // If someone passes ws:// already, keep it.
  return trimmed;
};

const nowIso = () => new Date().toISOString();

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

type InterviewRoomNavState = {
  firstQuestion?: InterviewQuestion;
};

function InterviewRoom() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const location = useLocation();

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );

  const [sessionMeta, setSessionMeta] = useState<InterviewSessionOut | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const navState = (location.state ?? null) as InterviewRoomNavState | null;
  const initialQuestion = navState?.firstQuestion;
  const [question, setQuestion] = useState<InterviewQuestion | null>(initialQuestion ?? null);
  const [evaluation, setEvaluation] = useState<InterviewEvaluation | null>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(true);

  const [typedAnswer, setTypedAnswer] = useState("");

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [activeViseme, setActiveViseme] = useState<VisemeName>("viseme_sil");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioObjectUrlRef = useRef<string | null>(null);
  const visemeTrackRef = useRef<VisemeCue[]>([]);
  const visemeRafRef = useRef<number | null>(null);
  const cueIndexRef = useRef(0);
  const lastVisemeRef = useRef<VisemeName>("viseme_sil");

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

  const revokeAudioUrl = useCallback(() => {
    if (!audioObjectUrlRef.current) return;
    URL.revokeObjectURL(audioObjectUrlRef.current);
    audioObjectUrlRef.current = null;
  }, []);

  const stopSpeaking = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsSpeaking(false);
    resetVisemes();
  }, [resetVisemes]);

  const startVisemeLoopFromAudio = useCallback((audio: HTMLAudioElement) => {
    stopVisemeLoop();
    cueIndexRef.current = 0;
    lastVisemeRef.current = "viseme_sil";

    const loop = () => {
      const track = visemeTrackRef.current;
      const t = audio.currentTime;
      while (cueIndexRef.current < track.length && t >= track[cueIndexRef.current].end) {
        cueIndexRef.current += 1;
      }
      const cue = track[cueIndexRef.current];
      const nextViseme: VisemeName = cue ? cue.viseme : "viseme_sil";
      if (lastVisemeRef.current !== nextViseme) {
        lastVisemeRef.current = nextViseme;
        setActiveViseme(nextViseme);
      }
      visemeRafRef.current = requestAnimationFrame(loop);
    };

    visemeRafRef.current = requestAnimationFrame(loop);
  }, [stopVisemeLoop]);

  const speakQuestion = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      stopSpeaking();
      setIsSpeaking(true);

      // Sarvam TTS via backend only.
      // Note: We intentionally do not fall back to browser `speechSynthesis` because that can
      // result in double audio (Sarvam + browser) depending on autoplay/permission behavior.
      try {
        const blob = await synthesizeSarvamSpeech({ text: trimmed });
        revokeAudioUrl();
        const url = URL.createObjectURL(blob);
        audioObjectUrlRef.current = url;

        const audio = audioRef.current ?? new Audio();
        audioRef.current = audio;
        audio.src = url;

        audio.onloadedmetadata = () => {
          // Sarvam endpoint doesn't provide word boundaries here, so we approximate visemes
          // from the transcript and the final audio duration.
          visemeTrackRef.current = createVisemeTrackFromTranscript(trimmed, audio.duration);
          startVisemeLoopFromAudio(audio);
        };

        audio.onended = () => {
          setIsSpeaking(false);
          resetVisemes();
        };

        await audio.play();
        return;
      } catch (err: unknown) {
        // Keep the UI consistent if the audio couldn't be played or TTS isn't configured.
        setIsSpeaking(false);
        resetVisemes();
        message.error(getErrorText(err) || "Text-to-speech failed. Please check Sarvam/Backend TTS configuration.");
      }
    },
    [resetVisemes, revokeAudioUrl, startVisemeLoopFromAudio, stopSpeaking],
  );

  useEffect(() => {
    if (!sessionId) return;
    if (!accessToken) {
      message.error("Please sign in before joining an interview.");
      navigate("/signin");
      return;
    }

    let cancelled = false;
    (async () => {
      setLoadingMeta(true);
      try {
        const meta = await getInterviewSession({ sessionId, accessToken });
        if (!cancelled) setSessionMeta(meta);
      } catch (err: unknown) {
        message.error(getErrorText(err) || "Failed to load interview session.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, navigate, sessionId]);

  const wsUrl = useMemo(() => {
    const base = toWsUrl(String(import.meta.env.VITE_BACKEND_URL || ""));
    return base ? `${base.replace(/\/$/, "")}/interviews/ws` : "";
  }, []);

  const onWsMessage = useCallback(
    (msg: WsEnvelope) => {
      if (!msg || typeof msg.type !== "string") return;

      if (msg.type === "question.next") {
        const payload = msg.payload ?? {};
        const nextQuestion: InterviewQuestion = {
          id: String(payload.question_id ?? payload.id ?? ""),
          question_text: String(payload.question_text ?? ""),
          index: Number(payload.index ?? 0),
        };
        setQuestion(nextQuestion);
        setEvaluation(null);
        setTypedAnswer("");

        if (autoSpeak && nextQuestion.question_text) {
          void speakQuestion(nextQuestion.question_text);
        }
        return;
      }

      if (msg.type === "answer.evaluation") {
        setEvaluation(msg.payload ?? {});
        return;
      }

      if (msg.type === "session.complete") {
        setReport(msg.payload ?? {});
        setIsSpeaking(false);
        resetVisemes();
        return;
      }

      if (msg.type === "error") {
        const payload = (msg.payload ?? {}) as unknown as WsErrorPayload;
        message.error(`${payload.code || "error"}: ${payload.message || "Unknown error"}`);
      }
    },
    [autoSpeak, resetVisemes, speakQuestion],
  );

  const { isConnected, send } = useInterviewSocket({
    wsUrl,
    sessionId: String(sessionId || ""),
    accessToken,
    onMessage: onWsMessage,
  });

  // Speech-to-text state (candidate answer).
  const {
    transcript,
    interimTranscript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  const lastSentLenRef = useRef(0);
  const sttDrivesTypedAnswerRef = useRef(false);
  const transcriptBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!listening || !sessionId) return;

    // Backend buffers partial transcripts; we send small deltas periodically to avoid spam.
    const timer = window.setInterval(() => {
      const combined = `${finalTranscript} ${interimTranscript}`.trim();
      if (!combined) return;

      if (combined.length < lastSentLenRef.current) {
        // Transcript was reset/shortened by the STT engine; restart delta tracking.
        lastSentLenRef.current = combined.length;
        return;
      }

      const delta = combined.slice(lastSentLenRef.current).trim();
      if (!delta) return;

      const ok = send({
        type: "answer.partial",
        session_id: String(sessionId),
        request_id: `partial-${nowIso()}`,
        payload: { transcript_chunk: delta },
      });
      if (ok) lastSentLenRef.current = combined.length;
    }, 1000);

    return () => window.clearInterval(timer);
  }, [finalTranscript, interimTranscript, listening, send, sessionId]);

  useEffect(() => {
    if (!listening) return;
    if (!sttDrivesTypedAnswerRef.current) return;

    // While listening, keep the editable textarea in sync with speech recognition so users
    // can see (and later edit) what the mic is picking up.
    const combined = `${finalTranscript} ${interimTranscript}`.trim();
    setTypedAnswer(combined);
  }, [finalTranscript, interimTranscript, listening]);

  useEffect(() => {
    // Keep the transcript viewport pinned to the latest speech.
    const el = transcriptBoxRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [finalTranscript, interimTranscript]);

  const startListening = async () => {
    if (!browserSupportsSpeechRecognition) {
      message.error("This browser does not support speech recognition.");
      return;
    }
    if (!isMicrophoneAvailable) {
      message.error("Microphone permission denied. Enable mic access for this site.");
      return;
    }
    lastSentLenRef.current = 0;
    resetTranscript();

    // Drive the textarea from STT while the mic is on.
    sttDrivesTypedAnswerRef.current = true;
    setTypedAnswer("");

    try {
      await SpeechRecognition.startListening({
        continuous: true,
        interimResults: true,
        language: "en-US",
      });
    } catch (err: unknown) {
      sttDrivesTypedAnswerRef.current = false;
      message.error(getErrorText(err) || "Failed to start listening.");
    }
  };

  const stopListening = async () => {
    sttDrivesTypedAnswerRef.current = false;
    SpeechRecognition.stopListening();
  };

  const submitAnswerText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      message.warning("Please provide an answer before submitting.");
      return;
    }
    if (!sessionId) return;

    const ok = send({
      type: "answer.final",
      session_id: String(sessionId),
      request_id: `final-${nowIso()}`,
      payload: { transcript_text: trimmed },
    });

    // Even if WS is temporarily down, keep UI responsive.
    if (!ok) {
      message.error("Not connected. Please wait for reconnection and try again.");
      return;
    }

    resetTranscript();
    lastSentLenRef.current = 0;
    setTypedAnswer("");
  };

  const finishSession = async () => {
    if (!sessionId) return;

    const ok = send({
      type: "session.finish",
      session_id: String(sessionId),
      request_id: `finish-${nowIso()}`,
      payload: {},
    });

    // REST fallback helps when WS is unavailable.
    if (!ok) {
      try {
        const r = await finishInterview({ sessionId, accessToken });
        setReport(r);
      } catch (err: unknown) {
        message.error(getErrorText(err) || "Failed to finish interview.");
      }
    }
  };

  useEffect(() => {
    return () => {
      stopSpeaking();
      revokeAudioUrl();
    };
  }, [revokeAudioUrl, stopSpeaking]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="rounded-2xl">
          <Text>Missing session id.</Text>
        </Card>
      </div>
    );
  }

  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spin size="large" />
      </div>
    );
  }

  if (report) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="max-w-3xl mx-auto">
          <Card className="rounded-2xl shadow-sm border border-slate-100">
            <Title level={3} className="m-0!">
              Interview Complete
            </Title>
            <Paragraph className="text-slate-600 mt-2">
              Your session has ended. You can view the final report now.
            </Paragraph>
            <div className="flex gap-3 mt-6">
              <Button onClick={() => navigate("/")}>Back Home</Button>
              <Button
                type="primary"
                className="bg-indigo-600 border-none"
                onClick={() => navigate(`/interview/${sessionId}/report`)}
              >
                View Report
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const progress =
    sessionMeta && sessionMeta.max_questions
      ? `${(question?.index ?? sessionMeta.current_question_index ?? 0) + 1} / ${sessionMeta.max_questions}`
      : "";

  const strengths = evaluation ? asStringArray(evaluation.strengths) : [];
  const weaknesses = evaluation ? asStringArray(evaluation.weaknesses) : [];

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="max-w-6xl mx-auto">
        <header className="mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <Title level={3} className="m-0! tracking-tight">
              Interview Room
            </Title>
            <div className="flex flex-wrap gap-2 mt-2">
              <Tag color={isConnected ? "green" : "orange"}>
                {isConnected ? "WS Connected" : "Reconnecting..."}
              </Tag>
              {sessionMeta?.llm_provider && (
                <Tag color="blue">{sessionMeta.llm_provider}</Tag>
              )}
              {sessionMeta?.llm_mode && <Tag>{sessionMeta.llm_mode}</Tag>}
              {progress && <Tag color="purple">Q {progress}</Tag>}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={() => setAutoSpeak((v) => !v)}>
              Auto Speak: {autoSpeak ? "On" : "Off"}
            </Button>
            <Button danger onClick={finishSession}>
              Finish
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card className="rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <Text className="text-slate-600 font-medium">Interviewer</Text>
              <div className="flex gap-2">
                <Button
                  size="small"
                  onClick={() => question?.question_text && void speakQuestion(question.question_text)}
                  disabled={!question?.question_text || isSpeaking}
                >
                  Speak
                </Button>
                <Button size="small" icon={<StopOutlined />} onClick={stopSpeaking} disabled={!isSpeaking} />
              </div>
            </div>

            <div className="h-[420px] bg-gradient-to-b from-slate-950 to-slate-900 rounded-xl overflow-hidden">
              <Canvas camera={{ position: [0, 1.45, 2.35], fov: 35 }}>
                <ambientLight intensity={0.8} />
                <directionalLight position={[2, 2, 2]} intensity={1.2} />
                <Environment preset="city" />
                <OrbitControls enablePan={false} enableZoom={false} />
                <group position={[0, -1.2, 0]}>
                  <Avatar activeViseme={activeViseme} isSpeaking={isSpeaking} />
                </group>
              </Canvas>
            </div>

            {/* Keep a hidden audio element in the DOM for predictable playback controls/timing. */}
            <audio ref={audioRef} className="hidden" />
          </Card>

          <div className="space-y-5">
            <Card className="rounded-2xl shadow-sm border border-slate-100">
              <Text className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                Current Question
              </Text>
              <Paragraph className="text-lg font-semibold text-slate-900 mt-2 mb-0">
                {question?.question_text || "Waiting for the first question..."}
              </Paragraph>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <Text className="text-slate-600 font-medium">Your Answer</Text>
                <div className="flex gap-2">
                  <Button
                    icon={<AudioOutlined />}
                    onClick={listening ? stopListening : startListening}
                    disabled={!browserSupportsSpeechRecognition}
                  >
                    {listening ? "Stop" : "Speak"}
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    className="bg-indigo-600 border-none"
                    onClick={() => void submitAnswerText(typedAnswer || transcript)}
                  >
                    Submit
                  </Button>
                </div>
              </div>

              {!browserSupportsSpeechRecognition && (
                <Text className="text-xs text-amber-700">
                  Speech recognition not supported on this browser. You can still type your answer below.
                </Text>
              )}
              {browserSupportsSpeechRecognition && !isMicrophoneAvailable && (
                <Text className="text-xs text-amber-700">
                  Microphone is not available. Enable permissions or type your answer.
                </Text>
              )}

              <div
                ref={transcriptBoxRef}
                className="mt-3 p-3 bg-slate-900 text-slate-100 rounded-xl min-h-24 max-h-64 overflow-y-auto leading-relaxed"
              >
                <span className="opacity-100">{finalTranscript}</span>
                <span className="opacity-60 text-sky-300">{interimTranscript}</span>
                {!finalTranscript && !interimTranscript && (
                  <span className="text-slate-500 italic">Waiting for speech...</span>
                )}
              </div>

              <Input.TextArea
                value={typedAnswer}
                onChange={(e) => {
                  // If the user starts editing, stop overwriting the textarea with STT updates.
                  sttDrivesTypedAnswerRef.current = false;
                  setTypedAnswer(e.target.value);
                }}
                placeholder="Optional: type/edit your answer here before submitting"
                className="mt-3 rounded-xl"
                autoSize={{ minRows: 3, maxRows: 7 }}
              />
            </Card>

            {evaluation && (
              <Card className="rounded-2xl shadow-sm border border-slate-100">
                <div className="flex items-center justify-between">
                  <Title level={5} className="m-0!">
                    Feedback
                  </Title>
                  {typeof evaluation.score === "number" && (
                    <Tag color="geekblue">Score: {evaluation.score}</Tag>
                  )}
                </div>

                {evaluation.feedback && (
                  <Paragraph className="text-slate-700 mt-3">
                    {String(evaluation.feedback)}
                  </Paragraph>
                )}

                {strengths.length > 0 && (
                  <div className="mt-3">
                    <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Strengths
                    </Text>
                    <ul className="list-disc pl-5 mt-2 text-slate-700">
                      {strengths.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {weaknesses.length > 0 && (
                  <div className="mt-3">
                    <Text className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Weaknesses
                    </Text>
                    <ul className="list-disc pl-5 mt-2 text-slate-700">
                      {weaknesses.map((w, idx) => (
                        <li key={idx}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default InterviewRoom;
