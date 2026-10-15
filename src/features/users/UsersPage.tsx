"use client";

import { useState } from "react";
import {
  Users,
  UserPlus,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Lock,
  UserX,
  UserCheck,
  X,
} from "lucide-react";
import { useUsersList, useUsersCreate, useUsersUpdate } from "@/api/generated/users/users";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast, type Role } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card, Table, Badge, Mono } from "@/components/ui";
import { ApiError } from "@/api/http";
import { fmtLocalTime } from "@/lib/time";
import { useQueryClient } from "@tanstack/react-query";
import type { UserDto } from "@/api/generated/zooVisionAPI.schemas";

export function UsersPage() {
  const queryClient = useQueryClient();
  const { me } = useMe();
  const isSuperadmin = roleAtLeast(me?.role ?? "USER", "SUPERADMIN");

  const usersQuery = useUsersList();

  // Create Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<Role>("USER");
  const [createFieldError, setCreateFieldError] = useState<Record<string, string>>({});
  const [createGeneralError, setCreateGeneralError] = useState<string | null>(null);

  // Edit Modal state
  const [editingUser, setEditingUser] = useState<UserDto | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("USER");
  const [editActive, setEditActive] = useState(true);
  const [editPassword, setEditPassword] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const createMutation = useUsersCreate({
    mutation: {
      onSuccess: () => {
        setCreateOpen(false);
        setNewUsername("");
        setNewName("");
        setNewPassword("");
        setNewRole("USER");
        setCreateFieldError({});
        setCreateGeneralError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/users`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "USERNAME_TAKEN" || err.statusCode === 409) {
            setCreateFieldError({ username: "Username ini sudah digunakan oleh akun lain." });
          } else if (err.errors && err.errors.length > 0) {
            const errs: Record<string, string> = {};
            for (const item of err.errors) {
              const key = item.path.replace(/^\//, "");
              errs[key] = item.message;
            }
            setCreateFieldError(errs);
            setCreateGeneralError(err.message || "Terdapat kesalahan validasi.");
          } else {
            setCreateGeneralError(err.message || "Gagal membuat akun pengguna.");
          }
        } else {
          setCreateGeneralError("Terjadi kesalahan sistem saat membuat akun.");
        }
      },
    },
  });

  const updateMutation = useUsersUpdate({
    mutation: {
      onSuccess: () => {
        setEditingUser(null);
        setEditError(null);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/users`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "LAST_SUPERADMIN" || err.statusCode === 409) {
            setEditError(err.message || "Tidak dapat menonaktifkan atau menurunkan peran Superadmin terakhir.");
          } else {
            setEditError(err.message || "Gagal memperbarui akun pengguna.");
          }
        } else {
          setEditError("Terjadi kesalahan sistem saat memperbarui akun.");
        }
      },
    },
  });

  const handleOpenEdit = (u: UserDto) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditRole(u.role);
    setEditActive(u.active);
    setEditPassword("");
    setEditError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateFieldError({});
    setCreateGeneralError(null);

    if (newPassword.length < 10) {
      setCreateFieldError({ password: "Kata sandi minimal harus 10 karakter." });
      return;
    }

    createMutation.mutate({
      data: {
        username: newUsername.trim(),
        name: newName.trim(),
        password: newPassword,
        role: newRole,
      },
    });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);

    if (editPassword && editPassword.length < 10) {
      setEditError("Kata sandi baru minimal harus 10 karakter.");
      return;
    }

    updateMutation.mutate({
      id: editingUser.id,
      data: {
        name: editName.trim(),
        role: editRole,
        active: editActive,
        password: editPassword ? editPassword : undefined,
      },
    });
  };

  const users = usersQuery.data ?? [];

  return (
    <RequireRole min="MANAGER">
      <PageHeader
        tag="Hak Akses & Otorisasi"
        title="Manajemen Pengguna"
        subtitle="Daftar akun operator operasional, pengawas manajerial, dan administrator sistem"
      >
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setCreateFieldError({});
            setCreateGeneralError(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-black text-white shadow-md transition-all hover:bg-forest-dark hover:shadow-lg active:scale-95"
        >
          <UserPlus className="size-4" />
          Tambah Pengguna
        </button>
      </PageHeader>

      <Card
        title={`Pengguna Terdaftar (${users.length} Akun)`}
        subtitle="Manager dapat mengelola akun USER dan MANAGER; hanya Superadmin yang dapat mengelola akun SUPERADMIN"
      >
        <Table
          head={["Username & ID", "Nama Lengkap", "Peran Akses", "Status Akun", "Dibuat Pada", "Aksi"]}
          rows={users.map((u) => [
            <div key="username" className="flex flex-col">
              <span className="font-extrabold text-forest">{u.username}</span>
              <span className="text-[11px] text-muted">
                <Mono>{u.id}</Mono>
              </span>
            </div>,

            <span key="name" className="text-xs font-bold text-ink">
              {u.name}
            </span>,

            <div key="role" className="flex items-center gap-1.5">
              {u.role === "SUPERADMIN" ? (
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-black text-purple-800">
                  SUPERADMIN
                </span>
              ) : u.role === "MANAGER" ? (
                <span className="rounded-full bg-forest/15 px-2.5 py-0.5 text-xs font-black text-forest">
                  MANAGER
                </span>
              ) : (
                <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-bold text-zinc-600">
                  USER
                </span>
              )}
            </div>,

            <div key="status">
              {u.active ? (
                <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600">
                  <UserCheck className="size-3.5" /> Aktif
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-zinc-400">
                  <UserX className="size-3.5" /> Nonaktif
                </span>
              )}
            </div>,

            <span key="created" className="text-xs text-muted">
              {fmtLocalTime(u.createdAt)} WIB
            </span>,

            <div key="actions" className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenEdit(u)}
                className="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink-2 transition hover:border-lime hover:bg-lime/10"
              >
                <Edit2 className="size-3.5" />
                <span>Edit</span>
              </button>
            </div>,
          ])}
          empty={
            usersQuery.isLoading
              ? "Memuat daftar pengguna..."
              : users.length === 0
              ? "Belum ada akun pengguna terdaftar."
              : undefined
          }
        />
      </Card>

      {/* Create User Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <UserPlus className="size-5 text-forest" />
                <h3 className="text-base font-black text-ink">Tambah Akun Pengguna</h3>
              </div>
              <button type="button" onClick={() => setCreateOpen(false)} className="text-muted hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            {createGeneralError && (
              <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                {createGeneralError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern="^[a-z0-9._-]{3,32}$"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  placeholder="misal: bobby.safari"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                />
                {createFieldError["username"] && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">{createFieldError["username"]}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Bobby Pratama"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                />
                {createFieldError["name"] && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">{createFieldError["name"]}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Kata Sandi Awal <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  maxLength={72}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 10 karakter"
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink focus:border-lime focus:outline-none"
                />
                {createFieldError["password"] && (
                  <p className="mt-1 text-[11px] font-bold text-red-600">{createFieldError["password"]}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Peran Akses <span className="text-red-500">*</span>
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                >
                  <option value="USER">USER (Operator Lapangan / Viewer Dashboard)</option>
                  <option value="MANAGER">MANAGER (Pengawas / Pengatur Kamera & Ambang Batas)</option>
                  {isSuperadmin && (
                    <option value="SUPERADMIN">SUPERADMIN (Administrator Sistem Penuh)</option>
                  )}
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
                  className="rounded-xl bg-forest px-5 py-2 text-xs font-black text-white hover:bg-forest-dark disabled:opacity-50"
                >
                  {createMutation.isPending ? "Menyimpan..." : "Buat Akun"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="size-5 text-forest" />
                <h3 className="text-base font-black text-ink">Edit Akun: {editingUser.username}</h3>
              </div>
              <button type="button" onClick={() => setEditingUser(null)} className="text-muted hover:text-ink">
                <X className="size-5" />
              </button>
            </div>

            {editError && (
              <div role="alert" className="mt-4 rounded-xl border border-red-300 bg-red-50 p-3 text-xs font-bold text-red-800">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Peran Akses
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="mt-1 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink focus:border-lime focus:outline-none"
                >
                  <option value="USER">USER</option>
                  <option value="MANAGER">MANAGER</option>
                  {isSuperadmin && <option value="SUPERADMIN">SUPERADMIN</option>}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="user-active-edit"
                  checked={editActive}
                  onChange={(e) => setEditActive(e.target.checked)}
                  className="size-4 rounded border-line text-forest focus:ring-lime"
                />
                <label htmlFor="user-active-edit" className="text-xs font-bold text-ink cursor-pointer">
                  Akun Aktif (Dapat masuk ke dashboard)
                </label>
              </div>

              <div className="border-t border-line/60 pt-3">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Ganti Kata Sandi (Opsional)
                </label>
                <p className="text-[11px] text-muted mb-1">Kosongkan jika tidak ingin mengubah kata sandi</p>
                <input
                  type="password"
                  minLength={10}
                  maxLength={72}
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Kata sandi baru (minimal 10 karakter)"
                  className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-mono font-bold text-ink focus:border-lime focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="rounded-xl bg-forest px-5 py-2 text-xs font-black text-white hover:bg-forest-dark disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </RequireRole>
  );
}
