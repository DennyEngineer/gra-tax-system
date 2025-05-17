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
  dark: "#333333", // Dark gray
  light: "#F5F5F5", // Light background
  white: "#FFFFFF",
  gray: "#718096",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  lightGray: "#E2E8F0",
};

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
            backgroundColor: colors.primary,
            borderColor: colors.primary,
            borderWidth: 0,
            borderRadius: 4,
            barPercentage: 0.45,
            categoryPercentage: 0.9,
            hoverBackgroundColor: colors.secondary,
            yAxisID: 'y',
          },
          {
            label: "Compliance Rate (%)",
            data: regions.map((r) => r.complianceRate * 100),
            backgroundColor: colors.success,
            borderColor: colors.success,
            borderWidth: 0,
            borderRadius: 4,
            barPercentage: 0.45,
            categoryPercentage: 0.9,
            hoverBackgroundColor: colors.secondary,
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
          color: colors.dark,
          padding: 20,
          usePointStyle: true,
        },
      },
      tooltip: {
        backgroundColor: colors.dark,
        titleFont: { size: 14, family: "'Inter', sans-serif", weight: "600" },
        bodyFont: { size: 13, family: "'Inter', sans-serif" },
        padding: 12,
        cornerRadius: 4,
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
        grid: { color: colors.lightGray },
        ticks: {
          font: { size: 12, family: "'Inter', sans-serif" },
          color: colors.dark,
          padding: 10,
          callback: (value) => `GHS ${value.toLocaleString()}`,
        },
        title: {
          display: true,
          text: 'Average Tax (GHS)',
          color: colors.dark,
          font: { size: 12, family: "'Inter', sans-serif" },
        },
      },
      y1: {
        beginAtZero: true,
        position: 'right',
        grid: { display: false },
        ticks: {
          font: { size: 12, family: "'Inter', sans-serif" },
          color: colors.dark,
          padding: 10,
          callback: (value) => `${value}%`,
        },
        title: {
          display: true,
          text: 'Compliance Rate (%)',
          color: colors.dark,
          font: { size: 12, family: "'Inter', sans-serif" },
        },
        max: 100,
      },
      x: {
        grid: { display: false },
        ticks: { font: { size: 12, family: "'Inter', sans-serif" }, color: colors.dark, padding: 10 },
      },
    },
    interaction: { mode: "index", intersect: false },
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
            <h2 className="text-2xl font-bold" style={{ color: colors.dark }}>Regional Tax Analysis</h2>
            <p className="text-sm text-gray-600 mt-1">Comparative metrics across Ghana’s regions ({selectedYear})</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
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
              className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-warning"
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

        {/* Chart Section */}
        {regionalData.chartData ? (
          <div className="mb-8 bg-white rounded-md p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>Regional Performance Overview ({selectedYear})</h2>
                <p className="text-sm text-gray-500 mt-1">Average tax and compliance by region</p>
              </div>
              <div className="flex space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-white rounded-md" style={{ backgroundColor: colors.primary }}>
                  Annual
                </button>
                <button className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200">
                  Quarterly
                </button>
              </div>
            </div>
            <div className="h-80">
              <Bar ref={chartRef} data={regionalData.chartData} options={chartOptions} />
            </div>
          </div>
        ) : (
          <div className="mb-8 bg-white rounded-md p-6 border border-gray-200 shadow-sm text-center text-gray-600">
            No chart data available for {selectedYear}.
          </div>
        )}

        {/* Region Details Panel */}
        {selectedRegion && (
          <div className="mb-8 bg-white rounded-md p-6 border border-gray-200 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>{selectedRegion.region} Region</h2>
                <p className="text-sm text-gray-500 mt-1">Detailed taxpayer metrics ({selectedYear})</p>
              </div>
              <button
                onClick={clearSelection}
                className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-warning"
                style={{ backgroundColor: colors.primary }}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="bg-white p-4 rounded-md border border-gray-200 hover:shadow-md transition-all">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Taxpayer Demographics</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Total Taxpayers</p>
                    <p className="text-lg font-semibold" style={{ color: colors.dark }}>{selectedRegion.taxpayers.toLocaleString()}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Salary</p>
                      <p className="font-medium" style={{ color: colors.dark }}>
                        {selectedRegion.salaryTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.salaryTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">E-VAT</p>
                      <p className="font-medium" style={{ color: colors.dark }}>
                        {selectedRegion.eVatTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.eVatTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Other</p>
                      <p className="font-medium" style={{ color: colors.dark }}>
                        {selectedRegion.otherTaxpayers.toLocaleString()} (
                        {(selectedRegion.taxpayers ? (selectedRegion.otherTaxpayers / selectedRegion.taxpayers) * 100 : 0).toFixed(1)}%)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-md border border-gray-200 hover:shadow-md transition-all">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Tax Revenue</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Total Tax Collected</p>
                    <p className="text-lg font-semibold" style={{ color: colors.dark }}>GHS {selectedRegion.totalTax.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Average Tax Paid</p>
                    <p className="font-medium" style={{ color: colors.dark }}>GHS {selectedRegion.averageTax.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white p-4 rounded-md border border-gray-200 hover:shadow-md transition-all">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Compliance Metrics</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-400">Compliance Rate</p>
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${selectedRegion.complianceRate * 100}%`,
                            backgroundColor: selectedRegion.complianceRate >= 0.8 ? colors.success : selectedRegion.complianceRate >= 0.5 ? colors.warning : colors.danger,
                          }}
                        ></div>
                      </div>
                      <span className="font-medium" style={{ color: colors.dark }}>{(selectedRegion.complianceRate * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Compliance Ranking</p>
                    <p className="font-medium" style={{ color: colors.dark }}>
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
          <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>Regional Tax Data ({selectedYear})</h2>
                <p className="text-sm text-gray-500 mt-1">Click any row for detailed metrics</p>
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
                    className="pl-10 pr-10 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
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
                <div className="flex space-x-2">
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      activeTab === "all"
                        ? "text-white"
                        : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                    } transition-colors`}
                    style={{ backgroundColor: activeTab === "all" ? colors.primary : undefined }}
                  >
                    All Regions
                  </button>
                  <button
                    onClick={() => setActiveTab("high")}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      activeTab === "high"
                        ? "text-white"
                        : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                    } transition-colors`}
                    style={{ backgroundColor: activeTab === "high" ? colors.success : undefined }}
                  >
                    High Compliance
                  </button>
                  <button
                    onClick={() => setActiveTab("medium")}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      activeTab === "medium"
                        ? "text-white"
                        : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                    } transition-colors`}
                    style={{ backgroundColor: activeTab === "medium" ? colors.warning : undefined }}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => setActiveTab("low")}
                    className={`px-3 py-1.5 text-sm rounded-md ${
                      activeTab === "low"
                        ? "text-white"
                        : "text-gray-700 bg-gray-100 hover:bg-gray-200"
                    } transition-colors`}
                    style={{ backgroundColor: activeTab === "low" ? colors.danger : undefined }}
                  >
                    Low
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
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
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        {header.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredRegions.length > 0 ? (
                    filteredRegions.map((region) => (
                      <tr
                        key={region.region}
                        onClick={() => handleRegionClick(region)}
                        className={`cursor-pointer transition-colors ${
                          selectedRegion?.region === region.region ? "bg-primary bg-opacity-10" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-md flex items-center justify-center" style={{ backgroundColor: `${colors.primary}15` }}>
                              <span className="font-medium" style={{ color: colors.primary }}>{region.region.substring(0, 2)}</span>
                            </div>
                            <div className="ml-4 flex items-center">
                              <span className="font-medium" style={{ color: colors.dark }}>{region.region}</span>
                              {region.complianceRate >= 0.8 && (
                                <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: `${colors.success}20`, color: colors.success }}>
                                  High
                                </span>
                              )}
                              {region.complianceRate >= 0.5 && region.complianceRate < 0.8 && (
                                <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: `${colors.warning}20`, color: colors.warning }}>
                                  Medium
                                </span>
                              )}
                              {region.complianceRate < 0.5 && (
                                <span className="ml-2 px-2 py-1 text-xs rounded-full" style={{ backgroundColor: `${colors.danger}20`, color: colors.danger }}>
                                  Low
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm" style={{ color: colors.dark }}>{region.taxpayers.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: colors.dark }}>{region.averageTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: colors.dark }}>{region.totalTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${region.complianceRate * 100}%`,
                                  backgroundColor: region.complianceRate >= 0.8 ? colors.success : region.complianceRate >= 0.5 ? colors.warning : colors.danger,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm" style={{ color: colors.dark }}>{(region.complianceRate * 100).toFixed(1)}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: colors.dark }}>
                          {(region.taxpayers ? (region.salaryTaxpayers / region.taxpayers) * 100 : 0).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: colors.dark }}>
                          {(region.taxpayers ? (region.eVatTaxpayers / region.taxpayers) * 100 : 0).toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="px-6 py-4 text-center text-sm text-gray-500">
                        No regions found matching "{searchQuery}" for {activeTab} compliance
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredRegions.length}</span> of{" "}
                <span className="font-medium">{regionalData.regions.length}</span> regions
              </div>
              <button
                onClick={exportToCSV}
                className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-warning"
                style={{ backgroundColor: colors.primary }}
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

export default RegionalAnalysis;