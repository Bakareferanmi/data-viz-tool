import { useState, useRef } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

function App() {
  const [data, setData] = useState([]);
  const [columns, setColumns] = useState([]);
  const [xKey, setXKey] = useState("");
  const [yKey, setYKey] = useState("");
  const [chartType, setChartType] = useState("bar");
  const [fileName, setFileName] = useState("");
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

    const numericCol = cols.find((c) => typeof rows[0][c] === "number");
    const stringCol = cols.find((c) => typeof rows[0][c] === "string");
    setXKey(stringCol || cols[0]);
    setYKey(numericCol || cols[1] || cols[0]);
  };

  const exportPDF = async () => {
    const canvas = await html2canvas(dashboardRef.current, { scale: 2 });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "landscape" });
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, width, height);
    pdf.save(`${fileName || "report"}.pdf`);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
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
          /* Empty state */
          <div className="border border-dashed border-slate-700 rounded-2xl py-24 flex flex-col items-center justify-center text-center">
            <p className="text-slate-300 font-medium mb-1">No data loaded yet</p>
            <p className="text-slate-500 text-sm">Upload a CSV or JSON file to generate your first chart</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Controls card */}
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
                  <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm min-w-[120px]">
                    <option value="bar">Bar</option>
                    <option value="line">Line</option>
                    <option value="pie">Pie</option>
                    <option value="area">Area</option>
                  </select>
                </div>

                <div className="flex gap-2 ml-auto">
                  <button onClick={exportCSV} className="border border-slate-700 hover:bg-slate-800 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
                    Export CSV
                  </button>
                  <button onClick={exportPDF} className="bg-emerald-600 hover:bg-emerald-500 transition-colors text-sm font-medium px-4 py-2 rounded-lg">
                    Export PDF
                  </button>
                </div>
              </div>
            </div>

            {/* Dashboard card */}
            <div ref={dashboardRef} className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">{fileName}</h2>
                <span className="text-xs text-slate-500">{data.length} rows</span>
              </div>

              <ResponsiveContainer width="100%" height={360}>
                {chartType === "bar" ? (
                  <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey={yKey} fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                ) : chartType === "line" ? (
                  <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey={yKey} stroke="#22d3ee" strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                ) : chartType === "area" ? (
                  <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={12} />
                    <YAxis stroke="#94a3b8" fontSize={12} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend />
                    <Area type="monotone" dataKey={yKey} stroke="#22d3ee" fill="#6366f1" fillOpacity={0.35} strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <PieChart>
                    <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={130} label>
                      {data.map((_, i) => (
                        <Cell key={i} fill={["#6366f1", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#f87171"][i % 6]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>

              {/* Table */}
              <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                  <thead className="bg-slate-800/60 sticky top-0">
                    <tr>
                      {columns.map((c) => (
                        <th key={c} className="text-left px-4 py-2.5 font-medium text-slate-400 whitespace-nowrap">{c}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="max-h-64">
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
