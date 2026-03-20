import { useRef } from "react";
import { useGLTF } from "@react-three/drei";
import {
	useFrame,
	type ThreeElements,
} from "@react-three/fiber";
import { MathUtils, type SkinnedMesh } from "three";

type MorphMesh = SkinnedMesh & {
	morphTargetDictionary?: Record<string, number>;
	morphTargetInfluences?: number[];
};

const VISEME_KEYS = [
	"viseme_sil",
	"viseme_PP",
	"viseme_FF",
	"viseme_TH",
	"viseme_DD",
	"viseme_kk",
	"viseme_CH",
	"viseme_SS",
	"viseme_nn",
	"viseme_RR",
	"viseme_aa",
	"viseme_E",
	"viseme_I",
	"viseme_O",
	"viseme_U",
] as const;

const applyVisemeToMesh = (
	mesh: MorphMesh | null,
	activeViseme: string,
	visemeStrength: number,
	smoothing: number,
	speakingFallback: number,
) => {
	const clamp = (v: number, min = 0, max = 0.55) =>
		Math.min(max, Math.max(min, v));
	if (
		!mesh?.morphTargetDictionary ||
		!mesh.morphTargetInfluences
	)
		return;

	const {
		morphTargetDictionary: dict,
		morphTargetInfluences: influences,
	} = mesh;

	const setMorph = (key: string, target: number) => {
		const index = dict[key];
		if (index === undefined) return;

		const safeTarget = clamp(target * visemeStrength);
		influences[index] = MathUtils.lerp(
			influences[index] ?? 0,
			safeTarget,
			smoothing,
		);
	};

	for (const viseme of VISEME_KEYS) {
		const index = dict[viseme];
		if (index === undefined) continue;
		const target =
			viseme === activeViseme ? visemeStrength : 0;
		influences[index] = MathUtils.lerp(
			influences[index] ?? 0,
			target,
			smoothing,
		);
	}

	// Ensure visible mouth motion even when viseme cues are sparse.
	const baseJaw =
		activeViseme === "viseme_sil"
			? speakingFallback * 0.2
			: speakingFallback * 0.3;
	const visemeJawBoost: Record<string, number> = {
		viseme_PP: 0.1,
		viseme_FF: 0.15,
		viseme_TH: 0.18,
		viseme_DD: 0.2,
		viseme_kk: 0.25,
		viseme_CH: 0.25,
		viseme_SS: 0.15,
		viseme_nn: 0.2,
		viseme_RR: 0.18,
		viseme_aa: 0.45, // was 0.75 ❌
		viseme_E: 0.35,
		viseme_I: 0.3,
		viseme_O: 0.38,
		viseme_U: 0.35,
		viseme_sil: 0,
	};
	const jawTarget = Math.max(
		baseJaw,
		visemeJawBoost[activeViseme] ?? 0,
	);
	setMorph("jawOpen", jawTarget);
	setMorph(
		"mouthClose",
		activeViseme === "viseme_PP" ? 0.5 : 0,
	);
	setMorph(
		"mouthFunnel",
		activeViseme === "viseme_O" ||
			activeViseme === "viseme_U"
			? 0.45
			: 0,
	);
	setMorph(
		"mouthPucker",
		activeViseme === "viseme_U" ? 0.35 : 0,
	);
};

type AvatarProps = ThreeElements["group"] & {
	activeViseme?: string;
	visemeStrength?: number;
	smoothing?: number;
	isSpeaking?: boolean;
};

export function Avatar({
	activeViseme = "viseme_sil",
	visemeStrength = 1,
	smoothing = 0.35,
	isSpeaking = false,
	...props
}: AvatarProps) {
	const { nodes, materials } = useGLTF(
		"/models/main-avatar.glb",
	) as any;
	const headRef = useRef<MorphMesh>(null);
	const teethRef = useRef<MorphMesh>(null);
	const beardRef = useRef<MorphMesh>(null);

	useFrame((state) => {
		const speakingFallback = isSpeaking
			? ((Math.sin(state.clock.elapsedTime * 12) + 1) / 2) *
				0.15
			: 0;
		applyVisemeToMesh(
			headRef.current,
			activeViseme,
			visemeStrength,
			smoothing,
			speakingFallback,
		);
		applyVisemeToMesh(
			teethRef.current,
			activeViseme,
			visemeStrength,
			smoothing,
			speakingFallback,
		);
		applyVisemeToMesh(
			beardRef.current,
			activeViseme,
			visemeStrength,
			smoothing,
			speakingFallback,
		);
	});

	return (
		<group {...props} dispose={null}>
			<primitive object={nodes.Hips} />
			<skinnedMesh
				name="EyeLeft"
				geometry={nodes.EyeLeft.geometry}
				material={materials.Wolf3D_Eye}
				skeleton={nodes.EyeLeft.skeleton}
				morphTargetDictionary={
					nodes.EyeLeft.morphTargetDictionary
				}
				morphTargetInfluences={
					nodes.EyeLeft.morphTargetInfluences
				}
			/>
			<skinnedMesh
				name="EyeRight"
				geometry={nodes.EyeRight.geometry}
				material={materials.Wolf3D_Eye}
				skeleton={nodes.EyeRight.skeleton}
				morphTargetDictionary={
					nodes.EyeRight.morphTargetDictionary
				}
				morphTargetInfluences={
					nodes.EyeRight.morphTargetInfluences
				}
			/>
			<skinnedMesh
				name="Wolf3D_Head"
				ref={headRef}
				geometry={nodes.Wolf3D_Head.geometry}
				material={materials.Wolf3D_Skin}
				skeleton={nodes.Wolf3D_Head.skeleton}
				morphTargetDictionary={
					nodes.Wolf3D_Head.morphTargetDictionary
				}
				morphTargetInfluences={
					nodes.Wolf3D_Head.morphTargetInfluences
				}
			/>
			<skinnedMesh
				name="Wolf3D_Teeth"
				ref={teethRef}
				geometry={nodes.Wolf3D_Teeth.geometry}
				material={materials.Wolf3D_Teeth}
				skeleton={nodes.Wolf3D_Teeth.skeleton}
				morphTargetDictionary={
					nodes.Wolf3D_Teeth.morphTargetDictionary
				}
				morphTargetInfluences={
					nodes.Wolf3D_Teeth.morphTargetInfluences
				}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Hair.geometry}
				material={materials.Wolf3D_Hair}
				skeleton={nodes.Wolf3D_Hair.skeleton}
			/>
			<skinnedMesh
				name="Wolf3D_Beard"
				ref={beardRef}
				geometry={nodes.Wolf3D_Beard.geometry}
				material={materials.Wolf3D_Beard}
				skeleton={nodes.Wolf3D_Beard.skeleton}
				morphTargetDictionary={
					nodes.Wolf3D_Beard.morphTargetDictionary
				}
				morphTargetInfluences={
					nodes.Wolf3D_Beard.morphTargetInfluences
				}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Glasses.geometry}
				material={materials.Wolf3D_Glasses}
				skeleton={nodes.Wolf3D_Glasses.skeleton}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Body.geometry}
				material={materials.Wolf3D_Body}
				skeleton={nodes.Wolf3D_Body.skeleton}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Outfit_Bottom.geometry}
				material={materials.Wolf3D_Outfit_Bottom}
				skeleton={nodes.Wolf3D_Outfit_Bottom.skeleton}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Outfit_Footwear.geometry}
				material={materials.Wolf3D_Outfit_Footwear}
				skeleton={nodes.Wolf3D_Outfit_Footwear.skeleton}
			/>
			<skinnedMesh
				geometry={nodes.Wolf3D_Outfit_Top.geometry}
				material={materials.Wolf3D_Outfit_Top}
				skeleton={nodes.Wolf3D_Outfit_Top.skeleton}
			/>
		</group>
	);
}

useGLTF.preload("/models/main-avatar.glb");
