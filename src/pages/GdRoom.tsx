import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Typography, message, Space, Divider, Alert } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGdRoomSocket } from "../hooks/useGdRoomSocket";
import { useGdWebRtc } from "../hooks/useGdWebRtc";
import { useGdTranscription } from "../hooks/useGdTranscription";
import type { GdRoomWsMessage } from "../types/gd";
import ParticipantGrid from "../components/gd/ParticipantGrid";
import MediaControls from "../components/gd/MediaControls";
import TopicPanel from "../components/gd/TopicPanel";
import ConnectionBadge from "../components/gd/ConnectionBadge";
import ReportModal from "../components/gd/ReportModal";
import TranscriptPanel from "../components/gd/TranscriptPanel";
import {
  endGdSession,
  endRoom,
  getRoomInfo,
  leaveRoom as leaveRoomRest,
  reportPeer as reportPeerRest,
  startGdSession,
} from "../services/gdApi";
import { getGdRoomHost, getGdRoomSessionId, saveGdRoomSessionId } from "../utils/gdSession";
import {
  InfoCircleOutlined,
  UsergroupAddOutlined,
  LogoutOutlined,
  WarningOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;
const gdConsole = (...args: unknown[]) => console.log("[GD ROOM]", ...args);

export default function GdRoom() {
  const navigate = useNavigate();
  const { roomId } = useParams<{ roomId: string }>();
  const { userId } = useAuth();

  const [topic, setTopic] = useState<string | null>(null);
  const [context, setContext] = useState<string | null>(null);
  const [keyPoints, setKeyPoints] = useState<string[] | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPeerId, setReportPeerId] = useState<string | null>(null);
  const [peerIds, setPeerIds] = useState<string[]>([]);
  const [transcripts, setTranscripts] = useState<
    { id: string; userId: string; speakerName?: string; text: string; timestampMs: number }[]
  >([]);
  const [sttSupported, setSttSupported] = useState(true);
  const [sttActive, setSttActive] = useState(false);
  const [sessionId, setSessionId] = useState(() =>
    roomId ? getGdRoomSessionId(roomId) : "",
  );
  const [sessionStarting, setSessionStarting] = useState(false);
  const [sessionEnding, setSessionEnding] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number>(0);
  const [muteCountdown, setMuteCountdown] = useState(0);
  const [mutedPeerIds, setMutedPeerIds] = useState<string[]>([]);
  const recentTranscriptMapRef = useRef<Map<string, number>>(new Map());
  const wsSendRef = useRef<(payload: unknown) => boolean>(() => false);
  const sessionIdRef = useRef(sessionId);

  const accessToken = useMemo(
    () => String(localStorage.getItem("accessToken") || ""),
    [],
  );
  const hostUserId = useMemo(() => (roomId ? getGdRoomHost(roomId) : ""), [roomId]);
  const isHost = Boolean(userId && hostUserId && userId === hostUserId);
  const roomInfoFetchedRef = useRef(false);

  const appendTranscript = useCallback(
    (item: { id: string; userId: string; speakerName?: string; text: string; timestampMs: number }) => {
      const text = item.text.trim();
      if (!text) return;
      const nowMs = Date.now();
      const dedupeKey = `${item.userId}:${text.toLowerCase()}`;
      const seenAt = recentTranscriptMapRef.current.get(dedupeKey) ?? 0;
      if (nowMs - seenAt < 1500) return;
      recentTranscriptMapRef.current.set(dedupeKey, nowMs);
      setTranscripts((prev) => {
        const next = [...prev, { ...item, text }];
        return next.length > 200 ? next.slice(next.length - 200) : next;
      });
    },
    [],
  );

  const normalizePeerIds = useCallback(
    (ids: string[]): string[] => {
      const unique = new Set<string>();
      ids.forEach((id) => {
        if (id && id !== userId) unique.add(id);
      });
      return [...unique];
    },
    [userId],
  );

  const baseUrl = useMemo(
    () => String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    [],
  );

  const setTopicFromRoomState = useCallback((msg: GdRoomWsMessage) => {
    if (msg.type !== "room_state") return;
    const raw = msg as Record<string, any>;
    setTopic(msg.topic ?? raw.topic_title ?? null);
    setContext(msg.context ?? raw.topic_context ?? null);
    setKeyPoints(msg.key_points ?? raw.key_points ?? null);
  }, []);

  const {
    localStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    initLocalMedia,
    handleRoomState,
    handlePeerJoined,
    handlePeerLeft,
    handleOffer,
    handleAnswer,
    handleIceCandidate,
    toggleAudio,
    setAudioEnabled,
    toggleVideo,
    stopAll,
  } = useGdWebRtc({ send: (payload) => void wsSendRef.current(payload) });

  const { isConnected, send, close } = useGdRoomSocket({
    httpBaseUrl: baseUrl,
    roomId: roomId || "",
    userId: userId || "",
    enabled: Boolean(roomId && userId),
    onMessage: (msg: GdRoomWsMessage) => {
      const rawType = String((msg as any)?.type || "");
      const rawSessionId = String((msg as any)?.session_id || (msg as any)?.gd_session_id || "").trim();
      if (rawSessionId && rawSessionId !== sessionId) {
        gdConsole("Session ID discovered from incoming event payload", { rawType, rawSessionId });
        setSessionId(rawSessionId);
        if (roomId) saveGdRoomSessionId(roomId, rawSessionId);
      }
      gdConsole("WS message received", { type: rawType, msg });
      if (rawType === "room_state") {
        setTopicFromRoomState(msg);
        const roomStateRaw = msg as Record<string, any>;
        const roomStateSessionId = String(roomStateRaw.session_id || roomStateRaw.gd_session_id || "").trim();
        if (roomStateSessionId && roomStateSessionId !== sessionId) {
          gdConsole("Session ID found in room_state", { roomStateSessionId });
          setSessionId(roomStateSessionId);
          if (roomId) saveGdRoomSessionId(roomId, roomStateSessionId);
        }
        setPeerIds(normalizePeerIds((msg as any).peers.map((p: any) => p.user_id)));
        void handleRoomState((msg as any).peers, (msg as any).reconnected);
      } else if (rawType === "warning") {
        gdConsole("Warning message", (msg as any).message);
        message.warning((msg as any).message);
      } else if (rawType === "error") {
        gdConsole("Error message from server", (msg as any).message);
        message.error((msg as any).message || "A room error occurred.");
      } else if (rawType === "topic_generated" || rawType === "room_ready") {
        const raw = msg as Record<string, any>;
        const nextTopic = String(raw.topic || raw.topic_title || "").trim();
        const nextContext = String(raw.context || raw.topic_context || "").trim();
        const nextKeyPoints = Array.isArray(raw.key_points) ? raw.key_points : null;
        gdConsole("Topic/room-ready event parsed", { nextTopic, nextContext, nextKeyPoints });
        if (nextTopic) setTopic(nextTopic);
        if (nextContext) setContext(nextContext);
        if (nextKeyPoints) setKeyPoints(nextKeyPoints);
      } else if (rawType === "peer_joined") {
        if ((msg as any).peer_id !== userId) {
          setPeerIds((prev) => (prev.includes((msg as any).peer_id) ? prev : [...prev, (msg as any).peer_id]));
          void handlePeerJoined((msg as any).peer_id);
        }
      } else if (rawType === "peer_left") {
        setPeerIds((prev) => prev.filter((id) => id !== (msg as any).peer_id));
        setMutedPeerIds((prev) => prev.filter((id) => id !== (msg as any).peer_id));
        handlePeerLeft((msg as any).peer_id);
      } else if (rawType === "offer" && (msg as any).from_user) {
        void handleOffer((msg as any).from_user, (msg as any).sdp);
      } else if (rawType === "answer" && (msg as any).from_user) {
        void handleAnswer((msg as any).from_user, (msg as any).sdp);
      } else if (rawType === "ice_candidate" && (msg as any).from_user) {
        void handleIceCandidate((msg as any).from_user, (msg as any).candidate);
      } else if (
        (rawType === "gd_session_started" || rawType === "session_started") &&
        (msg as any).session_id
      ) {
        gdConsole("GD session started event", { sessionId: (msg as any).session_id, fromHost: (msg as any).host_id });
        setSessionId((msg as any).session_id);
        if (roomId) saveGdRoomSessionId(roomId, (msg as any).session_id);
      } else if (rawType === "transcript" && (msg as any).text?.trim()) {
        const speakerId = (msg as any).speaker_id || (msg as any).from_user || "peer";
        appendTranscript({
          id: `${speakerId}-${(msg as any).timestamp_ms || Date.now()}`,
          userId: speakerId,
          speakerName: (msg as any).name || speakerId,
          text: (msg as any).text,
          timestampMs: (msg as any).timestamp_ms || Date.now(),
        });
      } else if (rawType === "alert") {
        const who = (msg as any).participant_id ? ` (${(msg as any).participant_id.slice(0, 6)})` : "";
        if ((msg as any).alert_type === "off_topic") {
          message.warning(`Off-topic warning: ${(msg as any).message}`);
        } else {
          message.warning(`${(msg as any).alert_type}${who}: ${(msg as any).message}`);
        }
      } else if (rawType === "mute") {
        const targetId = (msg as any).participant_id;
        setMutedPeerIds((prev) => (prev.includes(targetId) ? prev : [...prev, targetId]));
        window.setTimeout(() => {
          setMutedPeerIds((prev) => prev.filter((id) => id !== targetId));
        }, (msg as any).duration_s * 1000);
        if (targetId === userId) {
          const until = Date.now() + (msg as any).duration_s * 1000;
          setMutedUntil(until);
          setAudioEnabled(false);
          message.error(`You are muted for ${(msg as any).duration_s}s due to a policy violation.`);
        }
      } else if (rawType === "room_ended" || rawType === "blacklisted") {
        const raw = msg as Record<string, any>;
        const infoMessage = String(raw.message || raw.reason || "Session ended.");
        gdConsole("Room terminated event", { type: rawType, infoMessage });
        message.info(infoMessage);
        if (sessionId) {
          navigate(`/gd/report/${sessionId}`);
        } else {
          navigate("/gd");
        }
      }
    },
  });

  useEffect(() => {
    wsSendRef.current = send;
  }, [send]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);
  
  useEffect(() => {
    gdConsole("Room state snapshot", {
      roomId,
      userId,
      hostUserId,
      isHost,
      hasTopic: Boolean(topic),
      sessionId,
      isConnected,
    });
  }, [roomId, userId, hostUserId, isHost, topic, sessionId, isConnected]);

  useEffect(() => {
    if (!roomId || !accessToken || roomInfoFetchedRef.current) return;
    roomInfoFetchedRef.current = true;
    void (async () => {
      try {
        gdConsole("Fetching room info fallback", { roomId });
        const info = await getRoomInfo(accessToken, roomId);
        gdConsole("Room info fetched", info);
        if (!topic && info.topic) setTopic(info.topic);
        if (!context && info.context) setContext(info.context);
        if ((!keyPoints || keyPoints.length === 0) && Array.isArray(info.key_points)) {
          setKeyPoints(info.key_points);
        }
      } catch (err) {
        console.error("[GD ROOM] Failed to fetch room info fallback", err);
      }
    })();
  }, [roomId, accessToken, topic, context, keyPoints]);

  useEffect(() => {
    if (!roomId || !accessToken || sessionId) return;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const info = await getRoomInfo(accessToken, roomId);
          const discoveredSessionId = String(
            (info as any)?.gd_session_id || (info as any)?.session_id || "",
          ).trim();
          if (!discoveredSessionId) return;
          gdConsole("Session ID discovered from room info polling", { discoveredSessionId });
          setSessionId(discoveredSessionId);
          saveGdRoomSessionId(roomId, discoveredSessionId);
        } catch (err) {
          console.error("[GD ROOM] Session polling failed", err);
        }
      })();
    }, 2000);
    return () => window.clearInterval(intervalId);
  }, [roomId, accessToken, sessionId]);

  const handleTranscript = useCallback(
    (text: string) => {
      const cleanText = text.trim();
      if (!cleanText) return;

      let resolvedSessionId = sessionIdRef.current;
      if (!resolvedSessionId && roomId) {
        resolvedSessionId = getGdRoomSessionId(roomId);
      }
      if (!resolvedSessionId) return;

      const sent = send({
        type: "transcript",
        session_id: resolvedSessionId,
        text: cleanText,
        word_count: cleanText.split(/\s+/).filter(Boolean).length,
        timestamp_ms: Date.now(),
      });
      if (!sent || !userId) return;

      appendTranscript({
        id: `${userId}-${Date.now()}`,
        userId,
        speakerName: "You",
        text: cleanText,
        timestampMs: Date.now(),
      });
    },
    [appendTranscript, roomId, send, userId],
  );

  useEffect(() => {
    if (roomId && userId) void initLocalMedia();
  }, [roomId, userId, initLocalMedia]);

  useEffect(() => {
    if (!mutedUntil || mutedUntil <= Date.now()) {
      setMuteCountdown(0);
      return;
    }
    const id = window.setInterval(() => {
      const remain = Math.max(0, Math.ceil((mutedUntil - Date.now()) / 1000));
      setMuteCountdown(remain);
      if (remain <= 0) {
        setAudioEnabled(true);
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [mutedUntil, setAudioEnabled]);

  useGdTranscription({
    enabled: Boolean(isConnected && userId && isAudioEnabled && muteCountdown <= 0),
    onTranscript: handleTranscript,
    onStatusChange: (status) => {
      setSttSupported(status.supported);
      setSttActive(status.active);
    },
  });

  const startSession = async () => {
    gdConsole("Start session requested", { roomId, topic, isHost, userId, hostUserId, isConnected });
    if (!roomId || !topic || !isHost) {
      gdConsole("Start session blocked by preconditions", {
        hasRoomId: Boolean(roomId),
        hasTopic: Boolean(topic),
        isHost,
      });
      return;
    }
    if (!accessToken) {
      message.error("Please sign in first.");
      navigate("/signin");
      return;
    }
    setSessionStarting(true);
    try {
      const started = await startGdSession({ roomId, topic, accessToken });
      gdConsole("startGdSession API success", started);
      setSessionId(started.session_id);
      saveGdRoomSessionId(roomId, started.session_id);
      const sent = send({
        type: "gd_session_started",
        session_id: started.session_id,
        room_id: roomId,
        host_id: userId || "",
      });
      gdConsole("Broadcast gd_session_started", { sent });
      message.success("GD session started.");
    } catch (err: any) {
      console.error("[GD ROOM] startGdSession API failed", err);
      message.error(err?.response?.data?.detail || "Could not start session.");
    } finally {
      setSessionStarting(false);
    }
  };

  const endSession = async () => {
    gdConsole("End session requested", { sessionId, roomId, hasAccessToken: Boolean(accessToken) });
    if (!sessionId || !roomId || !accessToken) return;
    setSessionEnding(true);
    try {
      await endGdSession({ sessionId, accessToken });
      gdConsole("endGdSession API success", { sessionId });
      await endRoom(accessToken, roomId);
      gdConsole("endRoom API success", { roomId });
    } catch (err: any) {
      console.error("[GD ROOM] endGdSession API failed", err);
      message.error(err?.response?.data?.detail || "Could not end session.");
    } finally {
      setSessionEnding(false);
    }
  };

  const handleLeave = async () => {
    gdConsole("Leave room requested", { roomId, userId });
    send({ type: "leave_room" });
    close();
    stopAll();
    if (accessToken)
      try {
        await leaveRoomRest(accessToken);
      } catch {}
    navigate("/gd");
  };

  if (!roomId || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <Card className="w-full max-w-md rounded-3xl! border-none bg-slate-900 text-center">
          <InfoCircleOutlined className="mb-4 text-4xl text-indigo-500" />
          <Title level={4} className="text-white!">
            Session Unavailable
          </Title>
          <Text className="text-slate-400">
            Please sign in and provide a valid Room ID to join the discussion.
          </Text>
          <Button
            type="primary"
            block
            className="mt-8 h-12 rounded-xl! bg-indigo-600! border-none"
            onClick={() => navigate("/signin")}
          >
            Sign In to Join
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-dvh overflow-hidden bg-slate-950 p-2 md:p-4 transition-colors duration-500">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-4xl border border-slate-800 bg-slate-900/50 shadow-2xl backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <Space size="large">
            <div>
              <Title level={4} className="m-0! font-black! tracking-tight! text-white! flex items-center gap-2">
                <UsergroupAddOutlined className="text-indigo-500" /> GD Session
              </Title>
              <Text className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                Room: {roomId}
              </Text>
            </div>
          </Space>
          <Space size="middle">
            {isHost ? (
              <>
                <Button
                  type="primary"
                  disabled={Boolean(sessionId) || sessionStarting || !topic}
                  loading={sessionStarting}
                  onClick={startSession}
                >
                  Start GD
                </Button>
                <Button danger disabled={!sessionId || sessionEnding} loading={sessionEnding} onClick={endSession}>
                  End GD
                </Button>
              </>
            ) : null}
            <ConnectionBadge connected={isConnected} />
          </Space>
        </div>

        <div className="flex min-h-0 flex-1">
          <section className="flex flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
              <ParticipantGrid
                localStream={localStream}
                remoteStreams={remoteStreams}
                remotePeerIds={peerIds}
                mutedParticipantIds={mutedPeerIds}
                isLocalMuted={muteCountdown > 0}
              />
              <div className="mt-6 grid gap-4 lg:hidden">
                <TopicPanel topic={topic} context={context} keyPoints={keyPoints} />
                <Card className="rounded-2xl! border-slate-800 bg-slate-900/80">
                  <Title level={5} className="text-slate-300! mb-4! flex items-center gap-2">
                    <WarningOutlined className="text-amber-500" /> Moderation
                  </Title>
                  <div className="flex flex-wrap gap-2">
                    {peerIds.map((id) => (
                      <Button
                        key={id}
                        ghost
                        size="small"
                        className="rounded-lg! border-slate-700 text-slate-400 hover:text-red-400!"
                        onClick={() => {
                          setReportPeerId(id);
                          setReportOpen(true);
                        }}
                      >
                        Report {id.slice(0, 6)}...
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-800 bg-slate-950/50 px-4 py-2">
              <div className="h-[22vh] min-h-40 max-h-70">
                {!sessionId && <Alert className="mb-2" type="info" showIcon message="Waiting for host to start GD session." />}
                {muteCountdown > 0 && (
                  <Alert className="mb-2" type="error" showIcon message={`You are muted for ${muteCountdown}s.`} />
                )}
                {!sttSupported && (
                  <Alert
                    className="mb-2"
                    type="warning"
                    showIcon
                    message="Live transcription is not supported in this browser. Audio/video still works."
                  />
                )}
                {sttSupported && !sttActive && isAudioEnabled && muteCountdown <= 0 && (
                  <Alert className="mb-2" type="info" showIcon message="Transcription is reconnecting. It will resume automatically." />
                )}
                <TranscriptPanel items={transcripts} />
              </div>
            </div>

            <div className="border-t border-slate-800 bg-slate-900 px-6 py-4">
              <MediaControls
                isAudioEnabled={isAudioEnabled && muteCountdown <= 0}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onLeave={handleLeave}
              />
            </div>
          </section>

          <aside className="hidden w-95 flex-col border-l border-slate-800 bg-slate-900/30 lg:flex">
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
              <TopicPanel topic={topic} context={context} keyPoints={keyPoints} />
              <Divider className="border-slate-800" />
              <Card className="rounded-2xl! border-slate-800 bg-indigo-500/5 backdrop-blur-sm p-2">
                <Title level={5} className="text-white! mb-4! text-sm! uppercase tracking-widest opacity-70">
                  Moderation Tools
                </Title>
                <div className="space-y-2">
                  {peerIds.length === 0 ? (
                    <Text className="text-slate-600 italic block text-center py-4">Waiting for peers...</Text>
                  ) : (
                    peerIds.map((peerId) => (
                      <div
                        key={peerId}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-slate-700/50"
                      >
                        <Text className="text-slate-300 font-mono text-xs">{peerId.slice(0, 12)}...</Text>
                        <Button
                          danger
                          type="text"
                          size="small"
                          icon={<WarningOutlined />}
                          onClick={() => {
                            setReportPeerId(peerId);
                            setReportOpen(true);
                          }}
                        >
                          Report
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            <div className="p-6 border-t border-slate-800">
              <Button
                block
                danger
                icon={<LogoutOutlined />}
                className="h-12 rounded-xl! border-red-500/30! bg-red-500/10! hover:bg-red-500! font-bold"
                onClick={handleLeave}
              >
                Leave Room
              </Button>
            </div>
          </aside>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        peerId={reportPeerId}
        onCancel={() => setReportOpen(false)}
        onSubmit={async (p) => {
          setReportOpen(false);
          if (!send({ type: "report", ...p })) {
            const token = localStorage.getItem("accessToken");
            if (token && roomId) await reportPeerRest(token, roomId, p);
          }
          message.success("User reported to moderators.");
        }}
      />
    </div>
  );
}
