# Zoo Vision Phase 4a (Live Video), Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working proof-of-concept Live page: a grid of WebRTC tiles with state badges, and an opened camera
with the main stream, the engine's boxes lined up with the video, its zones, and for a SUPERADMIN a debug view
and a delay slider. A standalone `StreamPanel` shows a camera's connection, codec warning, bitrate and disk
estimate. The FE team redesigns these pages later.

**Architecture:** Video plays through MediaMTX's own WHEP client (`reader.js`, vendored) against the `liveUrls`
the API gives; the frontend never builds MediaMTX paths. Boxes come from the `camera:<id>` room on the existing
socket; a pure function picks and glides the boxes for "now minus the video delay" in server time, drawn on a
canvas on every video frame. New code lives in `src/video/`, `src/live/useCameraBoxes.ts` and
`src/features/live/`; the only shared file touched is `LiveProvider` (it exposes the socket).

**Tech Stack:** as in Phase 3 (Next.js 16, React 19, Tailwind 4, TanStack Query + orval, socket.io-client, Vitest).
Browser APIs: `RTCPeerConnection` (inside `reader.js`), `getStats()`, `HTMLVideoElement.requestVideoFrameCallback`.
No new dependencies.

**Spec:** the Phase 4a design in the backend repo,
`zoo-vision/docs/superpowers/specs/2026-10-15-phase-4a-video-design.md` (sections 2, 3 and 5 are the frontend's).
The contract details are in `src/contract/fe-contract.md` after the pull. The backend half is
`zoo-vision/docs/superpowers/plans/2026-10-15-phase-4a-video.md`; this plan starts after its tag `contract-v0.5`.

## Global Constraints

- Work in `D:\WORK\zoo-analytics-web` on branch `phase-4a-video`, cut from `phase-3-web-on-api` (not `main`: it
  has no plumbing yet). Never commit to `main`. Push only after the repo owner says yes.
- No Claude attribution in commits or pull requests. No test-first steps; one focused test where logic is risky.
- **This is Next.js 16:** read the matching guide in `node_modules/next/dist/docs/` before touching a Next.js API.
- The frontend talks only to its own origin (`/api/v1`, `/media`, `/ws`) and opens `http://localhost:8080`, never
  `:3000`.
- Never edit `src/contract/*` or `src/api/generated/*` by hand; `npm run contract:pull contract-v0.5` writes them.
- Avoid conflicts with the FE team's Phase 3 work (spec section 3): only new files, plus `src/app/live/page.tsx`
  (now 4a's) and the small `LiveProvider` change. Don't touch `src/app/config/cameras/*` (T1 is the FE team's).
- UI text in Indonesian, existing components from `src/components/ui.tsx`, light styling.
- Numbers fixed here:

  | What | Value |
  |---|---|
  | Box history kept | the last 2 s of box sets per camera |
  | Clock offset | smoothed minimum of `receivedAt − sentAt` over the last 50 messages |
  | Video delay | `jitterBufferDelay / jitterBufferEmittedCount` from `getStats()` + 50 ms network allowance, averaged over 3 s, read every 500 ms |
  | Delay slider (SUPERADMIN) | −500 to +1000 ms added to the measured delay, default 0 |
  | Grid tile fallback still | `GET /api/v1/cameras/:id/frame` every 2 s, one request at a time |
  | `StreamPanel` refresh | every 5 s while mounted |

## Decisions this plan makes beyond the design

1. **`LiveProvider` exposes the socket** (`socket: LiveSocket | null` in the context value), so
   `useCameraBoxes` joins `camera:<id>` on the one socket and rejoins on every `connect`. `useLive`'s other
   behaviour is unchanged.
2. **Zones are found generically:** any array of `[x, y]` pairs (numbers 0–1) in the active config's settings is a
   line (2 points) or a polygon (3 or more). No per-use-case code; good enough for a proof of concept.
3. **A box with `trackId: null` never glides:** it is drawn from the box set nearest in time.
4. **A tile with no `liveUrls`, or whose player fails or stalls 10 s, falls back to the 2 s still** (`FILE`
   cameras, the demo profile, an H.265 stream the browser can't play).
5. **The Live page is `src/features/live/`**, with `src/app/live/page.tsx` a thin wrapper (Phase 3 decision 2).

## Review Focus

1. **The tab is hidden for a minute, then shown again.** Expected: no stale boxes from a minute ago are drawn, the
   box buffer did not grow (it is pruned on every message), and the video catches up. Test in V2.
2. **The socket reconnects while a camera is open** (API restart). Expected: the hook rejoins `camera:<id>` and
   boxes resume without reopening the camera. Checked in V5.
3. **The user switches between three cameras quickly.** Expected: one room joined at a time, each old WHEP session
   closed (`DELETE`), no boxes of the previous camera drawn on the new one. Checked in V5 (MediaMTX log shows the
   sessions closing).
4. **A box set arrives before the video plays** (no `getStats` yet). Expected: boxes drawn with the network
   allowance only, never an exception. Test in V2.
5. **`session.ended` while video plays.** Expected: the player closes (the provider already logs out; the
   player's unmount closes the peer connection). Checked in V5.

## Execution sessions

| Session | Tasks | Ends with |
|---|---|---|
| **D: the pieces and the page** | V1–V4 | the Live page and `StreamPanel` working against the laptop stack; Sonnet reviews per task |
| **E: joint run** | V5 | the spec's laptop verification through the UI, Opus whole-branch review (both repos' 4a diffs), pushes after the owner's yes |

---

> **Session D starts here: Tasks V1–V4.** Needs the backend tag `contract-v0.5` pushed.

### Task V1: Branch, contract v0.5, the WHEP player

**Files:**
- Create: `src/video/reader.js` (MediaMTX v1.21.1 `internal/servers/webrtc/reader.js`, MIT header kept, plus a
  first-line comment with the source URL and version), `src/video/reader.d.ts`, `src/video/WhepPlayer.tsx`
- Modify: `src/contract/*`, `src/api/generated/*` (by the pull only)

**Interfaces:**
- `reader.d.ts` declares the `MediaMTXWebRTCReader` class the file exports (constructor options `url`, `onTrack`,
  `onError`; `close()`). If the vendored file attaches to `window` instead of exporting, add one `export` line at
  its end and say so in the header comment.
- `<WhepPlayer url: string; onVideo?: (v: HTMLVideoElement) => void; onFail?: () => void; className?: string>`:
  a muted, autoplaying, `playsInline` `<video>`; starts a reader for `url` on mount, closes it on unmount or URL
  change; `onFail` after a reader error or 10 s without a playing frame.

- [ ] **Step 1: Branch and pull**

```bash
git checkout phase-3-web-on-api && git pull && git checkout -b phase-4a-video
npm run contract:pull contract-v0.5
```
Expected: `src/contract/CONTRACT_VERSION` is `contract-v0.5`; `web.d.ts` has `BoxesMessage`; the generated cameras
module has `useCamerasStreamInfo`; `CameraViewDto` has `liveUrls`.

- [ ] **Step 2: Vendor `reader.js`, write `WhepPlayer`**

- [ ] **Step 3: Check**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`. Expected: pass (fix any type fallout of the
pull in existing files: `Point` is now `[number, number]`).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: pull contract-v0.5; WHEP player on MediaMTX's reader.js"
```

---

### Task V2: Boxes: room hook, "boxes at time t", overlay

**Files:**
- Create: `src/live/useCameraBoxes.ts`, `src/video/boxes-at.ts`, `src/video/boxes-at.test.ts`,
  `src/video/sync.ts`, `src/video/zones.ts`, `src/video/BoxOverlay.tsx`
- Modify: `src/live/LiveProvider.tsx` (socket in the context), `src/live/index.ts` (export the hook)

**Interfaces:**
- `boxes-at.ts` (pure):
  ```ts
  export type BoxSet = { t: number; boxes: Box[] };          // Box from '@/contract/web'
  export function boxesAt(sets: BoxSet[], t: number): Box[];  // sets sorted by t
  export function prune(sets: BoxSet[], newest: number, keepMs = 2000): BoxSet[];
  ```
  `boxesAt`: before the first set or after the last → that end's boxes; between sets A and B → each box of A whose
  `trackId` is in B moves linearly by `(t − A.t) / (B.t − A.t)`; boxes of A not in B, and `trackId: null` boxes,
  come from whichever of A/B is nearer in time. Sets older than 2 s before `t` give nothing (empty array).
- `useCameraBoxes(cameraId: string | null): { sets: React.MutableRefObject<BoxSet[]>; clock: ClockSync }` — joins
  `camera:<id>` when connected and on every `connect`, leaves on unmount or id change, pushes each `boxes` message
  (ignoring other cameras' ids) and prunes.
- `sync.ts`: `class ClockSync { onMessage(sentAt: number, receivedAt: number): void; serverNow(): number }` and
  `class VideoDelay { constructor(pc: () => RTCPeerConnection | null); start(): void; stop(): void; ms(): number }`
  (values per Global Constraints; `ms()` is the 50 ms allowance until stats exist).
- `zones.ts`: `geometryOf(settings: unknown): { lines: Point[][]; polygons: Point[][] }` (decision 2).
- `<BoxOverlay video: HTMLVideoElement; cameraId: string; settings?: unknown; extraDelayMs: number>`: a canvas
  sized to the video's displayed box (object-fit contain); on each `requestVideoFrameCallback` draws
  `boxesAt(sets, clock.serverNow() − delay.ms() − extraDelayMs)` with labels (`label #trackId`) and the zones.
  `reader.js` must hand out its `RTCPeerConnection` for `VideoDelay` (read it from the reader instance; if the
  vendored class keeps it private, pass `null` and use the allowance only, noted in a comment).

- [ ] **Step 1: Implement**

- [ ] **Step 2: Write the focused test** (`boxes-at.test.ts`)

```ts
it('between two sets a tracked box glides: halfway → x1 halfway')
it('a track only in the earlier set is drawn as is from it when nearer, gone when the later set is nearer')
it('trackId null boxes come from the nearer set, never interpolated')
it('t before the first set → the first set; after the last → the last; more than 2 s after the last → []')
it('prune keeps only sets within 2 s of the newest')                  // Review Focus 1
it('ClockSync with no messages and VideoDelay with no stats return numbers, never NaN')   // Review Focus 4
```

- [ ] **Step 3: Check** (`npm run lint && npx tsc --noEmit && npm test`), expect pass.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: camera box room hook, boxes-at-time with gliding, video-synced overlay"
```

---

### Task V3: The Live page

**Files:**
- Create: `src/features/live/LivePage.tsx`, `src/features/live/LiveTile.tsx`, `src/features/live/CameraView.tsx`
- Modify: `src/app/live/page.tsx` (render `LivePage`, drop the `Rebuilding` placeholder)

**Interfaces:**
- Consumes: `useCamerasList` (with `liveUrls`), `useStatus`, `useCameraStatusFrame`, the active config hook from
  `src/api/generated/camera-config/` for zones, `useMe` for the role, `WhepPlayer`, `BoxOverlay`.
- `LivePage`: grid of enabled cameras; clicking a tile opens `CameraView` (state in the URL as `?cam=<id>`, so
  back closes it).
- `LiveTile`: `WhepPlayer` on `liveUrls.sub ?? liveUrls.main`, or the 2 s still (decision 4); badges for state and
  fps from `useStatus`, "Offline" for null. No boxes.
- `CameraView`: `WhepPlayer` on `liveUrls.main` with `BoxOverlay`; SUPERADMIN only: a "Debug" toggle that swaps the
  player for `<img src="/media/debug/<id>">` (unmounting the player), and the delay slider.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Check against the laptop stack** (backend plan Task 11's setup, 2–3 `feed_*` cameras, the engine
  on CUDA): the grid plays; an opened camera shows boxes following the horses or cars; the debug toggle shows
  annotated frames. Fix what is off.

- [ ] **Step 3: Check** (`npm run lint && npx tsc --noEmit && npm test && npm run build`), expect pass.

- [ ] **Step 4: Commit**

```bash
git add src
git commit -m "feat: Live page: WebRTC grid with status, opened camera with boxes and zones, debug view"
```

---

### Task V4: `StreamPanel`

**Files:**
- Create: `src/features/cameras/StreamPanel.tsx`

**Interfaces:**
- `<StreamPanel cameraId: string>` (MANAGER and up; renders nothing for a USER): `useCamerasStreamInfo` refetched
  every 5 s; per path: "Terhubung"/"Tidak terhubung", codecs, a warning badge for `H265_BROWSER` ("H.265: browser
  mungkin tidak bisa memutar"), bitrate in Mbit/s ("mengukur…" while null); for the recorded path the estimate next
  to free and total disk in GB. A 503 shows "MediaMTX tidak tersedia".
- Not mounted anywhere yet: the camera form is T1's. Mount it temporarily in `CameraView` for MANAGER and up (one
  line), so it can be seen; T1 moves it into the form.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Check** in the browser: a camera switched to `SUB` and 3 days (via Swagger or curl) shows the new
  estimate within 10 s. `npm run lint && npx tsc --noEmit && npm run build` pass.

- [ ] **Step 3: Commit**

```bash
git add src
git commit -m "feat: StreamPanel: connection, codec warning, bitrate and disk estimate"
```

> **Session D ends here.**

---

> **Session E starts here: Task V5.**

### Task V5: Joint laptop run, review, push

- [ ] **Step 1: The spec's verification through the UI** (native MediaMTX, compose `postgres redis api-migrate api
  caddy`, `npm run dev`, the engine from source on CUDA, 2–3 cameras as `RTSP` from `feed_*`)

| Spec check | Pass when |
|---|---|
| #7 | live video with boxes over it, lagging the objects by no more than about 200 ms after the slider is tuned; logged out, `/media/webrtc/...` gives 401 and the page shows the login |
| #7 debug | the debug toggle shows annotated frames; turning it off → `EXISTS cam:<id>:debug` 0 within 5 s, no `debugframes` publishes (`redis-cli PUBSUB NUMSUB`) |
| #8 | switch a camera to the sub-stream and 3-day retention in the API → applied in MediaMTX without a restart; `StreamPanel` shows the new estimate |
| Restart | restart MediaMTX → tiles come back within 30 s (reload if the player gave up) |
| Review Focus 2 | `docker compose restart api` while a camera is open → boxes resume without reopening |
| Review Focus 3 | switch between three cameras quickly → MediaMTX's log shows each old WebRTC session closed |
| Review Focus 5 | log out in another tab → the playing video stops when the page goes to login |

A backend fix goes on the backend branch `phase-4a-video`; one that changes the contract gets tag `contract-v0.6`
and a re-pull here.

- [ ] **Step 2: Whole-branch review**

Dispatch an Opus reviewer over both repos' 4a diffs (`git diff phase-3-web-on-api...phase-4a-video` here,
`git diff main...phase-4a-video` in `zoo-vision`) with the spec and both plans. Fix Critical and Important
findings; add the rest to memory `phase-4a-followups`.

- [ ] **Step 3: Commit fixes, then push (after the owner's yes)**

```bash
git push -u origin phase-4a-video
```

Merge order (spec section 3): Phase 3's frontend into `main` after J1, then `main` into `phase-4a-video`,
`npm run contract:pull contract-v0.5` again (never merge `src/contract/` or `src/api/generated/` by hand), then 4a
into `main`. The backend pull request (`phase-4a-video` → `main`, merge commit) can be opened now.
