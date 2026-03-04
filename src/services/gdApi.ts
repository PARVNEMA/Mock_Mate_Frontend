import axios from "axios";
import type {
  LobbyJoinResponse,
  LobbyMeStatus,
  LobbyStatusResponse,
  ReportRequest,
  RoomInfo,
} from "../types/gd";

const backendBaseUrl = String(import.meta.env.VITE_BACKEND_URL || "").replace(
  /\/$/,
  "",
);

const requireBackendBaseUrl = (): string => {
  if (!backendBaseUrl) {
    throw new Error("Missing VITE_BACKEND_URL in .env");
  }
  return backendBaseUrl;
};

const authHeaders = (accessToken: string) => ({
  headers: { Authorization: `Bearer ${accessToken}` },
});

export const joinLobby = async (accessToken: string): Promise<LobbyJoinResponse> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.post<LobbyJoinResponse>(
    `${baseUrl}/GD/lobby/join`,
    {},
    authHeaders(accessToken),
  );
  return response.data;
};

export const getLobbyStatus = async (
  accessToken: string,
): Promise<LobbyStatusResponse> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get<LobbyStatusResponse>(
    `${baseUrl}/GD/lobby/status`,
    authHeaders(accessToken),
  );
  return response.data;
};

export const leaveLobby = async (accessToken: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await axios.post(`${baseUrl}/GD/lobby/leave`, {}, authHeaders(accessToken));
};

export const leaveRoom = async (accessToken: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await axios.post(`${baseUrl}/GD/lobby/leave-room`, {}, authHeaders(accessToken));
};

export const getRoomInfo = async (
  accessToken: string,
  roomId: string,
): Promise<RoomInfo> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get<RoomInfo>(
    `${baseUrl}/GD/room/${roomId}`,
    authHeaders(accessToken),
  );
  return response.data;
};

export const getRoomPeers = async (
  accessToken: string,
  roomId: string,
): Promise<{ room_id: string; peer_count: number; peers: unknown[] }> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get(
    `${baseUrl}/GD/room/${roomId}/peers`,
    authHeaders(accessToken),
  );
  return response.data;
};

export const endRoom = async (accessToken: string, roomId: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await axios.post(`${baseUrl}/GD/room/${roomId}/end`, {}, authHeaders(accessToken));
};

export const reportPeer = async (
  accessToken: string,
  roomId: string,
  body: ReportRequest,
): Promise<{ action: string; message: string }> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.post(
    `${baseUrl}/GD/room/${roomId}/report`,
    body,
    authHeaders(accessToken),
  );
  return response.data;
};

export const getMyStatus = async (
  accessToken: string,
): Promise<LobbyMeStatus> => {
  const baseUrl = requireBackendBaseUrl();
  const response = await axios.get<LobbyMeStatus>(
    `${baseUrl}/GD/lobby/me/status`,
    authHeaders(accessToken),
  );
  return response.data;
};
