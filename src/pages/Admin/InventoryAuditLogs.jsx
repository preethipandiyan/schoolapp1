import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Search, Filter, Calendar, Download, RefreshCw
} from 'lucide-react';
import { LuClipboardList } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function InventoryAuditLogs() {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productFilter, setProductFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [transactionFilter, setTransactionFilter] = useState('All'); // 'All' | 'inbound' | 'outbound'

  // Search states
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch logs
  useEffect(() => {
    if (!schoolId) return;
    setLoading(true);

    const unsub = subscribeToSubCollection(schoolId, 'inventory_audit_logs', (data) => {
      // Sort by timestamp descending
      data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(data);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [schoolId]);

  // Extract filter option sets dynamically
  const productsList = Array.from(new Set(logs.map(l => l.productName).filter(Boolean)));
  const categoriesList = Array.from(new Set(logs.map(l => l.category).filter(Boolean)));
  const usersList = Array.from(new Set(logs.map(l => l.userName).filter(Boolean)));
  const actionsList = Array.from(new Set(logs.map(l => l.actionType).filter(Boolean)));

  // Filter logic
  const filteredLogs = logs.filter(log => {
    // Search
    const matchesSearch = !searchTerm || 
      (log.productName && log.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.productId && log.productId.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    // Date Range
    let matchesDate = true;
    if (startDate) {
      matchesDate = matchesDate && new Date(log.timestamp) >= new Date(startDate);
    }
    if (endDate) {
      // end of day logic
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      matchesDate = matchesDate && new Date(log.timestamp) <= endDateTime;
    }

    // Dropdowns
    const matchesProduct = productFilter === 'All' || log.productName === productFilter;
    const matchesCategory = categoryFilter === 'All' || log.category === categoryFilter;
    const matchesUser = userFilter === 'All' || log.userName === userFilter;
    const matchesAction = actionFilter === 'All' || log.actionType === actionFilter;
    
    // Transaction type matching
    let matchesTransaction = true;
    if (transactionFilter !== 'All') {
      const type = log.actionType?.toLowerCase();
      if (transactionFilter === 'inbound') {
        matchesTransaction = type === 'inbound stock' || (log.quantityChanged && log.quantityChanged > 0);
      } else {
        matchesTransaction = type === 'outbound stock' || (log.quantityChanged && log.quantityChanged < 0);
      }
    }

    return matchesSearch && matchesDate && matchesProduct && matchesCategory && matchesUser && matchesAction && matchesTransaction;
  });

  // Export audit logs
  const handleExport = (format) => {
    if (filteredLogs.length === 0) {
      toast.error("No log entries match your filter settings to export.");
      return;
    }

    const rows = filteredLogs.map((l, idx) => ({
      "Log ID": l.id || `LOG-${idx+1000}`,
      "Date & Time": new Date(l.timestamp).toLocaleString(),
      "User Name": l.userName,
      "User Role": l.userRole,
      "Action Type": l.actionType,
      "Product Name": l.productName || '—',
      "Product ID": l.productId || '—',
      "Category": l.category || '—',
      "Previous Stock": l.previousStock !== undefined ? l.previousStock : '—',
      "New Stock": l.newStock !== undefined ? l.newStock : '—',
      "Quantity Changed": l.quantityChanged !== undefined ? l.quantityChanged : '—',
      "Remarks": l.remarks || '—',
      "IP Address": l.ipAddress || '—'
    }));

    if (format === 'csv') {
      const headers = ["Log ID", "Date & Time", "User Name", "User Role", "Action Type", "Product Name", "Product ID", "Category", "Previous Stock", "New Stock", "Quantity Changed", "Remarks", "IP Address"];
      const csvContent = [
        headers.join(","),
        ...rows.map(r => [
          `"${r["Log ID"]}"`,
          `"${r["Date & Time"]}"`,
          `"${r["User Name"].replace(/"/g, '""')}"`,
          `"${r["User Role"].replace(/"/g, '""')}"`,
          `"${r["Action Type"].replace(/"/g, '""')}"`,
          `"${r["Product Name"].replace(/"/g, '""')}"`,
          `"${r["Product ID"].replace(/"/g, '""')}"`,
          `"${r["Category"].replace(/"/g, '""')}"`,
          r["Previous Stock"],
          r["New Stock"],
          r["Quantity Changed"],
          `"${r["Remarks"].replace(/"/g, '""')}"`,
          `"${r["IP Address"]}"`
        ].join(","))
      ].join("\n");

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `inventory_audit_logs_${new Date().toISOString().slice(0,10)}.csv`);
      link.click();
      toast.success("Audit logs exported to CSV");
    } else if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
      XLSX.writeFile(wb, `inventory_audit_logs_${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success("Audit logs exported to Excel");
    } else if (format === 'pdf') {
      try {
        const doc = new jsPDF('l', 'mm', 'a4'); // Landscape A4
        doc.setFontSize(18);
        doc.text("Inventory Audit Logs Report", 14, 15);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 20);

        const tableHeaders = [["Date & Time", "User", "Role", "Action", "Product", "Prev", "New", "Diff", "Remarks"]];
        const tableRows = filteredLogs.map(l => [
          new Date(l.timestamp).toLocaleString(),
          l.userName,
          l.userRole,
          l.actionType,
          l.productName || '—',
          l.previousStock !== undefined ? l.previousStock : '—',
          l.newStock !== undefined ? l.newStock : '—',
          l.quantityChanged !== undefined ? l.quantityChanged : '—',
          l.remarks || '—'
        ]);

        autoTable(doc, {
          head: tableHeaders,
          body: tableRows,
          startY: 25,
          theme: 'striped',
          styles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 35 },
            1: { cellWidth: 25 },
            2: { cellWidth: 20 },
            3: { cellWidth: 25 },
            4: { cellWidth: 35 },
            5: { cellWidth: 12 },
            6: { cellWidth: 12 },
            7: { cellWidth: 12 },
            8: { cellWidth: 60 }
          }
        });

        doc.save(`inventory_audit_logs_${new Date().toISOString().slice(0,10)}.pdf`);
        toast.success("Audit logs exported to PDF");
      } catch (err) {
        toast.error("Failed to generate PDF report");
        console.error(err);
      }
    }
  };

  const clearAllFilters = () => {
    setStartDate('');
    setEndDate('');
    setProductFilter('All');
    setCategoryFilter('All');
    setUserFilter('All');
    setActionFilter('All');
    setTransactionFilter('All');
    setSearchTerm('');
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin/inventory')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <ArrowLeft size={18} className="text-slate-800 dark:text-slate-100" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <LuClipboardList className="text-primary-600" /> Inventory Audit Logs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Review, filter, and track all stock inbound/outbound records.</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={clearAllFilters}
            className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 px-4 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-semibold"
          >
            <RefreshCw size={16} /> Reset
          </button>

          <div className="relative group">
            <button className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2 rounded-xl hover:bg-primary-700 transition-all font-semibold shadow-sm">
              <Download size={18} /> Export Logs
            </button>
            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl hidden group-hover:block hover:block z-50">
              <button onClick={() => handleExport('xlsx')} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-t-2xl">Excel (.xlsx)</button>
              <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200">CSV (.csv)</button>
              <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 rounded-b-2xl">PDF Document</button>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm mb-6 shrink-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {/* Search */}
        <div className="relative md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Search Logs</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={16} />
            <input 
              type="text"
              placeholder="Search product, product ID, user name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-black font-medium"
            />
          </div>
        </div>

        {/* Date Start */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Start Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={16} />
            <input 
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-black font-semibold"
            />
          </div>
        </div>

        {/* Date End */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">End Date</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={16} />
            <input 
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-black font-semibold"
            />
          </div>
        </div>

        {/* Product Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Product</label>
          <select 
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="All">All Products</option>
            {productsList.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Category Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Category</label>
          <select 
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="All">All Categories</option>
            {categoriesList.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
        </div>

        {/* User Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">User</label>
          <select 
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="All">All Users</option>
            {usersList.map((u, i) => <option key={i} value={u}>{u}</option>)}
          </select>
        </div>

        {/* Action Type Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Action Type</label>
          <select 
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="All">All Actions</option>
            {actionsList.map((a, i) => <option key={i} value={a}>{a}</option>)}
          </select>
        </div>

        {/* Transaction Type Filter */}
        <div>
          <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Transaction Type</label>
          <select 
            value={transactionFilter}
            onChange={(e) => setTransactionFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="All">All Transactions</option>
            <option value="inbound">Inbound Stock</option>
            <option value="outbound">Outbound Stock</option>
          </select>
        </div>
      </div>

      {/* Logs Table Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden mb-6">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
              <tr className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                <th className="p-4 pl-6">Timestamp</th>
                <th className="p-4">User</th>
                <th className="p-4">Role</th>
                <th className="p-4">Action</th>
                <th className="p-4">Product Name</th>
                <th className="p-4">Category</th>
                <th className="p-4">Stock Changed</th>
                <th className="p-4">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 pl-6 font-semibold text-slate-500 dark:text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="p-4 font-bold text-slate-900 dark:text-white">{log.userName}</td>
                  <td className="p-4 capitalize text-slate-600 dark:text-slate-300 font-semibold">{log.userRole}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                      log.actionType?.toLowerCase().includes('create') ? 'bg-green-100 text-green-700' :
                      log.actionType?.toLowerCase().includes('delete') ? 'bg-red-100 text-red-700' :
                      log.actionType?.toLowerCase().includes('inbound') ? 'bg-emerald-100 text-emerald-700' :
                      log.actionType?.toLowerCase().includes('outbound') ? 'bg-orange-100 text-orange-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {log.actionType}
                    </span>
                  </td>
                  <td className="p-4 font-semibold text-slate-900 dark:text-white">{log.productName || '—'}</td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium">{log.category || '—'}</td>
                  <td className="p-4">
                    {log.quantityChanged !== undefined ? (
                      <div className="flex flex-col text-xs">
                        <span className={`font-bold ${log.quantityChanged > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {log.quantityChanged > 0 ? `+${log.quantityChanged}` : log.quantityChanged}
                        </span>
                        <span className="text-slate-400 dark:text-slate-300">
                          {log.previousStock} → {log.newStock}
                        </span>
                      </div>
                    ) : '—'}
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 font-medium max-w-xs truncate" title={log.remarks}>
                    {log.remarks || '—'}
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                    No audit log entries found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
