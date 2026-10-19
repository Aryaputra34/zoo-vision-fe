"use client";

import { useState, useMemo } from "react";
import {
  TrendingUp,
  Filter,
  BarChart,
  Calendar,
  Layers,
  ArrowUpRight,
  Maximize2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useReportsMetricSeries } from "@/api/generated/reports/reports";
import { useUsecasesList } from "@/api/generated/usecases/usecases";
import { useCamerasList } from "@/api/generated/cameras/cameras";
import { PageHeader, Card, Table, Tile, Tiles, Mono } from "@/components/ui";
import { AnalyticsTabs } from "@/components/client";
import { CsvLink } from "@/components/CsvLink";
import { fmtLocalTime, localDayRange } from "@/lib/time";
import { useToday } from "@/lib/useToday";
import { fmtNum } from "@/lib/util";
import type { Bucket } from "@/api/generated/zooVisionAPI.schemas";

export function MetricsExplorerPage() {
  const today = useToday();
  const [pickedDate, setPickedDate] = useState(today);
  const day = localDayRange(pickedDate);

  const usecasesQuery = useUsecasesList();
  const camerasQuery = useCamerasList();

  // Extract all available metrics dynamically from usecasesList
  const allMetrics = useMemo(() => {
    const list: Array<{
      name: string;
      label: string;
      unit: string;
      useCaseId: string;
      useCaseLabel: string;
    }> = [];
    for (const uc of usecasesQuery.data ?? []) {
      for (const m of uc.metrics ?? []) {
        list.push({
          name: m.name,
          label: m.label,
          unit: m.unit,
          useCaseId: uc.id,
          useCaseLabel: uc.label,
        });
      }
    }
    return list;
  }, [usecasesQuery.data]);

  // Selected parameters
  const [selectedMetricName, setSelectedMetricName] = useState<string>("occupancy");
  const [selectedCamera, setSelectedCamera] = useState<string>("ALL");
  const [selectedBucket, setSelectedBucket] = useState<Bucket>("5m");
  const [aggMode, setAggMode] = useState<"avg" | "max" | "min" | "above">("max");
  const [aboveThreshold, setAboveThreshold] = useState<number>(50);

  // Active metric descriptor
  const activeMetric = useMemo(() => {
    return allMetrics.find((m) => m.name === selectedMetricName) || allMetrics[0];
  }, [allMetrics, selectedMetricName]);

  // Query metric series
  const seriesQuery = useReportsMetricSeries({
    from: day.from,
    to: day.to,
    name: activeMetric?.name ?? "occupancy",
    useCase: activeMetric?.useCaseId,
    cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
    bucket: selectedBucket,
    ...(aggMode === "above" ? { above: aboveThreshold } : { agg: aggMode }),
  });

  const rows = seriesQuery.data?.rows ?? [];

  // Format data for chart
  const chartData = useMemo(() => {
    return rows.map((r) => ({
      time: fmtLocalTime(r.bucketStart),
      value: r.value ?? 0,
      cameraId: r.cameraId,
    }));
  }, [rows]);

  // Summary statistics
  const stats = useMemo(() => {
    let max = 0;
    let min = Infinity;
    let sum = 0;
    for (const r of rows) {
      const v = r.value ?? 0;
      if (v > max) max = v;
      if (v < min) min = v;
      sum += v;
    }
    const avg = rows.length > 0 ? (sum / rows.length).toFixed(1) : "0";
    return {
      count: rows.length,
      max: rows.length > 0 ? max : 0,
      min: rows.length > 0 && min !== Infinity ? min : 0,
      avg,
    };
  }, [rows]);

  const cameras = camerasQuery.data ?? [];

  return (
    <>
      <PageHeader
        title="Analitik"
        subtitle="Grafik deret waktu metrik dengan resolusi 5 menit, 15 menit, jam, atau hari."
        date={pickedDate}
      >
        <CsvLink
          path="/api/v1/exports/metrics.csv"
          params={{
            from: day.from,
            to: day.to,
            name: activeMetric?.name ?? "occupancy",
            useCase: activeMetric?.useCaseId,
            cameraIds: selectedCamera !== "ALL" ? selectedCamera : undefined,
          }}
        />
      </PageHeader>

      <AnalyticsTabs />

      {/* Dynamic Pickers Toolbar */}
      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric Picker */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Pilih Metrik Analitik
          </label>
          <select
            value={activeMetric?.name ?? ""}
            onChange={(e) => setSelectedMetricName(e.target.value)}
            className="w-full rounded-[10px] border border-[#cfc9b8] bg-surface py-2.5 px-3 text-[13px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          >
            {allMetrics.map((m) => (
              <option key={m.name} value={m.name}>
                {m.label} ({m.name}) · {m.unit}
              </option>
            ))}
          </select>
        </div>

        {/* Camera Filter */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Kamera CCTV
          </label>
          <select
            value={selectedCamera}
            onChange={(e) => setSelectedCamera(e.target.value)}
            className="w-full rounded-[10px] border border-[#cfc9b8] bg-surface py-2.5 px-3 text-[13px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          >
            <option value="ALL">Semua Kamera Relevan</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.id})
              </option>
            ))}
          </select>
        </div>

        {/* Bucket Resolution */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Resolusi Bucket Waktu
          </label>
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value as Bucket)}
            className="w-full rounded-[10px] border border-[#cfc9b8] bg-surface py-2.5 px-3 text-[13px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
          >
            <option value="5m">5 Menit (5m)</option>
            <option value="15m">15 Menit (15m)</option>
            <option value="hour">1 Jam (hour)</option>
            <option value="day">1 Hari (day)</option>
          </select>
        </div>

        {/* Aggregation Mode */}
        <div>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-ink-2 mb-1">
            Mode Agregasi Nilai
          </label>
          <div className="flex gap-2">
            <select
              value={aggMode}
              onChange={(e) => setAggMode(e.target.value as "avg" | "max" | "min" | "above")}
              className="w-full rounded-[10px] border border-[#cfc9b8] bg-surface py-2.5 px-3 text-[13px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
            >
              <option value="max">Maksimum (max)</option>
              <option value="avg">Rata-Rata (avg)</option>
              <option value="min">Minimum (min)</option>
              <option value="above">Durasi di Atas Ambang (above)</option>
            </select>
            {aggMode === "above" && (
              <input
                type="number"
                value={aboveThreshold}
                onChange={(e) => setAboveThreshold(Number(e.target.value))}
                placeholder="Ambang"
                className="w-20 rounded-[10px] border border-[#cfc9b8] bg-surface px-2 text-[13px] font-medium text-ink focus:border-forest focus:outline-none focus:ring-2 focus:ring-lime/40"
              />
            )}
          </div>
        </div>
      </div>

      <Tiles>
        <Tile
          label="Nilai Tertinggi (Peak)"
          value={`${stats.max} ${activeMetric?.unit ?? ""}`}
          sub="Nilai puncak dalam rentang hari ini"
        />
        <Tile
          label="Rata-Rata Terhitung"
          value={`${stats.avg} ${activeMetric?.unit ?? ""}`}
          sub="Rata-rata dari seluruh bucket"
        />
        <Tile
          label="Nilai Terendah"
          value={`${stats.min} ${activeMetric?.unit ?? ""}`}
          sub="Nilai minimum yang tercatat"
        />
        <Tile
          label="Total Titik Sampel"
          value={`${stats.count} Sampel`}
          sub={`Interval agregasi ${selectedBucket}`}
        />
      </Tiles>

      {/* Chart */}
      <div className="mb-6">
        <Card
          title={`Grafik Deret Waktu: ${activeMetric?.label ?? selectedMetricName}`}
          subtitle={`Satuan: ${activeMetric?.unit ?? ""} · Agregasi: ${aggMode.toUpperCase()}`}
        >
          {chartData.length > 0 ? (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
                  <defs>
                    <linearGradient id="metricGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#82bb3a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0d542e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} stroke="var(--grid)" strokeDasharray="3 3" />
                  <XAxis dataKey="time" minTickGap={32} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "#0d542e",
                      border: "1px solid rgba(130, 187, 58, 0.4)",
                      borderRadius: 14,
                      fontSize: 12,
                      color: "#ffffff",
                    }}
                    labelStyle={{ color: "#82bb3a", fontWeight: "bold" }}
                    formatter={(v) => [`${v} ${activeMetric?.unit ?? ""}`, activeMetric?.label ?? "Nilai"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#0d542e"
                    strokeWidth={2.5}
                    fill="url(#metricGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-16 text-center text-xs font-bold text-muted">
              Tidak ada data metrik pada tanggal {pickedDate}.
            </div>
          )}
        </Card>
      </div>

      {/* Table rows */}
      <Card
        title="Tabel Rincian Sampel Bucket Metrik"
        subtitle={`Menampilkan ${rows.length} baris rekaman deret waktu`}
      >
        <Table
          head={["Waktu Bucket Mulai", "Kamera CCTV", "Nilai Terhitung", "Satuan"]}
          rows={rows.map((r) => [
            fmtLocalTime(r.bucketStart),
            r.cameraId ?? "Semua Kamera",
            <span key="val" className="font-mono text-xs font-black text-forest">
              {r.value ?? 0}
            </span>,
            activeMetric?.unit ?? "—",
          ])}
          empty={
            seriesQuery.isLoading
              ? "Memuat deret waktu..."
              : rows.length === 0
              ? "Tidak ada data metrik."
              : undefined
          }
        />
      </Card>
    </>
  );
}
