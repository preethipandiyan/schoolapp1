import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from 'react-router-dom';
import {
  getExams, 
  createExam, 
  getSubCollection, 
  getStudentsByClass,
  getExamAssessments,
  getTemplate,
  subscribeToExams,
  subscribeToSubCollection
} from '../../firebase/firestore';
import { LuFileText as FileText, LuPlus as Plus, LuX as X, LuGraduationCap as GraduationCap, LuCalendar as Calendar, LuFileChartColumn as FileBarChart, LuLoaderCircle as Loader2, LuPrinter as Printer, LuPalette as Palette } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ReportTemplateBuilder from './ReportTemplateBuilder';
import { doc, setDoc } from 'firebase/firestore';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import { uploadCustomDataFiles } from '../../utils/cloudinary';
import { sortClassesAscending } from '../../utils/classSorting';

export default function ExamManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('manage'); // 'manage' | 'reports'
  const [exams, setExams] = useState([]);


  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Manage Exams State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newExam, setNewExam] = useState({ name: '', startDate: '', endDate: '', examType: 'Custom Exam', maxMarks: 100, customData: {} });

  // Report Card State
  const [selectedExamId, setSelectedExamId] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [reportData, setReportData] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [isBuildingTemplate, setIsBuildingTemplate] = useState(false);
  const [reportTemplate, setReportTemplate] = useState(null);

  useEffect(() => {
    setIsBuildingTemplate(false);
    setActiveTab('manage');
    setSelectedExamId('');
    setSelectedClassId('');
    setReportData(null);
  }, [location.pathname]);

  const fetchTemplate = () => {
    if (schoolId) {
      getTemplate(schoolId, 'report_card').then(templateData => {
        setReportTemplate(templateData);
      });
    }
  };

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let examsUnsub, classesUnsub;

    // Fetch template once statically
    fetchTemplate();

    examsUnsub = subscribeToExams(schoolId, (data) => {
      setExams(data);
      setLoading(false);
    });

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    return () => {
      if (examsUnsub) examsUnsub();
      if (classesUnsub) classesUnsub();
    };
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId && classes.length > 0) {
      const classExists = classes.some(c => c.id === selectedClassId);
      if (!classExists) {
        setSelectedClassId('');
      }
    }
  }, [classes, selectedClassId]);

  useEffect(() => {
    if (selectedExamId && exams.length > 0) {
      const examExists = exams.some(e => e.id === selectedExamId);
      if (!examExists) {
        setSelectedExamId('');
      }
    }
  }, [exams, selectedExamId]);

  const handleCreateExam = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const uploadedCustomData = await uploadCustomDataFiles(newExam.customData, schoolId, 'exams');
      await createExam(schoolId, {
        ...newExam,
        customData: uploadedCustomData,
        maxMarks: Number(newExam.maxMarks),
        status: 'active'
      });
      // Listener handles updates
      setShowCreateModal(false);
      setNewExam({ name: '', startDate: '', endDate: '', examType: 'Custom Exam', maxMarks: 100, customData: {} });
    } catch (error) {
      toast.error("Failed to create exam");
    } finally {
      setCreating(false);
    }
  };

  const generateReportCard = async () => {
    if (!selectedExamId || !selectedClassId) return;
    
    setGeneratingReport(true);
    try {
      // 1. Fetch Students in Class
      const students = await getStudentsByClass(schoolId, selectedClassId);
      students.sort((a, b) => a.firstName.localeCompare(b.firstName));

      // 2. Fetch all assessments for this class linked to this exam
      const assessments = await getExamAssessments(schoolId, selectedClassId, selectedExamId);

      // 3. Build data structure
      // We want rows = students, cols = assessments
      
      const rows = students.map(student => {
        let totalObtained = 0;
        let totalMax = 0;
        const marks = {}; // { assessmentId: { obtained, max } }

        assessments.forEach(assessment => {
          const studentMark = assessment.grades?.[student.id];
          if (studentMark !== undefined && studentMark !== null) {
            marks[assessment.id] = {
              obtained: studentMark,
              max: assessment.totalMarks
            };
            totalObtained += studentMark;
            totalMax += Number(assessment.totalMarks);
          } else {
            marks[assessment.id] = { obtained: '-', max: assessment.totalMarks };
          }
        });

        const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : 0;

        return {
          student,
          marks,
          totalObtained,
          totalMax,
          percentage
        };
      });

      setReportData({
        students: rows,
        assessments: assessments,
        className: classes.find(c => c.id === selectedClassId)?.className || '',
        examName: exams.find(e => e.id === selectedExamId)?.name || ''
      });

    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report card data.");
    } finally {
      setGeneratingReport(false);
    }
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublishReportCards = async () => {
    if (!reportData || !reportTemplate) {
      toast.error("Please generate report card data and customize/publish a template first.");
      return;
    }
    
    setPublishing(true);
    const loadingToast = toast.loading("Publishing report cards to parent portal...");
    try {
      const batchPromises = reportData.students.map(async (row) => {
        const studentId = row.student.id;
        const examId = selectedExamId;
        const docRef = doc(db, `schools/${schoolId}/students/${studentId}/report_cards`, examId);
        
        const reportCardDoc = {
          examId,
          examName: reportData.examName,
          classId: selectedClassId,
          className: reportData.className,
          studentId,
          studentName: `${row.student.firstName} ${row.student.lastName}`,
          marks: row.marks,
          totalObtained: row.totalObtained,
          totalMax: row.totalMax,
          percentage: row.percentage,
          publishedAt: new Date().toISOString(),
          publishedBy: userProfile?.name || userProfile?.email || 'Admin',
          reportTemplate: reportTemplate
        };
        
        await setDoc(docRef, reportCardDoc);
      });
      
      await Promise.all(batchPromises);
      toast.dismiss(loadingToast);
      toast.success("Report cards published successfully! Parents can now view them.");
    } catch (error) {
      console.error("Error publishing report cards:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to publish report cards.");
    } finally {
      setPublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (isBuildingTemplate) {
    return <ReportTemplateBuilder onBack={() => {
      setIsBuildingTemplate(false);
      fetchTemplate(); // Refetch template in case they saved it
    }} />;
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Examinations & Results</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage school-wide exams and generate report cards.</p>
        </div>
        {activeTab === 'manage' && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors w-full sm:w-auto justify-center"
          >
            <Plus size={18} /> Create Exam
          </button>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-[500px]">
        {/* Header Tabs */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex gap-2 bg-slate-50 dark:bg-slate-800 rounded-t-3xl overflow-x-auto custom-scrollbar">
          <button 
            onClick={() => setActiveTab('manage')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'manage' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            Manage Exams
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${activeTab === 'reports' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            Report Cards
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1">
          {activeTab === 'manage' ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {exams.length === 0 ? (
                <div className="col-span-full p-12 text-center text-slate-500 dark:text-slate-400">
                  <FileText size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-900 dark:text-white">No exams created yet</p>
                  <p>Click "Create Exam" to schedule a formal examination.</p>
                </div>
              ) : (
                exams.map(exam => (
                  <div key={exam.id} className="border border-slate-200 dark:border-slate-700 rounded-2xl p-5 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2.5 bg-primary-50 text-primary-600 rounded-xl">
                        <FileText size={24} />
                      </div>
                      <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                        {exam.status}
                      </span>
                    </div>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{exam.name}</h3>
                    <div className="flex flex-col gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
                      <div className="flex items-center gap-2 font-medium text-slate-600 dark:text-slate-300">
                        <FileText size={16} className="text-primary-500" />
                        {exam.examType || 'Standard Exam'} <span className="text-slate-300">•</span> {exam.maxMarks || 100} Max Marks
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {new Date(exam.startDate).toLocaleDateString('en-GB')} - {new Date(exam.endDate).toLocaleDateString('en-GB')}
                      </div>
                    </div>
                    {exam.customData && Object.keys(exam.customData).length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <CustomFieldsRenderer
                          moduleKey="exams"
                          customData={exam.customData}
                          readOnly={true}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-4 items-end bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex-1 w-full">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Exam</label>
                  <select 
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200! bg-white! text-black! focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="" className="text-black bg-white dark:bg-slate-900">-- Choose Exam --</option>
                    {exams.map(e => <option key={e.id} value={e.id} className="text-black bg-white dark:bg-slate-900">{e.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 w-full">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Class</label>
                  <select 
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200! bg-white! text-black! focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="" className="text-black bg-white dark:bg-slate-900">-- Choose Class --</option>
                    {classes.map(c => <option key={c.id} value={c.id} className="text-black bg-white dark:bg-slate-900">{c.name} - Section {c.section}</option>)}
                  </select>
                </div>
                <button 
                  onClick={generateReportCard}
                  disabled={!selectedExamId || !selectedClassId || generatingReport}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 h-11 shrink-0 w-full md:w-auto"
                >
                  {generatingReport ? <Loader2 size={18} className="animate-spin" /> : <FileBarChart size={18} />}
                  Generate View
                </button>
                <button 
                  onClick={() => setIsBuildingTemplate(true)}
                  className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 h-11 shrink-0 w-full md:w-auto"
                >
                  <Palette size={18} />
                  Customize Design
                </button>
              </div>

              <div className="p-6 flex-1 overflow-x-auto">
                {!reportData ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 py-12">
                    <FileBarChart size={64} className="mb-4 text-slate-200" />
                    <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Select an exam and class to view report cards</p>
                  </div>
                ) : (
                  <div>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-6">
                      <div className="min-w-0">
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white truncate">{reportData.examName}</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2 mt-1">
                          <GraduationCap size={16} /> Class: {reportData.className}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 w-full md:w-auto">
                        <button 
                          onClick={handlePublishReportCards}
                          disabled={publishing}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50"
                        >
                          <FileText size={18} /> {publishing ? 'Publishing...' : 'Publish Report Cards'}
                        </button>
                        <button 
                          onClick={() => window.print()}
                          className="px-4 py-2 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-colors flex items-center gap-2"
                        >
                          <Printer size={18} /> Print Record
                        </button>
                      </div>
                    </div>

                    {reportData.assessments.length === 0 ? (
                      <div className="p-8 bg-amber-50 text-amber-700 rounded-2xl border border-amber-200">
                        <p className="font-bold mb-1">No grades found!</p>
                        <p className="text-sm">Teachers have not linked any assessments for this class to this exam yet.</p>
                      </div>
                    ) : (
                      <>
                        {!reportTemplate ? (
                          <div className="p-8 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl border border-slate-200 dark:border-slate-700 text-center">
                            <Palette size={48} className="mx-auto mb-4 text-slate-400 dark:text-slate-300" />
                            <p className="font-bold mb-1">No Template Published</p>
                            <p className="text-sm mb-4">Please design and publish a Report Card Template first.</p>
                            <button onClick={() => setIsBuildingTemplate(true)} className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold">Customize Design</button>
                          </div>
                        ) : (
                          <div className="space-y-12">
                            {reportData.students.map((row) => (
                              <div key={row.student.id} className="bg-white dark:bg-slate-900 shadow-xl max-w-[794px] min-h-[1123px] mx-auto flex flex-col print:shadow-none print:break-after-page" style={{ fontFamily: "'Times New Roman', serif" }}>
                                {/* Report Card Header */}
                                <div className="p-8 pb-4 flex items-center border-b-[3px]" style={{ borderColor: reportTemplate.themeColor }}>
                                  {reportTemplate.header.showLogo && (
                                    <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center border-2 shrink-0" style={{ borderColor: reportTemplate.themeColor }}>
                                      <span className="text-xs text-slate-400 dark:text-slate-300 font-sans font-bold">LOGO</span>
                                    </div>
                                  )}
                                  <div className={`flex-1 ${reportTemplate.header.showLogo ? 'text-center' : 'text-left'}`}>
                                    <h1 className="text-3xl font-black uppercase text-slate-900 dark:text-white" style={{ color: reportTemplate.themeColor }}>{userProfile?.schoolName || 'YOUR SCHOOL NAME'}</h1>
                                    <div className="text-sm mt-2 text-slate-700 dark:text-slate-200">
                                      {reportTemplate.header.showAddress && <span>123 Education Street, Learning City, 10001<br/></span>}
                                      <span className="font-medium">
                                        {reportTemplate.header.showPhone && <span>Tel: +1 234 567 8900 </span>}
                                        {reportTemplate.header.showPhone && reportTemplate.header.showEmail && <span> | </span>}
                                        {reportTemplate.header.showEmail && <span>Email: info@yourschool.edu</span>}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Title Section */}
                                <div className="py-6 text-center">
                                  <h2 className="text-2xl font-bold uppercase underline decoration-2 underline-offset-4" style={{ decorationColor: reportTemplate.themeColor }}>
                                    {reportTemplate.header.title}
                                  </h2>
                                  <p className="text-md font-semibold text-slate-600 dark:text-slate-300 mt-2">{reportTemplate.header.subtitle}</p>
                                </div>

                                {/* Student Details Grid */}
                                <div className="px-10 pb-8">
                                  <div className="grid grid-cols-2 gap-x-12 gap-y-3 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-sans">
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Student Name:</span>
                                      <span className="font-bold text-slate-900 dark:text-white text-sm">{row.student.firstName} {row.student.lastName}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Class & Section:</span>
                                      <span className="font-bold text-slate-900 dark:text-white text-sm">{reportData.className}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Roll No:</span>
                                      <span className="font-bold text-slate-900 dark:text-white text-sm">{row.student.admissionNumber || 'N/A'}</span>
                                    </div>

                                    {reportTemplate.studentFields.admissionNo && (
                                      <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Admission No:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{row.student.admissionNumber || '-'}</span>
                                      </div>
                                    )}
                                    {reportTemplate.studentFields.dob && (
                                      <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Date of Birth:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{row.student.dateOfBirth || '-'}</span>
                                      </div>
                                    )}
                                    {reportTemplate.studentFields.fatherName && (
                                      <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Father's Name:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">{row.student.parentName || '-'}</span>
                                      </div>
                                    )}
                                    {reportTemplate.studentFields.motherName && (
                                      <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Mother's Name:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">-</span>
                                      </div>
                                    )}
                                    {reportTemplate.studentFields.attendance && (
                                      <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                                        <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Attendance:</span>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">- / -</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Marks Table */}
                                <div className="px-10 flex-1">
                                  <table className="w-full border-collapse font-sans text-sm">
                                    <thead>
                                      <tr className="text-white" style={{ backgroundColor: reportTemplate.themeColor }}>
                                        <th className="border border-slate-400 p-2 text-left">Assessment</th>
                                        <th className="border border-slate-400 p-2 text-center w-24">Max Marks</th>
                                        {['marks', 'marks_and_grades'].includes(reportTemplate.grading.style) && <th className="border border-slate-400 p-2 text-center">Marks Obt.</th>}
                                        {['grades', 'marks_and_grades'].includes(reportTemplate.grading.style) && <th className="border border-slate-400 p-2 text-center">Grade</th>}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {reportData.assessments.map((a, i) => {
                                        const mark = row.marks[a.id]?.obtained;
                                        // Simple grade logic for display
                                        let grade = '-';
                                        if (mark !== undefined) {
                                          const perc = (mark / a.totalMarks) * 100;
                                          if (perc >= 91) grade = 'A1';
                                          else if (perc >= 81) grade = 'A2';
                                          else if (perc >= 71) grade = 'B1';
                                          else if (perc >= 61) grade = 'B2';
                                          else if (perc >= 51) grade = 'C1';
                                          else if (perc >= 41) grade = 'C2';
                                          else if (perc >= 33) grade = 'D';
                                          else grade = 'E';
                                        }

                                        return (
                                          <tr key={a.id} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}>
                                            <td className="border border-slate-400 p-2 font-medium">{a.title}</td>
                                            <td className="border border-slate-400 p-2 text-center">{a.totalMarks}</td>
                                            {['marks', 'marks_and_grades'].includes(reportTemplate.grading.style) && <td className="border border-slate-400 p-2 text-center font-bold text-slate-800 dark:text-slate-100">{mark !== undefined ? mark : '-'}</td>}
                                            {['grades', 'marks_and_grades'].includes(reportTemplate.grading.style) && <td className="border border-slate-400 p-2 text-center font-bold text-slate-800 dark:text-slate-100">{grade}</td>}
                                          </tr>
                                        );
                                      })}
                                      {/* Totals */}
                                      {(reportTemplate.grading.showTotal || reportTemplate.grading.showPercentage) && (
                                        <tr className="bg-slate-100 dark:bg-slate-700 font-bold">
                                          <td className="border border-slate-400 p-2 text-right">TOTAL</td>
                                          <td className="border border-slate-400 p-2 text-center">{row.totalMax}</td>
                                          {['marks', 'marks_and_grades'].includes(reportTemplate.grading.style) && <td className="border border-slate-400 p-2 text-center text-primary-700" style={{ color: reportTemplate.themeColor }}>{row.totalObtained}</td>}
                                          {['grades', 'marks_and_grades'].includes(reportTemplate.grading.style) && <td className="border border-slate-400 p-2 text-center text-primary-700" style={{ color: reportTemplate.themeColor }}>-</td>}
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                  
                                  {reportTemplate.grading.showPercentage && (
                                    <div className="mt-4 text-right font-sans font-bold text-lg">
                                      Percentage: <span style={{ color: reportTemplate.themeColor }}>{row.percentage}%</span>
                                    </div>
                                  )}
                                </div>

                                {/* Remarks Area */}
                                {reportTemplate.footer.remarks && (
                                  <div className="px-10 mt-8">
                                    <div className="border-2 border-slate-300 dark:border-slate-600 p-4 rounded-xl min-h-[80px]">
                                      <span className="font-bold text-sm text-slate-700 dark:text-slate-200 block mb-1">Class Teacher's Remarks:</span>
                                      <span className="text-sm font-medium italic text-slate-500 dark:text-slate-400 block h-8 border-b border-dashed border-slate-300 dark:border-slate-600"></span>
                                      <span className="text-sm font-medium italic text-slate-500 dark:text-slate-400 block h-8 border-b border-dashed border-slate-300 dark:border-slate-600 mt-2"></span>
                                    </div>
                                  </div>
                                )}

                                {/* Footer Section */}
                                <div className="px-10 pt-16 pb-8 mt-auto flex flex-col font-sans">
                                  {/* Signatures */}
                                  <div className="flex justify-between w-full mb-8">
                                    {reportTemplate.footer.signatures.map((sig, index) => (
                                      <div key={index} className="flex flex-col items-center">
                                        <div className="w-32 border-b-2 border-slate-900 mb-2"></div>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{sig}</span>
                                      </div>
                                    ))}
                                  </div>

                                  {/* Grading Scale */}
                                  {reportTemplate.footer.gradingScaleText && (
                                    <div className="border-t border-slate-300 dark:border-slate-600 pt-4 text-center">
                                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Grading Scale</span>
                                      <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                                        {reportTemplate.footer.gradingScaleText}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Exam Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="text-primary-600" /> Create Exam
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Exam Name</label>
                  <input 
                    type="text" required
                    value={newExam.name}
                    onChange={(e) => setNewExam({...newExam, name: e.target.value})}
                    placeholder="e.g. Mid-Term 2026"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Exam Type</label>
                    <input 
                      type="text" required
                      value={newExam.examType}
                      onChange={(e) => setNewExam({...newExam, examType: e.target.value})}
                      placeholder="e.g. Unit Test, Midterm, Final"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Max Marks</label>
                    <input 
                      type="number" min="1" required
                      value={newExam.maxMarks}
                      onChange={(e) => setNewExam({...newExam, maxMarks: e.target.value})}
                      placeholder="100"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Start Date</label>
                    <input 
                      type="date" required
                      value={newExam.startDate}
                      onChange={(e) => setNewExam({...newExam, startDate: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">End Date</label>
                    <input 
                      type="date" required
                      value={newExam.endDate}
                      min={newExam.startDate}
                      onChange={(e) => setNewExam({...newExam, endDate: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <CustomFieldsRenderer
                    moduleKey="exams"
                    customData={newExam.customData}
                    onChange={(k, v) => setNewExam(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">
                  {creating ? 'Saving...' : 'Create Exam'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
