import React, { useState, useEffect, useRef } from "react";
import { EdgeTTS } from "edge-tts-universal";

// --- Type Definitions for TypeScript ---
interface Pause {
  duration: number;
  timestamp: number;
}

interface Analytics {
  fillerWords: Record<string, number>;
  pauses: Pause[];
  responseTime: string | null;
  wordCount: number;
}

// Augmenting Global Window object for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const FILLER_WORDS = [
  "um",
  "uh",
  "ah",
  "er",
  "like",
  "you know",
  "actually",
  "basically",
  "well",
  "so",
];

const TTS_STT_Test: React.FC = () => {
  // TTS State
  const [text, setText] = useState<string>(
    "Tell me about your experience with React development.",
  );
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // STT State
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [analytics, setAnalytics] = useState<Analytics>({
    fillerWords: {},
    pauses: [],
    responseTime: null,
    wordCount: 0,
  });

  const recognitionRef = useRef<any>(null);
  const lastSpeechTimeRef = useRef<number>(Date.now());
  const responseStartTimeRef = useRef<number | null>(null);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (recognitionRef.current) recognitionRef.current.stop();
    };
  }, []);

  // ==================== TTS Functions ====================

  const speakWithIndianVoice = (inputText: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(true);

    const utterance = new SpeechSynthesisUtterance(inputText);
    const voices = window.speechSynthesis.getVoices();
    const indianVoice = voices.find(
      (v) => v.lang.includes("en-IN") || v.name.includes("Indian"),
    );

    if (indianVoice) utterance.voice = indianVoice;
    utterance.rate = 0.9;
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const speakWithEdgeTTS = async (inputText: string) => {
    try {
      setIsSpeaking(true);
      // FIX: Use the static method getAudioBase64
      const base64Audio = await EdgeTTS.getAudioBase64(
        inputText,
        "en-IN-NeerjaNeural",
      );

      const url = `data:audio/mpeg;base64,${base64Audio}`;
      setAudioUrl(url);

      const audio = new Audio(url);
      audio.onended = () => setIsSpeaking(false);
      await audio.play();
    } catch (error) {
      console.error("Edge TTS Error:", error);
      speakWithIndianVoice(inputText); // Fallback
    }
  };

  // ==================== STT Functions ====================

  const analyzeFillerWords = (textSegment: string) => {
    const words = textSegment.toLowerCase().split(/\s+/);
    setAnalytics((prev) => {
      const newFillers = { ...prev.fillerWords };
      words.forEach((word) => {
        const clean = word.replace(/[.,!?;:]/g, "");
        if (FILLER_WORDS.includes(clean)) {
          newFillers[clean] = (newFillers[clean] || 0) + 1;
        }
      });
      return { ...prev, fillerWords: newFillers };
    });
  };

  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    // Resetting analytics for new session
    setTranscript("");
    setInterimTranscript("");
    setAnalytics({
      fillerWords: {},
      pauses: [],
      responseTime: null,
      wordCount: 0,
    });
    responseStartTimeRef.current = Date.now();
    lastSpeechTimeRef.current = Date.now();

    recognition.onstart = () => setIsListening(true);

    recognition.onerror = (event: any) => {
      console.error("SR Error:", event.error);
      if (event.error === "not-allowed") {
        alert(
          "Microphone access blocked. Please enable it in browser settings.",
        );
      }
      setIsListening(false);
    };

    recognition.onresult = (event: any) => {
      let finalStr = "";
      let interimStr = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript;
          finalStr += text + " ";
          analyzeFillerWords(text);

          const now = Date.now();
          const gap = now - lastSpeechTimeRef.current;
          if (gap > 1500) {
            // Record pauses longer than 1.5s
            setAnalytics((prev) => ({
              ...prev,
              pauses: [...prev.pauses, { duration: gap, timestamp: now }],
            }));
          }
          lastSpeechTimeRef.current = now;
        } else {
          interimStr += result[0].transcript;
        }
      }

      setTranscript((prev) => prev + finalStr);
      setInterimTranscript(interimStr);

      const totalWords = (transcript + finalStr + interimStr)
        .trim()
        .split(/\s+/)
        .filter((w) => w !== "").length;
      setAnalytics((prev) => ({ ...prev, wordCount: totalWords }));
    };

    recognition.onend = () => {
      setIsListening(false);
      if (responseStartTimeRef.current) {
        const time = (
          (Date.now() - responseStartTimeRef.current) /
          1000
        ).toFixed(1);
        setAnalytics((prev) => ({ ...prev, responseTime: time }));
      }
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
  };

  const totalFillers = Object.values(analytics.fillerWords).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900">
            AI Interview Proctor
          </h1>
          <p className="text-gray-600 mt-2">
            TTS/STT Testing Bench (Indian Accent Optimized)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Interviewer Controls */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-blue-700">
              1. Interviewer (TTS)
            </h2>
            <textarea
              className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => speakWithEdgeTTS(text)}
                disabled={isSpeaking}
                className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:bg-gray-300 transition-colors"
              >
                {isSpeaking ? "Speaking..." : "Play Neural Voice"}
              </button>
            </div>
          </section>

          {/* Candidate Controls */}
          <section className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold mb-4 text-purple-700">
              2. Candidate (STT)
            </h2>
            <button
              onClick={isListening ? stopListening : startListening}
              className={`w-full py-4 rounded-xl font-bold text-lg mb-4 transition-all ${
                isListening
                  ? "bg-red-100 text-red-600 border-2 border-red-600 animate-pulse"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {isListening ? "Stop Recording" : "Start Responding"}
            </button>
            <div className="p-4 bg-gray-900 text-gray-100 rounded-xl min-h-40 leading-relaxed shadow-inner">
              <span className="opacity-100">{transcript}</span>
              <span className="opacity-50 text-blue-300">
                {interimTranscript}
              </span>
              {!transcript && !interimTranscript && (
                <span className="text-gray-500 italic">
                  Waiting for speech...
                </span>
              )}
            </div>
          </section>
        </div>

        {/* Analytics Section */}
        {analytics.wordCount > 0 && (
          <section className="mt-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h3 className="text-2xl font-bold text-gray-800 mb-6">
              Speech Insights
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <MetricItem
                label="Word Count"
                value={analytics.wordCount}
                sub="words"
                color="text-blue-600"
              />
              <MetricItem
                label="Filler Usage"
                value={totalFillers}
                sub="fillers"
                color="text-orange-500"
              />
              <MetricItem
                label="Total Pauses"
                value={analytics.pauses.length}
                sub="> 1.5s"
                color="text-purple-600"
              />
              <MetricItem
                label="Session Time"
                value={analytics.responseTime || 0}
                sub="seconds"
                color="text-green-600"
              />
            </div>

            {Object.keys(analytics.fillerWords).length > 0 && (
              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Frequency breakdown
                </p>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(analytics.fillerWords).map(
                    ([word, count]) => (
                      <div
                        key={word}
                        className="bg-orange-50 border border-orange-100 px-4 py-2 rounded-lg"
                      >
                        <span className="font-medium text-orange-800">
                          {word}
                        </span>
                        <span className="ml-2 bg-orange-200 text-orange-900 px-2 py-0.5 rounded text-xs font-bold">
                          {count}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

const MetricItem = ({ label, value, sub, color }: any) => (
  <div className="flex flex-col">
    <span className="text-gray-500 text-sm font-medium">{label}</span>
    <div className="flex items-baseline gap-1">
      <span className={`text-3xl font-black ${color}`}>{value}</span>
      <span className="text-gray-400 text-xs">{sub}</span>
    </div>
  </div>
);

export default TTS_STT_Test;
