import React, { useState, useEffect } from 'react';
import { LuClipboardList, LuSearch, LuFilter, LuCalendar, LuDownload, LuUser } from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const logs = [
    { id: 'LOG-8912', action: 'Plan Upgrade', user: 'Admin (Greenwood)', details: 'Upgraded to Enterprise Plan', date: '2026-07-11T14:30:00Z', ip: '192.168.1.45', type: 'billing' },
    { id: 'LOG-8911', action: 'Failed Login', user: 'Unknown User', details: '5 failed attempts for superadmin@School.com', date: '2026-07-11T12:15:00Z', ip: '45.22.11.9', type: 'security' },
    { id: 'LOG-8910', action: 'API Key Generated', user: 'Admin (Sunrise)', details: 'Generated new API key for SMS gateway', date: '2026-07-10T09:00:00Z', ip: '10.0.0.12', type: 'system' },
    { id: 'LOG-8909', action: 'User Deleted', user: 'SuperAdmin', details: 'Deleted teacher account (ID: 1045)', date: '2026-07-09T16:45:00Z', ip: '192.168.1.1', type: 'data' },
    { id: 'LOG-8908', action: 'Settings Changed', user: 'Admin (Oakridge)', details: 'Updated grading scale to 10-point GPA', date: '2026-07-08T11:20:00Z', ip: '172.16.0.4', type: 'system' },
  ];

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredLogs = logs.filter(l => 
    l.action.toLowerCase().includes(searchTerm.toLowerCase()) || 
    l.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      toast.error("No logs to export");
      return;
    }

    const headers = ["Timestamp", "Action Event", "User/Initiator", "Details", "IP Address", "Type"];
    const rows = filteredLogs.map(log => [
      new Date(log.date).toLocaleString(),
      log.action,
      log.user,
      log.details,
      log.ip,
      log.type
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("CSV exported successfully");
    } catch (err) {
      toast.error("Failed to export CSV");
    }
  };

  const getTypeColor = (type) => {
    switch(type) {
      case 'security': return 'bg-red-100 text-red-700';
      case 'billing': return 'bg-purple-100 text-purple-700';
      case 'system': return 'bg-blue-100 text-blue-700';
      case 'data': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col min-w-0">
      <div className="mb-8 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuClipboardList className="text-primary-600" /> Audit Logs
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track all critical actions, security events, and configuration changes.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white hover:bg-primary-700 text-sm font-semibold rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2"
        >
          <LuDownload size={18} /> Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 grid grid-cols-1 sm:grid-cols-4 gap-4 shrink-0">
          <div className="relative w-full sm:col-span-2">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
            <input 
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
            />
          </div>
          <button className="w-full justify-center px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <LuFilter size={18} /> Event Type
          </button>
          <button className="w-full justify-center px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2">
            <LuCalendar size={18} /> Date Range
          </button>
        </div>

        <div className="w-full min-w-0 overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
              <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-700">
                <th className="p-4 font-bold">Timestamp</th>
                <th className="p-4 font-bold">Action Event</th>
                <th className="p-4 font-bold">User / Initiator</th>
                <th className="p-4 font-bold">Details</th>
                <th className="p-4 font-bold">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4 text-sm text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {new Date(log.date).toLocaleString()}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getTypeColor(log.type).split(' ')[0]}`}></span>
                      <span className="font-bold text-slate-900 dark:text-white">{log.action}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400">
                        <LuUser size={12} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{log.user}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-slate-600 dark:text-slate-300">
                    {log.details}
                  </td>
                  <td className="p-4">
                    <code className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded font-mono text-xs">
                      {log.ip}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filteredLogs.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-900 dark:text-white">{filteredLogs.length}</span> audit logs
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
