const hostKey = (roomId: string) => `gd:room:${roomId}:host`;
const sessionKey = (roomId: string) => `gd:room:${roomId}:session`;

export const saveGdRoomHost = (roomId: string, hostUserId: string): void => {
  if (!roomId || !hostUserId) return;
  sessionStorage.setItem(hostKey(roomId), hostUserId);
};

export const getGdRoomHost = (roomId: string): string => {
  if (!roomId) return "";
  return String(sessionStorage.getItem(hostKey(roomId)) || "");
};

export const saveGdRoomSessionId = (roomId: string, sessionId: string): void => {
  if (!roomId || !sessionId) return;
  sessionStorage.setItem(sessionKey(roomId), sessionId);
};

export const getGdRoomSessionId = (roomId: string): string => {
  if (!roomId) return "";
  return String(sessionStorage.getItem(sessionKey(roomId)) || "");
};
