import { useState, useEffect, useRef } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
import { db } from "../firebase";
import { collection, onSnapshot } from "firebase/firestore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function RegionalAnalysis() {
  const [regionalData, setRegionalData] = useState({ regions: [], chartData: null });
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");
  const [error, setError] = useState("");
  const chartRef = useRef(null);
  const yearsList = ["2020", "2021", "2022", "2023", "2024", "2025"];

  // Cleanup chart instance
  useEffect(() => {
    return () => {
      if (chartRef.current?.chartInstance) {
        chartRef.current.chartInstance.destroy();
      }
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regions"), (snapshot) => {
      const regionsData = snapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter((region) => {
          if (!region.region || typeof region.region !== "string") {
            console.warn(`Invalid region document: ${region.id}`, region);
            return false;
          }
          return true;
        });

      const regions = regionsData.map((region) => {
        const yearEntry = region.yearlyData?.find((y) => y.year === parseInt(selectedYear)) || {};
        return {
          region: region.region,
          taxpayers: yearEntry.taxpayers || 0,
          averageTax: isNaN(yearEntry.averageTax) ? 0 : yearEntry.averageTax || 0,
          totalTax: isNaN(yearEntry.totalTax) ? 0 : yearEntry.totalTax || 0,
          complianceRate: isNaN(yearEntry.complianceRate)
            ? 0
            : Math.max(0, Math.min(1, yearEntry.complianceRate || 0)),
          salaryTaxpayers: yearEntry.salaryTaxpayers || 0,
          eVatTaxpayers: yearEntry.eVatTaxpayers || 0,
          otherTaxpayers: yearEntry.otherTaxpayers || 0,
        };
      });

      if (regions.length === 0 || regions.every((r) => r.taxpayers === 0 && r.averageTax === 0 && r.totalTax === 0)) {
        setError(`No data available for ${selectedYear}. Please select another year or check Firestore.`);
        setRegionalData({ regions: [], chartData: null });
        return;
      }

      const chartData = {
        labels: regions.map((r) => r.region),
        datasets: [
          {
            label: "Average Tax Paid (GHS)",
            data: regions.map((r) => r.averageTax),
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 300);
              gradient.addColorStop(0, '#3B82F6');
              gradient.addColorStop(1, '#8B5CF6');
              return gradient;
            },
            borderColor: '#3B82F6',
            borderWidth: 1,
            borderRadius: 8,
            barPercentage: 0.45, // Thicker bars
            categoryPercentage: 0.9, // Less gap between bars
            hoverBackgroundColor: '#14B8A6',
            yAxisID: 'y',
          },
          {
            label: "Compliance Rate (%)",
            data: regions.map((r) => r.complianceRate * 100),
            backgroundColor: (context) => {
              const ctx = context.chart.ctx;
              const gradient = ctx.createLinearGradient(0, 0, 0, 300);
              gradient.addColorStop(0, '#14B8A6');
              gradient.addColorStop(1, '#34D399');
              return gradient;
            },
            borderColor: '#14B8A6',
            borderWidth: 1,
            borderRadius: 8,
            barPercentage: 0.45, // Thicker bars
            categoryPercentage: 0.9, // Less gap between bars
            hoverBackgroundColor: '#3B82F6',
            yAxisID: 'y1',
          },
        ],
      };

      setRegionalData({ regions, chartData });
      setError("");
    }, (err) => {
      console.error("Error fetching Firestore data:", err);
      setError("Failed to load data. Please try again.");
    });

    return () => unsubscribe();
  }, [selectedYear]);

  const handleRegionClick = (region) => {
    setSelectedRegion(region);
  };

  const clearSelection = () => {
    setSelectedRegion(null);
  };

  const clearSearch = () => {
    setSearchQuery("");
  };

  const filteredRegions = regionalData.regions
    .filter((region) => {
      if (activeTab === "high") return region.complianceRate >= 0.8;
      if (activeTab === "medium") return region.complianceRate >= 0.5 && region.complianceRate < 0.8;
      if (activeTab === "low") return region.complianceRate < 0.5;
      return true;
    })
    .filter((region) => region.region.toLowerCase().includes(searchQuery.toLowerCase()));

  const exportToCSV = () => {
    if (filteredRegions.length === 0) {
      alert("No data to export!");
      return;
    }

    const headers = [
      "Region",
      "Taxpayers",
      "Avg. Tax (GHS)",
      "Total Tax (GHS)",
      "Compliance (%)",
      "Salary (%)",
      "E-VAT (%)",
    ];
    const rows = filteredRegions.map((region) => [
      `"${region.region}"`,
      region.taxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.averageTax.toLocaleString("en-US", { useGrouping: false }),
      region.totalTax.toLocaleString("en-US", { useGrouping: false }),
      (region.complianceRate * 100).toFixed(1),
      (region.taxpayers ? (region.salaryTaxpayers / region.taxpayers) * 100 : 0).toFixed(1),
      (region.taxpayers ? (region.eVatTaxpayers / region.taxpayers) * 100 : 0).toFixed(1),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `regional_tax_data_${selectedYear}_${date}.csv`);
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
          color: '#E5E7EB',
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(30, 64, 175, 0.9)',
        titleFont: { size: 14, family: "'Inter', sans-serif", weight: "600" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 12,
        cornerRadius: 8,
        boxPadding: 6,
        callbacks: {
          label: (context) =>
            `${context.dataset.label}: ${context.raw.toFixed(
              context.dataset.label.includes("%") ? 1 : 0
            )}${context.dataset.label.includes("GHS") ? " GHS" : "%"}`,
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        position: 'left',
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        ticks: {
          font: { size: 12, family: "'Inter', sans-serif" },
          color: '#E5E7EB',
          padding: 10,
          callback: (value) => `GHS ${value.toLocaleString()}`,
        },
        title: {
          display: true,
          text: 'Average Tax (GHS)',
          color: '#E5E7EB',
          font: { size: 12, family: "'Inter', sans-serif" },
        },
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        grid: { display: false },
        ticks: {
          font: { size: 12, family: "'Inter', sans-serif" },
          color: '#E5E7EB',
          padding: 10,
          callback: (value) => `${value}%`,
        },
        title: {
          display: true,
          text: 'Compliance Rate (%)',
          color: '#E5E7EB',
          font: { size: 12, family: "'Inter', sans-serif" },
        },
        max: 100,
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: '#E5E7EB', padding: 10 },
      },
    },
    interaction: { mode: "index", intersect: false },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart',
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 pt-20">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Regional Tax Analysis</h1>
            <p className="text-base text-gray-300 mt-2">Comparative metrics across Ghana’s regions ({selectedYear})</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
            >
              {yearsList.map((year) => (
                <option key={year} value={year} className="bg-gray-900">{year}</option>
              ))}
            </select>
            <div className="px-3 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-gray-300 flex items-center backdrop-blur-md">
              <svg className="w-5 h-5 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 focus:ring-2 focus:ring-blue-500 flex items-center transform hover:scale-[1.02] transition-all"
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
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-lg text-sm flex items-center">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}

        {/* Chart Section */}
        {regionalData.chartData ? (
          <div className="mb-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Regional Performance Overview ({selectedYear})</h2>
                <p className="text-sm text-gray-300 mt-1">Average tax and compliance by region</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700">
                  Annual
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20">
                  Quarterly
                </button>
              </div>
            </div>
            <div className="h-80">
              <Bar ref={chartRef} data={regionalData.chartData} options={chartOptions} />
            </div>
          </div>
        ) : (
          <div className="mb-8 bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 shadow-xl text-center text-gray-300">
            No chart data available for {selectedYear}.
          </div>
        )}

        {/* Region Details Panel */}
        {selectedRegion && (
          <div className="mb-8 bg-white/10 backdrop-blur-lg p-6 rounded-xl border border-white/20 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">{selectedRegion.region} Region</h2>
                <p className="text-sm text-gray-300 mt-1">Detailed taxpayer metrics ({selectedYear})</p>
              </div>
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 flex items-center transform hover:scale-[1.02] transition-all"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white/10 backdrop-blur-lg p-4 rounded-lg border border-white/20 hover:shadow-xl transition-all">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Taxpayer Demographics</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Total Taxpayers</p>
                    <p className="text-lg font-semibold text-white">{selectedRegion.taxpayers.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Salary</p>
                      <p className="font-medium text-white">
                        {selectedRegion.salaryTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.salaryTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">E-VAT</p>
                      <p className="font-medium text-white">
                        {selectedRegion.eVatTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.eVatTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Other</p>
                      <p className="font-medium text-white">
                        {selectedRegion.otherTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.otherTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg p-4 rounded-lg border border-white/20 hover:shadow-xl transition-all">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Tax Revenue</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Total Tax Collected</p>
                    <p className="text-lg font-semibold text-white">GHS {selectedRegion.totalTax.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Average Tax Paid</p>
                    <p className="font-medium text-white">GHS {selectedRegion.averageTax.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-lg p-4 rounded-lg border border-white/20 hover:shadow-xl transition-all">
                <h3 className="text-sm font-medium text-gray-300 mb-2">Compliance Metrics</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Compliance Rate</p>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-600 rounded-full h-2 mr-2">
                        <div
                          className={`h-2 rounded-full ${selectedRegion.complianceRate >= 0.8 ? "bg-green-400" : selectedRegion.complianceRate >= 0.5 ? "bg-yellow-400" : "bg-red-400"}`}
                          style={{ width: `${selectedRegion.complianceRate * 100}%` }}
                        ></div>
                      </div>
                      <span className="font-medium text-white">{(selectedRegion.complianceRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Compliance Ranking</p>
                    <p className="font-medium text-white">
                      #{regionalData.regions
                        .sort((a, b) => b.complianceRate - a.complianceRate)
                        .findIndex((r) => r.region === selectedRegion.region) + 1}{" "}
                      of {regionalData.regions.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Regions Table */}
        {regionalData.regions && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/20 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">Regional Tax Data ({selectedYear})</h2>
                <p className="text-sm text-gray-300 mt-1">Click any row for detailed metrics</p>
              </div>
              <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
                <div className="relative">
                  <svg
                    className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search regions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 py-2 text-sm bg-white/10 border border-white/20 rounded-lg text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                  />
                  {searchQuery && (
                    <button
                      onClick={clearSearch}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activeTab === "all"
                        ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    } transition-colors`}
                  >
                    All Regions
                  </button>
                  <button
                    onClick={() => setActiveTab("high")}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activeTab === "high"
                        ? "bg-gradient-to-r from-green-500 to-teal-500 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    } transition-colors`}
                  >
                    High Compliance
                  </button>
                  <button
                    onClick={() => setActiveTab("medium")}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activeTab === "medium"
                        ? "bg-gradient-to-r from-yellow-500Senate Judiciary Committee to-teal-500 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    } transition-colors`}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setActiveTab("low")}
                    className={`px-3 py-1.5 text-sm rounded-lg ${
                      activeTab === "low"
                        ? "bg-gradient-to-r from-red-500 to-teal-500 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    } transition-colors`}
                  >
                    Low
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/20">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      { label: "Region" },
                      { label: "Taxpayers" },
                      { label: "Avg. Tax (GHS)" },
                      { label: "Total Tax (GHS)" },
                      { label: "Compliance" },
                      { label: "Salary %" },
                      { label: "E-VAT %" },
                    ].map((header) => (
                      <th
                        key={header.label}
                        className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider"
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/20">
                  {filteredRegions.length > 0 ? (
                    filteredRegions.map((region) => (
                      <tr
                        key={region.region}
                        onClick={() => handleRegionClick(region)}
                        className={`cursor-pointer transition-colors ${
                          selectedRegion?.region === region.region ? "bg-blue-500/20" : "hover:bg-white/10"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-blue-400 font-medium">{region.region.substring(0, 2)}</span>
                            </div>
                            <div className="ml-4 flex items-center">
                              <span className="font-medium text-white">{region.region}</span>
                              {region.complianceRate >= 0.8 && (
                                <span className="ml-2 px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">High</span>
                              )}
                              {region.complianceRate >= 0.5 && region.complianceRate < 0.8 && (
                                <span className="ml-2 px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded-full">Medium</span>
                              )}
                              {region.complianceRate < 0.5 && (
                                <span className="ml-2 px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded-full">Low</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{region.taxpayers.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.averageTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.totalTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-600 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  region.complianceRate >= 0.8 ? "bg-green-400" : region.complianceRate >= 0.5 ? "bg-yellow-400" : "bg-red-400"
                                }`}
                                style={{ width: `${region.complianceRate * 100}%` }}
                              ></div>
                            </div>
                            <span className="text-sm text-white">{(region.complianceRate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {(region.taxpayers ? (region.salaryTaxpayers / region.taxpayers) * 100 : 0).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {(region.taxpayers ? (region.eVatTaxpayers / region.taxpayers) * 100 : 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-400">
                        No regions found matching "{searchQuery}" for {activeTab} compliance
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-white/20 bg-white/5 flex items-center justify-between">
              <div className="text-sm text-gray-300">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredRegions.length}</span> of{" "}
                <span className="font-medium">{regionalData.regions.length}</span> regions
              </div>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg hover:from-blue-600 hover:to-indigo-700 flex items-center transform hover:scale-[1.02] transition-all"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Full Report
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl opacity-10"></div>
      </div>
    </div>
  );
}

export default RegionalAnalysis;