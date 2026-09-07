import React from 'react';
import { LuTriangleAlert as AlertTriangle, LuX as X } from 'react-icons/lu';

export default function ConfirmModal({ 
  isOpen, 
  onClose, 
  onCancel,
  onConfirm, 
  title = "Confirm Action", 
  message = "Are you sure you want to proceed?", 
  confirmText = "Confirm", 
  cancelText = "Cancel",
  type = "danger", // "danger" | "warning" | "info"
  zIndex = "z-[10000]"
}) {
  if (!isOpen) return null;

  const handleClose = onClose || onCancel;

  const colors = {
    danger: {
      icon: "text-red-600 bg-red-100",
      button: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
    },
    warning: {
      icon: "text-amber-600 bg-amber-100",
      button: "bg-amber-600 hover:bg-amber-700 focus:ring-amber-500",
    },
    info: {
      icon: "text-primary-600 bg-primary-100",
      button: "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500",
    },
    success: {
      icon: "text-green-600 bg-green-100",
      button: "bg-green-600 hover:bg-green-700 focus:ring-green-500",
    },
    primary: {
      icon: "text-primary-600 bg-primary-100",
      button: "bg-primary-600 hover:bg-primary-700 focus:ring-primary-500",
    }
  };

  const theme = colors[type] || colors.danger;

  return (
    <div 
      className={`fixed inset-0 ${zIndex} flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200`}
      onClick={handleClose}
    >
      <div 
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-full ${theme.icon} flex-shrink-0`}>
              <AlertTriangle size={24} />
            </div>
            <button 
              type="button"
              onClick={handleClose}
              className="text-slate-400 dark:text-slate-300 hover:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 p-2 rounded-full transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
          <div className="mt-3 text-left">
            <h3 className="text-xl font-bold leading-6 text-slate-900 dark:text-white" id="modal-title">
              {title}
            </h3>
            <div className="mt-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {message}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex flex-row-reverse gap-3">
          <button
            type="button"
            className={`inline-flex w-full justify-center rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 sm:w-auto transition-colors ${theme.button}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
          <button
            type="button"
            className="mt-3 inline-flex w-full justify-center rounded-xl bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-900 dark:text-white shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 sm:mt-0 sm:w-auto transition-colors"
            onClick={handleClose}
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
