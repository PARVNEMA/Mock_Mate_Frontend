import { useEffect, useMemo, useState } from "react";
import RiveAvatar from "./RiveAvatar";
import { useAvatarSpeech } from "./hooks/useAvatarSpeech";
import type { AvatarInterviewerProps } from "./types";

const DEFAULT_PROMPT =
	"Tell me about your experience building frontend applications with React.";
const TALKING_TEST_TEXT =
	"Hi, I am your interview avatar. This is a talking animation and voice synchronization test.";

const QUICK_QUESTIONS = [
	"Walk me through your latest project architecture.",
	"How do you optimize React rendering performance?",
	"Explain a bug you debugged and how you fixed it.",
];

function statusBadgeClass(
	status: "idle" | "loading" | "speaking" | "error",
) {
	if (status === "speaking") {
		return "bg-emerald-100 text-emerald-700";
	}
	if (status === "loading") {
		return "bg-amber-100 text-amber-700";
	}
	if (status === "error") {
		return "bg-rose-100 text-rose-700";
	}
	return "bg-slate-100 text-slate-600";
}

export default function AvatarInterviewer({
	compact = true,
	defaultText = DEFAULT_PROMPT,
	riveFile = "/avatar/interviewer.riv",
	onSpeechStart,
	onSpeechEnd,
	onSpeechError,
}: AvatarInterviewerProps) {
	const [text, setText] = useState(defaultText);
	const [isTestingAvatar, setIsTestingAvatar] =
		useState(false);
	const [testAudioLevel, setTestAudioLevel] = useState(0);
	const { speechState, speak, stop } = useAvatarSpeech({
		onSpeechStart,
		onSpeechEnd,
		onSpeechError,
	});

	useEffect(() => {
		if (!isTestingAvatar) {
			setTestAudioLevel(0);
			return;
		}

		let tick = 0;
		const intervalId = window.setInterval(() => {
			tick += 1;
			const wave = (Math.sin(tick / 1.9) + 1) / 2;
			const jitter = Math.random() * 0.15;
			setTestAudioLevel(
				Math.min(1, 0.15 + wave * 0.75 + jitter),
			);
		}, 120);
		const timeoutId = window.setTimeout(() => {
			setIsTestingAvatar(false);
		}, 6000);

		return () => {
			window.clearInterval(intervalId);
			window.clearTimeout(timeoutId);
		};
	}, [isTestingAvatar]);

	const isBusy =
		speechState.status === "loading" ||
		speechState.status === "speaking";
	const isTalking =
		isTestingAvatar || speechState.status === "speaking";
	const audioLevel = isTestingAvatar
		? testAudioLevel
		: speechState.audioLevel;
	const statusLabel = useMemo(() => {
		if (isTestingAvatar) {
			return "Testing";
		}
		if (speechState.status === "speaking") {
			return "Speaking";
		}
		if (speechState.status === "loading") {
			return "Preparing";
		}
		if (speechState.status === "error") {
			return "Error";
		}
		return "Idle";
	}, [isTestingAvatar, speechState.status]);

	return (
		<section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
			<div className="flex flex-col gap-4 md:flex-row">
				<div
					className={`mx-auto w-full shrink-0 ${
						compact
							? "max-w-[180px] md:max-w-[200px]"
							: "max-w-[240px]"
					}`}
				>
					<div className="h-auto w-auto">
						<RiveAvatar
							riveFile={riveFile}
							isTalking={isTalking}
							mouthOpen={audioLevel}
							energy={audioLevel}
						/>
					</div>
					<div className="mt-2 flex items-center justify-center gap-2 text-xs">
						<span
							className={`rounded-full px-2 py-0.5 font-semibold ${statusBadgeClass(speechState.status)}`}
						>
							{statusLabel}
						</span>
						<span className="font-semibold text-slate-500">
							level {Math.round(audioLevel * 100)}%
						</span>
					</div>
				</div>

				<div className="flex min-w-0 grow flex-col gap-3">
					<label className="text-sm font-semibold text-slate-700">
						Interview question
					</label>
					<textarea
						className="h-28 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white"
						value={text}
						onChange={(event) =>
							setText(event.target.value)
						}
						placeholder="Type the question that avatar should ask..."
					/>

					<div className="flex flex-wrap gap-2">
						{QUICK_QUESTIONS.map((question) => (
							<button
								key={question}
								type="button"
								onClick={() => setText(question)}
								className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600"
							>
								{question}
							</button>
						))}
					</div>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={() =>
								speak({
									text,
									voice: "en-IN-NeerjaNeural",
									interrupt: true,
									rate: 0.95,
									pitch: 1,
								})
							}
							disabled={isBusy || !text.trim()}
							className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
						>
							{isBusy ? "Speaking..." : "Speak with Avatar"}
						</button>
						<button
							type="button"
							onClick={stop}
							className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
						>
							Stop
						</button>
						<button
							type="button"
							onClick={() => setIsTestingAvatar(true)}
							disabled={isTestingAvatar}
							className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
						>
							{isTestingAvatar
								? "Testing Avatar..."
								: "Run 6s Avatar Test"}
						</button>
						<button
							type="button"
							onClick={() => {
								setText(TALKING_TEST_TEXT);
								speak({
									text: TALKING_TEST_TEXT,
									voice: "browser-default",
									interrupt: true,
									rate: 1,
									pitch: 1,
								});
							}}
							className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
						>
							Play Talking TTS Demo
						</button>
					</div>

					{speechState.error && (
						<p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
							{speechState.error}
						</p>
					)}
				</div>
			</div>
		</section>
	);
}
