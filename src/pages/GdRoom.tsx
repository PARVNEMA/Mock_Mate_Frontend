import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Typography, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGdRoomSocket } from "../hooks/useGdRoomSocket";
import { useGdWebRtc } from "../hooks/useGdWebRtc";
import { useGdTranscription } from "../hooks/useGdTranscription";
import type { GdRoomWsMessage, ReportRequest } from "../types/gd";
import ParticipantGrid from "../components/gd/ParticipantGrid";
import MediaControls from "../components/gd/MediaControls";
import TopicPanel from "../components/gd/TopicPanel";
import ConnectionBadge from "../components/gd/ConnectionBadge";
import ReportModal from "../components/gd/ReportModal";
import TranscriptPanel from "../components/gd/TranscriptPanel";
import { reportPeer as reportPeerRest, leaveRoom as leaveRoomRest } from "../services/gdApi";
import createLogger from "../utils/logger";

const { Title, Text } = Typography;
const logger = createLogger("GdRoom");

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
    { id: string; userId: string; text: string; timestamp: number }[]
  >([]);

  const normalizePeerIds = useCallback(
    (ids: string[]): string[] => {
      const unique = new Set<string>();
      ids.forEach((id) => {
        if (!id) return;
        if (id === userId) return;
        unique.add(id);
      });
      return [...unique];
    },
    [userId],
  );

  const baseUrl = useMemo(
    () => String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    [],
  );

  const setTopicFromRoomState = useCallback(
    (msg: GdRoomWsMessage) => {
      if (msg.type !== "room_state") return;
      const raw = msg as Record<string, unknown>;
      const topicValue =
        msg.topic ??
        (typeof raw.topic_title === "string" ? raw.topic_title : null) ??
        null;
      const contextValue =
        msg.context ??
        (typeof raw.topic_context === "string" ? raw.topic_context : null) ??
        null;
      const points =
        Array.isArray(msg.key_points) && msg.key_points.length > 0
          ? msg.key_points
          : Array.isArray(raw.key_points)
            ? raw.key_points.filter((item): item is string => typeof item === "string")
            : null;
      setTopic(topicValue);
      setContext(contextValue);
      setKeyPoints(points);
    },
    [setTopic, setContext, setKeyPoints],
  );

  const { isConnected, send, close } = useGdRoomSocket({
    httpBaseUrl: baseUrl,
    roomId: roomId || "",
    userId: userId || "",
    enabled: Boolean(roomId && userId),
    onMessage: (msg: GdRoomWsMessage) => {
      logger.debug("Room message received", { type: msg.type });
      if (msg.type === "room_state") {
        setTopicFromRoomState(msg);
        setPeerIds(normalizePeerIds(msg.peers.map((peer) => peer.user_id)));
        void handleRoomState(msg.peers, msg.reconnected).catch((error) => {
          logger.error("Failed handling room_state", error);
        });
      } else if (msg.type === "peer_joined") {
        if (msg.peer_id === userId) {
          logger.debug("Ignoring self peer_joined event", { peerId: msg.peer_id });
          return;
        }
        setPeerIds((prev) => (prev.includes(msg.peer_id) ? prev : [...prev, msg.peer_id]));
        void handlePeerJoined(msg.peer_id).catch((error) => {
          logger.error("Failed handling peer_joined", error);
        });
      } else if (msg.type === "peer_left") {
        setPeerIds((prev) => prev.filter((id) => id !== msg.peer_id));
        handlePeerLeft(msg.peer_id);
      } else if (msg.type === "offer") {
        if (msg.from_user) {
          void handleOffer(msg.from_user, msg.sdp).catch((error) => {
            logger.error("Failed handling offer", error);
          });
        }
      } else if (msg.type === "answer") {
        if (msg.from_user) {
          void handleAnswer(msg.from_user, msg.sdp).catch((error) => {
            logger.error("Failed handling answer", error);
          });
        }
      } else if (msg.type === "ice_candidate") {
        if (msg.from_user) {
          void handleIceCandidate(msg.from_user, msg.candidate).catch((error) => {
            logger.error("Failed handling ice_candidate", error);
          });
        }
      } else if (msg.type === "warning") {
        message.warning(msg.message);
      } else if (msg.type === "blacklisted") {
        message.error(msg.message);
        navigate("/gd");
      } else if (msg.type === "room_ended") {
        message.info(msg.reason || "Room ended.");
        navigate("/gd");
      } else if (msg.type === "report_ack") {
        message.success(msg.message);
      } else if (msg.type === "transcript") {
        if (!msg.text?.trim()) return;
        const nowMs = Date.now();
        setTranscripts((prev) => [
          ...prev,
          {
            id: `${msg.from_user || "peer"}-${msg.timestamp || nowMs}`,
            userId: msg.from_user || "peer",
            text: msg.text,
            timestamp: msg.timestamp || nowMs / 1000,
          },
        ]);
      } else if (msg.type === "error") {
        message.error(msg.message);
      }
    },
  });

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
    toggleVideo,
    stopAll,
  } = useGdWebRtc({
    send: (payload) => send(payload),
  });

  const handleTranscript = useCallback(
    (text: string) => {
      const now = Date.now();
      setTranscripts((prev) => [
        ...prev,
        {
          id: `${userId || "local"}-${now}`,
          userId: userId || "local",
          text,
          timestamp: now / 1000,
        },
      ]);
    },
    [userId],
  );

  useEffect(() => {
    if (!roomId || !userId) return;
    logger.info("Initializing local media on room join", { roomId, userId });
    void initLocalMedia().catch((error) => {
      logger.error("Failed to initialize local media on room join", error);
      message.error("Please allow camera and microphone permissions to join the room.");
    });
  }, [roomId, userId, initLocalMedia]);

  useGdTranscription({
    enabled: Boolean(isConnected && userId && isAudioEnabled),
    onTranscript: handleTranscript,
  });

  const handleLeave = async () => {
    logger.info("Leaving GD room", { roomId, userId });
    send({ type: "leave_room" });
    close();
    stopAll();
    if (roomId) {
      const accessToken = String(localStorage.getItem("accessToken") || "");
      if (accessToken) {
        try {
          await leaveRoomRest(accessToken);
          logger.info("Leave room REST call completed");
        } catch {}
      }
    }
    navigate("/gd");
  };

  const openReport = (peerId: string) => {
    logger.info("Opening report modal", { peerId });
    setReportPeerId(peerId);
    setReportOpen(true);
  };

  const handleReportSubmit = async (payload: ReportRequest) => {
    if (!roomId) return;
    setReportOpen(false);
    if (send({ type: "report", ...payload })) {
      logger.info("Report sent via WS", {
        roomId,
        reported_user_id: payload.reported_user_id,
      });
      return;
    }
    const accessToken = String(localStorage.getItem("accessToken") || "");
    if (accessToken) {
      try {
        await reportPeerRest(accessToken, roomId, payload);
        message.success("Report submitted.");
        logger.info("Report submitted via REST fallback", {
          roomId,
          reported_user_id: payload.reported_user_id,
        });
      } catch {
        message.error("Report failed.");
        logger.error("Report REST fallback failed", {
          roomId,
          reported_user_id: payload.reported_user_id,
        });
      }
    }
  };

  if (!roomId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-xl mx-auto rounded-2xl">
          <Title level={4} className="m-0!">
            Missing room id
          </Title>
        </Card>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Card className="max-w-xl mx-auto rounded-2xl">
          <Title level={4} className="m-0!">
            Please sign in to join the room.
          </Title>
          <Button className="mt-4" type="primary" onClick={() => navigate("/signin")}>
            Go to Sign In
          </Button>
        </Card>
      </div>
    );
  }

  const reportablePeers = peerIds;

  return (
    <div className="h-[100dvh] overflow-hidden bg-gradient-to-b from-slate-100 to-white p-3 md:p-4">
      <div className="mx-auto flex h-full w-full max-w-[1440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 md:px-5">
          <div>
            <Title level={3} className="m-0!">
              GD Room
            </Title>
            <Text className="text-slate-500">Room ID: {roomId}</Text>
          </div>
          <div className="flex items-center gap-3">
            <Text className="hidden text-slate-500 md:inline">Peers: {peerIds.length + 1}</Text>
            <ConnectionBadge connected={isConnected} />
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-5">
              <ParticipantGrid
                localStream={localStream}
                remoteStreams={remoteStreams}
                remotePeerIds={peerIds}
              />
              <div className="mt-4 grid gap-4 lg:hidden">
                <TopicPanel topic={topic} context={context} keyPoints={keyPoints} />
                <Card className="rounded-2xl border border-slate-100">
                  <Title level={5} className="m-0!">
                    Report a participant
                  </Title>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {reportablePeers.length === 0 && (
                      <Text className="text-slate-500">No peers to report.</Text>
                    )}
                    {reportablePeers.map((peerId) => (
                      <Button key={peerId} onClick={() => openReport(peerId)} size="small">
                        Report {peerId}
                      </Button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 md:px-5">
              <div className="h-[28vh] min-h-[180px] max-h-[300px] md:h-[24vh] md:min-h-[200px] md:max-h-[340px]">
                <TranscriptPanel items={transcripts} />
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 md:px-5">
              <MediaControls
                isAudioEnabled={isAudioEnabled}
                isVideoEnabled={isVideoEnabled}
                onToggleAudio={toggleAudio}
                onToggleVideo={toggleVideo}
                onLeave={handleLeave}
              />
            </div>
          </section>

          <aside className="hidden w-[340px] flex-col border-l border-slate-200 bg-slate-50/70 lg:flex">
            <div className="border-b border-slate-200 p-4">
              <TopicPanel topic={topic} context={context} keyPoints={keyPoints} />
            </div>
            <div className="min-h-0 flex-1 p-4" />
            <div className="border-t border-slate-200 p-4">
              <Card className="rounded-2xl border border-slate-100">
                <Title level={5} className="m-0!">
                  Report a participant
                </Title>
                <div className="mt-3 flex flex-wrap gap-2">
                  {reportablePeers.length === 0 && (
                    <Text className="text-slate-500">No peers to report.</Text>
                  )}
                  {reportablePeers.map((peerId) => (
                    <Button key={peerId} onClick={() => openReport(peerId)} size="small">
                      Report {peerId}
                    </Button>
                  ))}
                </div>
              </Card>
            </div>
          </aside>
        </div>
      </div>

      <ReportModal
        open={reportOpen}
        peerId={reportPeerId}
        onCancel={() => setReportOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </div>
  );
}
