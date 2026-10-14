# Zoo Analytics (Web Dashboard) · Taman Safari Indonesia

Dasbor pemantauan analitik dan operasional real-time berbasis AI Vision untuk Taman Safari Indonesia (koridor Safari Journey, loket kasir POS, restoran/dining hall, arena wahana kuda poni, dan sistem CCTV telemetry).

Aplikasi frontend ini dibangun menggunakan **Next.js (App Router)** dan mengonsumsi API backend `zoo-vision` melalui client berbasis React Query yang digenerate otomatis dari kontrak OpenAPI.

---

## Arsitektur & Lingkungan Pengembangan

Frontend berkomunikasi dengan backend melalui origin lokalnya sendiri (`/api/v1/...`, `/media/...`, `/ws`).

```
Browser
  │
  ▼
Caddy Reverse Proxy (:8080)
  ├── /api/v1/*, /media/*, /ws  ──▶  Backend API (:3001)
  └── /*                        ──▶  Next.js Frontend (:3000)
```

> [!IMPORTANT]
> Saat pengembangan lokal, selalu buka **`http://localhost:8080`** (melalui reverse proxy Caddy), **bukan** langsung `http://localhost:3000`. Cookie sesi (`zoo_session`) dan koneksi WebSocket (`/ws`) memerlukan routing reverse proxy Caddy.
> Untuk panduan setup backend lengkap, lihat panduan di backend repo: `zoo-vision/docs/fe-dev-setup.md`.

---

## Skrip yang Tersedia

```bash
# Menjalankan dev server frontend (:3000)
npm run dev

# Menjalankan build bundle produksi
npm run build

# Menjalankan server bundle produksi
npm start

# Menjalankan linter
npm run lint

# Menjalankan pengujian (Vitest + script contract tests)
npm test

# Menarik kontrak OpenAPI terbaru & meregenerate client
npm run contract:pull <tag|path>

# Memvalidasi integritas kontrak untuk CI
npm run contract:check
```

---

## Pembagian Tugas & Kepemilikan (Owner Table)

Implementasi Phase 3 dibagi antara Backend Developer (plumbing/infrastruktur frontend) dan Tim Frontend:

| Task | Deskripsi | Pemilik | Kontrak |
|---|---|---|---|
| **F1** | Contract pull, generated client, HTTP errors | Backend Developer | `contract-v0.1` |
| **F2** | Login, roles, role-aware menu, ganti password | Backend Developer | `contract-v0.1` |
| **F3** | Hapus layer data prototype, placeholder migrasi, konvensi | Backend Developer | `contract-v0.1` |
| **F4** | `useLive`, live status socket, banner gangguan | Backend Developer | `contract-v0.1` (live v0.3) |
| **F5** | Halaman referensi Wahana Kuda (Pony Rides) & report helpers | Backend Developer | `contract-v0.2` |
| **T1** | Konfigurasi Kamera | Tim Frontend | `contract-v0.1` |
| **T2** | Zone editor, konfigurasi polygon/tripwire, versi | Tim Frontend | `contract-v0.1` (v0.3) |
| **T3** | Manajemen Model AI | Tim Frontend | `contract-v0.1` |
| **T4** | Manajemen Pengguna & Token API | Tim Frontend | `contract-v0.1` |
| **T5** | Overview, Kendaraan, Loket Kasir, Restoran | Tim Frontend | `contract-v0.2` (v0.3) |
| **T6** | Log Kejadian Generik, Interval timeline, Metrik chart | Tim Frontend | `contract-v0.2` |
| **T7** | Halaman Live Kamera | Tim Frontend | `contract-v0.1` (v0.3) |
| **T8** | Log Sistem (Audit, Login, Sistem Event) & Audit notices | Tim Frontend | `contract-v0.4` |
| **J1** | Joint acceptance testing & rilis `contract-v1.0` | Bersama | `contract-v0.4` |

---

## Konvensi Kode

Seluruh standar kode, struktur folder, otorisasi, penanganan error, dan integrasi API wajib mengikuti [CONVENTIONS.md](CONVENTIONS.md).
