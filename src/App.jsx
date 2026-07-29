import { useState, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, ScatterChart, Scatter, ZAxis,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  FunnelChart, Funnel, LabelList, Treemap, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";

const DEFAULT_PALETTE = ["#6366f1", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#f87171", "#a78bfa", "#fb923c"];

const CHART_TYPES = [
  "bar", "bar3d", "line", "pie", "pie3d", "doughnut", "area", "scatter", "radar",
  "heatmap", "funnel", "histogram", "bubble", "treemap", "waterfall", "gauge",
];

const LABELS = { bar3d: "3D Bar", pie3d: "3D Pie" };

const shadeColor = (hex, percent) => {
  const clean = hex.replace("#", "");
  const f = parseInt(clean, 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent);
  const R = f >> 16, G = (f >> 8) & 0x00ff, B = f & 0x0000ff;
  const newColor =
    0x1000000 +
    (Math.round((t - R) * p) + R) * 0x10000 +
    (Math.round((t - G) * p) + G) * 0x100 +
    (Math.round((t - B) * p) + B);
  return "#" + newColor.toString(16).slice(1);
};

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [fileName, setFileName] = useState("");
  const [exportError, setExportError] = useState("");
  const [colors, setColors] = useState([]);
  const [showColors, setShowColors] = useState(false);
  const dashboardRef = useRef(null);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (result) => loadData(result.data),
      });
    } else if (file.name.endsWith(".json")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const parsed = JSON.parse(event.target.result);
        loadData(Array.isArray(parsed) ? parsed : [parsed]);
      };
      reader.readAsText(file);
    }
  };

  const loadData = (rows) => {
    if (!rows.length) return;
    const cols = Object.keys(rows[0]);
    setColumns(cols);
    setData(rows);
    setColors(rows.map((_, i) => DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]));

    const numericCol = cols.find((c) => typeof rows[0][c] === "number");
    const stringCol = cols.find((c) => typeof rows[0][c] === "string");
    setXKey(stringCol || cols[0]);
    setYKey(numericCol || cols[1] || cols[0]);
  };

  const setColorAt = (i, value) => {
    setColors((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const setAllColors = (value) => setColors((prev) => prev.map(() => value));
  const resetColors = () => setColors(data.map((_, i) => DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]));

  const captureDataUrl = async () => {
    return await toPng(dashboardRef.current, { backgroundColor: "#0f172a", pixelRatio: 2 });
  };

  const exportPNG = async () => {
    setExportError("");
    try {
      const dataUrl = await captureDataUrl();
      const link = document.createElement("a");
      link.download = `${fileName || "report"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      setExportError("PNG export failed: " + err.message);
    }
  };

  const exportPDF = async () => {
    setExportError("");
    try {
      const dataUrl = await captureDataUrl();
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdf = new jsPDF({ orientation: "landscape" });
      const width = pdf.internal.pageSize.getWidth();
      const height = (img.height * width) / img.width;
      pdf.addImage(dataUrl, "PNG", 0, 0, width, height);
      pdf.save(`${fileName || "report"}.pdf`);
    } catch (err) {
      setExportError("PDF export failed: " + err.message);
    }
  };

  const exportCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName || "export"}.csv`;
    a.click();
  };

  const numericVals = data.map((d) => Number(d[yKey])).filter((n) => !isNaN(n));

  const histogramData = (() => {
    if (!numericVals.length) return [];
    const min = Math.min(...numericVals);
    const max = Math.max(...numericVals);
    const bins = 6;
    const size = (max - min) / bins || 1;
    const buckets = Array.from({ length: bins }, (_, i) => ({
      range: `${(min + i * size).toFixed(1)}-${(min + (i + 1) * size).toFixed(1)}`,
      count: 0,
    }));
    numericVals.forEach((v) => {
      let idx = Math.floor((v - min) / size);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      buckets[idx].count += 1;
    });
    return buckets;
  })();

  const treemapData = data.map((d, i) => ({
    name: String(d[xKey]),
    size: Number(d[yKey]) || 1,
    fill: colors[i] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length],
  }));

  const waterfallData = (() => {
    let cumulative = 0;
    return data.map((d) => {
      const val = Number(d[yKey]) || 0;
      const base = cumulative;
      cumulative += val;
      return { name: String(d[xKey]), base, value: val };
    });
  })();

  const gaugeValue = numericVals.length ? numericVals.reduce((a, b) => a + b, 0) / numericVals.length : 0;
  const gaugeMax = numericVals.length ? Math.max(...numericVals) * 1.2 : 100;
  const gaugeData = [
    { name: "value", value: gaugeValue },
    { name: "remaining", value: Math.max(gaugeMax - gaugeValue, 0) },
  ];

  const heatmapMax = numericVals.length ? Math.max(...numericVals) : 1;
  const tooltipStyle = { background: "#1e293b", border: "1px solid #334155", borderRadius: 8 };
  const colorAt = (i) => colors[i] || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length];

  // Solid extruded 3D bar — layered shadow blocks, no perspective/skew math to break
  const Bar3D = () => {
    const max = numericVals.length ? Math.max(...numericVals) : 1;
    const barW = 44;
    return (
      <div className="flex items-end gap-10 justify-center py-14 px-10 overflow-x-auto">
        {data.map((d, i) => {
          const val = Number(d[yKey]) || 0;
          const h = max ? Math.round((val / max) * 220) + 24 : 24;
          const color = colorAt(i);
          const mid = shadeColor(color, -0.2);
          const dark = shadeColor(color, -0.42);
          const top = shadeColor(color, 0.35);
          return (
            <div key={i} className="flex flex-col items-center gap-3 shrink-0">
              <div style={{ position: "relative", width: barW + 10, height: 250, display: "flex", alignItems: "flex-end" }}>
                <div
                  style={{
                    width: barW,
                    height: h,
                    background: color,
                    borderRadius: "3px 3px 0 0",
                    boxShadow: `5px 5px 0 ${mid}, 10px 10px 0 ${dark}`,
                    position: "relative",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 8,
                    background: top, borderRadius: "3px 3px 0 0",
                  }} />
                </div>
              </div>
              <span className="text-xs text-slate-400 mt-1">{String(d[xKey])}</span>
              <span className="text-xs text-slate-300 font-medium">{val}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Tilted-disc 3D pie — conic-gradient face + darker offset "rim" layer for depth
  const Pie3D = () => {
    const total = numericVals.reduce((a, b) => a + b, 0) || 1;
    let acc = 0;
    const stops = data.map((d, i) => {
      const val = Number(d[yKey]) || 0;
      const start = (acc / total) * 360;
      acc += val;
      const end = (acc / total) * 360;
      return `${colorAt(i)} ${start}deg ${end}deg`;
    }).join(", ");
    const gradient = `conic-gradient(${stops})`;
    const size = 260;

    return (
      <div className="flex flex-col items-center py-10">
        <div style={{ position: "relative", width: size, height: size * 0.62 + 22 }}>
          <div style={{
            position: "absolute", top: 20, left: 0, width: size, height: size,
            borderRadius: "50%", background: gradient,
            transform: "scaleY(0.62)", filter: "brightness(0.55)",
          }} />
          <div style={{
            position: "absolute", top: 0, left: 0, width: size, height: size,
            borderRadius: "50%", background: gradient,
            transform: "scaleY(0.62)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.4)",
          }} />
        </div>
        <div className="flex flex-wrap gap-4 justify-center mt-6">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-slate-300">
              <span style={{ width: 10, height: 10, background: colorAt(i), display: "inline-block", borderRadius: 2 }} />
              {String(d[xKey])}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderChart = () => {
    switch (chartType) {
      case "bar":
        return (
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Bar dataKey={yKey} radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Bar>
          </BarChart>
        );
      case "line":
        return (
          <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Line type="monotone" dataKey={yKey} stroke={colors[0] || "#22d3ee"} strokeWidth={2.5} dot={{ r: 4, fill: colors[0] || "#22d3ee" }} />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Area type="monotone" dataKey={yKey} stroke={colors[0] || "#f472b6"} fill={colors[0] || "#f472b6"} fillOpacity={0.35} strokeWidth={2} />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={130} label>
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
          </PieChart>
        );
      case "doughnut":
        return (
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" innerRadius={70} outerRadius={130} label>
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
          </PieChart>
        );
      case "scatter":
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} name={xKey} />
            <YAxis dataKey={yKey} stroke="#94a3b8" fontSize={12} name={yKey} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name={yKey} data={data}>
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Scatter>
          </ScatterChart>
        );
      case "bubble":
        return (
          <ScatterChart margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} name={xKey} />
            <YAxis dataKey={yKey} stroke="#94a3b8" fontSize={12} name={yKey} />
            <ZAxis dataKey={yKey} range={[80, 500]} name="size" />
            <Tooltip contentStyle={tooltipStyle} cursor={{ strokeDasharray: "3 3" }} />
            <Legend />
            <Scatter name={yKey} data={data}>
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} fillOpacity={0.7} />)}
            </Scatter>
          </ScatterChart>
        );
      case "radar":
        return (
          <RadarChart data={data} margin={{ top: 10, right: 30, left: 30, bottom: 0 }}>
            <PolarGrid stroke="#1e293b" />
            <PolarAngleAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
            <PolarRadiusAxis stroke="#334155" fontSize={11} />
            <Tooltip contentStyle={tooltipStyle} />
            <Legend />
            <Radar name={yKey} dataKey={yKey} stroke={colors[0] || "#34d399"} fill={colors[0] || "#34d399"} fillOpacity={0.4} />
          </RadarChart>
        );
      case "funnel":
        return (
          <FunnelChart>
            <Tooltip contentStyle={tooltipStyle} />
            <Funnel dataKey={yKey} nameKey={xKey} data={data} isAnimationActive>
              <LabelList position="right" dataKey={xKey} fill="#e2e8f0" stroke="none" />
              {data.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Funnel>
          </FunnelChart>
        );
      case "histogram":
        return (
          <BarChart data={histogramData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="range" stroke="#94a3b8" fontSize={11} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill={colors[0] || "#a78bfa"} radius={[6, 6, 0, 0]} />
          </BarChart>
        );
      case "treemap":
        return (
          <Treemap data={treemapData} dataKey="size" stroke="#0f172a" fill="#6366f1">
            <Tooltip contentStyle={tooltipStyle} />
          </Treemap>
        );
      case "waterfall":
        return (
          <ComposedChart data={waterfallData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
            <YAxis stroke="#94a3b8" fontSize={12} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="base" stackId="a" fill="transparent" />
            <Bar dataKey="value" stackId="a" radius={[4, 4, 0, 0]}>
              {waterfallData.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
            </Bar>
          </ComposedChart>
        );
      case "gauge":
        return (
          <PieChart>
            <Pie data={gaugeData} dataKey="value" cx="50%" cy="80%" startAngle={180} endAngle={0} innerRadius={90} outerRadius={140}>
              <Cell fill={colors[0] || "#22d3ee"} />
              <Cell fill="#1e293b" />
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Data Viz Tool</h1>
            <p className="text-xs text-slate-400 mt-0.5">Import CSV or JSON, generate instant charts and reports</p>
          </div>
          <label className="cursor-pointer bg-indigo-600 hover:bg-indigo-500 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
            Upload File
            <input type="file" accept=".csv,.json" onChange={handleFile} className="hidden" />
          </label>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {columns.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-2xl py-24 flex flex-col items-center justify-center text-center">
            <p className="text-slate-300 font-medium mb-1">No data loaded yet</p>
            <p className="text-slate-500 text-sm">Upload a CSV or JSON file to generate your first chart</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-wrap items-end gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">X-Axis</label>
                  <select value={xKey} onChange={(e) => setXKey(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm min-w-[120px]">
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Y-Axis</label>
                  <select value={yKey} onChange={(e) => setYKey(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm min-w-[120px]">
                    {columns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">Chart Type</label>
                  <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm min-w-[140px]">
                    {CHART_TYPES.map((t) => (
                      <option key={t} value={t}>{LABELS[t] || (t.charAt(0).toUpperCase() + t.slice(1))}</option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={() => setShowColors((s) => !s)}
                  className="border border-slate-700 hover:bg-slate-800 transition-colors text-sm font-medium px-4 py-2 rounded-lg"
                >
                  {showColors ? "Hide Colors" : "Customize Colors"}
                </button>

                <div className="flex gap-2 ml-auto flex-wrap">
                  <button onClick={exportCSV} className="border border-slate-700 hover:bg-slate-800 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
                    Export CSV
                  </button>
                  <button onClick={exportPNG} className="bg-sky-600 hover:bg-sky-500 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
                    Export PNG
                  </button>
                  <button onClick={exportPDF} className="bg-emerald-600 hover:bg-emerald-500 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
                    Export PDF
                  </button>
                </div>
              </div>
              {exportError && <p className="text-red-400 text-xs mt-3">{exportError}</p>}

              {showColors && (
                <div className="mt-5 pt-5 border-t border-slate-800">
                  <div className="flex items-center gap-3 mb-4">
                    <label className="text-xs text-slate-400">Set all colors</label>
                    <input type="color" onChange={(e) => setAllColors(e.target.value)} className="w-9 h-9 rounded cursor-pointer bg-transparent border border-slate-700" />
                    <button onClick={resetColors} className="text-xs text-slate-400 hover:text-slate-200 underline">
                      Reset to default palette
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {data.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 bg-slate-800 rounded-lg px-2.5 py-1.5">
                        <input type="color" value={colorAt(i)} onChange={(e) => setColorAt(i, e.target.value)} className="w-6 h-6 rounded cursor-pointer bg-transparent border border-slate-600" />
                        <span className="text-xs text-slate-300">{String(d[xKey])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div ref={dashboardRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">{fileName}</h2>
                <span className="text-xs text-slate-500">{data.length} rows</span>
              </div>

              {chartType === "heatmap" ? (
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {data.map((d, i) => {
                    const val = Number(d[yKey]) || 0;
                    const intensity = heatmapMax ? val / heatmapMax : 0;
                    return (
                      <div key={i} className="rounded-lg p-3 text-xs flex flex-col items-center justify-center" style={{ backgroundColor: colorAt(i), opacity: 0.3 + intensity * 0.7 }}>
                        <span className="font-medium text-slate-900">{String(d[xKey])}</span>
                        <span className="text-slate-900">{val}</span>
                      </div>
                    );
                  })}
                </div>
              ) : chartType === "bar3d" ? (
                <Bar3D />
              ) : chartType === "pie3d" ? (
                <Pie3D />
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  {renderChart()}
                </ResponsiveContainer>
              )}

              <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/60 sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="text-left px-4 py-2.5 font-medium text-slate-400 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.slice(0, 20).map((row, i) => (
                      <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/40 transition-colors">
                        {columns.map((c) => (
                          <td key={c} className="px-4 py-2.5 whitespace-nowrap">{String(row[c])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {data.length > 20 && (
                  <div className="text-center text-xs text-slate-500 py-2 bg-slate-900">
                    Showing 20 of {data.length} rows — export CSV for full data
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
