// /* SIH HMPI Frontend Starter (React + Tailwind + Leaflet + Recharts + Framer Motion + shadcn)

// Purpose:
// Single-file starter React component (default export) that implements:
// - Landing + upload UI (drag & drop + preview)
// - Map (react-leaflet) with color-coded markers & popups
// - Simple charts (Recharts) for Safe/Moderate/Unsafe counts
// - Mock data + hooks to connect to backend endpoints
// - Smooth UI polish with Framer Motion and Tailwind

// Important: This is a starter file you can paste into a Vite + React project (or into your src/App.jsx).
// Dependencies to install (npm or yarn): 
// npm i react react-dom 
// npm i -D vite 
// npm i tailwindcss postcss autoprefixer && npx tailwindcss init -p 
// npm i react-leaflet leaflet 
// npm i recharts 
// npm i framer-motion 
// npm i papaparse 
// npm i @shadcn/ui lucide-react

// Tailwind: make sure you enable the content paths and import the base styles in index.css 
// Leaflet: remember to import Leaflet css somewhere globally: "import 'leaflet/dist/leaflet.css'"

// How to use:
// 1. Place this file as src/App.jsx or paste component into your app.
// 2. Start the dev server and open localhost:5173 (Vite default).
// 3. Replace the mock API hooks with your Django API endpoints (/upload, /compute, /samples).
// */



import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, ScatterChart, Scatter, ZAxis } from 'recharts';
import { motion } from 'framer-motion';
import { Download, UploadCloud, MapPin, BarChart2, Send, Moon, Sun } from 'lucide-react';

// DIFFERENT PERMISSIBLE LIMIT STANDARDS

const STANDARDS = {
  WHO: {
    Fe: { standard: 300, ideal: 0 },
    Mn: { standard: 100, ideal: 0 },
    As: { standard: 10, ideal: 0 },
    Pb: { standard: 10, ideal: 0 },
    Cd: { standard: 3, ideal: 0 }
  },
  USEPA: {
    Fe: { standard: 200, ideal: 0 },
    Mn: { standard: 50, ideal: 0 },
    As: { standard: 10, ideal: 0 },
    Pb: { standard: 15, ideal: 0 },
    Cd: { standard: 5, ideal: 0 }
  },
  ICMR: {
    Fe: { standard: 300, ideal: 0 },
    Mn: { standard: 100, ideal: 0 },
    As: { standard: 50, ideal: 0 },
    Pb: { standard: 100, ideal: 0 },
    Cd: { standard: 10, ideal: 0 }
  },
  CGWB: {
    Fe: { standard: 300, ideal: 0 },
    Mn: { standard: 100, ideal: 0 },
    As: { standard: 10, ideal: 0 },
    Pb: { standard: 10, ideal: 0 },
    Cd: { standard: 3, ideal: 0 }
  }
};


// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.3/dist/images/marker-shadow.png',
});

const CATEGORY_COLORS = { Safe: '#16a34a', Moderate: '#f59e0b', Unsafe: '#ef4444' };

function getMarkerIcon(category) {
  const colors = { Safe: '#16a34a', Moderate: '#f59e0b', Unsafe: '#ef4444' };
  return L.divIcon({
    className: 'custom-marker-icon',
    html: `<div style="background-color: ${colors[category]}; width: 18px; height: 18px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 2px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

// ============================================
// CALCULATION METHODS - Different Pollution Indices
// ============================================

// 1. HPI (Heavy Metal Pollution Index) - WHO/CGWB Method
function calculateHPI(metalData, standards) {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [metal, limits] of Object.entries(standards)) {
    const concentration = metalData[metal] || 0;
    const Wi = 1 / limits.standard;  // Unit weight
    const Qi = ((concentration - limits.ideal) / (limits.standard - limits.ideal)) * 100;
    weightedSum += Wi * Qi;
    totalWeight += Wi;
  }

  return weightedSum / totalWeight;
}

// 2. HEI (Heavy Metal Evaluation Index)
// Formula: HEI = Σ(Ci / Si)
// Where: Ci = measured concentration, Si = standard limit
function calculateHEI(metalData, standards) {
  let sum = 0;
  let count = 0;

  for (const [metal, limits] of Object.entries(standards)) {
    const concentration = metalData[metal] || 0;
    sum += concentration / limits.standard;
    count++;
  }

  return (sum / count) * 100; // Multiply by 100 for percentage
}

// 3. CD (Contamination Degree)
// Formula: CD = Σ(Ci / Si - 1)
// Measures how much concentration exceeds the standard
function calculateCD(metalData, standards) {
  let sum = 0;

  for (const [metal, limits] of Object.entries(standards)) {
    const concentration = metalData[metal] || 0;
    const cf = (concentration / limits.standard) - 1; // Contamination factor
    sum += Math.max(0, cf); // Only count if exceeds standard
  }

  return sum;
}

// 4. Degree of Contamination (mCd)
// Formula: mCd = Σ(Cfi) / n
// Where: Cfi = (Ci / Si) - contamination factor for each metal
function calculateDegreeOfContamination(metalData, standards) {
  let sum = 0;
  let count = 0;

  for (const [metal, limits] of Object.entries(standards)) {
    const concentration = metalData[metal] || 0;
    const cfi = concentration / limits.standard;
    sum += cfi;
    count++;
  }

  return sum / count;
}

// Main function that routes to the correct calculation method
// function computeIndexFromRow(row, method = 'HPI') {
//   // WHO/CGWB standards (all values in μg/L or ppb)
//   const standards = {
//     Fe: { standard: 300, ideal: 0 },
//     Mn: { standard: 100, ideal: 0 },
//     As: { standard: 10, ideal: 0 },
//     Pb: { standard: 10, ideal: 0 },
//     Cd: { standard: 3, ideal: 0 }
//   };

function computeIndexFromRow(row, method = 'HPI', standardType = 'WHO') {
  const standards = STANDARDS[standardType] || STANDARDS.WHO;


  // Extract metal data from row
  const metalData = {};
  for (const metal of Object.keys(standards)) {
    let concentration = parseFloat(
      row[metal] ||
      row[metal.toLowerCase()] ||
      row[metal.toUpperCase()] ||
      0
    );

    // Auto-convert mg/L to μg/L for trace metals
    if (['As', 'Pb', 'Cd'].includes(metal) && concentration < 1 && concentration > 0) {
      concentration = concentration * 1000;
    }

    metalData[metal] = concentration;
  }

  // Calculate index based on selected method
  let index = 0;
  switch (method) {
    case 'HPI':
      index = calculateHPI(metalData, standards);
      break;
    case 'HEI':
      index = calculateHEI(metalData, standards);
      break;
    case 'CD':
      index = calculateCD(metalData, standards);
      break;
    case 'DEGREE OF CONTAMINATION':
      index = calculateDegreeOfContamination(metalData, standards);
      break;
    default:
      index = calculateHPI(metalData, standards);
  }

  // Classify based on index value
  let category = 'Safe';
  if (index >= 100) {
    category = 'Unsafe';
  } else if (index >= 50) {
    category = 'Moderate';
  }

  console.log(`${row.Location || 'Sample'}: ${method} = ${index.toFixed(2)} (${category})`);

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
  const [samples, setSamples] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [calculationMethod, setCalculationMethod] = useState('HPI');
  const [permissibleLimit, setPermissibleLimit] = useState('WHO');
  const [filterOption, setFilterOption] = useState('View All Data');
  const [chatMessage, setChatMessage] = useState('');
  const [isDark, setIsDark] = useState(false);
  const fileInputRef = useRef();
  const [selectedLocation, setSelectedLocation] = useState("All");
  const [selectedClassification, setSelectedClassification] = useState("All");
  const [selectedMetal, setSelectedMetal] = useState("All");

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
      { Location: 'Well D', Latitude: 28.7000, Longitude: 77.0950, Fe: 80, Mn: 30, As: 1, Pb: 1, Cd: 0.3 },
      { Location: 'Well E', Latitude: 28.7150, Longitude: 77.1150, Fe: 350, Mn: 380, As: 12, Pb: 9, Cd: 3.5 },
    ];
    const enriched = mocked.map((r, i) => ({ id: i + 1, ...r, ...computeIndexFromRow(r, calculationMethod, permissibleLimit) }));
    setSamples(enriched);
  }, [calculationMethod, permissibleLimit]); // Re-calculate when method changes!

  const filteredSamples = samples.filter((s) => {
    const matchLocation = selectedLocation === "All" || s.Location === selectedLocation;

    const matchClass =
      selectedClassification === "All" || s.Classification === selectedClassification;

    const matchMetal =
      selectedMetal === "All" ||
      Object.keys(s).includes(selectedMetal);

    return matchLocation && matchClass && matchMetal;
  });

  async function handleFileSelect(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rows = await parseCsvFile(f);
    console.log('Parsed CSV rows:', rows);
    setRawRows(rows);

    const enriched = rows.map((r, idx) => {
      const coords = {
        Latitude: parseFloat(r.Latitude || r.latitude || r.lat || r.LAT) || 0,
        Longitude: parseFloat(r.Longitude || r.longitude || r.lon || r.LONG || r.LNG) || 0
      };

      const base = {
        id: idx + 1,
        Location: r.Location || r.location || r.LOCATION || r.name || r.NAME || `Sample ${idx + 1}`,
        ...coords,
        Fe: parseFloat(r.Fe || r.fe || r.FE || r.Iron || r.iron) || 0,
        Mn: parseFloat(r.Mn || r.mn || r.MN || r.Manganese || r.manganese) || 0,
        As: parseFloat(r.As || r.as || r.AS || r.Arsenic || r.arsenic) || 0,
        Pb: parseFloat(r.Pb || r.pb || r.PB || r.Lead || r.lead) || 0,
        Cd: parseFloat(r.Cd || r.cd || r.CD || r.Cadmium || r.cadmium) || 0
      };

      console.log('Processing row:', base);
      // Pass the selected calculation method to the computation
      return { ...base, ...computeIndexFromRow(base, calculationMethod, permissibleLimit) };
    });

    console.log('Enriched samples:', enriched);
    setSamples(enriched);
  }

  const toggleDarkMode = () => {
    setIsDark(!isDark);
  };

  const barChartData = filteredSamples.map(s => ({
    name: s.Location,
    HPI: s.index
  }));

  const counts = { Safe: 0, Moderate: 0, Unsafe: 0 };
  filteredSamples.forEach(s => counts[s.category]++);


  const trendData = filteredSamples.map((s, i) => ({
    sample: i + 1,
    HPI: s.index
  }));

  const scatterData = filteredSamples.map(s => ({
    x: s.Fe,
    y: s.index,
    z: 100
  }));

  return (
    <div className={`min-h-screen ${isDark ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} transition-colors duration-300`}>
      {/* Header */}
      <header className={`flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border-2 border-black rounded-full">
          <span className="font-semibold text-sm sm:text-lg">HMPI Calculator</span>
        </div>

        <nav className="hidden md:flex items-center gap-4 lg:gap-6">
          <button className="hover:text-blue-600 transition text-sm lg:text-base">Home</button>
          <button className="hover:text-blue-600 transition text-sm lg:text-base">Calculate</button>
          <button className="hover:text-blue-600 transition text-sm lg:text-base">Export</button>
          <button className="hover:text-blue-600 transition text-sm lg:text-base">About</button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full transition-colors duration-200 
             hover:bg-gray-100 dark:bg-gray-100 "

          >
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>


        </nav>

        {/* Mobile menu button */}
        <button onClick={toggleDarkMode} className="md:hidden p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      {/* Hero Section */}
      <section className="text-center py-8 sm:py-12 px-4 sm:px-6">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2">Heavy Metal Pollution Indices Calculator</h1>
        <p className={`text-sm sm:text-base lg:text-lg mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          Interactive maps, instant analysis, and exportable reports -<br className="hidden sm:block" />
          built for quick & efficient HMPI Calculations.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-6 sm:px-8 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            Upload CSV
          </button>
          <button className="w-full sm:w-auto px-6 sm:px-8 py-3 border-2 border-black rounded-full 
  bg-white text-black dark:bg-black dark:text-white 
  hover:bg-gray-200 dark:hover:bg-gray-700 transition text-sm sm:text-base">
            Open Tutorial
          </button>


        </div>
        <input ref={fileInputRef} onChange={handleFileSelect} type="file" accept=".csv" className="hidden" />
      </section>

      {/* Filters Section */}
      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 max-w-6xl mx-auto mb-4 sm:mb-6">
          <div>
            <label className="block text-xs sm:text-sm font-semibold mb-2">Calculation Methods:</label>
            <select
              value={calculationMethod}
              onChange={(e) => setCalculationMethod(e.target.value)}
              className={`w-full p-2 sm:p-3 border-2 rounded-lg text-sm sm:text-base ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option>HPI</option>
              <option>HEI</option>
              <option>CD</option>
              <option>DEGREE OF CONTAMINATION</option>
              <option>CUSTOM METHOD</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold mb-2">Permissible Limits:</label>
            <select
              value={permissibleLimit}
              onChange={(e) => setPermissibleLimit(e.target.value)}
              className={`w-full p-2 sm:p-3 border-2 rounded-lg text-sm sm:text-base ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option>WHO</option>
              <option>USEPA</option>
              <option>ICMR</option>
              <option>CUSTOM LIMITS</option>
              <option>ALL</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-1">
            <label className="block text-xs sm:text-sm font-semibold mb-2">Apply Filters:</label>
            <select
              value={filterOption}
              onChange={(e) => setFilterOption(e.target.value)}
              className={`w-full p-2 sm:p-3 border-2 rounded-lg text-sm sm:text-base ${isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-300'}`}
            >
              <option>View All Data</option>
              <option>Filter by Location</option>
              <option>Filter by Classification</option>
              <option>Filter by Metal</option>
              <option>View All Stats</option>
            </select>
          </div>
        </div>

        <div className="text-center">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full sm:w-auto px-8 sm:px-12 py-3 bg-black text-white rounded-full hover:bg-gray-800 transition font-semibold text-sm sm:text-base"
          >
            Upload CSV
          </button>
        </div>
      </section>

      {/* Charts Grid */}

      <section className="px-4 sm:px-6 py-6 sm:py-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold">
            Water Quality Analysis <span className="text-sm text-blue-500">({permissibleLimit})</span>
          </h2>
          <div className="flex flex-wrap gap-4 justify-center mt-4">
            {/* Location Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="border rounded-md p-2 bg-white text-black dark:bg-gray-900 dark:text-white dark:border-gray-700"
            >
              <option value="All" className="text-black dark:text-white">All Locations</option>
              {[...new Set(samples.map((s) => s.Location))].map((loc) => (
                <option key={loc} value={loc} className="text-black dark:text-white">{loc}</option>
              ))}
            </select>

            {/* Classification Filter */}
            <select
              value={selectedClassification}
              onChange={(e) => setSelectedClassification(e.target.value)}
              className="border rounded-md p-2 bg-white text-black dark:bg-gray-900 dark:text-white dark:border-gray-700"
            >
              <option value="All" className="text-black dark:text-white">All Classifications</option>
              <option value="Safe" className="text-black dark:text-white">Safe</option>
              <option value="Moderate" className="text-black dark:text-white">Moderate</option>
              <option value="Unsafe" className="text-black dark:text-white">Unsafe</option>
            </select>

            {/* Metal Type Filter */}
            <select
              value={selectedMetal}
              onChange={(e) => setSelectedMetal(e.target.value)}
              className="border rounded-md p-2 bg-white text-black dark:bg-gray-900 dark:text-white dark:border-gray-700"
            >
              <option value="All" className="text-black dark:text-white">All Metals</option>
              <option value="Fe" className="text-black dark:text-white">Fe</option>
              <option value="Mn" className="text-black dark:text-white">Mn</option>
              <option value="As" className="text-black dark:text-white">As</option>
              <option value="Pb" className="text-black dark:text-white">Pb</option>
              <option value="Cd" className="text-black dark:text-white">Cd</option>
            </select>

            {/* Clear Filters Button */}
            <button
              onClick={() => {
                setSelectedLocation("All");
                setSelectedClassification("All");
                setSelectedMetal("All");
              }}
              className="bg-gray-200 text-black dark:bg-gray-700 dark:text-white px-4 py-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Clear Filters
            </button>

            {/* Export Report Button
  <button
    onClick={handleExportReport}
    className="bg-blue-600 text-white dark:bg-blue-500 dark:text-white px-4 py-2 rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition"
  >
    Export Report
  </button> */}
          </div>


        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
          {/* Bar Chart */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold mb-3 text-sm sm:text-base">HPI by Location</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="HPI" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold mb-3 text-sm sm:text-base">Category Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Safe', value: counts.Safe },
                    { name: 'Moderate', value: counts.Moderate },
                    { name: 'Unsafe', value: counts.Unsafe },
                  ]}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  labelLine={false}
                >
                  {['Safe', 'Moderate', 'Unsafe'].map((c, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[c]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Line Chart */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold mb-3 text-sm sm:text-base">HPI Trend</h3>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="sample" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="HPI" stroke="#06b6d4" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Map */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'} md:col-span-2`}>
            <h3 className="font-semibold mb-3 text-sm sm:text-base">Geographic Distribution</h3>
            <div className="h-[250px] sm:h-[300px] rounded overflow-hidden">
              <MapContainer center={[28.7041, 77.1025]} zoom={12} style={{ height: '100%', width: '100%' }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {filteredSamples.map(s => (
                  <Marker key={s.id} position={[s.Latitude, s.Longitude]} icon={getMarkerIcon(s.category)}>
                    <Popup>
                      <div className="text-sm">
                        <strong>{s.Location}</strong><br />
                        HPI: {s.index} ({s.category})
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          </div>

          {/* Histogram */}
          <div className={`p-3 sm:p-4 rounded-lg border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'}`}>
            <h3 className="font-semibold mb-3 text-sm sm:text-base">HPI Distribution</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={barChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" hide />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="HPI" fill="#06b6d4" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Chat Interface */}
      <section className="px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
        <div className={`rounded-xl sm:rounded-2xl border-2 ${isDark ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-50'} p-4 sm:p-6`}>
          <p className={`text-xs sm:text-sm mb-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            <strong>Chat with CSV:</strong> Ask questions and get detailed text reports to save time using AI and semantic searching.
          </p>

          <div className={`flex gap-2 p-3 sm:p-4 rounded-xl ${isDark ? 'bg-gray-900' : 'bg-white'} border ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              placeholder="Ask a question..."
              className={`flex-1 outline-none text-sm sm:text-base ${isDark ? 'bg-gray-900 text-white placeholder-gray-500' : 'bg-white text-gray-900 placeholder-gray-400'}`}
            />
            <button className="px-4 sm:px-6 py-2 bg-black text-white rounded-full hover:bg-gray-800 transition flex items-center gap-2 text-sm sm:text-base whitespace-nowrap">
              <span className="hidden sm:inline">Send</span>
              <Send size={16} />
            </button>
          </div>

          <button className="mt-4 w-full flex items-center justify-center gap-2 text-xs sm:text-sm hover:underline">
            <Download size={14} /> Download Full Report
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className={`text-center py-4 sm:py-6 border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} mt-8 sm:mt-12 px-4`}>
        <p className={`text-xs sm:text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
          SIH Prototype • HMPI Dashboard By BroCode — WHO Standard Compliant
        </p>
      </footer>
    </div>
  );
}