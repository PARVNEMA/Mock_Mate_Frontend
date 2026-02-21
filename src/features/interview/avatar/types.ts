export type SupportedVoice = "en-IN-NeerjaNeural" | "browser-default";

export interface AvatarSpeechRequest {
  text: string;
  voice?: SupportedVoice;
  rate?: number;
  pitch?: number;
  interrupt?: boolean;
}

export type AvatarSpeechStatus = "idle" | "loading" | "speaking" | "error";

export interface AvatarSpeechState {
  status: AvatarSpeechStatus;
  currentText: string | null;
  audioLevel: number;
  error?: string;
}

export interface AvatarInterviewerProps {
  compact?: boolean;
  defaultText?: string;
  riveFile?: string;
  onSpeechStart?: (text: string) => void;
  onSpeechEnd?: (text: string) => void;
  onSpeechError?: (message: string) => void;
}
