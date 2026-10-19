# Zoo Vision Phase 4b (Evidence and Exports), Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (native: the session implements every task itself, no per-task subagents) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A proof-of-concept web half of 4b: every time on screen follows the site's time zone from the database,
an Exports page makes PDFs and keeps the CSV downloads, a Site settings page edits the zone and retention
defaults, the camera form sets evidence retention and shows evidence usage, an event's evidence can be kept by
hand and shows its status, and managers see a banner when a disk fills. Ends with the joint laptop run (spec
section 8). The FE team redesigns these pages later.

**Architecture:** `src/lib/time.ts` keeps its functions but reads a module-level zone that a small gate sets from
`GET /api/v1/site-settings` once after login; the formatters are built lazily per zone. New pages live in
`src/features/{exports,site-settings}/` with thin `src/app/*/page.tsx` wrappers (Phase 3 decision 2). The disk
banner hangs off `LiveProvider`'s socket like `audit.notice`. All API calls go through the orval hooks the
contract pull generates.

**Tech Stack:** as in Phase 4a (Next.js 16, React 19, Tailwind 4, TanStack Query + orval, socket.io-client, Vitest).
No new dependencies.

**Spec:** the Phase 4b design in the backend repo,
`zoo-vision/docs/superpowers/specs/2026-10-19-phase-4b-evidence-design.md` (sections 6–8 are the frontend's). The
contract details are in `src/contract/fe-contract.md` after the pull. The backend half is
`zoo-vision/docs/superpowers/plans/2026-10-19-phase-4b-evidence.md`; this plan starts after its Task 11 (contract
files), ideally after its tag `contract-v0.6`.

## Global Constraints

- Work in `D:\WORK\zoo-analytics-web` on branch `phase-4b-evidence`, cut from `main` after the 4a merge
  (`bbcdab2`). Never commit to `main`. Push only after the repo owner says yes.
- No Claude attribution in commits or pull requests. No test-first steps; one focused test where logic is risky.
- **This is Next.js 16:** read the matching guide in `node_modules/next/dist/docs/` before touching a Next.js API.
- The frontend talks only to its own origin (`/api/v1`, `/media`, `/ws`) and opens `http://localhost:8080`, never
  `:3000`.
- Never edit `src/contract/*` or `src/api/generated/*` by hand; `npm run contract:pull contract-v0.6` writes them
  (before the tag exists: `npm run contract:pull D:\WORK\zoo-vision`, then the tag before the pull request).
- UI text in Indonesian, existing components from `src/components/ui.tsx`, light styling. The FE team still owns
  T1–T8 from Phase 3: touch shared files only where a task names them.
- Hooks named after the backend's operation ids: `useSiteSettingsGet`, `useSiteSettingsUpdate`, `useEvidenceKeep`,
  `useExportJobsCreate`, `useExportJobsList`, `exportJobsFile` (a URL, not a fetch). If the pull names them
  differently, use the generated names.
- Numbers fixed here:

  | What | Value |
  |---|---|
  | Zone before settings load | none: pages wait (a short "Memuat…" in the shell) |
  | Export jobs refresh | every 3 s while any listed job is `QUEUED`, else none |
  | CSV range on the Exports page | from and to dates (inclusive), default the last 7 days |
  | Disk banner | MANAGER and up; one line per `path`, the latest message wins; dismissed per path until the next message |

## Decisions this plan makes beyond the design

1. **A gate, not a context, for the zone.** `time.ts` stays a set of plain functions (dozens of callers). A
   `SiteZoneGate` between `AuthProvider` and `LiveProvider` loads the settings, calls `setSiteTimeZone`, and only
   then renders the pages, so nothing formats with the wrong zone. A saved zone change sets it again and
   invalidates every query, so the open tab re-renders in the new zone.
2. **"Simpan bukti" lives in `EvidenceButton`'s dialog**, with the status badge on the thumbnail, so all six pages
   that show event evidence get it by passing two props (`eventId`, `evidence`).
3. **The PDF download is a plain link** to `fileUrl` (the session cookie goes with it), like `CsvLink`.
4. **Site settings sit under Konfigurasi** (`/config/site`, MANAGER reads, SUPERADMIN edits); Exports under
   Analitik (`/exports`, every role).

## Review Focus

1. **A SUPERADMIN changes the zone while another page is open in the same tab.** Expected: times, the "today"
   date and report ranges switch to the new zone without a reload. Test in W1.
2. **A job stays `QUEUED` because Gotenberg is down.** Expected: the list keeps polling every 3 s and shows
   "Menunggu"; when it turns `FAILED` the error shows and polling stops. Test in W3.
3. **A USER opens an event's evidence.** Expected: no "Simpan bukti" button, the badge still shows; a MANAGER's
   click on a `FAILED` event shows `QUEUED` at once. Test in W5.
4. **Two `disk.warning` messages for the same path** (warning, then critical). Expected: one banner line, now
   critical. Test in W5.
5. **A MANAGER opens Site settings.** Expected: the fields are read-only and there is no save button; a direct
   PATCH would be 403 anyway. Checked in W6.

## Execution sessions

| Session | Tasks | Ends with |
|---|---|---|
| **E: zone and pages** | W1–W5 | everything working against the laptop stack; a Sonnet session implements natively, no per-task review |
| **F: joint run** | W6 | the spec's laptop run through the UI, Opus whole-branch review of both repos' 4b diffs, pushes after the owner's yes |

---

> **Session E starts here: Tasks W1–W5.** Needs the backend through Task 11.

### Task W1: Contract v0.6 and the zone from site settings

**Files:**
- Modify: `src/contract/*`, `src/api/generated/*` (by the pull only), `src/lib/time.ts` (+ `time.test.ts`),
  `src/app/layout.tsx`
- Create: `src/lib/SiteZoneGate.tsx`

**Interfaces:**
- `time.ts`: `SITE_TZ` goes. `export function setSiteTimeZone(tz: string): void`, `export function siteTimeZone():
  string`; the two `Intl.DateTimeFormat`s are made on first use for the current zone and remade when it changes.
  Every existing export keeps its signature.
- `<SiteZoneGate>{children}</SiteZoneGate>`: on `/login`, or with no `me`, renders children. With `me`:
  `useSiteSettingsGet()`; until it answers, a "Memuat…" line; then `setSiteTimeZone(data.timeZone)` (before the
  children render) and the children. When a later answer carries another zone: set it and
  `queryClient.invalidateQueries()`.
- `layout.tsx`: `<AuthProvider><SiteZoneGate><LiveProvider>…</LiveProvider></SiteZoneGate></AuthProvider>`.

- [ ] **Step 1: Pull the contract**

```bash
npm run contract:pull contract-v0.6
```
Expected: `CONTRACT_VERSION` is `contract-v0.6`; `web.d.ts` has `DiskWarning`; the generated client has the
site-settings, evidence and export-jobs hooks; `EventRowDto` has `evidence`.

- [ ] **Step 2: Implement**

- [ ] **Step 3: Write the focused test** (`time.test.ts`)

```ts
it('after setSiteTimeZone("Asia/Makassar"): fmtLocalTime("2026-10-19T00:00:00Z") is "08:00:00" and localDayRange("2026-10-19").from ends with "+08:00"')   // Review Focus 1
it('setting it back to Asia/Jakarta gives "07:00:00" again')
```

- [ ] **Step 4: Check**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run build`. Expected: pass; `grep -rn SITE_TZ src` finds
nothing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: times follow the site time zone from site settings"
```

---

### Task W2: Site settings page

**Files:**
- Create: `src/features/site-settings/SiteSettingsPage.tsx`, `src/app/config/site/page.tsx`
- Modify: `src/auth/roles.ts` (nav item)

**Interfaces:**
- Nav, section Konfigurasi: `{ href: '/config/site', label: 'Pengaturan Situs', sub: 'Zona Waktu & Retensi',
  Icon: Settings, minRole: 'MANAGER' }`.
- Fields: Nama situs, Zona waktu (text input with a `<datalist>` of `Intl.supportedValuesOf('timeZone')`), Retensi
  rekaman (hari), Retensi snapshot (hari), Retensi snapshot kamera audit (hari), Retensi bukti (hari). A short
  hint under recording retention: "Berlaku untuk kamera tanpa pengaturan sendiri".
- SUPERADMIN: editable, "Simpan" sends only changed fields with `useSiteSettingsUpdate`; a 400's field errors
  show under their fields; success → `setSiteTimeZone` if the zone changed, `queryClient.invalidateQueries()`,
  a "Tersimpan" note. MANAGER: the same fields read-only, no button.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Check** (`npm run lint && npx tsc --noEmit && npm test && npm run build`), expect pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: site settings page (superadmin edits, managers read)"
```

---

### Task W3: Exports page

**Files:**
- Create: `src/features/exports/{ExportsPage.tsx,jobs-poll.ts,jobs-poll.test.ts}`, `src/app/exports/page.tsx`
- Modify: `src/auth/roles.ts` (nav item)

**Interfaces:**
- Nav, section Analitik: `{ href: '/exports', label: 'Ekspor', sub: 'Laporan PDF & CSV', Icon: FileDown,
  minRole: 'USER' }`.
- PDF form: Periode (Harian / Mingguan / Bulanan → `day`/`week`/`month`), Tanggal (`todayLocal()` default),
  either Kamera (checkboxes from `useCamerasList`, none = all) or Use case (select from `useUsecasesList`, empty =
  all). "Buat PDF" → `useExportJobsCreate`; a 503 shows "Layanan PDF tidak tersedia"; a 400 shows its message.
- Jobs list (`useExportJobsList`): created time (local), period and date, status (Menunggu / Selesai / Gagal /
  Kedaluwarsa), size, a download link to `fileUrl` when `DONE`, `error` when `FAILED`.
- `jobs-poll.ts`: `export function jobsRefetchInterval(jobs: { status: string }[] | undefined): number | false`
  → `3000` when any job is `QUEUED`, else `false`; passed as `refetchInterval: (q) =>
  jobsRefetchInterval(q.state.data)` (the `ModelsPage` idiom).
- CSV section below: Dari / Sampai dates (inclusive, default the last 7 days via `localDaysRange`), optional use
  case, and four `CsvLink`s: `/api/v1/exports/events.csv`, `intervals.csv`, `metrics.csv`, and `summary.csv` with
  `bucket=day`.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Write the focused test** (`jobs-poll.test.ts`)

```ts
it('3000 while one job is QUEUED; false when all are DONE, FAILED or EXPIRED; false for undefined')   // Review Focus 2
```

- [ ] **Step 3: Check** (`npm run lint && npx tsc --noEmit && npm test && npm run build`), expect pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: exports page with PDF jobs and the CSV downloads"
```

---

### Task W4: Camera form evidence retention and usage

**Files:**
- Modify: `src/features/cameras/CameraEditPage.tsx`, `src/features/cameras/StreamPanel.tsx`

**Interfaces:**
- Recording settings gain "Retensi bukti (hari)": empty = "ikut pengaturan situs" (sent as `null`), else 1–3650,
  sent as `recording.evidenceRetentionDays`, editable for SUPERADMIN like the other recording fields. A hint:
  "Menurunkan nilai ini menghapus klip bukti yang lebih lama pada pembersihan berikutnya (setiap jam)."
- `StreamPanel`: one more line, "Bukti tersimpan: <evidenceCount> klip, <evidenceBytes in GB, 1 decimal> GB".

- [ ] **Step 1: Implement**

- [ ] **Step 2: Check** (`npm run lint && npx tsc --noEmit && npm test && npm run build`), expect pass.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: camera form sets evidence retention; stream panel shows kept evidence"
```

---

### Task W5: Keep evidence, its badge, and the disk banner

**Files:**
- Modify: `src/components/EvidenceButton.tsx`, the six callers (`src/features/explorer/EventsExplorerPage.tsx`,
  `src/usecases/{cashier_presence/CashierPage,horse_riding/RidesPage,overview/OverviewPage,restaurant/RestaurantPage,vehicle_gate/VehiclesPage}.tsx`),
  `src/live/{LiveProvider.tsx,useLiveEvents.ts,index.ts}`, `src/components/CommandCenterShell.tsx`
- Create: `src/components/DiskBanner.tsx`, `src/components/disk-banner.ts` (+ `disk-banner.test.ts`),
  `src/components/EvidenceButton.test.tsx`

**Interfaces:**
- `EvidenceButton` gains `eventId?: string` and `evidence?: { status: 'QUEUED'|'KEPT'|'NO_RECORDING'|'FAILED';
  reason: string } | null`. Badge on the thumbnail: Disimpan (KEPT), Menyimpan… (QUEUED), Gagal (FAILED), Tanpa
  rekaman (NO_RECORDING). In the dialog, for MANAGER and up (`useAuth().me.role`) when `eventId` is set and the
  status is not `KEPT`/`QUEUED`: "Simpan bukti" → `useEvidenceKeep`; the answer's status replaces the shown one at
  once, and event list queries are invalidated. The button also renders (with no thumbnail) when there is no
  snapshot or clip but `eventId` is set, so a MANAGER can keep it.
- Callers pass `eventId={e.id}` and `evidence={e.evidence}` where they have an event row.
- `LiveProvider`: `socket.on('disk.warning', …)` to a `diskFns` set like `auditFns`; `useDiskWarnings(fn)` exported
  from `useLiveEvents.ts` and `src/live/index.ts`.
- `disk-banner.ts`: `export function mergeDiskWarning(list: DiskWarning[], w: DiskWarning): DiskWarning[]` (by
  `path`, the new one replaces the old). `DiskBanner` (MANAGER and up): one line per path, amber for warning, red
  for critical: "Disk <path> terisi <usedPercent>% (sisa <free GB> GB)", a dismiss per line. Rendered at the top of
  `CommandCenterShell`'s content.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Write the focused tests**

```ts
// disk-banner.test.ts
it('a warning then a critical for /data/recordings → one entry, critical; another path → two entries')   // Review Focus 4
// EvidenceButton.test.tsx (Testing Library, the hook mocked)
it('a USER sees the "Gagal" badge and no "Simpan bukti"; a MANAGER clicks it → the badge reads "Menyimpan…"')   // Review Focus 3
```

- [ ] **Step 3: Check** (`npm run lint && npx tsc --noEmit && npm test && npm run build`), expect pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: keep event evidence by hand, evidence status badge, disk warning banner"
```

> **Session E ends here.**

---

> **Session F starts here: Task W6.**

### Task W6: Joint laptop run, review, push

- [ ] **Step 1: The spec's laptop run through the UI** (native `mediamtx.exe`; compose with the demo profile plus
  Gotenberg: `postgres redis api-migrate api caddy gotenberg demo-seed demo-feed`; `npm run dev` behind Caddy on
  `http://localhost:8080`; two `feed_*` cameras added as `RTSP` in the camera form, one with `auditCamera`)

| Spec check | Pass when |
|---|---|
| #7, the clip half | a warning event on a `feed_*` camera shows "Menyimpan…" then "Disimpan"; delete its segments under `data/recordings/zv_<id>/` → the clip still plays in the dialog and seeks; `curl.exe -b cookie.txt -r 0-99 … /media/clips/<id>` → 206 |
| #9 | a week PDF and a week `summary.csv` for 3 cameras from the Exports page; the PDF opens with tables and charts; both rows (`export.pdf`, `export.csv`) in Log Audit |
| Snapshot retention | Site settings: snapshot retention 1 day; restart `api`, wait 60 s → old demo snapshot folders under `data/snapshots/` are gone, the JPEGs of kept events stay and still show in the dialog |
| Zone | Site settings: zone `Asia/Makassar` → the open Ringkasan page's hours move by one without a reload; `summary.csv` times move too; set it back |
| Review Focus 5 | log in as a MANAGER: Site settings is read-only |
| Keep by hand | as a MANAGER, "Simpan bukti" on an info event of the non-audit camera → "Disimpan" within ~2 min |
| Disk banner | in the git-ignored `deploy/docker-compose.override.yml`, give `api` a `tmpfs` at `/data/exports` (`size=10m`); `docker compose exec api sh -c "head -c 9000000 /dev/zero > /data/exports/fill"` → within 5 min a warning banner for `/data/exports` and a `disk_low` row in Kejadian Sistem; 9.6 MB → critical on the same line; remove the override afterwards |

A backend fix goes on the backend branch `phase-4b-evidence`; one that changes the contract gets a new tag
(`contract-v0.6.1`) and a re-pull here.

- [ ] **Step 2: Whole-branch review**

Dispatch an Opus reviewer over both repos' 4b diffs (`git diff main...phase-4b-evidence` in each) with the spec and
both plans. Fix Critical and Important findings; add the rest to memory `phase-4b-followups`.

- [ ] **Step 3: Commit fixes, then push (after the owner's yes)**

```bash
git push -u origin phase-4b-evidence
```

Merge order: the backend pull request (`phase-4b-evidence` → `main`, merge commit) first, then this one (merge
commit, never a squash). If `main` moved meanwhile, merge `main` into this branch and run
`npm run contract:pull contract-v0.6` again (never merge `src/contract/` or `src/api/generated/` by hand).
