import { useCallback, useMemo, useState } from "react";
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

const { Title, Text } = Typography;

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
      if (msg.type === "room_state") {
        setTopic(msg.topic ?? null);
        setContext(msg.context ?? null);
        setKeyPoints(msg.key_points ?? null);
        setPeerIds(msg.peers.map((peer) => peer.user_id));
        handleRoomState(msg.peers, msg.reconnected);
      } else if (msg.type === "peer_joined") {
        setPeerIds((prev) => (prev.includes(msg.peer_id) ? prev : [...prev, msg.peer_id]));
        handlePeerJoined(msg.peer_id);
      } else if (msg.type === "peer_left") {
        setPeerIds((prev) => prev.filter((id) => id !== msg.peer_id));
        handlePeerLeft(msg.peer_id);
      } else if (msg.type === "offer") {
        if (msg.from_user) handleOffer(msg.from_user, msg.sdp);
      } else if (msg.type === "answer") {
        if (msg.from_user) handleAnswer(msg.from_user, msg.sdp);
      } else if (msg.type === "ice_candidate") {
        if (msg.from_user) handleIceCandidate(msg.from_user, msg.candidate);
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

  useGdTranscription({
    enabled: Boolean(isConnected && userId && isAudioEnabled),
    onTranscript: handleTranscript,
  });

  const handleLeave = async () => {
    send({ type: "leave_room" });
    close();
    stopAll();
    if (roomId) {
      const accessToken = String(localStorage.getItem("accessToken") || "");
      if (accessToken) {
        try {
          await leaveRoomRest(accessToken);
        } catch {}
      }
    }
    navigate("/gd");
  };

  const openReport = (peerId: string) => {
    setReportPeerId(peerId);
    setReportOpen(true);
  };

  const handleReportSubmit = async (payload: ReportRequest) => {
    if (!roomId) return;
    setReportOpen(false);
    if (send({ type: "report", ...payload })) {
      return;
    }
    const accessToken = String(localStorage.getItem("accessToken") || "");
    if (accessToken) {
      try {
        await reportPeerRest(accessToken, roomId, payload);
        message.success("Report submitted.");
      } catch {
        message.error("Report failed.");
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
