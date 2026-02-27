# Sarvam TTS Backend Example (Node)

Use this backend route with the frontend `src/services/sarvamTts.ts`.

It keeps one Sarvam streaming client alive, deduplicates identical in-flight requests, and caches repeated text, which reduces API usage for repeated prompts.

```js
const express = require("express");
const crypto = require("crypto");
const { SarvamAIClient } = require("sarvamai");

const router = express.Router();
const sarvam = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_SUBSCRIPTION_KEY,
});

let stream = null;
let streamConfigKey = "";

const inFlight = new Map();
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 100;

function normalize(text) {
  return (text || "").replace(/\s+/g, " ").trim();
}

function hashPayload(payload) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function setCache(key, data) {
  cache.delete(key);
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (!oldest) break;
    cache.delete(oldest);
  }
}

function getCache(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (item.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, item);
  return item.data;
}

async function getConfiguredStream(config) {
  const configKey = hashPayload(config);
  if (!stream) {
    stream = await sarvam.textToSpeechStreaming.connect({
      model: config.model,
      sendCompletionEvent: true,
    });
    streamConfigKey = "";
  }
  if (streamConfigKey !== configKey) {
    await stream.configure({
      speaker: config.speaker,
      targetLanguageCode: config.targetLanguageCode,
      sampleRate: config.sampleRate,
      pace: config.pace,
      loudness: config.loudness,
      enablePreprocessing: config.enablePreprocessing,
      model: config.model,
    });
    streamConfigKey = configKey;
  }
  return stream;
}

async function synthesize(payload) {
  const normalizedText = normalize(payload.transcript);
  if (!normalizedText) throw new Error("Transcript is empty.");

  const keyPayload = {
    text: normalizedText,
    model: payload.model,
    speaker: payload.speaker,
    targetLanguageCode: payload.target_language_code,
    sampleRate: payload.sample_rate,
    pace: payload.pace,
    loudness: payload.loudness,
    enablePreprocessing: payload.enable_preprocessing,
  };
  const key = hashPayload(keyPayload);

  const hit = getCache(key);
  if (hit) return hit;

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const task = (async () => {
    const ws = await getConfiguredStream({
      model: payload.model || "bulbul:v2",
      speaker: payload.speaker || "anushka",
      targetLanguageCode:
        payload.target_language_code || "en-IN",
      sampleRate: payload.sample_rate || 22050,
      pace: payload.pace ?? 1,
      loudness: payload.loudness ?? 1,
      enablePreprocessing:
        payload.enable_preprocessing ?? true,
    });

    const chunks = [];
    // SDK interface can vary slightly by version.
    // This pattern follows Sarvam streaming docs: configure -> convert -> flush.
    for await (const msg of ws.convert({ text: normalizedText })) {
      if (msg.type === "audio" && msg.data) {
        chunks.push(Buffer.from(msg.data, "base64"));
      }
      if (msg.type === "error") {
        throw new Error(msg.data || "Sarvam stream error.");
      }
      if (msg.type === "event" && msg.eventType === "done") {
        break;
      }
    }
    await ws.flush();

    const audio = Buffer.concat(chunks);
    if (!audio.length) {
      throw new Error("Sarvam returned empty audio.");
    }
    setCache(key, audio);
    return audio;
  })();

  inFlight.set(key, task);
  try {
    return await task;
  } finally {
    inFlight.delete(key);
  }
}

router.post("/tts/sarvam/stream", async (req, res) => {
  try {
    const audio = await synthesize(req.body || {});
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(audio);
  } catch (err) {
    res.status(500).json({ error: err.message || "TTS failed" });
  }
});

module.exports = router;
```

## Expected Request Body

```json
{
  "model": "bulbul:v2",
  "speaker": "anushka",
  "target_language_code": "en-IN",
  "transcript": "Tell me about your React experience.",
  "pace": 1,
  "loudness": 1,
  "sample_rate": 22050,
  "enable_preprocessing": true
}
```
