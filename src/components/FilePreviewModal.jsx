import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LuX, LuDownload, LuFileText } from 'react-icons/lu';

export default function FilePreviewModal({ fileUrl, isOpen, onClose }) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!isOpen || !fileUrl) return null;

  // Helper to determine file type
  const getFileType = (url) => {
    const lowercaseUrl = url.toLowerCase();
    if (lowercaseUrl.match(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i)) return 'image';
    if (lowercaseUrl.match(/\.(pdf)(\?.*)?$/i)) return 'pdf';
    if (lowercaseUrl.match(/\.(doc|docx|xls|xlsx|ppt|pptx)(\?.*)?$/i)) return 'office';
    return 'other';
  };

  const fileType = getFileType(fileUrl);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      if (fileUrl.includes('res.cloudinary.com')) {
        // Intercept Cloudinary URL to add fl_attachment
        const urlParts = fileUrl.split('/upload/');
        if (urlParts.length === 2) {
          const downloadUrl = `${urlParts[0]}/upload/fl_attachment/${urlParts[1]}`;
          // Cloudinary will prompt download automatically when opened
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          window.open(fileUrl, '_blank');
        }
      } else if (fileUrl.includes('firebasestorage.googleapis.com')) {
        // Fetch the file and force download
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Try to guess a filename if possible, else generic
        let filename = 'downloaded_file';
        try {
          const urlObj = new URL(fileUrl);
          const pathSegments = urlObj.pathname.split('/');
          const lastSegment = decodeURIComponent(pathSegments[pathSegments.length - 1]);
          // Clean up the filename if it has tokens or firebase prefix
          if (lastSegment) {
            filename = lastSegment.split('?')[0]; // remove query params
          }
        } catch (e) {
          // ignore parsing error
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Fallback: just open in new tab
        window.open(fileUrl, '_blank');
      }
    } catch (error) {
      console.error("Error downloading file:", error);
      // Fallback
      window.open(fileUrl, '_blank');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">File Preview</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={handleDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-50 text-primary-600 font-medium rounded-lg hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
              >
                <LuDownload size={18} />
                {isDownloading ? 'Downloading...' : 'Download File'}
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 bg-slate-100 dark:bg-slate-700 p-4 overflow-auto flex items-center justify-center">
            {fileType === 'image' && (
              <img 
                src={fileUrl} 
                alt="Preview" 
                className="max-w-full max-h-full object-contain rounded shadow-sm bg-white dark:bg-slate-900"
              />
            )}

            {fileType === 'pdf' && (
              <iframe 
                src={fileUrl} 
                className="w-full h-full rounded shadow-sm bg-white dark:bg-slate-900 border-0"
                title="PDF Preview"
              />
            )}

            {fileType === 'office' && (
              <iframe 
                src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`}
                className="w-full h-full rounded shadow-sm bg-white dark:bg-slate-900 border-0"
                title="Office Document Preview"
              />
            )}

            {fileType === 'other' && (
              <div className="flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-slate-900 rounded-xl shadow-sm max-w-md w-full">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 rounded-full flex items-center justify-center mb-4">
                  <LuFileText size={40} />
                </div>
                <h4 className="font-bold text-slate-800 dark:text-slate-100 text-lg mb-2">No Preview Available</h4>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  This file type cannot be previewed directly in the browser. Please download the file to view it on your device.
                </p>
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full py-3 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex justify-center items-center gap-2"
                >
                  <LuDownload size={20} />
                  {isDownloading ? 'Downloading...' : 'Download File Now'}
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
