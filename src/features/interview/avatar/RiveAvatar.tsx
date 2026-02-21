import { useEffect, useRef, useState } from "react";

interface RiveAvatarProps {
	isTalking: boolean;
	mouthOpen: number;
	energy?: number;
	className?: string;
	riveFile?: string;
	stateMachineName?: string;
}

type RiveInput = {
	name: string;
	value?: number | boolean;
	fire?: () => void;
};

type InputBindings = {
	talkingTrigger?: RiveInput;
	talkingBoolean?: RiveInput;
	talkingNumber?: RiveInput;
	mouthOpen?: RiveInput;
	energy?: RiveInput;
};

type RiveInstance = {
	cleanup?: () => void;
	stateMachineInputs: (
		stateMachineName: string,
	) => RiveInput[];
	resizeDrawingSurfaceToCanvas?: () => void;
	play?: (animationNames?: string | string[]) => void;
	contents?: {
		artboards?: Array<{
			stateMachines?: Array<{
				name: string;
			}>;
			animations?: Array<{
				name: string;
			}>;
		}>;
	};
};

type RiveRuntime = {
	Rive: new (
		config: Record<string, unknown>,
	) => RiveInstance;
};

declare global {
	interface Window {
		rive?: RiveRuntime;
	}
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function setInputValue(
	input: RiveInput | undefined,
	value: number | boolean,
) {
	if (!input) {
		return;
	}
	if (typeof input.value === "boolean") {
		input.value = Boolean(value);
		return;
	}
	if (typeof input.value === "number") {
		if (typeof value === "boolean") {
			input.value = value ? 1 : 0;
			return;
		}
		input.value = clamp(value, 0, 1);
	}
}

function normalizedName(name: string) {
	return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function hasKeyword(name: string, keywords: string[]) {
	return keywords.some((keyword) => name.includes(keyword));
}

function findBestInput(
	inputs: RiveInput[],
	keywords: string[],
	type: "trigger" | "boolean" | "number",
	excludeKeywords: string[] = [],
) {
	const matches = inputs.filter((input) => {
		const name = normalizedName(input.name);
		if (
			excludeKeywords.length > 0 &&
			hasKeyword(name, excludeKeywords)
		) {
			return false;
		}
		if (!hasKeyword(name, keywords)) {
			return false;
		}
		if (type === "trigger") {
			return typeof input.fire === "function";
		}
		if (type === "boolean") {
			return typeof input.value === "boolean";
		}
		return typeof input.value === "number";
	});

	if (matches.length === 0) {
		return undefined;
	}

	matches.sort(
		(left, right) =>
			normalizedName(left.name).length -
			normalizedName(right.name).length,
	);
	return matches[0];
}

function resolveStateMachineName(
	rive: RiveInstance,
	preferredStateMachineName?: string,
) {
	if (preferredStateMachineName) {
		return preferredStateMachineName;
	}
	return rive.contents?.artboards?.[0]?.stateMachines?.[0]
		?.name;
}

function resolveAnimationName(rive: RiveInstance) {
	return rive.contents?.artboards?.[0]?.animations?.[0]
		?.name;
}

function findInputByNames(
	inputs: RiveInput[],
	names: string[],
) {
	const lookup = names.map((name) => name.toLowerCase());
	return inputs.find((input) =>
		lookup.includes(input.name.toLowerCase()),
	);
}

function FallbackAvatar({
	isTalking,
	mouthOpen,
}: Pick<RiveAvatarProps, "isTalking" | "mouthOpen">) {
	const mouthLevel = clamp(mouthOpen, 0, 1);
	const mouthHeight = Math.max(
		4,
		Math.round(5 + mouthLevel * 22),
	);
	const mouthWidth = 24 + Math.round(mouthLevel * 18);
	const eyeScale = isTalking ? 0.98 : 1;

	return (
		<div className="relative flex h-full w-full items-center justify-center rounded-2xl bg-slate-100">
			<svg
				width="88%"
				height="88%"
				viewBox="0 0 220 220"
				role="img"
				aria-label="Interviewer avatar fallback"
			>
				<defs>
					<linearGradient
						id="avatarSkin"
						x1="0%"
						y1="0%"
						x2="0%"
						y2="100%"
					>
						<stop offset="0%" stopColor="#f8dfc6" />
						<stop offset="100%" stopColor="#f3d1aa" />
					</linearGradient>
					<linearGradient
						id="avatarHair"
						x1="0%"
						y1="0%"
						x2="100%"
						y2="100%"
					>
						<stop offset="0%" stopColor="#334155" />
						<stop offset="100%" stopColor="#0f172a" />
					</linearGradient>
				</defs>
				<ellipse
					cx="110"
					cy="120"
					rx="60"
					ry="70"
					fill="url(#avatarSkin)"
				/>
				<path
					d="M56 110c-2-40 24-74 55-74s58 22 54 80c-13-14-31-22-53-22-23 0-40 7-56 16Z"
					fill="url(#avatarHair)"
				/>
				<ellipse
					cx="85"
					cy="117"
					rx="10"
					ry={7 * eyeScale}
					fill="#1f2937"
				/>
				<ellipse
					cx="135"
					cy="117"
					rx="10"
					ry={7 * eyeScale}
					fill="#1f2937"
				/>
				<ellipse
					cx="81"
					cy="114"
					rx="2"
					ry="2"
					fill="#f8fafc"
				/>
				<ellipse
					cx="131"
					cy="114"
					rx="2"
					ry="2"
					fill="#f8fafc"
				/>
				<rect
					x={110 - mouthWidth / 2}
					y={150 - mouthHeight / 2}
					width={mouthWidth}
					height={mouthHeight}
					rx={mouthHeight / 2}
					fill="#7f1d1d"
				/>
			</svg>
			<span className="absolute bottom-2 rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
				Rive fallback
			</span>
		</div>
	);
}

export default function RiveAvatar({
	isTalking,
	mouthOpen,
	energy = 0,
	className,
	riveFile = "/avatar/interviewer.riv",
	stateMachineName,
}: RiveAvatarProps) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const riveRef = useRef<RiveInstance | null>(null);
	const inputRefs = useRef<InputBindings>({});
	const [status, setStatus] = useState<
		"ready" | "fallback"
	>("fallback");
	const lastTalkingTriggerAtRef = useRef<number>(0);

	useEffect(() => {
		const runtime = window.rive;
		const canvas = canvasRef.current;

		if (!runtime?.Rive || !canvas) {
			if (!runtime?.Rive) {
				console.error(
					"[RiveAvatar] Rive runtime not found on window.",
				);
			}
			return;
		}

		let mounted = true;
		let retryWithoutStateMachine = false;
		const configuredStateMachineName =
			stateMachineName ?? "State Machine 1";
		const bindInputs = (rive: RiveInstance) => {
			const resolvedStateMachineName =
				resolveStateMachineName(rive, stateMachineName);
			if (!resolvedStateMachineName) {
				return false;
			}

			try {
				const stateInputs = rive.stateMachineInputs(
					resolvedStateMachineName,
				);
				const talkingTrigger =
					findInputByNames(stateInputs, [
						"speak",
						"talk",
						"isTalking",
					]) ??
					findBestInput(
						stateInputs,
						["talk", "speak", "speech", "voice"],
						"trigger",
						["blink", "eye", "brow", "idle"],
					);
				const talkingBoolean = findBestInput(
					stateInputs,
					["talk", "speak", "speech", "voice", "chat"],
					"boolean",
					["blink", "eye", "brow", "idle"],
				);
				const talkingNumber = findBestInput(
					stateInputs,
					["talk", "speak", "speech", "voice", "chat"],
					"number",
					["blink", "eye", "brow", "idle"],
				);
				const mouthInput = findBestInput(
					stateInputs,
					[
						"mouth",
						"lip",
						"jaw",
						"viseme",
						"phoneme",
						"open",
					],
					"number",
					["eye", "brow", "idle"],
				);
				const energyInput = findBestInput(
					stateInputs,
					["energy", "intensity", "level", "volume", "amp"],
					"number",
					["eye", "brow", "idle"],
				);

				inputRefs.current = {
					talkingTrigger,
					talkingBoolean,
					talkingNumber,
					mouthOpen: mouthInput,
					energy: energyInput,
				};
				console.info("[RiveAvatar] State machine bound.", {
					stateMachine: resolvedStateMachineName,
					inputs: stateInputs.map((input) => ({
						name: input.name,
						type: typeof input.value,
					})),
					mapped: {
						talkingTrigger: talkingTrigger?.name,
						talkingBoolean: talkingBoolean?.name,
						talkingNumber: talkingNumber?.name,
						mouthOpen: mouthInput?.name,
						energy: energyInput?.name,
					},
				});
				return stateInputs.length > 0;
			} catch {
				inputRefs.current = {};
				return false;
			}
		};
		const createRive = (withStateMachine: boolean) => {
			const config: Record<string, unknown> = {
				src: riveFile,
				canvas,
				autoplay: true,
				onLoad: () => {
					if (!mounted || !riveRef.current) {
						return;
					}

					const hasInputs = bindInputs(riveRef.current);
					if (!hasInputs) {
						const animationName = resolveAnimationName(
							riveRef.current,
						);
						if (animationName) {
							riveRef.current.play?.(animationName);
							console.info(
								"[RiveAvatar] Playing animation fallback.",
								{
									animation: animationName,
								},
							);
						}
					}
					riveRef.current.resizeDrawingSurfaceToCanvas?.();
					setStatus("ready");
				},
				onLoadError: () => {
					if (!mounted) {
						return;
					}
					if (
						withStateMachine &&
						!retryWithoutStateMachine
					) {
						retryWithoutStateMachine = true;
						riveRef.current?.cleanup?.();
						riveRef.current = null;
						inputRefs.current = {};
						try {
							riveRef.current = createRive(false);
						} catch {
							console.error(
								"[RiveAvatar] Failed to load .riv without state machine.",
								{
									riveFile,
								},
							);
							setStatus("fallback");
						}
						return;
					}
					console.error(
						"[RiveAvatar] Failed to load .riv file.",
						{
							riveFile,
							stateMachineName,
						},
					);
					setStatus("fallback");
				},
			};
			if (withStateMachine) {
				config.stateMachines = configuredStateMachineName;
			}
			return new runtime.Rive(config);
		};
		const resizeListener = () => {
			riveRef.current?.resizeDrawingSurfaceToCanvas?.();
		};

		try {
			riveRef.current = createRive(true);
			window.addEventListener("resize", resizeListener);
		} catch {
			console.error(
				"[RiveAvatar] Runtime initialization failed.",
				{
					riveFile,
					stateMachineName,
				},
			);
			// Keep fallback mode when runtime initialization fails.
		}

		return () => {
			mounted = false;
			window.removeEventListener("resize", resizeListener);
			inputRefs.current = {};
			lastTalkingTriggerAtRef.current = 0;
			riveRef.current?.cleanup?.();
			riveRef.current = null;
		};
	}, [riveFile, stateMachineName]);

	useEffect(() => {
		const speechLevel = clamp(
			mouthOpen * 0.85 + energy * 0.15,
			0,
			1,
		);
		const talkingInput = inputRefs.current.talkingBoolean;
		const talkingNumberInput =
			inputRefs.current.talkingNumber;
		const mouthInput = inputRefs.current.mouthOpen;
		const energyInput = inputRefs.current.energy;
		const talkingTriggerInput =
			inputRefs.current.talkingTrigger;

		if (!isTalking) {
			lastTalkingTriggerAtRef.current = 0;
		} else if (talkingTriggerInput?.fire) {
			const now = Date.now();
			const triggerEveryMs = Math.round(
				260 - speechLevel * 150,
			);
			if (
				lastTalkingTriggerAtRef.current === 0 ||
				now - lastTalkingTriggerAtRef.current >=
					triggerEveryMs
			) {
				talkingTriggerInput.fire();
				lastTalkingTriggerAtRef.current = now;
			}
		}

		setInputValue(talkingInput, isTalking);
		setInputValue(talkingNumberInput, speechLevel);
		setInputValue(mouthInput, clamp(mouthOpen, 0, 1));
		setInputValue(energyInput, clamp(energy, 0, 1));
	}, [energy, isTalking, mouthOpen]);

	return (
		<div
			className={`relative overflow-hidden rounded-2xl bg-slate-100 ${className ?? ""}`}
		>
			<canvas
				ref={canvasRef}
				className={`h-50 w-60 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
			/>
			{status !== "ready" && (
				<div className="absolute inset-0">
					<FallbackAvatar
						isTalking={isTalking}
						mouthOpen={mouthOpen}
					/>
				</div>
			)}
		</div>
	);
}
