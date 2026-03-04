import { useEffect, useRef } from "react";

type TranscriptHandler = (text: string) => void;

type SpeechRecognitionCtor = new () => SpeechRecognition;

const getSpeechRecognition = (): SpeechRecognitionCtor | null => {
  const anyWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return anyWindow.SpeechRecognition || anyWindow.webkitSpeechRecognition || null;
};

export function useGdTranscription(params: {
  enabled: boolean;
  onTranscript: TranscriptHandler;
}) {
  const { enabled, onTranscript } = params;
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const restartingRef = useRef(false);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!enabled || !Recognition) return;

    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0]?.transcript ?? "";
        }
      }
      const trimmed = finalText.trim();
      if (trimmed) onTranscript(trimmed);
    };

    recognition.onerror = () => {
      // ignore errors; browser may stop recognition
    };

    recognition.onend = () => {
      if (!enabled) return;
      if (restartingRef.current) return;
      restartingRef.current = true;
      window.setTimeout(() => {
        restartingRef.current = false;
        try {
          recognition.start();
        } catch {
          // ignore
        }
      }, 500);
    };

    try {
      recognition.start();
    } catch {
      // ignore
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
  }, [enabled, onTranscript]);
}
