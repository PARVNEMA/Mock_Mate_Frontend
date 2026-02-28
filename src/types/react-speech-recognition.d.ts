declare module "react-speech-recognition" {
	export interface SpeechRecognitionOptions {
		continuous?: boolean;
		interimResults?: boolean;
		language?: string;
	}

export interface SpeechRecognitionHookResponse {
	transcript: string;
	finalTranscript: string;
	interimTranscript: string;
	listening: boolean;
	isMicrophoneAvailable: boolean;
	resetTranscript: () => void;
	browserSupportsSpeechRecognition: boolean;
	browserSupportsContinuousListening: boolean;
}

	export function useSpeechRecognition(): SpeechRecognitionHookResponse;

	const SpeechRecognition: {
		startListening: (
			options?: SpeechRecognitionOptions,
		) => Promise<void>;
		stopListening: () => Promise<void>;
		abortListening: () => Promise<void>;
		getRecognition: () => EventTarget | null;
	};

	export default SpeechRecognition;
}
