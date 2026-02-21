# Rive Avatar Contract

Place your exported Rive file at:

- `public/avatar/interviewer.riv`

State machine contract expected by frontend:

- State machine name: `InterviewerSM`
- Inputs:
  - `isTalking` (`bool`)
  - `mouthOpen` (`number`, `0..1`)
  - `energy` (`number`, optional, `0..1`)

Recommended artboard setup:

- Artboard size: `512x512`
- Transparent background
- Head-and-shoulders framing for compact cards

If the `.riv` file or runtime is missing, the UI falls back to a lightweight SVG avatar.
