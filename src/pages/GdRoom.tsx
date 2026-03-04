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

  const { isConnected, send, close } = useGdRoomSocket({
    httpBaseUrl: baseUrl,
    roomId: roomId || "",
    userId: userId || "",
    enabled: Boolean(roomId && userId),
    onMessage: (msg: GdRoomWsMessage) => {
      logger.debug("Room message received", { type: msg.type });
      if (msg.type === "room_state") {
        setTopic(msg.topic ?? null);
        setContext(msg.context ?? null);
        setKeyPoints(msg.key_points ?? null);
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
        if (!msg.text) return;
        setTranscripts((prev) => [
          ...prev,
          {
            id: `${msg.from_user || "unknown"}-${msg.timestamp || Date.now()}`,
            userId: msg.from_user || "unknown",
            text: msg.text,
            timestamp: msg.timestamp || Date.now() / 1000,
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
      send({ type: "transcript", text });
    },
    [send],
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
    enabled: Boolean(isConnected && userId && isAudioEnabled && localStream),
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
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Title level={2} className="m-0!">
              GD Room
            </Title>
            <Text className="text-slate-500">Room ID: {roomId}</Text>
          </div>
          <ConnectionBadge connected={isConnected} />
        </div>

        <TopicPanel topic={topic} context={context} keyPoints={keyPoints} />

        <MediaControls
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onLeave={handleLeave}
        />

        <ParticipantGrid
          localStream={localStream}
          remoteStreams={remoteStreams}
          remotePeerIds={peerIds}
        />

        <TranscriptPanel items={transcripts} />

        <Card className="rounded-2xl border border-slate-100">
          <Title level={4} className="m-0!">
            Report a participant
          </Title>
          <div className="mt-3 flex flex-wrap gap-2">
            {reportablePeers.length === 0 && (
              <Text className="text-slate-500">No peers to report.</Text>
            )}
            {reportablePeers.map((peerId) => (
              <Button key={peerId} onClick={() => openReport(peerId)}>
                Report {peerId}
              </Button>
            ))}
          </div>
        </Card>
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
