# GD Frontend Flow (WebSocket + WebRTC + Transcript)

This document explains the **Group Discussion (GD)** frontend flow and what each file does.

---

## 1) High-level flow

1. **User signs in**  
   - `src/pages/SignIn.tsx` / `src/pages/SignUp.tsx`  
   - Stores tokens + `userId` in `AuthContext`.

2. **Lobby join (WebSocket)**  
   - UI: `src/pages/GdLobby.tsx`  
   - Socket: `src/hooks/useGdLobbySocket.ts`  
   - Server endpoint: `ws://<API>/GD/lobby/ws/{user_id}`  
   - Receives: `lobby_update`, `queue_status`, `room_created`

3. **Room join (WebSocket)**  
   - UI: `src/pages/GdRoom.tsx`  
   - Socket: `src/hooks/useGdRoomSocket.ts`  
   - Server endpoint: `ws://<API>/GD/room/ws/{room_id}/{user_id}`  
   - Receives: `room_state`, `peer_joined`, `peer_left`, signaling messages

4. **WebRTC connection between peers**  
   - Hook: `src/hooks/useGdWebRtc.ts`  
   - Uses WS to exchange `offer/answer/ice_candidate`
   - Renders remote streams on `ParticipantGrid`.

5. **Live transcript (chat-style)**  
   - Hook: `src/hooks/useGdTranscription.ts` (browser SpeechRecognition)  
   - Sends `{ type: "transcript", text }` over room WS  
   - UI: `src/components/gd/TranscriptPanel.tsx`

6. **Moderation / reporting**  
   - UI: `src/components/gd/ReportModal.tsx`  
   - WS event: `{ type: "report", reported_user_id, reason }`  
   - REST fallback: `src/services/gdApi.ts`

---

## 2) UI pages (top-level)

### `src/pages/GdLobby.tsx`
- Join/leave lobby.
- Displays queue stats and lobby status.
- Starts lobby WebSocket only after user clicks **Join Lobby**.

### `src/pages/GdRoom.tsx`
- Main GD room UI.
- Handles WS messages for room state and WebRTC signaling.
- Manages:
  - Topic panel
  - Media controls (audio/video)
  - Participants grid
  - Report modal
  - Transcript panel

---

## 3) Hooks (core logic)

### `src/hooks/useGdLobbySocket.ts`
- Lobby WebSocket lifecycle (connect, heartbeat, reconnect).
- Stops auto-reconnect on server close codes `4403` (blacklisted) / `4409` (room locked).

### `src/hooks/useGdRoomSocket.ts`
- Room WebSocket lifecycle.
- Same reconnect guard as lobby to avoid infinite retry loops.

### `src/hooks/useGdWebRtc.ts`
- Creates `RTCPeerConnection` per peer.
- Handles offer/answer/ice-candidate.
- Manages local and remote media streams.

### `src/hooks/useGdTranscription.ts`
- Browser SpeechRecognition.
- Emits text only when final results are received.
- Used in `GdRoom.tsx` to push transcripts into chat.

---

## 4) Components (UI building blocks)

### Core GD components
- `src/components/gd/ParticipantGrid.tsx`  
  Renders local + remote participant tiles (even before media connects).

- `src/components/gd/ParticipantTile.tsx`  
  Shows video + label and a “Connecting…” overlay until stream arrives.

- `src/components/gd/MediaControls.tsx`  
  Audio/video toggles and leave button.

- `src/components/gd/TopicPanel.tsx`  
  Shows topic, context, and key points.

- `src/components/gd/TranscriptPanel.tsx`  
  Chat-style transcript list.

- `src/components/gd/ReportModal.tsx`  
  Report peer UI (sends WS message or REST fallback).

- `src/components/gd/ConnectionBadge.tsx`  
  Shows WebSocket connection state.

---

## 5) Services + Types

### `src/services/gdApi.ts`
REST helpers:
- `/GD/lobby/join`
- `/GD/lobby/leave`
- `/GD/lobby/leave-room`
- `/GD/lobby/room/{room_id}`
- `/GD/room/{room_id}`
- `/GD/room/{room_id}/report`

### `src/types/gd.ts`
All shared GD types:
- WS message union (`GdLobbyWsMessage`, `GdRoomWsMessage`)
- Room / peer / report models
- Transcript message model

### `src/types/speech.d.ts`
Adds SpeechRecognition TypeScript typings for browsers.

---

## 6) Routing / Navigation

### `src/main.tsx`
Routes:
- `/gd` -> `GdLobby`
- `/gd/room/:roomId` -> `GdRoom`

### `src/components/Header.tsx`
Adds navigation entry for GD.

---

## 7) Environment variables

Frontend uses:
- `VITE_BACKEND_URL` (HTTP base, e.g. `http://localhost:8000`)
- `VITE_GD_ICE_SERVERS` (optional JSON array of ICE servers)

---

## 8) Common issues checklist

- **Repeated WS close warnings**:  
  Server closes with `4403/4409` — frontend now stops reconnecting.

- **Late join not allowed**:  
  Room becomes `ACTIVE` after lock time on backend. Rejoin only within reconnect grace window.

- **No remote video**:  
  Check that offers/answers/ICE messages are flowing in the room WS.

---

If you want, I can also add **sequence diagrams** or extend this with screenshots of each UI section.
