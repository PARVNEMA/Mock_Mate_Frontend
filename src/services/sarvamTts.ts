type SarvamPayload = {
	model: string;
	speaker: string;
	target_language_code: string;
	transcript: string;
	pace: number;
	loudness: number;
	sample_rate: number;
	enable_preprocessing: boolean;
};

export type SarvamTtsRequest = {
	text: string;
	model?: string;
	speaker?: string;
	targetLanguageCode?: string;
	pace?: number;
	loudness?: number;
	sampleRate?: number;
	enablePreprocessing?: boolean;
	maxCharsPerChunk?: number;
	signal?: AbortSignal;
};

type CacheItem = {
	blob: Blob;
	expiresAt: number;
};

const DEFAULT_MODEL = "bulbul:v2";
const DEFAULT_SPEAKER = "anushka";
const DEFAULT_LANGUAGE = "en-IN";
const DEFAULT_PACE = 1;
const DEFAULT_LOUDNESS = 1;
const DEFAULT_SAMPLE_RATE = 22050;
const DEFAULT_ENABLE_PREPROCESSING = true;
const DEFAULT_MAX_CHARS_PER_CHUNK = 280;
const DEFAULT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MEMORY_CACHE_LIMIT = 24;
const BROWSER_CACHE_NAME = "sarvam-tts-audio-v1";

const inFlight = new Map<string, Promise<Blob>>();
const memoryCache = new Map<string, CacheItem>();

const env = import.meta.env;
const backendBaseUrl = env.VITE_BACKEND_URL?.trim();
const sarvamEndpoint =
	env.VITE_SARVAM_TTS_ENDPOINT?.trim() ||
	(backendBaseUrl
		? `${backendBaseUrl.replace(/\/$/, "")}/tts/sarvam/stream`
		: "");

const cacheTtlMs = Number(
	env.VITE_SARVAM_TTS_CACHE_TTL_MS ?? DEFAULT_CACHE_TTL_MS,
);

const normalizeText = (text: string): string =>
	text.replace(/\s+/g, " ").trim();

const hashString = (value: string): string => {
	let hash = 2166136261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash +=
			(hash << 1) +
			(hash << 4) +
			(hash << 7) +
			(hash << 8) +
			(hash << 24);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
};

const buildCacheKey = (payload: SarvamPayload): string => {
	const keyMaterial = JSON.stringify(payload);
	return `sarvam:${hashString(keyMaterial)}`;
};

const touchMemoryCache = (
	key: string,
	item: CacheItem,
): void => {
	memoryCache.delete(key);
	memoryCache.set(key, item);
	while (memoryCache.size > MEMORY_CACHE_LIMIT) {
		const oldestKey = memoryCache.keys().next().value;
		if (!oldestKey) break;
		memoryCache.delete(oldestKey);
	}
};

const readFromMemoryCache = (
	key: string,
	now: number,
): Blob | null => {
	const item = memoryCache.get(key);
	if (!item) return null;
	if (item.expiresAt <= now) {
		memoryCache.delete(key);
		return null;
	}
	touchMemoryCache(key, item);
	return item.blob;
};

const supportsBrowserCache = (): boolean =>
	typeof window !== "undefined" &&
	"caches" in window &&
	typeof window.caches?.open === "function";

const readFromBrowserCache = async (
	key: string,
	now: number,
): Promise<Blob | null> => {
	if (!supportsBrowserCache()) return null;
	try {
		const cache = await window.caches.open(
			BROWSER_CACHE_NAME,
		);
		const request = new Request(key);
		const response = await cache.match(request);
		if (!response) return null;
		const expiresAt = Number(
			response.headers.get("x-expires-at") ?? "0",
		);
		if (!Number.isFinite(expiresAt) || expiresAt <= now) {
			await cache.delete(request);
			return null;
		}
		return await response.blob();
	} catch {
		return null;
	}
};

const writeToBrowserCache = async (
	key: string,
	blob: Blob,
	expiresAt: number,
): Promise<void> => {
	if (!supportsBrowserCache()) return;
	try {
		const cache = await window.caches.open(
			BROWSER_CACHE_NAME,
		);
		await cache.put(
			new Request(key),
			new Response(blob, {
				headers: {
					"content-type":
						blob.type || "audio/mpeg",
					"x-expires-at": String(expiresAt),
				},
			}),
		);
	} catch {
		// Browser cache is best-effort and should not block TTS.
	}
};

const decodeBase64Audio = (
	base64: string,
): Uint8Array => {
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
};

const parseAudioFromResponse = async (
	response: Response,
): Promise<Blob> => {
	const contentType =
		response.headers.get("content-type") ?? "";
	if (!contentType.includes("application/json")) {
		return await response.blob();
	}

	const body = await response.json();
	const encoded =
		body?.audioBase64 ??
		body?.audio ??
		body?.audios?.[0] ??
		null;
	if (!encoded || typeof encoded !== "string") {
		throw new Error(
			"Sarvam TTS response missing audio payload.",
		);
	}
	const audioBytes = decodeBase64Audio(encoded);
	const strictBytes = new Uint8Array(audioBytes.length);
	strictBytes.set(audioBytes);
	const mime =
		typeof body?.contentType === "string"
			? body.contentType
			: "audio/mpeg";
	return new Blob([strictBytes], { type: mime });
};

const splitIntoChunks = (
	text: string,
	maxChars: number,
): string[] => {
	if (text.length <= maxChars) return [text];
	const sentences = text
		.split(/(?<=[.!?])\s+/)
		.map((segment) => segment.trim())
		.filter(Boolean);
	if (sentences.length === 0) return [text];

	const chunks: string[] = [];
	let current = "";

	for (const sentence of sentences) {
		const next =
			current.length > 0
				? `${current} ${sentence}`
				: sentence;
		if (next.length <= maxChars) {
			current = next;
			continue;
		}
		if (current.length > 0) {
			chunks.push(current);
			current = "";
		}
		if (sentence.length <= maxChars) {
			current = sentence;
			continue;
		}
		const words = sentence.split(/\s+/);
		let wordBuffer = "";
		for (const word of words) {
			const candidate =
				wordBuffer.length > 0
					? `${wordBuffer} ${word}`
					: word;
			if (candidate.length <= maxChars) {
				wordBuffer = candidate;
			} else {
				if (wordBuffer.length > 0) {
					chunks.push(wordBuffer);
				}
				wordBuffer = word;
			}
		}
		if (wordBuffer.length > 0) {
			current = wordBuffer;
		}
	}

	if (current.length > 0) {
		chunks.push(current);
	}
	return chunks;
};

const toPayload = (
	inputText: string,
	request: SarvamTtsRequest,
): SarvamPayload => ({
	model: request.model ?? DEFAULT_MODEL,
	speaker: request.speaker ?? DEFAULT_SPEAKER,
	target_language_code:
		request.targetLanguageCode ?? DEFAULT_LANGUAGE,
	transcript: inputText,
	pace: request.pace ?? DEFAULT_PACE,
	loudness: request.loudness ?? DEFAULT_LOUDNESS,
	sample_rate: request.sampleRate ?? DEFAULT_SAMPLE_RATE,
	enable_preprocessing:
		request.enablePreprocessing ??
		DEFAULT_ENABLE_PREPROCESSING,
});

const fetchSarvamChunk = async (
	payload: SarvamPayload,
	signal?: AbortSignal,
): Promise<Blob> => {
	if (!sarvamEndpoint) {
		throw new Error(
			"Missing VITE_BACKEND_URL or VITE_SARVAM_TTS_ENDPOINT for Sarvam TTS.",
		);
	}

	const response = await fetch(sarvamEndpoint, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(payload),
		signal,
	});

	if (!response.ok) {
		const detail = await response.text();
		throw new Error(
			`Sarvam TTS request failed (${response.status}): ${detail}`,
		);
	}

	const blob = await parseAudioFromResponse(response);
	if (blob.size === 0) {
		throw new Error("Sarvam TTS returned empty audio.");
	}
	return blob;
};

const getChunkAudio = async (
	payload: SarvamPayload,
	signal?: AbortSignal,
): Promise<Blob> => {
	const now = Date.now();
	const ttl =
		Number.isFinite(cacheTtlMs) && cacheTtlMs > 0
			? cacheTtlMs
			: DEFAULT_CACHE_TTL_MS;
	const expiresAt = now + ttl;
	const cacheKey = buildCacheKey(payload);

	const memoryHit = readFromMemoryCache(cacheKey, now);
	if (memoryHit) return memoryHit;

	const browserHit = await readFromBrowserCache(cacheKey, now);
	if (browserHit) {
		touchMemoryCache(cacheKey, { blob: browserHit, expiresAt });
		return browserHit;
	}

	const pending = inFlight.get(cacheKey);
	if (pending) return pending;

	const requestPromise = (async () => {
		const freshBlob = await fetchSarvamChunk(payload, signal);
		touchMemoryCache(cacheKey, {
			blob: freshBlob,
			expiresAt,
		});
		void writeToBrowserCache(
			cacheKey,
			freshBlob,
			expiresAt,
		);
		return freshBlob;
	})();

	inFlight.set(cacheKey, requestPromise);
	try {
		return await requestPromise;
	} finally {
		inFlight.delete(cacheKey);
	}
};

export const synthesizeSarvamSpeech = async (
	request: SarvamTtsRequest,
): Promise<Blob> => {
	const normalized = normalizeText(request.text);
	if (!normalized) {
		throw new Error("TTS input text is empty.");
	}

	const maxChars =
		request.maxCharsPerChunk ?? DEFAULT_MAX_CHARS_PER_CHUNK;
	const chunkTexts = splitIntoChunks(normalized, maxChars);
	const chunkBlobs: Blob[] = [];

	for (const chunkText of chunkTexts) {
		const payload = toPayload(chunkText, request);
		const blob = await getChunkAudio(payload, request.signal);
		chunkBlobs.push(blob);
	}

	if (chunkBlobs.length === 1) {
		return chunkBlobs[0];
	}
	const mime = chunkBlobs[0]?.type || "audio/mpeg";
	return new Blob(chunkBlobs, { type: mime });
};
