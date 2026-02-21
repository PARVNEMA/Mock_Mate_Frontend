import { useCallback, useEffect, useRef, useState } from "react";
import { EdgeTTS } from "edge-tts-universal";
import type { AvatarSpeechRequest, AvatarSpeechState } from "../types";
import { useAudioLevel } from "./useAudioLevel";

interface UseAvatarSpeechOptions {
  onSpeechStart?: (text: string) => void;
  onSpeechEnd?: (text: string) => void;
  onSpeechError?: (message: string) => void;
}

const DEFAULT_EDGE_VOICE = "en-IN-NeerjaNeural";
const INTERRUPTED_MESSAGE = "Speech interrupted";

function toRatePercent(rate: number) {
  const delta = Math.round((rate - 1) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}%`;
}

function toPitchHz(pitch: number) {
  const delta = Math.round((pitch - 1) * 50);
  return `${delta >= 0 ? "+" : ""}${delta}Hz`;
}

function isInterruptError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message === INTERRUPTED_MESSAGE || error.name === "AbortError";
}

export function useAvatarSpeech(options: UseAvatarSpeechOptions = {}) {
  const [speechState, setSpeechState] = useState<AvatarSpeechState>({
    status: "idle",
    currentText: null,
    audioLevel: 0,
  });

  const queueRef = useRef<AvatarSpeechRequest[]>([]);
  const isProcessingRef = useRef<boolean>(false);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const optionsRef = useRef<UseAvatarSpeechOptions>(options);
  const {
    audioLevel,
    trackAudioElement,
    startSyntheticLevel,
    stopTracking,
  } = useAudioLevel();

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    setSpeechState((prev) => ({ ...prev, audioLevel }));
  }, [audioLevel]);

  const stopCurrentPlayback = useCallback(() => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    stopTracking();
  }, [stopTracking]);

  const stop = useCallback(() => {
    queueRef.current = [];
    stopCurrentPlayback();
    setSpeechState({
      status: "idle",
      currentText: null,
      audioLevel: 0,
      error: undefined,
    });
  }, [stopCurrentPlayback]);

  const waitForAudioElement = useCallback(
    (audioElement: HTMLAudioElement, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          audioElement.onended = null;
          audioElement.onerror = null;
          signal.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
          cleanup();
          audioElement.pause();
          reject(new Error(INTERRUPTED_MESSAGE));
        };

        if (signal.aborted) {
          onAbort();
          return;
        }

        audioElement.onended = () => {
          cleanup();
          resolve();
        };

        audioElement.onerror = () => {
          cleanup();
          reject(new Error("Audio playback failed"));
        };

        signal.addEventListener("abort", onAbort, { once: true });
      }),
    [],
  );

  const playWithEdgeTts = useCallback(
    async (request: AvatarSpeechRequest, signal: AbortSignal) => {
      const voice =
        request.voice && request.voice !== "browser-default"
          ? request.voice
          : DEFAULT_EDGE_VOICE;
      const tts = new EdgeTTS(request.text, voice, {
        rate: toRatePercent(request.rate ?? 0.95),
        pitch: toPitchHz(request.pitch ?? 1),
      });
      const synthesis = await tts.synthesize();
      const objectUrl = URL.createObjectURL(synthesis.audio);
      const audioElement = new Audio(objectUrl);

      activeAudioRef.current = audioElement;
      trackAudioElement(audioElement);

      if (signal.aborted) {
        URL.revokeObjectURL(objectUrl);
        throw new Error(INTERRUPTED_MESSAGE);
      }

      try {
        await audioElement.play();
        await waitForAudioElement(audioElement, signal);
        activeAudioRef.current = null;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    },
    [trackAudioElement, waitForAudioElement],
  );

  const playWithBrowserTts = useCallback(
    (request: AvatarSpeechRequest, signal: AbortSignal) =>
      new Promise<void>((resolve, reject) => {
        if (!("speechSynthesis" in window)) {
          reject(new Error("Browser speech synthesis is not supported"));
          return;
        }

        const utterance = new SpeechSynthesisUtterance(request.text);
        utterance.rate = request.rate ?? 0.95;
        utterance.pitch = request.pitch ?? 1;

        const voices = window.speechSynthesis.getVoices();
        const preferredVoice =
          voices.find((voice) => voice.lang.toLowerCase() === "en-in") ||
          voices.find((voice) => voice.lang.startsWith("en-IN")) ||
          voices.find((voice) => voice.lang.startsWith("en")) ||
          null;

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        startSyntheticLevel();

        const cleanup = () => {
          utterance.onend = null;
          utterance.onerror = null;
          signal.removeEventListener("abort", onAbort);
        };

        const onAbort = () => {
          cleanup();
          window.speechSynthesis.cancel();
          reject(new Error(INTERRUPTED_MESSAGE));
        };

        if (signal.aborted) {
          onAbort();
          return;
        }

        utterance.onend = () => {
          cleanup();
          resolve();
        };

        utterance.onerror = () => {
          cleanup();
          reject(new Error("Speech synthesis failed"));
        };

        signal.addEventListener("abort", onAbort, { once: true });
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }),
    [startSyntheticLevel],
  );

  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;

    while (queueRef.current.length > 0) {
      const nextRequest = queueRef.current.shift();
      if (!nextRequest) {
        continue;
      }

      const trimmedText = nextRequest.text.trim();
      if (!trimmedText) {
        continue;
      }

      const request: AvatarSpeechRequest = {
        ...nextRequest,
        text: trimmedText,
      };

      setSpeechState((prev) => ({
        ...prev,
        status: "loading",
        currentText: request.text,
        error: undefined,
      }));

      optionsRef.current.onSpeechStart?.(request.text);
      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      try {
        setSpeechState((prev) => ({ ...prev, status: "speaking" }));

        if (request.voice === "browser-default") {
          await playWithBrowserTts(request, controller.signal);
        } else {
          try {
            await playWithEdgeTts(request, controller.signal);
          } catch (edgeError) {
            if (isInterruptError(edgeError)) {
              throw edgeError;
            }
            await playWithBrowserTts(request, controller.signal);
          }
        }

        optionsRef.current.onSpeechEnd?.(request.text);
      } catch (error) {
        if (!isInterruptError(error)) {
          const message =
            error instanceof Error ? error.message : "Unable to generate speech";
          setSpeechState((prev) => ({ ...prev, status: "error", error: message }));
          optionsRef.current.onSpeechError?.(message);
        }
      } finally {
        activeAbortControllerRef.current = null;
        stopTracking();
      }
    }

    isProcessingRef.current = false;
    setSpeechState((prev) => ({
      ...prev,
      status: "idle",
      currentText: null,
      audioLevel: 0,
      error: undefined,
    }));
  }, [playWithBrowserTts, playWithEdgeTts, stopTracking]);

  const speak = useCallback(
    (input: AvatarSpeechRequest) => {
      const request: AvatarSpeechRequest = {
        text: input.text,
        voice: input.voice ?? DEFAULT_EDGE_VOICE,
        rate: input.rate ?? 0.95,
        pitch: input.pitch ?? 1,
        interrupt: input.interrupt ?? true,
      };

      if (!request.text.trim()) {
        return;
      }

      if (request.interrupt) {
        queueRef.current = [];
        stopCurrentPlayback();
      }

      queueRef.current.push(request);
      void processQueue();
    },
    [processQueue, stopCurrentPlayback],
  );

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    speechState,
    speak,
    stop,
  };
}
