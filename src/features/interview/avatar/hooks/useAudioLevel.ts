import { useCallback, useEffect, useRef, useState } from "react";

const FFT_SIZE = 256;
const GATE_THRESHOLD = 0.015;
const LEVEL_MULTIPLIER = 3.1;
const SYNTHETIC_INTERVAL_MS = 90;

export function useAudioLevel() {
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const syntheticTimerRef = useRef<number | null>(null);
  const smoothedLevelRef = useRef<number>(0);

  const stopTracking = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (syntheticTimerRef.current !== null) {
      window.clearInterval(syntheticTimerRef.current);
      syntheticTimerRef.current = null;
    }

    try {
      sourceNodeRef.current?.disconnect();
    } catch (disconnectError) {
      void disconnectError;
    }

    try {
      analyserNodeRef.current?.disconnect();
    } catch (disconnectError) {
      void disconnectError;
    }

    sourceNodeRef.current = null;
    analyserNodeRef.current = null;
    smoothedLevelRef.current = 0;
    setAudioLevel(0);
  }, []);

  const trackAudioElement = useCallback(
    (audioElement: HTMLAudioElement) => {
      if (typeof window === "undefined" || !("AudioContext" in window)) {
        return;
      }

      stopTracking();

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const context = audioContextRef.current;
      if (context.state === "suspended") {
        void context.resume();
      }

      const analyser = context.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.25;

      const sourceNode = context.createMediaElementSource(audioElement);
      sourceNode.connect(analyser);
      analyser.connect(context.destination);

      analyserNodeRef.current = analyser;
      sourceNodeRef.current = sourceNode;

      const samples = new Uint8Array(analyser.frequencyBinCount);

      const updateLevel = () => {
        if (!analyserNodeRef.current) {
          return;
        }

        analyserNodeRef.current.getByteTimeDomainData(samples);

        let sumSquares = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = samples[i] / 128 - 1;
          sumSquares += centered * centered;
        }

        const rms = Math.sqrt(sumSquares / samples.length);
        const smoothed = smoothedLevelRef.current * 0.74 + rms * 0.26;
        smoothedLevelRef.current = smoothed;

        const gated = smoothed < GATE_THRESHOLD ? 0 : smoothed * LEVEL_MULTIPLIER;
        setAudioLevel(Math.min(1, gated));
        rafRef.current = requestAnimationFrame(updateLevel);
      };

      rafRef.current = requestAnimationFrame(updateLevel);
    },
    [stopTracking],
  );

  const startSyntheticLevel = useCallback(() => {
    stopTracking();

    let phase = 0;
    syntheticTimerRef.current = window.setInterval(() => {
      phase += 0.48;
      const wave = (Math.sin(phase) + 1) / 2;
      const jitter = Math.random() * 0.22;
      const nextLevel = Math.min(1, 0.08 + wave * 0.65 + jitter);
      setAudioLevel(nextLevel);
    }, SYNTHETIC_INTERVAL_MS);
  }, [stopTracking]);

  useEffect(() => {
    return () => {
      stopTracking();
      if (audioContextRef.current) {
        void audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [stopTracking]);

  return {
    audioLevel,
    trackAudioElement,
    startSyntheticLevel,
    stopTracking,
  };
}
