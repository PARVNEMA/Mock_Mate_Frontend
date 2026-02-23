# 3D Avatar Lip Sync Guide

## What this feature does

The `/test` page renders a 3D avatar and drives mouth/face visemes while interview text is spoken.

Primary path:
- `EdgeTTS` generates audio + word boundaries.
- `wawa-lipsync` analyzes the playing audio in real time.
- The detected viseme is passed to the avatar mesh morph targets.

Fallback path:
- If Edge TTS is unavailable (for example CORS/network restrictions), browser `speechSynthesis` is used.
- A local text-to-viseme track is generated from transcript/word boundaries and used to animate the avatar.

## Runtime flow

1. User clicks `Play Voice` or `Test Lip Sync` on `/test`.
2. `src/components/TTS_STT_Test.tsx` tries `speakWithEdgeTTS()`.
3. TTS output audio is attached to a shared `HTMLAudioElement`.
4. `Lipsync` from `wawa-lipsync` connects to that audio element.
5. On each animation frame, `processAudio()` updates the current viseme.
6. Current viseme is stored in `activeViseme` state.
7. `activeViseme` is passed to `src/components/Avatar.tsx`.
8. `Avatar.tsx` updates morph targets (`viseme_*`, jaw/mouth helpers) on head/teeth/beard meshes.

## File responsibilities

- `src/components/TTS_STT_Test.tsx`
  - Main test bench UI at route `/test`.
  - Orchestrates TTS playback, lipsync driver loops, and STT analytics.
  - Contains `wawa-lipsync` integration (`Lipsync`, `processAudio`, RAF loop).
  - Falls back to browser speech synthesis + local viseme track if Edge TTS fails.

- `src/components/Avatar.tsx`
  - Loads the GLB avatar model.
  - Applies viseme morph targets each frame.
  - Adds jaw/mouth fallback shaping so speech stays visible.
  - Receives `activeViseme`, `visemeStrength`, `smoothing`, `isSpeaking` as props.

- `src/utils/lipsync.ts`
  - Local phoneme/viseme mapping utilities.
  - Builds timeline cues from transcript or word boundaries.
  - Used mainly for fallback lipsync path and cue generation helpers.

- `public/models/main-avatar.glb`
  - The 3D avatar asset with required morph targets (`viseme_*`, jaw/mouth blendshapes).

- `src/main.tsx`
  - Router config; `/test` points to `TTS_STT_Test`.

## Important notes

- `wawa-lipsync` needs a valid media element source (`audio.src`) before connecting.
- Edge TTS browser usage may be blocked in some environments; fallback path is kept intentionally.
- All audio/lipsync RAF loops and object URLs are cleaned up in component stop/unmount logic.

