"use client";

import { useState } from "react";
import {
  Key,
  Plus,
  Copy,
  Check,
  AlertTriangle,
  Clock,
  ShieldAlert,
  Ban,
  X,
  ShieldCheck,
} from "lucide-react";
import {
  useApiTokensList,
  useApiTokensCreate,
  useApiTokensRevoke,
} from "@/api/generated/api-tokens/api-tokens";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table, Mono } from "@/components/ui";
import { ApiError } from "@/api/http";
import { fmtLocalTime } from "@/lib/time";
import { useQueryClient } from "@tanstack/react-query";
import type { Role } from "@/auth/roles";
import type { ApiTokenDto } from "@/api/generated/zooVisionAPI.schemas";

export function ApiTokensPage() {
  const queryClient = useQueryClient();
  const tokensQuery = useApiTokensList();

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [tokenRole, setTokenRole] = useState<Role>("USER");
  const [createError, setCreateError] = useState<string | null>(null);

  // Once-shown newly generated token
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke confirmation modal state
  const [revokingToken, setRevokingToken] = useState<ApiTokenDto | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const createMutation = useApiTokensCreate({
    mutation: {
      onSuccess: (data) => {
        setTokenName("");
        setTokenRole("USER");
        setCreateError(null);
        setGeneratedToken(data.token);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/api-tokens`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setCreateError(err.message || "Gagal membuat token API.");
        } else {
          setCreateError("Terjadi kesalahan sistem.");
        }
      },
    },
  });

  const revokeMutation = useApiTokensRevoke({
    mutation: {
      onSuccess: () => {
        setRevokingToken(null);
        setRevokeError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/api-tokens`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setRevokeError(err.message || "Gagal mencabut token API.");
        } else {
          setRevokeError("Terjadi kesalahan sistem.");
        }
      },
    },
  });

  const handleCopy = () => {
    if (!generatedToken) return;
    navigator.clipboard.writeText(generatedToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    createMutation.mutate({
      data: {
        name: tokenName.trim(),
        role: tokenRole,
      },
    });
  };

  const tokens = tokensQuery.data ?? [];

  return (
    <RequireRole min="SUPERADMIN">
      <PageHeader
        title="Token API"
        subtitle="Kredensial Bearer untuk sistem lain seperti POS, layar informasi, atau BI."
      >
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setGeneratedToken(null);
            setCreateError(null);
          }}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-lime px-4 text-[13px] font-extrabold text-forest-dark transition-colors hover:bg-lime-2"
        >
          <Plus className="size-4" />
          Buat Token API
        </button>
      </PageHeader>

      <Card
        title={`Daftar Token API (${tokens.length} Token)`}
        subtitle="Token yang telah dicabut (revoked) tidak dapat digunakan kembali oleh sistem eksternal"
      >
        <Table
          head={["Nama Token", "Prefix Token", "Peran Akses", "Status", "Terakhir Digunakan", "Dibuat Pada", "Aksi"]}
          rows={tokens.map((t) => {
            const isRevoked = Boolean(t.revokedAt);

            return [
              <div key="name" className="flex flex-col">
                <span className="font-extrabold text-forest">{t.name}</span>
                <span className="text-[11px] text-muted">
                  <Mono>{t.id}</Mono>
                </span>
              </div>,

              <span key="prefix" className="text-xs font-mono font-bold text-ink">
                {t.prefix}…
              </span>,

              <div key="role">
                {t.role === "SUPERADMIN" ? (
                  <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-extrabold text-purple-800">
                    SUPERADMIN
                  </span>
                ) : t.role === "MANAGER" ? (
                  <span className="rounded-full bg-forest/15 px-2.5 py-0.5 text-xs font-extrabold text-forest">
                    MANAGER
                  </span>
                ) : (
                  <span className="rounded-full bg-off-bg px-2.5 py-0.5 text-xs font-bold text-muted">
                    USER
                  </span>
                )}
              </div>,

              <div key="status">
                {isRevoked ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-crit">
                    <Ban className="size-3.5" /> Dicabut
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-good">
                    <ShieldCheck className="size-3.5" /> Aktif
                  </span>
                )}
              </div>,

              <span key="lastUsed" className="text-xs text-muted">
                {t.lastUsedAt ? `${fmtLocalTime(t.lastUsedAt)} WIB` : "Belum pernah"}
              </span>,

              <span key="created" className="text-xs text-muted">
                {fmtLocalTime(t.createdAt)} WIB
              </span>,

              <div key="actions">
                {!isRevoked ? (
                  <button
                    type="button"
                    onClick={() => {
                      setRevokingToken(t);
                      setRevokeError(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-crit/25 bg-crit-bg px-2.5 py-1.5 text-xs font-bold text-crit hover:bg-crit-bg"
                  >
                    <Ban className="size-3.5" />
                    <span>Cabut Akses</span>
                  </button>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>,
            ];
          })}
          empty={
            tokensQuery.isLoading
              ? "Memuat daftar token API..."
              : tokens.length === 0
              ? "Belum ada token API yang dibuat."
              : undefined
          }
        />
      </Card>

      {/* Create Token Dialog */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Key className="size-5 text-forest" />
                <h3 className="text-base font-extrabold text-ink">Buat Token API Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setGeneratedToken(null);
                }}
                className="text-muted hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Generated Token Revealed View */}
            {generatedToken ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-warn/25 bg-warn-bg p-4 text-xs font-bold text-gold-ink flex items-start gap-3">
                  <ShieldAlert className="size-5 shrink-0 text-gold-ink mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm">Simpan Token Ini Sekarang!</p>
                    <p className="mt-1 font-semibold leading-relaxed">
                      Token ini <strong>hanya ditampilkan satu kali</strong> demi keamanan sistem. Jika Anda menutup dialog ini tanpa menyalinnya, Anda harus membuat token baru.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Token Kredensial API
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={generatedToken}
                      className="w-full rounded-xl border border-line bg-forest-dark p-3 font-mono text-xs font-bold text-lime select-all focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-3 text-xs font-extrabold text-white hover:bg-forest-dark"
                    >
                      {copied ? <Check className="size-4 text-lime" /> : <Copy className="size-4" />}
                      <span>{copied ? "Tersalin!" : "Salin"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setGeneratedToken(null);
                    }}
                    className="rounded-xl bg-forest px-5 py-2 text-xs font-extrabold text-white hover:bg-forest-dark"
                  >
                    Saya Sudah Menyimpan Token
                  </button>
                </div>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
                {createError && (
                  <div role="alert" className="rounded-xl border border-crit/25 bg-crit-bg p-3 text-xs font-bold text-crit-ink">
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Nama Deskriptif Token <span className="text-crit">*</span>
                  </label>
                  <p className="text-[11px] text-muted mb-1">Tujuan atau sistem klien (misal: POS Kasir Gerbang Barat)</p>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="POS Kasir Gerbang Barat"
                    className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                    Peran Akses Token
                  </label>
                  <select
                    value={tokenRole}
                    onChange={(e) => setTokenRole(e.target.value as Role)}
                    className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                  >
                    <option value="USER">USER (Hanya Membaca Data Laporan & Status)</option>
                    <option value="MANAGER">MANAGER (Dapat Mengelola Kamera & Zona)</option>
                    <option value="SUPERADMIN">SUPERADMIN (Akses Penuh Seluruh Endpoint API)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(false)}
                    className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="rounded-xl bg-forest px-5 py-2 text-xs font-extrabold text-white hover:bg-forest-dark disabled:opacity-50"
                  >
                    {createMutation.isPending ? "Membuat..." : "Buat & Tampilkan Token"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      {revokingToken && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-crit">
              <AlertTriangle className="size-6 text-crit" />
              <h3 className="text-base font-extrabold text-ink">Konfirmasi Cabut Token API</h3>
            </div>

            <p className="mt-4 text-xs font-semibold text-ink-2 leading-relaxed">
              Apakah Anda yakin ingin mencabut token <strong className="text-ink">{revokingToken.name}</strong>? Aplikasi atau integrasi yang menggunakan token ini akan segera kehilangan akses. Tindakan ini tidak dapat dibatalkan.
            </p>

            {revokeError && (
              <div role="alert" className="mt-3 rounded-xl border border-crit/25 bg-crit-bg p-3 text-xs font-bold text-crit-ink">
                {revokeError}
              </div>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokingToken(null)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate({ id: revokingToken.id })}
                className="rounded-xl bg-crit px-4 py-2 text-xs font-extrabold text-white hover:bg-crit disabled:opacity-50"
              >
                {revokeMutation.isPending ? "Mencabut..." : "Cabut Token"}
              </button>
            </div>
          </div>
        </div>
      )}
    </RequireRole>
  );
}
