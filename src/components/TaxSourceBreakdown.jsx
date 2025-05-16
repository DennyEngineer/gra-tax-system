import { useState, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from "chart.js";
import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, onSnapshot } from "firebase/firestore";

ChartJS.register(ArcElement, Tooltip, Legend);

function TaxSourceBreakdown() {
  const [taxSources, setTaxSources] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newTaxpayer, setNewTaxpayer] = useState({
    name: "",
    region: "",
    taxType: "",
    taxAmount: "",
    contact: "",
    idNumber: "",
  });
  const [error, setError] = useState("");
  const [selectedYear, setSelectedYear] = useState("2025");

  const regionsList = [
    "Greater Accra", "Ashanti", "Central", "Eastern", "Western", "Volta",
    "Northern", "Bono", "Ahafo", "Bono East", "Western North", "Upper East",
    "Upper West", "Savannah", "North East", "Oti"
  ];
  const yearsList = ["2020", "2021", "2022", "2023", "2024", "2025"];

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "regions"), (snapshot) => {
      const regionsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const yearData = regionsData.map((region) => {
        const yearEntry = region.yearlyData?.find((y) => y.year === parseInt(selectedYear)) || {};
        return {
          region: region.region,
          taxpayers: yearEntry.taxpayers || 0,
          totalTax: yearEntry.totalTax || 0,
          averageTax: yearEntry.averageTax || 0,
          salaryTaxpayers: yearEntry.salaryTaxpayers || 0,
          eVatTaxpayers: yearEntry.eVatTaxpayers || 0,
          otherTaxpayers: yearEntry.otherTaxpayers || 0,
          complianceRate: yearEntry.complianceRate || 0,
        };
      });

      const totalTaxpayers = yearData.reduce((sum, r) => sum + r.taxpayers, 0);
      const totalSalaryTaxpayers = yearData.reduce((sum, r) => sum + r.salaryTaxpayers, 0);
      const totalEVatTaxpayers = yearData.reduce((sum, r) => sum + r.eVatTaxpayers, 0);
      const totalOtherTaxpayers = yearData.reduce((sum, r) => sum + r.otherTaxpayers, 0);
      const totalTax = yearData.reduce((sum, r) => sum + r.totalTax, 0);
      const averageComplianceRate = yearData.reduce((sum, r) => sum + r.complianceRate, 0) / yearData.length || 0;

      console.log("Chart Data Inputs:", {
        totalSalaryTaxpayers,
        totalEVatTaxpayers,
        totalOtherTaxpayers,
      });

      const chartData = {
        labels: ["Income Taxpayers", "E-VAT Taxpayers", "Other Taxpayers"],
        datasets: [
          {
            data: [totalSalaryTaxpayers, totalEVatTaxpayers, totalOtherTaxpayers],
            backgroundColor: [
              (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 200, 200);
                gradient.addColorStop(0, '#3B82F6');
                gradient.addColorStop(1, '#8B5CF6');
                return gradient;
              },
              (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 200, 200);
                gradient.addColorStop(0, '#14B8A6');
                gradient.addColorStop(1, '#34D399');
                return gradient;
              },
              (context) => {
                const ctx = context.chart.ctx;
                const gradient = ctx.createLinearGradient(0, 0, 200, 200);
                gradient.addColorStop(0, '#6B7280');
                gradient.addColorStop(1, '#9CA3AF');
                return gradient;
              },
            ],
            borderColor: ['#3B82F6', '#14B8A6', '#6B7280'],
            borderWidth: 1,
            hoverBackgroundColor: ['#2563EB', '#0D9488', '#4B5563'],
          },
        ],
      };

      setTaxSources({
        totalTaxpayers,
        totalSalaryTaxpayers,
        totalEVatTaxpayers,
        totalOtherTaxpayers,
        totalTax,
        averageComplianceRate,
        chartData,
        regions: yearData,
      });
    }, (err) => {
      console.error("Error fetching Firestore data:", err);
      setError("Failed to load data. Please try again.");
    });

    return () => unsubscribe();
  }, [selectedYear]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTaxpayer((prev) => ({ ...prev, [name]: value }));
  };

  const handleRegisterTaxpayer = async (e) => {
    e.preventDefault();
    setError("");

    if (!newTaxpayer.name || !newTaxpayer.region || !newTaxpayer.taxType || !newTaxpayer.taxAmount) {
      setError("Please fill in all required fields (Name, Region, Tax Type, Tax Amount).");
      return;
    }

    const taxAmount = parseFloat(newTaxpayer.taxAmount);
    if (isNaN(taxAmount) || taxAmount <= 0) {
      setError("Tax Amount must be a valid positive number.");
      return;
    }

    try {
      await addDoc(collection(db, "taxpayers"), {
        name: newTaxpayer.name,
        region: newTaxpayer.region,
        taxType: newTaxpayer.taxType,
        taxAmount,
        year: parseInt(selectedYear),
        contact: newTaxpayer.contact || "",
        idNumber: newTaxpayer.idNumber || "",
        createdAt: new Date(),
      });

      const regionRef = doc(db, "regions", newTaxpayer.region);
      const regionSnapshot = await getDocs(collection(db, "regions"));
      const regionDoc = regionSnapshot.docs.find((doc) => doc.id === newTaxpayer.region)?.data();
      if (!regionDoc) {
        setError("Region not found in Firestore.");
        return;
      }

      const yearEntry = regionDoc.yearlyData?.find((y) => y.year === parseInt(selectedYear)) || {};
      const newTaxpayers = (yearEntry.taxpayers || 0) + 1;
      const newTotalTax = (yearEntry.totalTax || 0) + taxAmount;
      const newAverageTax = newTotalTax / newTaxpayers;

      const yearlyData = regionDoc.yearlyData || [];
      const yearIndex = yearlyData.findIndex((y) => y.year === parseInt(selectedYear));
      const updatedYearData = {
        year: parseInt(selectedYear),
        taxpayers: newTaxpayers,
        totalTax: newTotalTax,
        averageTax: newAverageTax,
        salaryTaxpayers: yearEntry.salaryTaxpayers || 0,
        eVatTaxpayers: yearEntry.eVatTaxpayers || 0,
        otherTaxpayers: yearEntry.otherTaxpayers || 0,
        complianceRate: yearEntry.complianceRate || 0,
      };

      updatedYearData[`${newTaxpayer.taxType.toLowerCase()}Taxpayers`] =
        (yearEntry[`${newTaxpayer.taxType.toLowerCase()}Taxpayers`] || 0) + 1;

      if (yearIndex >= 0) {
        yearlyData[yearIndex] = updatedYearData;
      } else {
        yearlyData.push(updatedYearData);
      }

      await updateDoc(regionRef, { yearlyData });

      setNewTaxpayer({ name: "", region: "", taxType: "", taxAmount: "", contact: "", idNumber: "" });
      setShowModal(false);
    } catch (err) {
      setError("Error registering taxpayer. Please try again.");
      console.error(err);
    }
  };

  const filteredRegions = taxSources.regions?.filter((region) =>
    region.region.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const clearSearch = () => {
    setSearchQuery("");
  };

  const exportToCSV = () => {
    if (filteredRegions.length === 0) {
      alert("No data to export!");
      return;
    }

    const headers = [
      "Region", "Total Taxpayers", "Income Tax", "E-VAT Taxpayers",
      "Other Taxpayers", "Average Tax", "Total Tax", "Compliance Rate"
    ];
    const rows = filteredRegions.map((region) => [
      `"${region.region}"`,
      region.taxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.salaryTaxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.eVatTaxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.otherTaxpayers.toLocaleString("en-US", { useGrouping: false }),
      region.averageTax.toLocaleString("en-US", { useGrouping: false }),
      region.totalTax.toLocaleString("en-US", { useGrouping: false }),
      (region.complianceRate * 100).toFixed(2),
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `tax_source_breakdown_${selectedYear}_${date}.csv`);
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
        callbacks: {
          label: (context) => `${context.label}: ${context.raw.toLocaleString()}`,
        },
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart',
    },
    backgroundColor: '#1F2937',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-800 to-indigo-900 pt-20">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-white">Tax Source Breakdown</h1>
            <p className="text-base text-gray-300 mt-2">Distribution of taxpayers by source across Ghana ({selectedYear})</p>
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
              Export Breakdown
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-teal-500 rounded-lg hover:from-green-600 hover:to-teal-600 focus:ring-2 focus:ring-green-500 flex items-center transform hover:scale-[1.02] transition-all"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Taxpayer
            </button>
          </div>
        </div>

        {/* Registration Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 w-full max-w-md border border-white/20">
              <h2 className="text-xl font-semibold text-white mb-4">Register New Taxpayer ({selectedYear})</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500 text-red-200 rounded-lg text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
              <form onSubmit={handleRegisterTaxpayer}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={newTaxpayer.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">Region *</label>
                  <select
                    name="region"
                    value={newTaxpayer.region}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                    required
                  >
                    <option value="" className="bg-gray-900">Select Region</option>
                    {regionsList.map((region) => (
                      <option key={region} value={region} className="bg-gray-900">{region}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">Tax Type *</label>
                  <select
                    name="taxType"
                    value={newTaxpayer.taxType}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                    required
                  >
                    <option value="" className="bg-gray-900">Select Tax Type</option>
                    <option value="salary" className="bg-gray-900">Income Taxpayer</option>
                    <option value="eVat" className="bg-gray-900">E-VAT Taxpayer</option>
                    <option value="other" className="bg-gray-900">Other Taxpayer</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">Tax Amount (GHS) *</label>
                  <input
                    type="number"
                    name="taxAmount"
                    value={newTaxpayer.taxAmount}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">Contact (Optional)</label>
                  <input
                    type="text"
                    name="contact"
                    value={newTaxpayer.contact}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300">ID Number (Optional)</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={newTaxpayer.idNumber}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-md"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-500 to-teal-500 rounded-lg hover:from-green-600 hover:to-teal-600 focus:ring-2 focus:ring-green-500 transform hover:scale-[1.02] transition-all"
                  >
                    Register
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[
            {
              title: "Total Taxpayers",
              value: taxSources.totalTaxpayers?.toLocaleString() || "0",
              icon: (
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ),
            },
            {
              title: "Income Tax",
              value: taxSources.totalSalaryTaxpayers?.toLocaleString() || "0",
              icon: (
                <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              ),
            },
            {
              title: "E-VAT Taxpayers",
              value: taxSources.totalEVatTaxpayers?.toLocaleString() || "0",
              icon: (
                <svg className="w-6 h-6 text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2zM10 8.5a.5.5 0 11-1 0 .5.5 0 011 0zm5 5a.5.5 0 11-1 0 .5.5 0 011 0z" />
                </svg>
              ),
            },
            {
              title: "Other Taxpayers",
              value: taxSources.totalOtherTaxpayers?.toLocaleString() || "0",
              icon: (
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              title: "Total Tax (GHS)",
              value: taxSources.totalTax?.toLocaleString() || "0",
              icon: (
                <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
            {
              title: "Avg Compliance Rate",
              value: taxSources.averageComplianceRate ? `${(taxSources.averageComplianceRate * 100).toFixed(1)}%` : "0%",
              icon: (
                <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ),
            },
          ].map((card, index) => (
            <div
              key={card.title}
              className="bg-white/10 backdrop-blur-lg p-6 rounded-xl border border-white/20 hover:shadow-xl transition-all transform hover:scale-[1.02]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-300 mb-2">{card.title}</p>
                  <p className="text-2xl font-semibold text-white">{card.value}</p>
                </div>
                <div className="p-3 bg-blue-500/20 rounded-lg">{card.icon}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Pie Chart Section */}
        {taxSources.chartData && taxSources.chartData.datasets[0].data.some(val => val > 0) ? (
          <div className="mb-8 bg-white/10 backdrop-blur-lg p-6 rounded-xl border border-white/20 shadow-xl">
            <h2 className="text-xl font-semibold text-white mb-4">Taxpayer Source Distribution ({selectedYear})</h2>
            <div className="relative w-full max-w-md mx-auto" style={{ height: '400px' }}>
              <Pie data={taxSources.chartData} options={chartOptions} />
            </div>
          </div>
        ) : (
          <div className="mb-8 bg-white/10 backdrop-blur-lg p-6 rounded-xl border border-white/20 shadow-xl text-center text-gray-300">
            <p>No taxpayer data available for {selectedYear}</p>
          </div>
        )}

        {/* Table Section */}
        {taxSources.regions && (
          <div className="bg-white/10 backdrop-blur-lg rounded-xl shadow-xl border border-white/20 overflow-hidden">
            <div className="px-6 py-4 border-b border-white/20 flex flex-col sm:flex-row justify-between items-start sm:items-center">
              <div>
                <h2 className="text-xl font-semibold text-white">Regional Tax Source Breakdown ({selectedYear})</h2>
                <p className="text-sm text-gray-300 mt-1">Taxpayer distribution by region and source</p>
              </div>
              <div className="mt-4 sm:mt-0 flex items-center space-x-3">
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
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-white/20">
                <thead className="bg-white/5">
                  <tr>
                    {[
                      { label: "Region" },
                      { label: "Total Taxpayers" },
                      { label: "Income Tax" },
                      { label: "E-VAT Taxpayers" },
                      { label: "Other Taxpayers" },
                      { label: "Average Tax (GHS)" },
                      { label: "Total Tax (GHS)" },
                      { label: "Compliance Rate" },
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
                      <tr key={region.region} className="hover:bg-white/10 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                              <span className="text-blue-400 font-medium">{region.region.substring(0, 2)}</span>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-white">{region.region}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{region.taxpayers.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-white">{region.salaryTaxpayers.toLocaleString()}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.eVatTaxpayers.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.otherTaxpayers.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.averageTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{region.totalTax.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{(region.complianceRate * 100).toFixed(1)}%</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-400">
                        No regions found matching "{searchQuery}"
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-white/20 bg-white/5 flex items-center justify-between">
              <div className="text-sm text-gray-300">
                Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredRegions.length}</span> of{" "}
                <span className="font-medium">{taxSources.regions?.length}</span> regions
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-purple-500 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-blue-500 rounded-full filter blur-3xl opacity-20"></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl opacity-10"></div>
      </div>
    </div>
  );
}

export default TaxSourceBreakdown;