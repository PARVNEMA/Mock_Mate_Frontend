import { useCallback, useEffect, useRef, useState } from "react";
import type { WsEnvelope } from "../types/interview";

export function useInterviewSocket(params: {
  wsUrl: string; // Example: ws://127.0.0.1:8000/interviews/ws
  sessionId: string;
  accessToken: string;
  onMessage: (msg: WsEnvelope) => void;
}) {
  const { wsUrl, sessionId, accessToken, onMessage } = params;

  const wsRef = useRef<WebSocket | null>(null);
  const closedByUserRef = useRef(false);
  const retryRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const connectRef = useRef<(() => void) | null>(null);

  const [isConnected, setIsConnected] = useState(false);

  const send = useCallback((message: WsEnvelope): boolean => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    ws.send(JSON.stringify(message));
    return true;
  }, []);

  const connect = useCallback(() => {
    if (!wsUrl || !sessionId || !accessToken) return;

    const existing = wsRef.current;
    if (existing && existing.readyState <= WebSocket.OPEN) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      retryRef.current = 0;

      // Always (re)join after a connect. Backend uses this to authenticate and
      // to send the current pending question (supports reconnect resume).
      ws.send(
        JSON.stringify({
          type: "session.join",
          session_id: sessionId,
          request_id: `join-${Date.now()}`,
          payload: { access_token: accessToken },
        } satisfies WsEnvelope),
      );
    };

    ws.onmessage = (event) => {
      try {
        const parsed = JSON.parse(String(event.data)) as WsEnvelope;
        onMessage(parsed);
      } catch {
        // Ignore malformed messages instead of taking the socket down.
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;

      if (closedByUserRef.current) return;

      // Exponential backoff reconnect to avoid hammering the server.
      const delayMs = Math.min(1000 * 2 ** retryRef.current, 15_000);
      retryRef.current += 1;
      timerRef.current = window.setTimeout(() => connectRef.current?.(), delayMs);
    };

    // Force onclose to trigger reconnect logic.
    ws.onerror = () => ws.close();
  }, [wsUrl, sessionId, accessToken, onMessage]);

  // Keep a stable reference so event handlers can schedule reconnects safely.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    closedByUserRef.current = false;
    connect();

    return () => {
      closedByUserRef.current = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      wsRef.current?.close(1000, "component_unmount");
      wsRef.current = null;
    };
  }, [connect]);

  return { isConnected, send };
}
