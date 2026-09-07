import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { LuFileSpreadsheet as FileIcon, LuPrinter as Printer, LuArrowLeft as ArrowLeft, LuCalendar as Calendar, LuAward as Award, LuDownload as DownloadIcon } from 'react-icons/lu';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';

export default function ParentGrades() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const studentId = userProfile?.linkedStudentId;
  const location = useLocation();

  const [loading, setLoading] = useState(true);
  const [reportCards, setReportCards] = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);

  useEffect(() => {
    setSelectedReport(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = collection(db, `schools/${schoolId}/students/${studentId}/report_cards`);
    
    const unsubscribe = onSnapshot(ref, (snap) => {
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort by publication date descending
      list.sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
      setReportCards(list);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching report cards:", error);
      toast.error("Failed to load report cards.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId, studentId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!studentId) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        You must link a student to your account to view report cards.
      </div>
    );
  }

  if (selectedReport) {
    const template = selectedReport.reportTemplate || {
      themeColor: '#3b82f6',
      header: { title: 'STUDENT REPORT CARD', subtitle: 'Academic Performance Record', showLogo: true, showAddress: true, showPhone: true, showEmail: true }
    };
    
    // Sort assessments/subjects keys
    const assessmentIds = Object.keys(selectedReport.marks || {});

    return (
      <div className="p-4 sm:p-8 max-w-4xl mx-auto pb-24 min-w-0 w-full">
        {/* Actions bar */}
        <div className="flex justify-between items-center mb-6 print:hidden w-full">
          <button 
            onClick={() => setSelectedReport(null)}
            className="flex items-center gap-2 px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft size={16} /> Back to List
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors shadow-sm"
          >
            <Printer size={16} /> Print Report Card
          </button>
        </div>

        {/* Paper Report Card Layout */}
        <div className="bg-white dark:bg-slate-900 shadow-xl max-w-[794px] min-h-[1050px] mx-auto flex flex-col p-8 print:shadow-none border border-slate-100 dark:border-slate-800 rounded-3xl print:border-none print:p-0" style={{ fontFamily: "'Times New Roman', serif" }}>
          {/* Header */}
          <div className="pb-4 flex items-center border-b-[3px]" style={{ borderColor: template.themeColor }}>
            {template.header.showLogo && (
              <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center border-2 shrink-0 mr-6" style={{ borderColor: template.themeColor }}>
                <span className="text-[10px] text-slate-400 dark:text-slate-300 font-sans font-extrabold">LOGO</span>
              </div>
            )}
            <div className={`flex-1 ${template.header.showLogo ? 'text-center' : 'text-left'}`}>
              <h1 className="text-2xl font-black uppercase text-slate-900 dark:text-white" style={{ color: template.themeColor }}>
                {userProfile?.schoolName || 'YOUR SCHOOL NAME'}
              </h1>
              <div className="text-xs mt-1.5 text-slate-600 dark:text-slate-300 font-sans">
                {template.header.showAddress && <span>123 Education Street, Learning City, 10001<br/></span>}
                <span className="font-semibold">
                  {template.header.showPhone && <span>Tel: +1 234 567 8900 </span>}
                  {template.header.showPhone && template.header.showEmail && <span> | </span>}
                  {template.header.showEmail && <span>Email: info@yourschool.edu</span>}
                </span>
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="py-6 text-center">
            <h2 className="text-xl font-bold uppercase underline decoration-2 underline-offset-4" style={{ decorationColor: template.themeColor }}>
              {template.header.title}
            </h2>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mt-1">{template.header.subtitle}</p>
          </div>

          {/* Student Info */}
          <div className="pb-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-2.5 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-sans">
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase">Student Name:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedReport.studentName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase">Class & Section:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedReport.className}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase">Examination:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">{selectedReport.examName}</span>
              </div>
              <div className="flex justify-between border-b border-slate-150 pb-1">
                <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase">Academic Year:</span>
                <span className="font-bold text-slate-900 dark:text-white text-xs">2026-2027</span>
              </div>
            </div>
          </div>

          {/* Grades Table */}
          <div className="flex-1 min-w-0 w-full">
            <div className="w-full min-w-0 overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 dark:border-slate-600 font-sans text-xs min-w-max">
                <thead>
                <tr className="text-white uppercase" style={{ backgroundColor: template.themeColor }}>
                  <th className="p-3 border border-slate-300 dark:border-slate-600 font-bold">Assessment / Subject</th>
                  <th className="p-3 border border-slate-300 dark:border-slate-600 text-center font-bold">Marks Obtained</th>
                  <th className="p-3 border border-slate-300 dark:border-slate-600 text-center font-bold">Max Marks</th>
                  <th className="p-3 border border-slate-300 dark:border-slate-600 text-center font-bold">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {assessmentIds.map((id) => {
                  const item = selectedReport.marks[id];
                  const percentage = item.obtained !== '-' && Number(item.max) > 0 
                    ? ((Number(item.obtained) / Number(item.max)) * 100).toFixed(1) + '%'
                    : 'N/A';
                  return (
                    <tr key={id} className="hover:bg-slate-50/50">
                      <td className="p-3 border border-slate-300 dark:border-slate-600 font-semibold text-slate-900 dark:text-white">{item.title || 'Assessment'}</td>
                      <td className="p-3 border border-slate-300 dark:border-slate-600 text-center font-bold text-slate-800 dark:text-slate-100">{item.obtained}</td>
                      <td className="p-3 border border-slate-300 dark:border-slate-600 text-center text-slate-500 dark:text-slate-400">{item.max}</td>
                      <td className="p-3 border border-slate-300 dark:border-slate-600 text-center font-bold text-slate-800 dark:text-slate-100">{percentage}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Performance summary card */}
            <div className="mt-8 flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-sans">
              <div>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Obtained Marks:</span>
                <p className="text-lg font-black text-slate-900 dark:text-white">{selectedReport.totalObtained} / {selectedReport.totalMax}</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Overall Percentage:</span>
                <p className="text-2xl font-black" style={{ color: template.themeColor }}>{selectedReport.percentage}%</p>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-12 grid grid-cols-2 gap-12 text-center font-sans text-xs mt-auto">
            <div>
              <div className="border-b border-slate-300 dark:border-slate-600 mx-auto w-48 h-8"></div>
              <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-2">Class Teacher Signature</p>
            </div>
            <div>
              <div className="border-b border-slate-300 dark:border-slate-600 mx-auto w-48 h-8"></div>
              <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mt-2">Principal Signature</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24 min-w-0 w-full">
      <div className="flex items-center gap-3 mb-8 w-full">
        <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-2xl flex items-center justify-center shadow-sm shrink-0">
          <Award size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight truncate">Academic Report Cards</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 font-medium">View and download your child's published academic progress records</p>
        </div>
      </div>

      {reportCards.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-12 text-center shadow-sm">
          <FileIcon className="mx-auto text-slate-300 mb-4" size={56} />
          <h3 className="text-slate-900 dark:text-white font-bold text-lg mb-1">No Report Cards Published</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-sm mx-auto">
            Official term-end report cards will appear here once finalized and published by the school administration.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reportCards.map((report) => (
            <div 
              key={report.id} 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-4">
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100">
                    {report.className}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-300 flex items-center gap-1">
                    <Calendar size={12} />
                    {report.publishedAt ? new Date(report.publishedAt).toLocaleDateString('en-GB') : 'N/A'}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-4">{report.examName}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">Published by: {report.publishedBy}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-3xl font-black text-slate-900 dark:text-white">{report.percentage}%</span>
                  <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase">Overall Result</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                <button 
                  onClick={() => setSelectedReport(report)}
                  className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-colors text-center text-sm shadow-sm"
                >
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
