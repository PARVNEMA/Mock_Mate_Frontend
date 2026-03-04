import {
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import type { GdLobbyWsMessage } from "../types/gd";
import createLogger from "../utils/logger";

const logger = createLogger("useGdLobbySocket");

const toWsUrl = (httpBaseUrl: string): string => {
	const trimmed = String(httpBaseUrl || "")
		.trim()
		.replace(/\/$/, "");
	if (!trimmed) return "";
	if (trimmed.startsWith("https://"))
		return trimmed.replace("https://", "wss://");
	if (trimmed.startsWith("http://"))
		return trimmed.replace("http://", "ws://");
	return trimmed;
};

export function useGdLobbySocket(params: {
	httpBaseUrl: string;
	userId: string;
	enabled: boolean;
	onMessage: (msg: GdLobbyWsMessage) => void;
}) {
	const { httpBaseUrl, userId, enabled, onMessage } =
		params;
	const [isConnected, setIsConnected] = useState(false);

	const wsRef = useRef<WebSocket | null>(null);
	const onMessageRef = useRef(onMessage);
	const closedByUserRef = useRef(false);
	const retryRef = useRef(0);
	const timerRef = useRef<number | null>(null);
	const heartbeatRef = useRef<number | null>(null);

	const send = useCallback((payload: unknown): boolean => {
		const ws = wsRef.current;
		if (!ws || ws.readyState !== WebSocket.OPEN)
			return false;
		if (typeof payload === "string") {
			ws.send(payload);
		} else {
			ws.send(JSON.stringify(payload));
		}
		return true;
	}, []);

	const connect = useCallback(() => {
		if (!enabled || !httpBaseUrl || !userId) return;
		const wsBase = toWsUrl(httpBaseUrl);
		const wsUrl = `${wsBase}/GD/lobby/ws/${userId}`;

		const existing = wsRef.current;
		if (existing && existing.readyState <= WebSocket.OPEN)
			return;

		logger.info("Connecting to GD Lobby WebSocket", {
			wsUrl,
			userId,
		});
		const ws = new WebSocket(wsUrl);
		wsRef.current = ws;

		ws.onopen = () => {
			logger.info("GD Lobby WebSocket connected");
			if (closedByUserRef.current) {
				ws.close(1000, "aborted_before_open");
				return;
			}
			setIsConnected(true);
			retryRef.current = 0;
			if (heartbeatRef.current === null) {
				heartbeatRef.current = window.setInterval(() => {
					send("ping");
				}, 20000);
			}
		};

		ws.onmessage = (event) => {
			try {
				const parsed = JSON.parse(
					String(event.data),
				) as GdLobbyWsMessage;
				logger.debug("GD Lobby message received", {
					type: parsed.type,
				});
				onMessageRef.current(parsed);
			} catch (error) {
				logger.warn(
					"Failed to parse GD Lobby message",
					error,
				);
			}
		};

		ws.onclose = (event) => {
			logger.warn("GD Lobby WebSocket closed", {
				code: event.code,
				reason: event.reason,
			});
			setIsConnected(false);
			wsRef.current = null;
			if (heartbeatRef.current !== null) {
				window.clearInterval(heartbeatRef.current);
				heartbeatRef.current = null;
			}
			if (event.code === 4403 || event.code === 4409) {
				logger.info(
					"GD Lobby WebSocket closed by authorization",
				);
				closedByUserRef.current = true;
				return;
			}
			if (closedByUserRef.current) return;
			const delayMs = Math.min(
				1000 * 2 ** retryRef.current,
				15000,
			);
			retryRef.current += 1;
			logger.info("GD Lobby WebSocket reconnecting", {
				delayMs,
				retryCount: retryRef.current,
			});
			timerRef.current = window.setTimeout(
				() => connect(),
				delayMs,
			);
		};

		ws.onerror = (error) => {
			logger.error("GD Lobby WebSocket error", error);
			ws.close();
		};
	}, [enabled, httpBaseUrl, userId, send]);

	useEffect(() => {
		onMessageRef.current = onMessage;
	}, [onMessage]);

	useEffect(() => {
		closedByUserRef.current = false;
		connect();
		return () => {
			closedByUserRef.current = true;
			if (timerRef.current !== null)
				window.clearTimeout(timerRef.current);
			if (heartbeatRef.current !== null)
				window.clearInterval(heartbeatRef.current);
			if (
				wsRef.current &&
				wsRef.current.readyState <
					WebSocket.CLOSING
			) {
				wsRef.current.close(1000, "component_unmount");
			}
			wsRef.current = null;
		};
	}, [connect]);

	const close = useCallback(() => {
		closedByUserRef.current = true;
		if (timerRef.current !== null)
			window.clearTimeout(timerRef.current);
		if (heartbeatRef.current !== null)
			window.clearInterval(heartbeatRef.current);
		wsRef.current?.close(1000, "client_close");
		wsRef.current = null;
		setIsConnected(false);
	}, []);

	return { isConnected, send, close };
}
