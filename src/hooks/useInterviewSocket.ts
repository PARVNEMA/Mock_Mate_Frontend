import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { WsEnvelope } from "../types/interview";
import createLogger from "../utils/logger";

const logger = createLogger("useInterviewSocket");

export function useInterviewSocket(params: {
	wsUrl: string; // Example: ws://127.0.0.1:8000/interviews/ws
	sessionId: string;
	accessToken: string;
	onMessage: (msg: WsEnvelope) => void;
}) {
	const { wsUrl, sessionId, accessToken, onMessage } =
		params;

	const wsRef = useRef<WebSocket | null>(null);
	const closedByUserRef = useRef(false);
	const retryRef = useRef(0);
	const timerRef = useRef<number | null>(null);
	const connectRef = useRef<(() => void) | null>(null);

	const [isConnected, setIsConnected] = useState(false);

	const send = useCallback(
		(message: WsEnvelope): boolean => {
			const ws = wsRef.current;
			if (!ws || ws.readyState !== WebSocket.OPEN)
				return false;
			ws.send(JSON.stringify(message));
			return true;
		},
		[],
	);

	const connect = useCallback(() => {
		if (!wsUrl || !sessionId || !accessToken) {
			logger.warn(
				"Cannot connect: missing required parameters",
				{
					hasUrl: !!wsUrl,
					hasSessionId: !!sessionId,
					hasToken: !!accessToken,
				},
			);
			return;
		}

		const existing = wsRef.current;
		if (existing && existing.readyState <= WebSocket.OPEN) {
			logger.debug(
				"WebSocket already connected or connecting",
			);
			return;
		}

		logger.info("Connecting to Interview WebSocket", {
			wsUrl,
			sessionId,
		});
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			logger.info("Interview WebSocket connected");
			setIsConnected(true);
			retryRef.current = 0;

			// Always (re)join after a connect. Backend uses this to authenticate and
			// to send the current pending question (supports reconnect resume).
			const sessionJoinMsg = {
				type: "session.join",
				session_id: sessionId,
				request_id: `join-${Date.now()}`,
				payload: { access_token: accessToken },
			} satisfies WsEnvelope;
			logger.info("Sending session join message");
			ws.send(JSON.stringify(sessionJoinMsg));
		};

		ws.onmessage = (event) => {
			try {
				const parsed = JSON.parse(
					String(event.data),
				) as WsEnvelope;
				logger.debug("Interview message received", {
					type: parsed.type,
					requestId: parsed.request_id,
				});
				onMessage(parsed);
			} catch (error) {
				logger.warn(
					"Failed to parse Interview message",
					error,
				);
			}
		};

		ws.onclose = () => {
			logger.warn("Interview WebSocket closed");
			setIsConnected(false);
			wsRef.current = null;

			if (closedByUserRef.current) {
				logger.info("WebSocket closed by user");
				return;
			}

			// Exponential backoff reconnect to avoid hammering the server.
			const delayMs = Math.min(
				1000 * 2 ** retryRef.current,
				15_000,
			);
			retryRef.current += 1;
			logger.info("Interview WebSocket reconnecting", {
				delayMs,
				retryCount: retryRef.current,
			});
			timerRef.current = window.setTimeout(
				() => connectRef.current?.(),
				delayMs,
			);
		};

		// Force onclose to trigger reconnect logic.
		ws.onerror = (event) => {
			logger.error("Interview WebSocket error", event);
			ws.close();
		};
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
			if (timerRef.current !== null)
				window.clearTimeout(timerRef.current);
			wsRef.current?.close(1000, "component_unmount");
			wsRef.current = null;
		};
	}, [connect]);

	return { isConnected, send };
}
