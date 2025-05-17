import { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, addDoc, getDocs, updateDoc, doc, deleteDoc, onSnapshot } from "firebase/firestore";

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

function TaxpayerManagement() {
  const [taxpayers, setTaxpayers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingTaxpayer, setEditingTaxpayer] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    taxType: "",
    taxAmount: "",
    year: "2025",
    contact: "",
    idNumber: "",
  });
  const [error, setError] = useState("");

  const regionsList = [
    "Greater Accra", "Ashanti", "Central", "Eastern", "Western", "Volta",
    "Northern", "Bono", "Ahafo", "Bono East", "Western North", "Upper East",
    "Upper West", "Savannah", "North East", "Oti"
  ];
  const yearsList = ["2020", "2021", "2022", "2023", "2024", "2025"];
  const taxTypes = ["salary", "eVat", "other"];

  // Fetch taxpayers in real-time
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "taxpayers"), (snapshot) => {
      const taxpayerData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTaxpayers(taxpayerData);
    }, (err) => {
      console.error("Error fetching taxpayers:", err);
      setError("Failed to load taxpayers. Please try again.");
    });

    return () => unsubscribe();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Validate and submit form (add or edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.name || !formData.region || !formData.taxType || !formData.taxAmount || !formData.year) {
      setError("Please fill in all required fields (Name, Region, Tax Type, Tax Amount, Year).");
      return;
    }

    const taxAmount = parseFloat(formData.taxAmount);
    if (isNaN(taxAmount) || taxAmount <= 0) {
      setError("Tax Amount must be a valid positive number.");
      return;
    }

    try {
      const regionRef = doc(db, "regions", formData.region);
      const regionSnapshot = await getDocs(collection(db, "regions"));
      const regionDoc = regionSnapshot.docs.find((doc) => doc.id === formData.region)?.data();
      if (!regionDoc) {
        setError("Region not found in Firestore.");
        return;
      }

      const yearEntry = regionDoc.yearlyData?.find((y) => y.year === parseInt(formData.year)) || {};
      let yearlyData = regionDoc.yearlyData || [];

      if (editingTaxpayer) {
        // Editing existing taxpayer
        const oldTaxpayer = taxpayers.find((t) => t.id === editingTaxpayer.id);
        const oldTaxAmount = oldTaxpayer.taxAmount;
        const oldTaxType = oldTaxpayer.taxType;
        const oldYear = oldTaxpayer.year;

        // Update taxpayer document
        await updateDoc(doc(db, "taxpayers", editingTaxpayer.id), {
          name: formData.name,
          region: formData.region,
          taxType: formData.taxType,
          taxAmount,
          year: parseInt(formData.year),
          contact: formData.contact || "",
          idNumber: formData.idNumber || "",
          updatedAt: new Date(),
        });

        // Adjust region data if year or taxType changed
        if (oldYear !== parseInt(formData.year) || oldTaxpayer.region !== formData.region) {
          // Update old region's yearlyData
          const oldRegionRef = doc(db, "regions", oldTaxpayer.region);
          const oldRegionDoc = regionSnapshot.docs.find((doc) => doc.id === oldTaxpayer.region)?.data();
          let oldYearlyData = oldRegionDoc?.yearlyData || [];
          const oldYearIndex = oldYearlyData.findIndex((y) => y.year === oldYear);
          if (oldYearIndex >= 0) {
            const oldYearData = oldYearlyData[oldYearIndex];
            oldYearData.taxpayers = (oldYearData.taxpayers || 0) - 1;
            oldYearData.totalTax = (oldYearData.totalTax || 0) - oldTaxAmount;
            oldYearData.averageTax = oldYearData.taxpayers > 0 ? oldYearData.totalTax / oldYearData.taxpayers : 0;
            oldYearData[`${oldTaxType.toLowerCase()}Taxpayers`] =
              (oldYearData[`${oldTaxType.toLowerCase()}Taxpayers`] || 0) - 1;
            oldYearlyData[oldYearIndex] = oldYearData;
            await updateDoc(oldRegionRef, { yearlyData: oldYearlyData });
          }
        }

        // Update new region's yearlyData
        const yearIndex = yearlyData.findIndex((y) => y.year === parseInt(formData.year));
        let updatedYearData = yearEntry;
        if (yearIndex >= 0) {
          updatedYearData = { ...yearlyData[yearIndex] };
          if (oldYear === parseInt(formData.year) && oldTaxpayer.region === formData.region) {
            updatedYearData.totalTax = (updatedYearData.totalTax || 0) - oldTaxAmount + taxAmount;
            updatedYearData.averageTax = updatedYearData.taxpayers > 0 ? updatedYearData.totalTax / updatedYearData.taxpayers : 0;
            if (oldTaxType !== formData.taxType) {
              updatedYearData[`${oldTaxType.toLowerCase()}Taxpayers`] =
                (updatedYearData[`${oldTaxType.toLowerCase()}Taxpayers`] || 0) - 1;
              updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] =
                (updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] || 0) + 1;
            }
          } else {
            updatedYearData.taxpayers = (updatedYearData.taxpayers || 0) + 1;
            updatedYearData.totalTax = (updatedYearData.totalTax || 0) + taxAmount;
            updatedYearData.averageTax = updatedYearData.taxpayers > 0 ? updatedYearData.totalTax / updatedYearData.taxpayers : 0;
            updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] =
              (updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] || 0) + 1;
          }
          yearlyData[yearIndex] = updatedYearData;
        } else {
          updatedYearData = {
            year: parseInt(formData.year),
            taxpayers: 1,
            totalTax: taxAmount,
            averageTax: taxAmount,
            salaryTaxpayers: formData.taxType === "salary" ? 1 : 0,
            eVatTaxpayers: formData.taxType === "eVat" ? 1 : 0,
            otherTaxpayers: formData.taxType === "other" ? 1 : 0,
            complianceRate: yearEntry.complianceRate || 0,
          };
          yearlyData.push(updatedYearData);
        }

        await updateDoc(regionRef, { yearlyData });
      } else {
        // Adding new taxpayer
        await addDoc(collection(db, "taxpayers"), {
          name: formData.name,
          region: formData.region,
          taxType: formData.taxType,
          taxAmount,
          year: parseInt(formData.year),
          contact: formData.contact || "",
          idNumber: formData.idNumber || "",
          createdAt: new Date(),
        });

        // Update region's yearlyData
        const yearIndex = yearlyData.findIndex((y) => y.year === parseInt(formData.year));
        let updatedYearData;
        if (yearIndex >= 0) {
          updatedYearData = { ...yearlyData[yearIndex] };
          updatedYearData.taxpayers = (updatedYearData.taxpayers || 0) + 1;
          updatedYearData.totalTax = (updatedYearData.totalTax || 0) + taxAmount;
          updatedYearData.averageTax = updatedYearData.taxpayers > 0 ? updatedYearData.totalTax / updatedYearData.taxpayers : 0;
          updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] =
            (updatedYearData[`${formData.taxType.toLowerCase()}Taxpayers`] || 0) + 1;
          yearlyData[yearIndex] = updatedYearData;
        } else {
          updatedYearData = {
            year: parseInt(formData.year),
            taxpayers: 1,
            totalTax: taxAmount,
            averageTax: taxAmount,
            salaryTaxpayers: formData.taxType === "salary" ? 1 : 0,
            eVatTaxpayers: formData.taxType === "eVat" ? 1 : 0,
            otherTaxpayers: formData.taxType === "other" ? 1 : 0,
            complianceRate: yearEntry.complianceRate || 0,
          };
          yearlyData.push(updatedYearData);
        }

        await updateDoc(regionRef, { yearlyData });
      }

      setFormData({ name: "", region: "", taxType: "", taxAmount: "", year: "2025", contact: "", idNumber: "" });
      setEditingTaxpayer(null);
      setShowModal(false);
    } catch (err) {
      setError(editingTaxpayer ? "Error updating taxpayer. Please try again." : "Error adding taxpayer. Please try again.");
      console.error(err);
    }
  };

  // Handle edit button click
  const handleEdit = (taxpayer) => {
    setEditingTaxpayer(taxpayer);
    setFormData({
      name: taxpayer.name,
      region: taxpayer.region,
      taxType: taxpayer.taxType,
      taxAmount: taxpayer.taxAmount.toString(),
      year: taxpayer.year.toString(),
      contact: taxpayer.contact || "",
      idNumber: taxpayer.idNumber || "",
    });
    setShowModal(true);
  };

  // Handle delete button click
  const handleDelete = async (taxpayer) => {
    if (!window.confirm(`Are you sure you want to delete ${taxpayer.name}?`)) return;

    try {
      // Delete from taxpayers collection
      await deleteDoc(doc(db, "taxpayers", taxpayer.id));

      // Update region's yearlyData
      const regionRef = doc(db, "regions", taxpayer.region);
      const regionSnapshot = await getDocs(collection(db, "regions"));
      const regionDoc = regionSnapshot.docs.find((doc) => doc.id === taxpayer.region)?.data();
      if (!regionDoc) {
        setError("Region not found in Firestore.");
        return;
      }

      let yearlyData = regionDoc.yearlyData || [];
      const yearIndex = yearlyData.findIndex((y) => y.year === taxpayer.year);
      if (yearIndex >= 0) {
        const yearData = yearlyData[yearIndex];
        yearData.taxpayers = (yearData.taxpayers || 0) - 1;
        yearData.totalTax = (yearData.totalTax || 0) - taxpayer.taxAmount;
        yearData.averageTax = yearData.taxpayers > 0 ? yearData.totalTax / yearData.taxpayers : 0;
        yearData[`${taxpayer.taxType.toLowerCase()}Taxpayers`] =
          (yearData[`${taxpayer.taxType.toLowerCase()}Taxpayers`] || 0) - 1;
        yearlyData[yearIndex] = yearData;
        await updateDoc(regionRef, { yearlyData });
      }
    } catch (err) {
      setError("Error deleting taxpayer. Please try again.");
      console.error(err);
    }
  };

  // Export taxpayers to CSV
  const exportToCSV = () => {
    if (filteredTaxpayers.length === 0) {
      alert("No taxpayers to export!");
      return;
    }

    const headers = [
      "Name",
      "Region",
      "Tax Type",
      "Tax Amount (GHS)",
      "Year",
      "Contact",
      "ID Number",
    ];
    const rows = filteredTaxpayers.map((taxpayer) => [
      `"${taxpayer.name.replace(/"/g, '""')}"`, // Escape quotes
      `"${taxpayer.region}"`,
      `"${taxpayer.taxType === "salary" ? "Income Taxpayer" : taxpayer.taxType === "eVat" ? "E-VAT Taxpayer" : "Other Taxpayer"}"`,
      taxpayer.taxAmount.toLocaleString("en-US", { useGrouping: false }),
      taxpayer.year,
      `"${taxpayer.contact || "-"}"`,
      `"${taxpayer.idNumber || "-"}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `taxpayers_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter taxpayers based on search query
  const filteredTaxpayers = taxpayers.filter(
    (taxpayer) =>
      taxpayer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      taxpayer.region.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clearSearch = () => {
    setSearchQuery("");
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: colors.dark }}>Taxpayer Management</h2>
            <p className="text-sm text-gray-600 mt-1">Add, edit, or remove taxpayers</p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            <button
              onClick={() => {
                setEditingTaxpayer(null);
                setFormData({ name: "", region: "", taxType: "", taxAmount: "", year: "2025", contact: "", idNumber: "" });
                setShowModal(true);
              }}
              className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-warning"
              style={{ backgroundColor: colors.success }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Taxpayer
            </button>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 text-sm font-medium text-white rounded-md flex items-center transition-colors hover:bg-warning"
              style={{ backgroundColor: colors.primary }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export CSV
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

        {/* Modal for Add/Edit */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md p-6 w-full max-w-md border border-gray-200 shadow-lg">
              <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>
                {editingTaxpayer ? "Edit Taxpayer" : "Add New Taxpayer"}
              </h2>
              {error && (
                <div className="my-4 p-3 bg-red-100 border border-red-200 text-red-800 rounded-md text-sm flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Region *</label>
                  <select
                    name="region"
                    value={formData.region}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    required
                  >
                    <option value="">Select Region</option>
                    {regionsList.map((region) => (
                      <option key={region} value={region}>{region}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Tax Type *</label>
                  <select
                    name="taxType"
                    value={formData.taxType}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    required
                  >
                    <option value="">Select Tax Type</option>
                    {taxTypes.map((type) => (
                      <option key={type} value={type}>
                        {type === "salary" ? "Income Taxpayer" : type === "eVat" ? "E-VAT Taxpayer" : "Other Taxpayer"}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Tax Amount (GHS) *</label>
                  <input
                    type="number"
                    name="taxAmount"
                    value={formData.taxAmount}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Year *</label>
                  <select
                    name="year"
                    value={formData.year}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                    required
                  >
                    <option value="">Select Year</option>
                    {yearsList.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Contact (Optional)</label>
                  <input
                    type="text"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">ID Number (Optional)</label>
                  <input
                    type="text"
                    name="idNumber"
                    value={formData.idNumber}
                    onChange={handleInputChange}
                    className="mt-1 block w-full bg-white border border-gray-300 rounded-md p-2 text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white rounded-md transition-colors hover:bg-warning"
                    style={{ backgroundColor: colors.success }}
                  >
                    {editingTaxpayer ? "Update" : "Add"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Taxpayers Table */}
        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h2 className="text-lg font-semibold" style={{ color: colors.dark }}>Taxpayers List</h2>
              <p className="text-sm text-gray-500 mt-1">Manage all registered taxpayers</p>
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
                  placeholder="Search taxpayers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent"
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
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    "Name", "Region", "Tax Type", "Tax Amount (GHS)", "Year", "Contact", "ID Number", "Actions"
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredTaxpayers.length > 0 ? (
                  filteredTaxpayers.map((taxpayer) => (
                    <tr key={taxpayer.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium" style={{ color: colors.dark }}>{taxpayer.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>{taxpayer.region}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>
                          {taxpayer.taxType === "salary"
                            ? "Income Taxpayer"
                            : taxpayer.taxType === "eVat"
                            ? "E-VAT Taxpayer"
                            : "Other Taxpayer"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>{taxpayer.taxAmount.toLocaleString()}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>{taxpayer.year}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>{taxpayer.contact || "-"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm" style={{ color: colors.dark }}>{taxpayer.idNumber || "-"}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleEdit(taxpayer)}
                          className="mr-4"
                          style={{ color: colors.primary }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(taxpayer)}
                          style={{ color: colors.danger }}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5-4h4M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchQuery ? `No taxpayers found matching "${searchQuery}"` : "No taxpayers registered"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredTaxpayers.length}</span> of{" "}
              <span className="font-medium">{taxpayers.length}</span> taxpayers
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

export default TaxpayerManagement;