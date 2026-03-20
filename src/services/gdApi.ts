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

const getStoredAccessToken = (): string =>
  String(localStorage.getItem("accessToken") || "").trim();

const getStoredRefreshToken = (): string =>
  String(localStorage.getItem("refreshToken") || "").trim();

const saveSessionTokens = (accessToken: string, refreshToken?: string | null): void => {
  localStorage.setItem("accessToken", accessToken);
  if (refreshToken) {
    localStorage.setItem("refreshToken", refreshToken);
  }
};

const isUnauthorized = (error: unknown): boolean =>
  axios.isAxiosError(error) && error.response?.status === 401;

const resolveAccessToken = (accessToken?: string): string =>
  String(accessToken || "").trim() || getStoredAccessToken();

const refreshAccessToken = async (): Promise<string> => {
  const baseUrl = requireBackendBaseUrl();
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token");
  }

  const response = await axios.post<{
    session?: { access_token?: string; refresh_token?: string };
  }>(`${baseUrl}/auth/refresh`, { refresh_token: refreshToken });

  const session = response.data?.session;
  const nextAccessToken = String(session?.access_token || "").trim();
  const nextRefreshToken = String(session?.refresh_token || "").trim();

  if (!nextAccessToken) {
    throw new Error("Refresh failed: access token missing");
  }

  saveSessionTokens(nextAccessToken, nextRefreshToken || refreshToken);
  return nextAccessToken;
};

const withAuthRetry = async <T>(
  request: (token: string) => Promise<T>,
  initialToken?: string,
): Promise<T> => {
  const token = resolveAccessToken(initialToken);
  if (!token) {
    throw new Error("Missing access token");
  }

  try {
    return await request(token);
  } catch (error) {
    if (!isUnauthorized(error)) {
      throw error;
    }
  }

  const refreshedToken = await refreshAccessToken();
  return request(refreshedToken);
};

export const joinLobby = async (accessToken: string): Promise<LobbyJoinResponse> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.post<LobbyJoinResponse>(
      `${baseUrl}/GD/lobby/join`,
      {},
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};

export const getLobbyStatus = async (
  accessToken: string,
): Promise<LobbyStatusResponse> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get<LobbyStatusResponse>(
      `${baseUrl}/GD/lobby/status`,
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};

export const leaveLobby = async (accessToken: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await withAuthRetry(
    (token) => axios.post(`${baseUrl}/GD/lobby/leave`, {}, authHeaders(token)),
    accessToken,
  );
};

export const leaveRoom = async (accessToken: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await withAuthRetry(
    (token) => axios.post(`${baseUrl}/GD/lobby/leave-room`, {}, authHeaders(token)),
    accessToken,
  );
};

export const getRoomInfo = async (
  accessToken: string,
  roomId: string,
): Promise<RoomInfo> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get<RoomInfo>(
      `${baseUrl}/GD/room/${roomId}`,
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};

export const getRoomPeers = async (
  accessToken: string,
  roomId: string,
): Promise<{ room_id: string; peer_count: number; peers: unknown[] }> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get(
      `${baseUrl}/GD/room/${roomId}/peers`,
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};

export const endRoom = async (accessToken: string, roomId: string): Promise<void> => {
  const baseUrl = requireBackendBaseUrl();
  await withAuthRetry(
    (token) => axios.post(`${baseUrl}/GD/room/${roomId}/end`, {}, authHeaders(token)),
    accessToken,
  );
};

export const reportPeer = async (
  accessToken: string,
  roomId: string,
  body: ReportRequest,
): Promise<{ action: string; message: string }> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.post(
      `${baseUrl}/GD/room/${roomId}/report`,
      body,
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};

export const getMyStatus = async (
  accessToken: string,
): Promise<LobbyMeStatus> => {
  const baseUrl = requireBackendBaseUrl();
  return withAuthRetry(async (token) => {
    const response = await axios.get<LobbyMeStatus>(
      `${baseUrl}/GD/lobby/me/status`,
      authHeaders(token),
    );
    return response.data;
  }, accessToken);
};
