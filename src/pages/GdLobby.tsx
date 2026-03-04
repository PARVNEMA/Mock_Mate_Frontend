import { useEffect, useMemo, useState } from "react";
import { Button, Card, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useGdLobbySocket } from "../hooks/useGdLobbySocket";
import type {
  GdLobbyWsMessage,
  LobbyUpdateMessage,
  QueueStatusMessage,
} from "../types/gd";
import LobbyStatusCard from "../components/gd/LobbyStatusCard";
import QueueStats from "../components/gd/QueueStats";
import ConnectionBadge from "../components/gd/ConnectionBadge";
import { getMyStatus } from "../services/gdApi";

const { Title, Text } = Typography;

export default function GdLobby() {
  const navigate = useNavigate();
  const { userId } = useAuth();
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState<LobbyUpdateMessage | QueueStatusMessage | null>(
    null,
  );
  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [blacklistedMessage, setBlacklistedMessage] = useState<string | null>(null);

  const baseUrl = useMemo(
    () => String(import.meta.env.VITE_BACKEND_URL || "").replace(/\/$/, ""),
    [],
  );

  const onMessage = (msg: GdLobbyWsMessage) => {
    if (msg.type === "lobby_update" || msg.type === "queue_status") {
      setStatus(msg);
      if ("estimated_wait_seconds" in msg && msg.estimated_wait_seconds) {
        setEstimatedWait(msg.estimated_wait_seconds ?? null);
      }
    } else if (msg.type === "room_created") {
      message.success("Room created! Redirecting...");
      navigate(`/gd/room/${msg.room_id}`);
    } else if (msg.type === "blacklisted") {
      setBlacklistedMessage(msg.message);
      message.error(msg.message);
    } else if (msg.type === "error") {
      message.error(msg.message);
    }
  };

  const { isConnected, close } = useGdLobbySocket({
    httpBaseUrl: baseUrl,
    userId: userId || "",
    enabled: joined && Boolean(userId),
    onMessage,
  });

  useEffect(() => {
    if (!joined || !userId) return;
    const accessToken = String(localStorage.getItem("accessToken") || "");
    if (!accessToken) return;
    let stopped = false;

    const tick = async () => {
      try {
        const status = await getMyStatus(accessToken);
        if (stopped) return;
        if (status.in_room && status.room_id) {
          navigate(`/gd/room/${status.room_id}`);
        }
      } catch {
        // ignore polling errors
      }
    };

    tick();
    const intervalId = window.setInterval(tick, 3000);
    return () => {
      stopped = true;
      window.clearInterval(intervalId);
    };
  }, [joined, userId, navigate]);

  const handleJoin = () => {
    if (!userId) {
      message.error("Please sign in to join the lobby.");
      navigate("/signin");
      return;
    }
    setBlacklistedMessage(null);
    setJoined(true);
  };

  const handleLeave = () => {
    close();
    setJoined(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Title level={2} className="m-0!">
              Group Discussion Lobby
            </Title>
            <Text className="text-slate-500">
              Join the queue to get matched into a GD room.
            </Text>
          </div>
          <ConnectionBadge connected={isConnected} />
        </div>

        {blacklistedMessage && (
          <Card className="border border-red-200 bg-red-50 rounded-2xl">
            <Text type="danger">{blacklistedMessage}</Text>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <LobbyStatusCard status={status} />
          <QueueStats
            waitingCount={status?.waiting_count ?? 0}
            needed={status?.needed ?? 0}
            requiredPlayers={status?.required_players ?? 0}
            estimatedWaitSeconds={estimatedWait}
          />
        </div>

        <div className="flex gap-3">
          {!joined ? (
            <Button type="primary" size="large" onClick={handleJoin}>
              Join Lobby
            </Button>
          ) : (
            <Button danger size="large" onClick={handleLeave}>
              Leave Lobby
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
