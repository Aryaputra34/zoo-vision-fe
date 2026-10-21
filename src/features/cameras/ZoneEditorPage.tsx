"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { CameraTabs } from "@/components/client";
import {
  ArrowLeft,
  Save,
  History,
  RotateCcw,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Maximize2,
  RefreshCw,
  X,
} from "lucide-react";
import {
  useCameraConfigActive,
  useCameraConfigSave,
  useCameraConfigList,
  useCameraConfigGet,
  useCameraConfigRollback,
} from "@/api/generated/camera-config/camera-config";
import { useCamerasGet } from "@/api/generated/cameras/cameras";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useStatus } from "@/live";
import { useMe } from "@/auth/AuthProvider";
import { roleAtLeast, type Role } from "@/auth/roles";
import { RequireRole } from "@/auth/RequireRole";
import { PageHeader, Card } from "@/components/ui";
import { ApiError } from "@/api/http";
import { fmtLocalTime, siteZoneLabel } from "@/lib/time";
import { useQueryClient } from "@tanstack/react-query";
import type {
  CameraViewDto,
  ConfigVersionDto,
  UseCaseDto,
} from "@/api/generated/zooVisionAPI.schemas";
import {
  clampPoint,
  isValidPolygon,
  generateZoneId,
  findGeometryNodes,
  type Point,
} from "./zone-utils";

interface ZoneEditorInnerProps {
  id: string;
  camera: CameraViewDto;
  initialConfig: ConfigVersionDto;
  usecase?: UseCaseDto;
  userRole: Role;
  refetchConfig: () => Promise<unknown>;
}

function ZoneEditorInner({
  id,
  camera,
  initialConfig,
  usecase,
  userRole,
  refetchConfig,
}: ZoneEditorInnerProps) {
  const queryClient = useQueryClient();
  const { cameras: liveStatus } = useStatus();
  const cameraLive = liveStatus[id];

  // Local state for settings editing
  const [settings, setSettings] = useState<Record<string, unknown>>(
    () => (initialConfig.settings as Record<string, unknown>) ?? {}
  );
  const [baseVersion, setBaseVersion] = useState<number>(initialConfig.version);
  const [saveNote, setSaveNote] = useState<string>("");

  // Canvas / Frame state
  const [frameError, setFrameError] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const canvasRef = useRef<HTMLDivElement>(null);

  const settingsSchema = (usecase?.settingsSchema ?? {}) as Record<string, unknown>;
  const geometryNodes = findGeometryNodes(settingsSchema);

  const [selectedGeoPathOverride, setSelectedGeoPath] = useState<string | null>(null);
  const selectedGeoPath =
    selectedGeoPathOverride ?? (geometryNodes[0]?.path.join(".") || "");

  const [selectedListItemId, setSelectedListItemId] = useState<string | null>(null);

  // Status and feedback
  const [saveState, setSaveState] = useState<"IDLE" | "SAVED">("IDLE");
  const [saveVersionNumber, setSaveVersionNumber] = useState<number | null>(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [staleModalOpen, setStaleModalOpen] = useState(false);

  // History Drawer state
  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<number | null>(null);

  // Derive applied status with live engine
  const effectiveSaveState: "IDLE" | "SAVED" | "APPLIED" | "REJECTED" = (() => {
    if (saveState === "SAVED" && saveVersionNumber !== null) {
      if (cameraLive?.appliedVersion === saveVersionNumber) {
        return "APPLIED";
      } else if (cameraLive?.configError) {
        return "REJECTED";
      }
      return "SAVED";
    }
    return saveState;
  })();

  const effectiveErrorMessage =
    saveErrorMessage ||
    (effectiveSaveState === "REJECTED" ? cameraLive?.configError : null);

  // Save Mutation
  const saveMutation = useCameraConfigSave({
    mutation: {
      onSuccess: (res) => {
        setSaveVersionNumber(res.version);
        setBaseVersion(res.version);
        setSaveState("SAVED");
        setSaveErrorMessage(null);
        setSaveNote("");
        queryClient.invalidateQueries({ queryKey: [`/api/v1/cameras/${id}/config`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/cameras/${id}/config/versions`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          if (err.code === "STALE_VERSION" || err.statusCode === 409) {
            setStaleModalOpen(true);
          } else {
            setSaveErrorMessage(err.message || "Gagal menyimpan konfigurasi zona.");
          }
        } else {
          setSaveErrorMessage("Terjadi kesalahan sistem saat menyimpan.");
        }
      },
    },
  });

  // Rollback Mutation
  const rollbackMutation = useCameraConfigRollback({
    mutation: {
      onSuccess: (res) => {
        setSaveVersionNumber(res.version);
        setBaseVersion(res.version);
        setSaveState("SAVED");
        setHistoryOpen(false);
        queryClient.invalidateQueries({ queryKey: [`/api/v1/cameras/${id}/config`] });
        queryClient.invalidateQueries({ queryKey: [`/api/v1/cameras/${id}/config/versions`] });
      },
      onError: (err) => {
        if (err instanceof ApiError) {
          setSaveErrorMessage(`Gagal rollback: ${err.message}`);
        }
      },
    },
  });

  const versionsQuery = useCameraConfigList(id, { query: { enabled: historyOpen } });
  const versionDetailQuery = useCameraConfigGet(
    id,
    selectedHistoryVersion ?? 0,
    { query: { enabled: historyOpen && selectedHistoryVersion !== null } }
  );

  // Geometry manipulation helpers
  const getNestedValue = (obj: Record<string, unknown>, path: string[]) => {
    let curr: unknown = obj;
    for (const p of path) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = (curr as Record<string, unknown>)[p];
      } else {
        return undefined;
      }
    }
    return curr;
  };

  const updateNestedValue = (path: string[], value: unknown) => {
    setSettings((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      let curr = next;
      for (let i = 0; i < path.length - 1; i++) {
        const p = path[i];
        if (!curr[p] || typeof curr[p] !== "object") {
          curr[p] = {};
        }
        curr = curr[p];
      }
      curr[path[path.length - 1]] = value;
      return next;
    });
  };

  // Canvas click to add/move points
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !selectedGeoPath) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pt = clampPoint([x, y]);

    const pathArray = selectedGeoPath.split(".");
    const activeNode = geometryNodes.find((g) => g.path.join(".") === selectedGeoPath);
    if (!activeNode) return;

    if (activeNode.type === "polygon") {
      const currentPoints = (getNestedValue(settings, pathArray) as Point[]) || [];
      updateNestedValue(pathArray, [...currentPoints, pt]);
    } else if (activeNode.type === "line") {
      const currentLine = (getNestedValue(settings, pathArray) as { start?: Point; end?: Point }) || {};
      if (!currentLine.start) {
        updateNestedValue(pathArray, { ...currentLine, start: pt });
      } else {
        updateNestedValue(pathArray, { ...currentLine, end: pt });
      }
    } else if (activeNode.type === "polygon-list") {
      const currentList = (getNestedValue(settings, pathArray) as Array<{ id: string; name: string; polygon: Point[] }>) || [];
      if (!selectedListItemId) return;
      const updatedList = currentList.map((item) => {
        if (item.id === selectedListItemId) {
          const pts = item.polygon || [];
          return { ...item, polygon: [...pts, pt] };
        }
        return item;
      });
      updateNestedValue(pathArray, updatedList);
    }
  };

  const handleSave = () => {
    setSaveErrorMessage(null);

    // Validate polygons meet 3-point rule before saving
    for (const node of geometryNodes) {
      if (node.type === "polygon") {
        const pts = getNestedValue(settings, node.path) as Point[];
        if (pts && pts.length > 0 && !isValidPolygon(pts)) {
          setSaveErrorMessage(`Poligon untuk "${node.title}" harus memiliki minimal 3 titik koordinat.`);
          return;
        }
      } else if (node.type === "polygon-list") {
        const list = (getNestedValue(settings, node.path) as Array<{ id: string; name: string; polygon: Point[] }>) || [];
        for (const item of list) {
          if (item.polygon && item.polygon.length > 0 && !isValidPolygon(item.polygon)) {
            setSaveErrorMessage(`Poligon untuk item "${item.name}" harus memiliki minimal 3 titik koordinat.`);
            return;
          }
        }
      }
    }

    saveMutation.mutate({
      id,
      data: {
        baseVersion,
        settings,
        note: saveNote.trim() || undefined,
      },
    });
  };

  const handleReloadLatest = () => {
    setStaleModalOpen(false);
    refetchConfig().then((res) => {
      const data = (res as { data?: { settings?: unknown; version: number } }).data;
      if (data) {
        setSettings((data.settings as Record<string, unknown>) ?? {});
        setBaseVersion(data.version);
      }
    });
  };

  const activeNode = geometryNodes.find((g) => g.path.join(".") === selectedGeoPath);
  const activePathArray = selectedGeoPath ? selectedGeoPath.split(".") : [];

  return (
    <>
      <Link
        href="/config/cameras"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-muted transition hover:text-forest"
      >
        <ArrowLeft className="size-4" />
        Semua kamera
      </Link>

      <PageHeader
        tag={`Konfigurasi v${baseVersion}`}
        title={camera?.name ?? id}
        subtitle={`Zona dan ambang batas · ${usecase?.label ?? camera?.useCase ?? ""}`}
      />
      <CameraTabs id={id} />

      {/* Save bar: status of the last save, version history, save */}
      <div className="sticky top-14 z-20 -mx-1 mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface/95 px-3 py-2.5 shadow-[0_6px_16px_rgba(19,36,26,0.06)] backdrop-blur">
        <span className="px-1 text-xs font-medium text-muted">Simpan membuat versi baru, lalu engine menerapkannya.</span>
        <div className="flex flex-wrap items-center gap-2">
          {effectiveSaveState === "APPLIED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-good/25 bg-good-bg px-3 py-1 text-xs font-extrabold text-good">
              <CheckCircle2 className="size-3.5 text-good" />
              Diterapkan ✓ (v{saveVersionNumber})
            </span>
          )}
          {effectiveSaveState === "SAVED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/40 bg-lime/20 px-3 py-1 text-xs font-extrabold text-forest">
              <Clock className="size-3.5 animate-spin text-forest" />
              Tersimpan · Menerapkan ke Mesin AI...
            </span>
          )}
          {effectiveSaveState === "REJECTED" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-crit/25 bg-crit-bg px-3 py-1 text-xs font-bold text-crit-ink">
              <AlertCircle className="size-3.5 text-crit" />
              Ditolak: {effectiveErrorMessage}
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              setHistoryOpen(true);
              setSelectedHistoryVersion(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-bold text-ink-2 shadow-sm transition hover:border-lime hover:bg-lime/10"
          >
            <History className="size-4" />
            Riwayat Versi (v{baseVersion})
          </button>

          <button
            type="button"
            disabled={saveMutation.isPending}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-4 py-2 text-xs font-extrabold text-white shadow-md transition hover:bg-forest-dark hover:shadow-lg disabled:opacity-50"
          >
            <Save className="size-4" />
            {saveMutation.isPending ? "Menyimpan..." : "Simpan Konfigurasi"}
          </button>
        </div>
      </div>

      {effectiveErrorMessage && effectiveSaveState !== "REJECTED" && (
        <div role="alert" className="mb-6 rounded-2xl border border-crit/25 bg-crit-bg p-4 text-xs font-bold text-crit-ink">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-crit" />
            <span>{effectiveErrorMessage}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: 16:9 Canvas & Interactive Drawing Area */}
        <div className="lg:col-span-8 space-y-4">
          <Card
            title="Kanvas Visualisasi Kamera CCTV"
            subtitle="Klik pada kanvas untuk menambah titik koordinat poligon atau garis tripwire"
            actions={
              <button
                type="button"
                onClick={() => {
                  setFrameError(false);
                  setFrameKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-muted hover:text-forest"
              >
                <RefreshCw className="size-3" />
                Segarkan Frame
              </button>
            }
          >
            {/* 16:9 Aspect Ratio Frame Container */}
            <div
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="group relative aspect-video w-full cursor-crosshair overflow-hidden rounded-2xl border-2 border-dashed border-line bg-[#141b17] select-none"
            >
              {/* Background Frame Image */}
              {!frameError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/v1/cameras/${id}/frame?t=${frameKey}`}
                  alt="Camera Live Frame"
                  onError={() => setFrameError(true)}
                  className="absolute inset-0 size-full object-contain pointer-events-none"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#141b17]/90 text-[#a8b2ac] p-4 text-center pointer-events-none">
                  <div className="rounded-full bg-white/10 p-3 mb-2">
                    <Maximize2 className="size-6 text-[#a8b2ac]" />
                  </div>
                  <span className="text-xs font-extrabold text-[#dde7e0]">Belum ada gambar dari kamera</span>
                  <span className="text-[10px] text-muted mt-1 max-w-sm">
                    Kamera belum mengirimkan frame atau sedang offline. Anda tetap dapat menggambar zona pada kanvas 16:9 ini.
                  </span>
                </div>
              )}

              {/* SVG Overlay for Polygons and Lines */}
              <svg className="absolute inset-0 size-full pointer-events-none">
                {geometryNodes.map((node) => {
                  const isCurrent = node.path.join(".") === selectedGeoPath;
                  const nodeColor = isCurrent ? "#84cc16" : "#0284c7"; // lime vs sky
                  const fillColor = isCurrent ? "rgba(132, 204, 22, 0.25)" : "rgba(2, 132, 199, 0.15)";

                  if (node.type === "polygon") {
                    const pts = (getNestedValue(settings, node.path) as Point[]) || [];
                    if (pts.length === 0) return null;
                    const pointsStr = pts.map((p) => `${p[0] * 100}%,${p[1] * 100}%`).join(" ");

                    return (
                      <g key={node.path.join(".")}>
                        <polygon
                          points={pointsStr}
                          stroke={nodeColor}
                          strokeWidth="2.5"
                          fill={fillColor}
                          strokeDasharray={isCurrent ? "none" : "4 2"}
                        />
                        {pts.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={`${p[0] * 100}%`}
                            cy={`${p[1] * 100}%`}
                            r="5"
                            fill="#ffffff"
                            stroke={nodeColor}
                            strokeWidth="2.5"
                          />
                        ))}
                      </g>
                    );
                  }

                  if (node.type === "line") {
                    const line = (getNestedValue(settings, node.path) as { start?: Point; end?: Point }) || {};
                    if (!line.start) return null;

                    return (
                      <g key={node.path.join(".")}>
                        {line.end ? (
                          <line
                            x1={`${line.start[0] * 100}%`}
                            y1={`${line.start[1] * 100}%`}
                            x2={`${line.end[0] * 100}%`}
                            y2={`${line.end[1] * 100}%`}
                            stroke="#eab308"
                            strokeWidth="3"
                          />
                        ) : null}
                        <circle
                          cx={`${line.start[0] * 100}%`}
                          cy={`${line.start[1] * 100}%`}
                          r="6"
                          fill="#ffffff"
                          stroke="#eab308"
                          strokeWidth="2"
                        />
                        {line.end && (
                          <circle
                            cx={`${line.end[0] * 100}%`}
                            cy={`${line.end[1] * 100}%`}
                            r="6"
                            fill="#ffffff"
                            stroke="#eab308"
                            strokeWidth="2"
                          />
                        )}
                      </g>
                    );
                  }

                  if (node.type === "polygon-list") {
                    const list = (getNestedValue(settings, node.path) as Array<{ id: string; name: string; polygon: Point[] }>) || [];
                    return (
                      <g key={node.path.join(".")}>
                        {list.map((item) => {
                          const pts = item.polygon || [];
                          if (pts.length === 0) return null;
                          const isItemSelected = isCurrent && selectedListItemId === item.id;
                          const color = isItemSelected ? "#10b981" : "#64748b";
                          const fill = isItemSelected ? "rgba(16, 185, 129, 0.3)" : "rgba(100, 116, 139, 0.15)";
                          const pointsStr = pts.map((p) => `${p[0] * 100}%,${p[1] * 100}%`).join(" ");

                          return (
                            <g key={item.id}>
                              <polygon
                                points={pointsStr}
                                stroke={color}
                                strokeWidth="2"
                                fill={fill}
                              />
                              {pts.map((p, idx) => (
                                <circle
                                  key={idx}
                                  cx={`${p[0] * 100}%`}
                                  cy={`${p[1] * 100}%`}
                                  r="4"
                                  fill="#ffffff"
                                  stroke={color}
                                  strokeWidth="2"
                                />
                              ))}
                            </g>
                          );
                        })}
                      </g>
                    );
                  }

                  return null;
                })}
              </svg>
            </div>

            {/* Drawing Controls toolbar */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-extrabold uppercase text-ink-2">Geometri Aktif:</span>
                <select
                  value={selectedGeoPath}
                  onChange={(e) => {
                    setSelectedGeoPath(e.target.value);
                    setSelectedListItemId(null);
                  }}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-forest focus:border-lime focus:outline-none"
                >
                  {geometryNodes.map((n) => (
                    <option key={n.path.join(".")} value={n.path.join(".")}>
                      {n.title} ({n.type})
                    </option>
                  ))}
                </select>
              </div>

              {activeNode && (
                <div className="flex items-center gap-2">
                  {activeNode.type === "polygon" && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const pts = (getNestedValue(settings, activePathArray) as Point[]) || [];
                          if (pts.length > 0) {
                            updateNestedValue(activePathArray, pts.slice(0, -1));
                          }
                        }}
                        className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink-2 hover:bg-surface-2"
                      >
                        Hapus Titik Terakhir
                      </button>
                      <button
                        type="button"
                        onClick={() => updateNestedValue(activePathArray, [])}
                        className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-crit hover:bg-crit-bg"
                      >
                        Reset Poligon
                      </button>
                    </>
                  )}

                  {activeNode.type === "line" && (
                    <button
                      type="button"
                      onClick={() => updateNestedValue(activePathArray, {})}
                      className="rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-crit hover:bg-crit-bg"
                    >
                      Reset Garis
                    </button>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Polygon-List Sub-Manager (e.g. Restaurant Tables) */}
          {activeNode?.type === "polygon-list" && (
            <Card
              title={`Daftar ${activeNode.title}`}
              subtitle="Kelola poligon per item (tambah, namai ulang, atau hapus zona)"
              actions={
                <button
                  type="button"
                  onClick={() => {
                    const list = (getNestedValue(settings, activePathArray) as Array<{ id: string; name: string; polygon: Point[] }>) || [];
                    const existingIds = list.map((l) => l.id);
                    const newId = generateZoneId("table", existingIds);
                    const newItem = {
                      id: newId,
                      name: `Meja ${list.length + 1}`,
                      polygon: [],
                    };
                    updateNestedValue(activePathArray, [...list, newItem]);
                    setSelectedListItemId(newId);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-forest px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-forest-dark"
                >
                  <Plus className="size-3.5" />
                  Tambah Item
                </button>
              }
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {(((getNestedValue(settings, activePathArray) as Array<{ id: string; name: string; polygon: Point[] }>) || []).map((item) => {
                  const isSelected = selectedListItemId === item.id;
                  const ptsCount = (item.polygon || []).length;

                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedListItemId(item.id)}
                      className={`cursor-pointer rounded-2xl border p-3 transition ${
                        isSelected
                          ? "border-good bg-good-bg shadow-sm"
                          : "border-line bg-surface hover:border-lime/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-ink">{item.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const list = (getNestedValue(settings, activePathArray) as Array<{ id: string; name: string; polygon: Point[] }>) || [];
                            updateNestedValue(
                              activePathArray,
                              list.filter((l) => l.id !== item.id)
                            );
                            if (selectedListItemId === item.id) setSelectedListItemId(null);
                          }}
                          className="text-muted hover:text-crit"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="mt-1 flex items-center justify-between text-[11px] text-muted">
                        <span className="font-mono">{item.id}</span>
                        <span>{ptsCount} Titik</span>
                      </div>
                    </div>
                  );
                }))}
              </div>
            </Card>
          )}
        </div>

        {/* Right: Dynamic Settings & Threshold Form */}
        <div className="lg:col-span-4 space-y-4">
          <Card
            title="Ambang Batas & Logika Deteksi"
            subtitle="Parameter analitik dari skema use-case resmi"
          >
            <div className="space-y-4">
              {Boolean(settingsSchema["properties"]) &&
                Object.entries(settingsSchema["properties"] as Record<string, Record<string, unknown>>)
                  .filter(([, val]) => !val["x-geometry"])
                  .map(([propKey, propVal]) => {
                    const minRole = (propVal["x-minRole"] as Role) || "USER";
                    const isAllowed = roleAtLeast(userRole, minRole);
                    const propType = propVal["type"] as string;
                    const valCurrent = settings[propKey] ?? propVal["default"];

                    return (
                      <div key={propKey} className="rounded-2xl border border-line/60 bg-surface-2 p-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-extrabold uppercase tracking-wider text-ink-2">
                            {String(propVal["title"] || propKey)}
                          </label>
                          {!isAllowed && (
                            <span className="rounded-md bg-warn-bg px-1.5 py-0.5 text-[9px] font-bold text-gold-ink">
                              Butuh {minRole}
                            </span>
                          )}
                        </div>

                        {Boolean(propVal["description"]) && (
                          <p className="mt-0.5 text-[11px] text-muted">
                            {String(propVal["description"])}
                          </p>
                        )}

                        <div className="mt-2">
                          {propType === "boolean" ? (
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                disabled={!isAllowed}
                                checked={Boolean(valCurrent)}
                                onChange={(e) =>
                                  setSettings((prev) => ({ ...prev, [propKey]: e.target.checked }))
                                }
                                className="size-4 rounded border-line text-forest focus:ring-lime disabled:opacity-50"
                              />
                              <span className="text-xs font-bold text-ink">Aktif</span>
                            </label>
                          ) : propType === "number" || propType === "integer" ? (
                            <input
                              type="number"
                              disabled={!isAllowed}
                              min={propVal["minimum"] as number | undefined}
                              max={propVal["maximum"] as number | undefined}
                              value={valCurrent !== undefined ? Number(valCurrent) : ""}
                              onChange={(e) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  [propKey]: e.target.value === "" ? 0 : Number(e.target.value),
                                }))
                              }
                              className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink disabled:bg-surface-3 disabled:text-muted focus:border-lime focus:outline-none"
                            />
                          ) : (
                            <input
                              type="text"
                              disabled={!isAllowed}
                              value={String(valCurrent ?? "")}
                              onChange={(e) =>
                                setSettings((prev) => ({ ...prev, [propKey]: e.target.value }))
                              }
                              className="w-full rounded-xl border border-line bg-surface px-3 py-1.5 text-xs font-bold text-ink disabled:bg-surface-3 disabled:text-muted focus:border-lime focus:outline-none"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}

              <div className="pt-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2">
                  Catatan Perubahan (Opsional)
                </label>
                <textarea
                  rows={2}
                  maxLength={500}
                  value={saveNote}
                  onChange={(e) => setSaveNote(e.target.value)}
                  placeholder="Misal: Penyesuaian garis tripwire setelah reposisi CCTV..."
                  className="mt-1.5 w-full rounded-xl border border-line bg-surface px-3 py-2 text-xs font-medium text-ink placeholder:text-muted focus:border-lime focus:outline-none"
                />
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* History and Rollback Modal */}
      {historyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-line pb-4">
              <div className="flex items-center gap-2">
                <History className="size-5 text-forest" />
                <h3 className="text-base font-extrabold text-ink">Riwayat Versi Konfigurasi Kamera</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryOpen(false)}
                className="text-muted hover:text-ink"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto space-y-3">
              {versionsQuery.isLoading ? (
                <div className="py-8 text-center text-xs font-bold text-muted">Memuat riwayat...</div>
              ) : (versionsQuery.data ?? []).length === 0 ? (
                <div className="py-8 text-center text-xs font-bold text-muted">Belum ada riwayat konfigurasi.</div>
              ) : (
                (versionsQuery.data ?? []).map((ver) => {
                  const isCurrent = ver.version === baseVersion;
                  const isSelected = selectedHistoryVersion === ver.version;

                  return (
                    <div
                      key={ver.version}
                      className={`rounded-2xl border p-4 transition ${
                        isCurrent
                          ? "border-forest bg-forest/5"
                          : isSelected
                          ? "border-lime bg-lime/10"
                          : "border-line bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-forest">Versi {ver.version}</span>
                          {isCurrent && (
                            <span className="rounded-full bg-forest px-2 py-0.5 text-[10px] font-bold text-white">
                              Aktif
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedHistoryVersion(isSelected ? null : ver.version)
                            }
                            className="text-xs font-bold text-forest hover:underline"
                          >
                            {isSelected ? "Tutup Diff" : "Lihat Perubahan"}
                          </button>

                          {!isCurrent && (
                            <button
                              type="button"
                              disabled={rollbackMutation.isPending}
                              onClick={() =>
                                rollbackMutation.mutate({
                                  id,
                                  data: { baseVersion, version: ver.version },
                                })
                              }
                              className="inline-flex items-center gap-1 rounded-xl bg-lime-dark px-3 py-1 text-xs font-extrabold text-forest hover:bg-lime"
                            >
                              <RotateCcw className="size-3" />
                              Rollback
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-muted flex items-center gap-4">
                        <span>Oleh: {ver.author?.name ?? "Sistem"}</span>
                        <span>Waktu: {fmtLocalTime(ver.createdAt)} {siteZoneLabel()}</span>
                      </div>

                      {ver.note && (
                        <p className="mt-1 text-xs font-medium text-ink-2 italic">
                          &quot;{ver.note}&quot;
                        </p>
                      )}

                      {/* Version Diff View */}
                      {isSelected && versionDetailQuery.data && (
                        <div className="mt-3 rounded-xl border border-line bg-forest-dark p-3 text-xs font-mono text-[#dde7e0]">
                          <div className="text-[11px] font-bold text-muted mb-2">
                            Perubahan dari versi sebelumnya:
                          </div>
                          {versionDetailQuery.data.changes && versionDetailQuery.data.changes.length > 0 ? (
                            versionDetailQuery.data.changes.map((ch, idx) => (
                              <div key={idx} className="space-y-0.5">
                                <span className="text-lime">{ch.path}</span>
                                <div className="text-crit">- {JSON.stringify(ch.before)}</div>
                                <div className="text-good">+ {JSON.stringify(ch.after)}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-muted">Tidak ada perbedaan data tercatat.</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stale Version Conflict Modal */}
      {staleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-gold-ink">
              <AlertCircle className="size-6" />
              <h3 className="text-base font-extrabold text-ink">Konflik Versi (Stale Version)</h3>
            </div>
            <p className="mt-3 text-xs font-semibold text-ink-2 leading-relaxed">
              Konfigurasi kamera ini telah diperbarui oleh pengguna lain saat Anda membuka halaman. Untuk menghindari penimpaan konfigurasi yang tidak disengaja, silakan muat ulang versi terbaru.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStaleModalOpen(false)}
                className="rounded-xl border border-line px-4 py-2 text-xs font-bold text-ink-2 hover:bg-surface-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleReloadLatest}
                className="rounded-xl bg-forest px-4 py-2 text-xs font-extrabold text-white hover:bg-forest-dark"
              >
                Muat Ulang Versi Terbaru
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ZoneEditorPage({ id }: { id: string }) {
  const { me } = useMe();
  const userRole = (me?.role ?? "USER") as Role;

  const cameraQuery = useCamerasGet(id);
  const configQuery = useCameraConfigActive(id);
  const usecasesQuery = useUsecasesList();

  const camera = cameraQuery.data;
  const config = configQuery.data;
  const usecase = (usecasesQuery.data ?? []).find((u) => u.id === camera?.useCase);

  return (
    <RequireRole min="MANAGER">
      {cameraQuery.isLoading || configQuery.isLoading ? (
        <Card>
          <div className="py-12 text-center text-xs font-bold text-muted">Memuat editor zona...</div>
        </Card>
      ) : !camera || !config ? (
        <Card>
          <div className="py-12 text-center text-xs font-bold text-crit">
            Kamera atau konfigurasi tidak ditemukan.
          </div>
        </Card>
      ) : (
        <ZoneEditorInner
          key={`${id}-${config.version}`}
          id={id}
          camera={camera}
          initialConfig={config}
          usecase={usecase}
          userRole={userRole}
          refetchConfig={() => configQuery.refetch()}
        />
      )}
    </RequireRole>
  );
}
