export type UserStatus = "waiting" | "in_room" | "disconnected" | "blacklisted";
export type RoomStatus = "waiting" | "active" | "ended";

export type WsMessageType =
  | "lobby_update"
  | "queue_status"
  | "room_created"
  | "blacklisted"
  | "heartbeat"
  | "error"
  | "room_state"
  | "room_ready"
  | "peer_joined"
  | "peer_left"
  | "offer"
  | "answer"
  | "ice_candidate"
  | "signal"
  | "transcript"
  | "topic_generated"
  | "room_ended"
  | "warning"
  | "report"
  | "report_ack";

export type LobbyJoinResponse = {
  user_id: string;
  position: number;
  waiting_count: number;
  needed: number;
  required_players: number;
  estimated_wait_seconds?: number | null;
};

export type LobbyStatusResponse = {
  waiting_count: number;
  your_position?: number | null;
  needed: number;
  required_players: number;
};

export type LobbyMeStatus = {
  user_id: string;
  is_blacklisted: boolean;
  ban_info?: Record<string, unknown> | null;
  violations: number;
  in_room: boolean;
  room_id?: string | null;
  in_queue: boolean;
  queue_position?: number | null;
  queue_total: number;
};

export type Participant = {
  user_id: string;
  status?: UserStatus | null;
};

export type RoomInfo = {
  room_id: string;
  topic?: string | null;
  context?: string | null;
  key_points?: string[] | null;
  participants: string[];
  status?: RoomStatus;
  created_at?: number | string;
  live_peers?: PeerInfo[];
  live_peer_count?: number;
};

export type PeerInfo = {
  user_id: string;
  joined_at: number;
};

export type LobbyUpdateMessage = {
  type: "lobby_update";
  waiting_count: number;
  needed: number;
  your_position?: number | null;
  required_players: number;
};

export type QueueStatusMessage = {
  type: "queue_status";
  waiting_count: number;
  needed: number;
  your_position?: number | null;
  required_players: number;
  estimated_wait_seconds?: number | null;
};

export type RoomCreatedMessage = {
  type: "room_created";
  room_id: string;
  users: string[];
  participant_count: number;
  topic?: string | null;
};

export type BlacklistedMessage = {
  type: "blacklisted";
  message: string;
  banned_until?: number | null;
  violations?: number;
  is_blacklisted?: boolean;
};

export type HeartbeatMessage = {
  type: "heartbeat";
  timestamp: number;
};

export type ErrorMessage = {
  type: "error";
  message: string;
  code?: string;
};

export type RoomStateMessage = {
  type: "room_state";
  room_id: string;
  peers: PeerInfo[];
  topic?: string | null;
  context?: string | null;
  key_points?: string[] | null;
  reconnected?: boolean;
};

export type PeerJoinedMessage = {
  type: "peer_joined";
  room_id: string;
  peer_id: string;
  joined_at: number;
};

export type PeerLeftMessage = {
  type: "peer_left";
  room_id: string;
  peer_id: string;
  remaining_peers?: string[];
  reason?: string;
};

export type SignalMessage = {
  type: "offer" | "answer";
  room_id?: string;
  from_user?: string;
  to_user?: string;
  sdp: RTCSessionDescriptionInit;
};

export type IceCandidateMessage = {
  type: "ice_candidate";
  room_id?: string;
  from_user?: string;
  to_user?: string;
  candidate: RTCIceCandidateInit;
};

export type WarningMessage = {
  type: "warning";
  message: string;
};

export type RoomEndedMessage = {
  type: "room_ended";
  room_id: string;
  reason?: string;
};

export type ReportAckMessage = {
  type: "report_ack";
  action: "none" | "warned" | "banned";
  reported_user_id: string;
  message: string;
};

export type TranscriptMessage = {
  type: "transcript";
  from_user?: string;
  text: string;
  timestamp?: number;
};

export type GdLobbyWsMessage =
  | LobbyUpdateMessage
  | QueueStatusMessage
  | RoomCreatedMessage
  | BlacklistedMessage
  | HeartbeatMessage
  | ErrorMessage;

export type GdRoomWsMessage =
  | RoomStateMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | SignalMessage
  | IceCandidateMessage
  | TranscriptMessage
  | WarningMessage
  | BlacklistedMessage
  | RoomEndedMessage
  | ReportAckMessage
  | ErrorMessage;

export type ReportRequest = {
  reported_user_id: string;
  reason: string;
  category?: "abusive_language" | "misconduct" | "spam" | "other";
};
