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
    <div className="min-h-screen bg-slate-900 text-slate-100 p-6">
      <h1 className="text-2xl font-bold mb-4">Data Viz Tool</h1>

      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <input
          type="file"
          accept=".csv,.json"
          onChange={handleFile}
          className="text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-indigo-600 file:text-white"
        />
        {columns.length > 0 && (
          <>
            <select value={xKey} onChange={(e) => setXKey(e.target.value)} className="bg-slate-800 rounded px-2 py-1 text-sm">
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={yKey} onChange={(e) => setYKey(e.target.value)} className="bg-slate-800 rounded px-2 py-1 text-sm">
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={chartType} onChange={(e) => setChartType(e.target.value)} className="bg-slate-800 rounded px-2 py-1 text-sm">
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="pie">Pie</option>
              <option value="area">Area</option>
            </select>
            <button onClick={exportPDF} className="bg-emerald-600 px-3 py-1.5 rounded text-sm">Export PDF</button>
            <button onClick={exportCSV} className="bg-sky-600 px-3 py-1.5 rounded text-sm">Export CSV</button>
          </>
        )}
      </div>

      {data.length > 0 && (
        <div ref={dashboardRef} className="bg-slate-800 rounded-xl p-4">
          <h2 className="text-lg font-semibold mb-3">{fileName}</h2>
          <ResponsiveContainer width="100%" height={350}>
            {chartType === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={xKey} stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
                <Legend />
                <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : chartType === "line" ? (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={xKey} stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
                <Legend />
                <Line type="monotone" dataKey={yKey} stroke="#22d3ee" strokeWidth={2} />
              </LineChart>
            ) : chartType === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey={xKey} stroke="#cbd5e1" />
                <YAxis stroke="#cbd5e1" />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
                <Legend />
                <Area type="monotone" dataKey={yKey} stroke="#22d3ee" fill="#6366f1" fillOpacity={0.4} />
              </AreaChart>
            ) : (
              <PieChart>
                <Pie
                  data={data}
                  dataKey={yKey}
                  nameKey={xKey}
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={["#6366f1", "#22d3ee", "#f472b6", "#facc15", "#34d399", "#f87171"][i % 6]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#1e293b", border: "none" }} />
                <Legend />
              </PieChart>
            )}
          </ResponsiveContainer>

          <div className="mt-4 overflow-x-auto max-h-64">
            <table className="text-sm w-full">
              <thead>
                <tr>{columns.map((c) => <th key={c} className="text-left px-2 py-1 text-slate-400">{c}</th>)}</tr>
              </thead>
              <tbody>
                {data.slice(0, 20).map((row, i) => (
                  <tr key={i} className="border-t border-slate-700">
                    {columns.map((c) => <td key={c} className="px-2 py-1">{String(row[c])}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
