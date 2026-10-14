# Konvensi Kode & Arsitektur Frontend (CONVENTIONS.md)

Dokumen ini mendefinisikan aturan dan konvensi pengembangan frontend pada proyek `zoo-analytics-web` (Taman Safari Indonesia AI Vision Dashboard). Seluruh developer wajib mematuhi standar berikut.

---

## 1. Sumber Data (Data Fetching)
- **Data hanya berasal dari generated hooks**:
  - Dihasilkan secara otomatis oleh Orval dari OpenAPI contract (`src/api/generated/`).
  - Jangan melakukan panggilan `fetch()` manual atau axios mentah untuk resource API yang telah didefinisikan dalam contract.
  - Query caching dan invalidation dikelola melalui TanStack Query (`@tanstack/react-query`).

## 2. Penanganan Error (Error Handling)
- **Semua error API bertipe `ApiError`**:
  - Diimpor dari `@/api/http`.
  - Jangan berasumsi struktur respon axios `err.response.data`.
  - Lakukan percabangan (*switch-case*) pada properti `code` standar (misal: `UNAUTHENTICATED`, `ROLE_REQUIRED`, `VALIDATION_FAILED`, dsb.).
  - Selalu sediakan `error.message` sebagai fallback deskripsi kesalahan jika `code` tidak tertangani secara spesifik.

## 3. Otorisasi & Peran Pengguna (Roles & Authorization)
- **Gunakan `RequireRole` dan `minRole` pada UI**:
  - Komponen otorisasi UI: `<RequireRole min="MANAGER">` atau `<RequireRole min="SUPERADMIN">` dari `@/auth/RequireRole`.
  - Fungsi utilitas peran: `roleAtLeast(userRole, minRole)` dari `@/auth/roles`.
  - Menu navigasi disaring menggunakan `visibleNav(NAV_SECTIONS, currentRole)`.
  - **Catatan Penting**: Otorisasi UI hanyalah proteksi tampilan sisi klien. Keputusan otorisasi final mutlak ditentukan oleh backend API (HTTP 403 `ROLE_REQUIRED`).

## 4. Telemetri Real-time (Live Data)
- **Data live hanya melalui `@/live`: `useStatus`, `useLiveEvents`, `useAuditNotices`** (satu koneksi dari `LiveProvider`):
  - Disediakan dari modul `@/live`.
  - Komunikasi real-time terpusat melalui satu koneksi WebSocket Socket.IO (`/ws`).
  - Perubahan data (`data.changed`) memicu invalidasi query TanStack Query secara terkoordinasi.
  - Status kamera dan telemetri langsung dikonsumsi melalui hook `useStatus()`.

## 5. Zona Waktu & Format Waktu (Time Handling)
- **Seluruh waktu diproses melalui `src/lib/time.ts`**:
  - Zona waktu resmi operasional: `Asia/Jakarta` (WIB, UTC+7).
  - Gunakan helper standar: `todayLocal()`, `localDayRange(date)`, `localDaysRange(date, days)`, `fmtLocalTime(iso)`, `localHour(iso)`, dan `fillBuckets(...)`.
  - Jangan memanipulasi string tanggal atau offset UTC secara manual di level komponen.

## 6. Struktur Direktori Fitur (Feature Structure)
- **Halaman use-case**: Simpan di `src/usecases/<id>/` (misal: `src/usecases/horse_riding/`, dsb.).
- **Area umum / modul pendukung**: Simpan di `src/features/<area>/` (misal: `src/features/cameras/`, `src/features/models/`, `src/features/users/`, dsb.).
- **Route App Router**: `src/app/...` bertindak sebagai penyedia rute tipis yang mendelegasikan render ke komponen usecase/feature bersangkutan.

## 7. Pembaruan Kontrak API (Contract Update Workflow)
1. Tarik tag kontrak backend terbaru:
   ```bash
   npm run contract:pull <tag>
   ```
2. Baca berkas catatan perubahan: bagian *Changelog* di `src/contract/fe-contract.md` dan pastikan tidak ada breaking change tak tertangani.
3. Selalu lakukan commit bersama untuk direktori `src/contract/` dan `src/api/generated/` dalam satu commit yang sama.
4. Pastikan `npm run contract:check` lolos pada pipeline CI.

## 8. Bahasa Antarmuka Pengguna (UI Localization)
- **Seluruh teks, label, pesan error, dan keterangan antarmuka wajib berbahasa Indonesia**:
  - Istilah teknis yang umum dapat dipertahankan atau dilengkapi keterangan (misal: *Live Sync*, *Audit Log*, dsb.).
  - Pesan error dan konfirmasi harus ramah dan jelas bagi operator operasional lapangan Taman Safari Indonesia.
