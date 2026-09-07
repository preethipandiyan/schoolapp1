import React, { useState, useEffect } from 'react';
import { LuX as X, LuDownload as Download, LuFileSpreadsheet as FileSpreadsheet } from 'react-icons/lu';

/**
 * Reusable ExportModal component for Excel / CSV exports
 * 
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether modal is visible
 * @param {function} props.onClose - Close modal callback
 * @param {string} props.title - Modal title (e.g. "Export Payroll Report")
 * @param {string} [props.subtitle] - Modal description
 * @param {string} props.defaultFileName - Initial file name without extension
 * @param {Array<{key: string, label: string}>} props.availableFields - Available fields list
 * @param {Object} props.selectedFields - Object with boolean flags per field key
 * @param {function(string): void} props.onToggleField - Toggle single field callback
 * @param {function(boolean): void} props.onSelectAll - Select/Deselect all callback
 * @param {function(string): void} props.onExport - Export callback receiving final file name
 * @param {string} [props.exportButtonText] - Text on export button (default: "Export Excel")
 */
export default function ExportModal({
  isOpen,
  onClose,
  title = "Export Report",
  subtitle = "Select columns to include in the exported Excel spreadsheet",
  defaultFileName = "Export_Data",
  availableFields = [],
  selectedFields = {},
  onToggleField,
  onSelectAll,
  onExport,
  exportButtonText = "Export Excel"
}) {
  const [fileName, setFileName] = useState(defaultFileName);

  useEffect(() => {
    if (isOpen) {
      setFileName(defaultFileName);
    }
  }, [isOpen, defaultFileName]);

  if (!isOpen) return null;

  const handleExportClick = () => {
    const trimmed = fileName.trim() || defaultFileName;
    onExport(trimmed);
  };

  const selectedCount = Object.values(selectedFields).filter(Boolean).length;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-fade-in-up">
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 rounded-2xl">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
              {subtitle && (
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">{subtitle}</p>
              )}
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-white rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {/* File Name Input */}
          <div className="space-y-1.5 pb-4 border-b border-slate-100 dark:border-slate-800">
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">File Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder={defaultFileName}
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                className="w-full px-4 py-2.5 pr-14 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-900 transition-all"
              />
              <span className="absolute right-4 top-2.5 text-xs text-slate-400 dark:text-slate-300 font-bold font-mono select-none">.xlsx</span>
            </div>
          </div>

          {/* Controls & Counter */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectAll && onSelectAll(true)}
                className="px-3 py-1.5 text-xs font-bold bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 rounded-lg transition-colors"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => onSelectAll && onSelectAll(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Deselect All
              </button>
            </div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {selectedCount} of {availableFields.length} columns selected
            </span>
          </div>

          {/* Checkbox Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {availableFields.map(field => {
              const isChecked = !!selectedFields[field.key];
              return (
                <label 
                  key={field.key}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-sm font-semibold select-none ${
                    isChecked
                      ? 'border-primary-300 dark:border-primary-800 bg-primary-50/40 dark:bg-primary-950/20 text-slate-900 dark:text-white'
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => onToggleField && onToggleField(field.key)}
                    className="rounded text-primary-600 focus:ring-primary-500 h-4.5 w-4.5 border-slate-300 dark:border-slate-600 cursor-pointer"
                  />
                  <span className="truncate" title={field.label}>{field.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-800 flex justify-end items-center gap-3 shrink-0">
          <button 
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleExportClick}
            disabled={selectedCount === 0}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-primary-600/20 transition-all flex items-center gap-2 active:scale-[0.98]"
          >
            <Download size={18} />
            {exportButtonText}
          </button>
        </div>
      </div>
    </div>
  );
}
