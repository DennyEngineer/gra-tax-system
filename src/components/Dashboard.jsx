import { useState, useEffect, useRef } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// GRA color scheme
const colors = {
  primary: "#006837", // GRA Green
  secondary: "#FFC72C", // GRA Gold/Yellow
  accent: "#00A651", // Lighter green
  dark: "#333333", // Dark gray (not pure black for softer look)
  light: "#F5F5F5", // Light background
  white: "#FFFFFF",
  gray: "#718096",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  lightGray: "#E2E8F0",
};

function Dashboard() {
  const [metrics, setMetrics] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: "taxpayers", direction: "desc" });
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [error, setError] = useState("");
  const chartRef = useRef(null);
  const yearsList = ["2020", "2021", "2022", "2023", "2024", "2025"];

  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regions"), (snapshot) => {
      const regionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const regionalMetrics = regionsData.map((region) => {
        const yearEntry = region.yearlyData?.find((y) => y.year === parseInt(selectedYear)) || {};
        return {
          region: region.region,
          taxpayers: yearEntry.taxpayers || 0,
          totalTax: yearEntry.totalTax || 0,
          averageTax: yearEntry.averageTax || 0,
          complianceRate: yearEntry.complianceRate || 0,
        };
      });

      const totalTaxpayers = regionalMetrics.reduce((sum, r) => sum + r.taxpayers, 0);
      const totalTax = regionalMetrics.reduce((sum, r) => sum + r.totalTax, 0);
      const avgTax = totalTaxpayers ? totalTax / totalTaxpayers : 0;
      const avgCompliance = totalTaxpayers
        ? regionalMetrics.reduce((sum, r) => sum + r.complianceRate * r.taxpayers, 0) / totalTaxpayers
        : 0;

      const chartData = {
        labels: regionalMetrics.map((r) => r.region),
        datasets: [
          {
            label: "Taxpayers by Region",
            data: regionalMetrics.map((r) => r.taxpayers),
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            borderWidth: 0,
            borderRadius: 4,
            barPercentage: 0.7,
            hoverBackgroundColor: colors.accent,
          },
        ],
      };

      setMetrics({ totalTaxpayers, totalTax, avgTax, avgCompliance, chartData, regionalMetrics });
    }, (err) => {
      console.error("Error fetching Firestore data:", err);
      setError("Failed to load data. Please try again.");
    });

    return () => unsubscribe();
  }, [selectedYear]);

  const sortData = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    setSortConfig({ key, direction });

    const sortedMetrics = [...metrics.regionalMetrics].sort((a, b) => {
      if (key === "region") {
        return direction === "asc" ? a[key].localeCompare(b[key]) : b[key].localeCompare(a[key]);
      }
      return direction === "asc" ? a[key] - b[key] : b[key] - a[key];
    });

    setMetrics({ ...metrics, regionalMetrics: sortedMetrics });
  };

  const filteredMetrics = metrics.regionalMetrics?.filter((region) =>
    region.region.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const clearSearch = () => {
    setSearchQuery("");
  };

  const exportToCSV = () => {
    if (filteredMetrics.length === 0) {
      alert("No data to export!");
      return;
    }

    const headers = ["Region", "Taxpayers", "Avg. Tax (GHS)", "Total Tax (GHS)", "Compliance (%)"];
    const rows = filteredMetrics.map((region) => [
      `"${region.region}"`,
      region.taxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.averageTax.toLocaleString("en-US", { useGrouping: false }),
      region.totalTax.toLocaleString("en-US", { useGrouping: false }),
      (region.complianceRate * 100).toFixed(1),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `taxpayer_data_${selectedYear}_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          font: { size: 14, family: "'Inter', sans-serif" },
          color: colors.dark,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: colors.dark,
        titleFont: { size: 14, family: "'Inter', sans-serif", weight: "600" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 12,
        cornerRadius: 4,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.raw.toLocaleString()}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: { color: colors.lightGray },
        ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: colors.dark, padding: 10 },
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: colors.dark, padding: 10 },
      },
    },
    animation: {
      duration: 800,
      easing: 'easeOutQuart',
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200" style={{ backgroundColor: colors.primary }}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center">
          <h1 className="text-xl font-bold text-white flex items-center">
            <svg viewBox="0 0 24 24" width="24" height="24" className="mr-2">
              <rect width="24" height="24" fill={colors.primary} />
              <path d="M5,5 L19,5 L19,19 L5,19 Z" fill={colors.secondary} />
              <circle cx="12" cy="12" r="4" fill={colors.primary} />
            </svg>
            Ghana Revenue Authority
          </h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-16">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: colors.dark }}>National Taxpayer Dashboard</h2>
            <p className="text-sm text-gray-600 mt-1">Real-time insights into Ghana's tax ecosystem ({selectedYear})</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              {yearsList.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            <div className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-600 flex items-center">
              <svg className="w-5 h-5 text-gray-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-opacity-90"
              style={{ backgroundColor: colors.primary }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Report
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-3 bg-red-100 border border-red-200 text-red-800 rounded-md text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            {
              title: "Total Taxpayers",
              value: metrics.totalTaxpayers?.toLocaleString() || "0",
              change: "12.5% from last year",
              changeType: "positive",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ),
            },
            {
              title: "Total Tax Paid",
              value: `GHS ${metrics.totalTax?.toLocaleString() || "0"}`,
              change: "18.3% from last year",
              changeType: "positive",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              title: "Avg. Tax Paid",
              value: `GHS ${metrics.avgTax?.toFixed(2) || "0.00"}`,
              change: "5.2% from last year",
              changeType: "positive",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              ),
            },
            {
              title: "Compliance Rate",
              value: `${(metrics.avgCompliance * 100)?.toFixed(1) || "0.0"}%`,
              change: "2.1% from last year",
              changeType: "negative",
              icon: (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: colors.primary }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              ),
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-white rounded-md p-6 border border-gray-200 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.title}</p>
                  <p className="text-2xl font-semibold mt-1" style={{ color: colors.dark }}>{card.value}</p>
                  <div className={`flex items-center text-sm ${card.changeType === "positive" ? "text-green-600" : "text-red-600"} mt-2`}>
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={card.changeType === "positive" ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"}
                      />
                    </svg>
                    <span>{card.change}</span>
                  </div>
                </div>
                <div className="p-3 rounded-md" style={{ backgroundColor: `${colors.primary}10` }}>{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section */}
        {metrics.chartData && (
          <div className="mb-8 bg-white rounded-md p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>Taxpayer Distribution by Region ({selectedYear})</h2>
                <p className="text-sm text-gray-500 mt-1">Registered taxpayers across Ghana's regions</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-white rounded-md" style={{ backgroundColor: colors.primary }}>
                  Annual
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                  Quarterly
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                  Monthly
                </button>
              </div>
            </div>
            <div className="h-80">
              <Bar ref={chartRef} data={metrics.chartData} options={chartOptions} />
            </div>
          </div>
        )}

        {/* Table Section */}
        {metrics.regionalMetrics && (
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>Regional Tax Data ({selectedYear})</h2>
                <p className="text-sm text-gray-500 mt-1">Detailed breakdown by administrative region</p>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center space-x-3">
                <div className="relative">
                  <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search regions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Filters
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[
                      { key: "region", label: "Region" },
                      { key: "taxpayers", label: "Taxpayers" },
                      { key: "averageTax", label: "Avg. Tax (GHS)" },
                      { key: "totalTax", label: "Total Tax (GHS)" },
                      { key: "complianceRate", label: "Compliance" },
                    ].map((header) => (
                      <th
                        key={header.key}
                        onClick={() => sortData(header.key)}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-green-600"
                      >
                        <div className="flex items-center">
                          {header.label}
                          <svg
                            className={`w-4 h-4 ml-1 ${sortConfig.key === header.key ? "opacity-100" : "opacity-0"} ${sortConfig.direction === "asc" ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMetrics.length > 0 ? (
                    filteredMetrics.map((region) => (
                      <tr key={region.region} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${colors.primary}15` }}>
                              <span style={{ color: colors.primary }} className="font-medium text-sm">{region.region.substring(0, 2)}</span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{region.region}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{region.taxpayers.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{metrics.totalTaxpayers ? ((region.taxpayers / metrics.totalTaxpayers) * 100).toFixed(1) : "0.0"}%</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{region.averageTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{region.totalTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="h-2 rounded-full"
                                style={{ 
                                  width: `${region.complianceRate * 100}%`,
                                  backgroundColor: region.complianceRate >= 0.8 ? colors.success : region.complianceRate >= 0.5 ? colors.warning : colors.danger
                                }}
                              ></div>
                            </div>
                            <span className="text-sm text-gray-900">{(region.complianceRate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-4 text-center text-sm text-gray-500">
                        No regions found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredMetrics.length}</span> of{" "}
                <span className="font-medium">{metrics.regionalMetrics?.length}</span> regions
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                  Previous
                </button>
                <button className="px-4 py-2 text-sm font-medium text-white rounded-md hover:bg-opacity-90" style={{ backgroundColor: colors.primary }}>
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <footer className="py-6 border-t border-gray-200" style={{ backgroundColor: colors.primary }}>
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center">
              <svg viewBox="0 0 24 24" width="24" height="24" className="mr-2">
                <rect width="24" height="24" fill={colors.primary} />
                <path d="M5,5 L19,5 L19,19 L5,19 Z" fill={colors.secondary} />
                <circle cx="12" cy="12" r="4" fill={colors.primary} />
              </svg>
              <span className="text-white text-sm">Ghana Revenue Authority © {new Date().getFullYear()}</span>
            </div>
            <div className="mt-4 md:mt-0">
              <span className="text-white text-sm">Dashboard last updated: {new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Dashboard;