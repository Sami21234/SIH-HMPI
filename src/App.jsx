/* SIH HMPI Frontend Starter (React + Tailwind + Leaflet + Recharts + Framer Motion + shadcn)

Purpose:
Single-file starter React component (default export) that implements:
- Landing + upload UI (drag & drop + preview)
- Map (react-leaflet) with color-coded markers & popups
- Simple charts (Recharts) for Safe/Moderate/Unsafe counts
- Mock data + hooks to connect to backend endpoints
- Smooth UI polish with Framer Motion and Tailwind

Important: This is a starter file you can paste into a Vite + React project (or into your src/App.jsx).
Dependencies to install (npm or yarn): 
npm i react react-dom 
npm i -D vite 
npm i tailwindcss postcss autoprefixer && npx tailwindcss init -p 
npm i react-leaflet leaflet 
npm i recharts 
npm i framer-motion 
npm i papaparse 
npm i @shadcn/ui lucide-react

Tailwind: make sure you enable the content paths and import the base styles in index.css 
Leaflet: remember to import Leaflet css somewhere globally: "import 'leaflet/dist/leaflet.css'"

How to use:
1. Place this file as src/App.jsx or paste component into your app.
2. Start the dev server and open localhost:5173 (Vite default).
3. Replace the mock API hooks with your Django API endpoints (/upload, /compute, /samples).
*/

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { motion } from 'framer-motion';
import { Download, UploadCloud, MapPin, BarChart2 } from 'lucide-react';

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

const CATEGORY_COLORS = { Safe: '#16a34a', Moderate: '#f59e0b', Unsafe: '#ef4444' };

function getMarkerIcon(category) {
  const colors = {
    Safe: '#16a34a',
    Moderate: '#f59e0b',
    Unsafe: '#ef4444',
  };

  return L.divIcon({
    className: 'custom-marker-icon',
    html: `
      <div style="
        background-color: ${colors[category]};
        width: 18px;
        height: 18px;
        border-radius: 50%;
        border: 2px solid white;
        box-shadow: 0 0 2px rgba(0,0,0,0.5);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}


function computeIndexFromRow(row) {
  // WHO/Standard limits (μg/L)
  const standards = {
    Fe: { limit: 300, ideal: 100 },
    Mn: { limit: 400, ideal: 100 },
    As: { limit: 10, ideal: 0 },
    Pb: { limit: 10, ideal: 0 },
    Cd: { limit: 3, ideal: 0 }
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [metal, std] of Object.entries(standards)) {
    const concentration = parseFloat(row[metal]) || 0;

    // Wi = k / Si (k=1, Si = standard limit)
    const weight = 1 / std.limit;

    // Qi = [(Ci - I) / (S - I)] × 100
    // where Ci = measured, I = ideal (0), S = standard limit
    const subIndex = ((concentration - std.ideal) / (std.limit - std.ideal)) * 100;

    weightedSum += weight * subIndex;
    totalWeight += weight;
  }

  // HPI = Σ(Wi × Qi) / ΣWi
  const index = weightedSum / totalWeight;

  // Classification based on standard HPI values
  let category = 'Safe';
  if (index >= 100) category = 'Unsafe';
  else if (index >= 50) category = 'Moderate';

  return { index: Number(index.toFixed(2)), category };
}

function parseCsvFile(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data),
      error: err => reject(err),
    });
  });
}

export default function App() {
  const [stage, setStage] = useState('landing');
  const [filePreview, setFilePreview] = useState(null);
  const [rawRows, setRawRows] = useState([]);
  const [samples, setSamples] = useState([]);
  const [filter, setFilter] = useState({ metal: 'All', category: 'All' });
  const fileInputRef = useRef();
  const reportRef = useRef();

  const stats = useMemo(() => {
    const counts = { Safe: 0, Moderate: 0, Unsafe: 0 };
    for (const s of samples) counts[s.category] = (counts[s.category] || 0) + 1;
    const total = samples.length || 1;
    return {
      counts,
      total,
      percentages: {
        Safe: Math.round((counts.Safe / total) * 100),
        Moderate: Math.round((counts.Moderate / total) * 100),
        Unsafe: Math.round((counts.Unsafe / total) * 100),
      },
    };
  }, [samples]);

  useEffect(() => {
    const mocked = [
      { Location: 'Well A', Latitude: 28.7041, Longitude: 77.1025, Fe: 100, Mn: 20, As: 2, Pb: 2, Cd: 0.5 },
      { Location: 'Well B', Latitude: 28.7048, Longitude: 77.1100, Fe: 250, Mn: 150, As: 6, Pb: 8, Cd: 1.5 },
      { Location: 'Well C', Latitude: 28.7100, Longitude: 77.1200, Fe: 400, Mn: 450, As: 15, Pb: 12, Cd: 4 },
    ];
    const enriched = mocked.map((r, i) => ({ id: i + 1, ...r, ...computeIndexFromRow(r) }));
    setSamples(enriched);
  }, []);

  async function exportReport() {
    if (!reportRef.current) {
      alert("Go to the Analysis page first!");
      return;
    }

    try {
      // Simple text-based report generation
      const reportText = `
HEAVY METAL POLLUTION INDICES REPORT
Generated on: ${new Date().toLocaleString()}

SUMMARY STATISTICS
==================
Total Samples: ${samples.length}
Safe: ${stats.counts.Safe} (${stats.percentages.Safe}%)
Moderate: ${stats.counts.Moderate} (${stats.percentages.Moderate}%)
Unsafe: ${stats.counts.Unsafe} (${stats.percentages.Unsafe}%)

SAMPLE DETAILS
==============
${samples.map(s => `
Location: ${s.Location}
Coordinates: ${s.Latitude}, ${s.Longitude}
HPI Index: ${s.index}
Category: ${s.category}
Metals: Fe=${s.Fe}, Mn=${s.Mn}, As=${s.As}, Pb=${s.Pb}, Cd=${s.Cd}
`).join('\n')}
`;

      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'HMPI_Report.txt';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
      alert("Failed to generate report. Check console for details.");
    }
  }

  async function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFilePreview(f.name + ' — ' + Math.round(f.size / 1024) + ' KB');
    const rows = await parseCsvFile(f);
    setRawRows(rows);
    const enriched = rows.map((r, idx) => {
      const coords = {
        Latitude: parseFloat(r.Latitude) || parseFloat(r.lat) || 0,
        Longitude: parseFloat(r.Longitude) || parseFloat(r.lon) || 0
      };
      const base = {
        id: idx + 1,
        Location: r.Location || r.location || 'Unknown',
        ...coords,
        Fe: r.Fe,
        Mn: r.Mn,
        As: r.As,
        Pb: r.Pb,
        Cd: r.Cd
      };
      return { ...base, ...computeIndexFromRow(base) };
    });
    setSamples(enriched);
    setStage('analysis');
  }

  function handleDrop(e) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    fileInputRef.current.files = e.dataTransfer.files;
    handleFileSelect({ target: { files: [f] } });
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function filteredSamples() {
    return samples.filter(s => {
      if (filter.category !== 'All' && s.category !== filter.category) return false;
      if (filter.metal !== 'All') {
        const mVal = parseFloat(s[filter.metal]) || 0;
        if (mVal <= 0) return false;
      }
      return true;
    });
  }

  const Header = () => {
    // Optional: local state for icon swap
    const [isDark, setIsDark] = useState(() =>
      typeof window !== 'undefined' &&
      document.documentElement.classList.contains('dark')
    );

    const toggleDarkMode = () => {
      const html = document.documentElement;
      html.classList.toggle('dark');
      const darkNow = html.classList.contains('dark');
      setIsDark(darkNow);
      localStorage.setItem('theme', darkNow ? 'dark' : 'light');
    };

    useEffect(() => {
      // Set theme on first load based on saved value
      const stored = localStorage.getItem('theme');
      if (stored === 'dark') {
        document.documentElement.classList.add('dark');
        setIsDark(true);
      }
    }, []);

    return (
      <header className="flex items-center justify-between px-6 py-4 border-b bg-white dark:bg-slate-900 dark:border-slate-700 transition-colors">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-sky-600 w-10 h-10 flex items-center justify-center text-white font-bold">
            HM
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">HMPI Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Heavy Metal Pollution Indices — SIH Demo</p>
          </div>
        </div>

        <nav className="flex items-center gap-3">


          <button
            onClick={() => setStage('landing')}
            className="px-3 py-1 rounded-md 
             text-slate-700 dark:text-slate-200 
             hover:bg-slate-100 dark:hover:bg-slate-800 
             transition-colors duration-200 ease-in-out 
             hover:scale-105"
          >
            Home
          </button>

          <button
            onClick={() => setStage('upload')}
            className="px-3 py-1 rounded-md 
             bg-sky-600 text-white 
             hover:bg-sky-500 
             transition-all duration-200 ease-in-out 
             hover:scale-105"
          >
            Upload
          </button>

          {/* 🌗 Dark Mode Toggle */}
          <button
            onClick={toggleDarkMode}
            title="Toggle Dark Mode"
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {isDark ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h1M4 12H3m16.364-7.364l.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707.707M6.343 6.343l-.707.707M12 5a7 7 0 100 14 7 7 0 000-14z" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-800 dark:text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            )}
          </button>
        </nav>
      </header>
    );
  };


  const Landing = () => (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-8">
      <div className="rounded-2xl p-8 bg-gradient-to-r from-sky-50 to-white dark:from-slate-800 dark:to-slate-900 shadow transition-colors">
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Heavy Metal Pollution Indices</h2>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Interactive map, instant analysis, and exportable reports — built for rapid SIH demos.</p>
        <div className="mt-6 flex gap-4">
          <button
            onClick={() => setStage('upload')}
            className="px-6 py-3 rounded-lg bg-sky-600 text-white 
             hover:bg-sky-500 
             shadow-sm hover:shadow-md 
             transform hover:-translate-y-0.5 
             flex items-center gap-2 
             transition-all duration-200 ease-in-out"
          >
            <UploadCloud size={16} /> Upload CSV
          </button>

          <button
            onClick={() => setStage('analysis')}
            className="px-6 py-3 rounded-lg border dark:border-slate-600 
             bg-white dark:bg-slate-700 dark:text-white 
             hover:bg-slate-100 dark:hover:bg-slate-800 
             shadow-sm hover:shadow-md 
             transform hover:-translate-y-0.5 
             flex items-center gap-2 
             transition-all duration-200 ease-in-out"
          >
            <MapPin size={16} /> Open Demo Map
          </button>
        </div>
      </div>
      <div className="mt-8 grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-800 transition-colors">
          <h3 className="font-semibold dark:text-white">Quick Stats</h3>
          <p className="text-3xl mt-2 text-gray-900 dark:text-white">{samples.length} Samples</p>
        </div>
        <div className="p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-800 transition-colors">
          <h3 className="font-semibold text-gray-900 dark:text-white">Unsafe Percentage</h3>
          <p className="text-3xl mt-2 text-gray-900 dark:text-white">{stats.percentages.Unsafe}%</p>
        </div>
        <div className="p-4 rounded-xl border dark:border-slate-700 dark:bg-slate-800 transition-colors">
          <h3 className="font-semibold text-gray-900 dark:text-white">Top Polluted</h3>
          <p className="text-2xl mt-2 text-gray-900 dark:text-white">{samples.slice().sort((a, b) => b.index - a.index)[0]?.Location || '—'}</p>
        </div>
      </div>
    </motion.div>
  );

  const Upload = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <div onDrop={handleDrop} onDragOver={handleDragOver} className="border-dashed border-2 rounded-xl p-6 text-center dark:border-slate-600 dark:bg-slate-800 transition-colors">
            <p className="text-sm text-slate-600 dark:text-slate-300">Drag & drop CSV file here</p>
            <p className="mt-4 text-xs text-slate-500">Columns: Location, Latitude, Longitude, Fe, Mn, As, Pb, Cd</p>
            <div className="mt-4 flex items-center justify-center">
              <button
                onClick={() => fileInputRef.current.click()}
                className="px-4 py-2 rounded-md border dark:border-slate-600 dark:bg-slate-700 dark:text-white 
             bg-white hover:bg-gray-100 dark:hover:bg-slate-600 
             shadow-sm hover:shadow-md 
             transform hover:-translate-y-0.5 
             flex items-center gap-2 transition-all duration-200 ease-in-out"
              >
                <UploadCloud size={16} /> Choose file
              </button>
            </div>
            <input ref={fileInputRef} onChange={handleFileSelect} type="file" accept=".csv" className="hidden" />
            {filePreview && <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">Selected: <strong>{filePreview}</strong></p>}
          </div>
          {rawRows && rawRows.length > 0 && (
            <div className="mt-4 p-3 rounded border dark:border-slate-700 dark:bg-slate-800 max-h-60 overflow-auto transition-colors">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <tr>{Object.keys(rawRows[0]).slice(0, 8).map(h => <th key={h} className="pr-3">{h}</th>)}</tr>
                </thead>
                <tbody className="text-slate-700 dark:text-slate-200">
                  {rawRows.slice(0, 8).map((r, i) => (
                    <tr key={i} className="border-t dark:border-slate-700">
                      {Object.values(r).slice(0, 8).map((v, ii) => <td key={ii} className="py-1 text-xs pr-3">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Preview & Analysis</h3>
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">After upload, the demo computes HMPI using WHO standards locally.</p>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['All', 'Fe', 'Mn', 'As', 'Pb', 'Cd'].map(m => (
              <button
                key={m}
                onClick={() => setFilter(s => ({ ...s, metal: m }))}
                className={`p-2 rounded transition-colors ${filter.metal === m ? 'bg-sky-600 text-white' : 'border dark:border-slate-600 dark:bg-slate-700 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-600'}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="text-xs text-slate-700 dark:text-slate-300">Category</label>
            <select value={filter.category} onChange={e => setFilter(s => ({ ...s, category: e.target.value }))} className="mt-2 w-full p-2 border rounded dark:bg-slate-800 dark:border-slate-600 dark:text-white">
              <option>All</option>
              <option>Safe</option>
              <option>Moderate</option>
              <option>Unsafe</option>
            </select>
          </div>
          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setStage('analysis')}
              className="px-4 py-2 rounded bg-green-600 text-white 
             hover:bg-green-500 
             shadow-sm hover:shadow-md 
             transform hover:-translate-y-0.5 
             flex items-center gap-2 
             transition-all duration-200 ease-in-out"
            >
              <BarChart2 size={16} /> Compute
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const Analysis = () => (
    <div
      ref={reportRef}
      id="report-section"
      className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 text-slate-900 dark:text-slate-100"
    >
      {/* Map Section */}
      <div className="lg:col-span-2">
        <div className="relative rounded-xl border p-4 h-[70vh] dark:bg-slate-800 dark:border-slate-700 transition-colors">
          <h3 className="font-semibold mb-2 text-slate-900 dark:text-white -mt-4">Interactive Map</h3>

          <MapContainer center={[28.7041, 77.1025]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filteredSamples().map(s => (
              <Marker
                key={s.id}
                position={[s.Latitude, s.Longitude]}
                icon={getMarkerIcon(s.category)}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{s.Location}</strong><br />
                    Fe: {s.Fe}, Mn: {s.Mn}, As: {s.As}, Pb: {s.Pb}, Cd: {s.Cd}<br />
                    HPI: {s.index} ({s.category})
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Legend */}
          <div className="absolute top-8 right-4 bg-white dark:bg-slate-900 bg-opacity-90 dark:bg-opacity-90 p-3 rounded shadow text-sm z-[999] text-black dark:text-white border dark:border-slate-700">
            <h4 className="font-semibold mb-2">Legend</h4>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS.Safe }}></span> Safe
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS.Moderate }}></span> Moderate
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ background: CATEGORY_COLORS.Unsafe }}></span> Unsafe
            </div>
          </div>
        </div>
      </div>

      {/* Summary Stats Section */}
      <div className="rounded-xl border p-4 dark:bg-slate-800 dark:border-slate-700 transition-colors">
        <h3 className="font-semibold mb-2 text-slate-900 dark:text-white">Summary Statistics</h3>
        <p className="text-slate-700 dark:text-slate-200">Total Samples: {samples.length}</p>
        <p className="text-slate-700 dark:text-slate-200">Safe: {stats.counts.Safe} ({stats.percentages.Safe}%)</p>
        <p className="text-slate-700 dark:text-slate-200">Moderate: {stats.counts.Moderate} ({stats.percentages.Moderate}%)</p>
        <p className="text-slate-700 dark:text-slate-200">Unsafe: {stats.counts.Unsafe} ({stats.percentages.Unsafe}%)</p>

        {/* Pie Chart */}
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[
                  { name: 'Safe', value: stats.counts.Safe },
                  { name: 'Moderate', value: stats.counts.Moderate },
                  { name: 'Unsafe', value: stats.counts.Unsafe },
                ]}
                dataKey="value"
                nameKey="name"
                outerRadius={80}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}

                labelLine={true}
              >
                {['Safe', 'Moderate', 'Unsafe'].map((c, i) => (
                  <Cell key={i} fill={CATEGORY_COLORS[c]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1f2937', // dark: slate-800
                  borderColor: '#334155', // dark: slate-700
                  color: '#fff'
                }}
                itemStyle={{
                  color: '#fff' // tooltip item text white
                }}
                labelStyle={{
                  color: '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Export Button */}
        <div className="mt-4">
          <button
            onClick={exportReport}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded flex items-center justify-center gap-2"
          >
            <Download size={14} /> Export Report
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-slate-900 dark:text-slate-100 transition-colors duration-300">

      <Header />
      <main>
        {stage === 'landing' && <Landing />}
        {stage === 'upload' && <Upload />}
        {stage === 'analysis' && <Analysis />}
      </main>

      <footer className="p-4 text-center text-sm text-slate-500 dark:text-slate-400 border-t dark:border-slate-700 bg-white dark:bg-slate-900 transition-colors">
        SIH Prototype • HMPI Dashboard By BroCode — WHO Standard Compliant
      </footer>
    </div>
  );
}