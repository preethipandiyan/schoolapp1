import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getStudentsByClass, 
  getAssessmentsByClass, 
  createAssessment, 
  updateAssessmentGrades,
  getExams,
  subscribeToStudentsByClass,
  subscribeToAssessmentsByClass,
  subscribeToExams
} from '../../firebase/firestore';
import { LuPlus as Plus, LuFileText as FileText, LuCircleCheck as CheckCircle2, LuSave as Save, LuX as X, LuBookOpen as BookOpen, LuGraduationCap as GraduationCap, LuPrinter as Printer, LuSend as Send } from 'react-icons/lu';
import toast from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

export default function Grades() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.assignedClassId;

  const [students, setStudents] = useState([]);
  const [assessments, setAssessments] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Assessment State
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [grades, setGrades] = useState({}); // { studentId: number }
  const [savingGrades, setSavingGrades] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAssessment, setNewAssessment] = useState({
    title: '',
    date: new Date().toISOString().split('T')[0],
    totalMarks: 100,
    examId: ''
  });

  useEffect(() => {
    if (!schoolId || !classId) return;

    setLoading(true);
    let studentsUnsub, assessmentsUnsub, examsUnsub;

    studentsUnsub = subscribeToStudentsByClass(schoolId, classId, (studentsData) => {
      studentsData.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(studentsData);
    });

    assessmentsUnsub = subscribeToAssessmentsByClass(schoolId, classId, (assessmentsData) => {
      setAssessments(assessmentsData);
      
      // If we haven't selected an assessment yet, and there's data, select the first one
      if (assessmentsData.length > 0) {
        // Need to wait for students state, or just use the current one.
        // The safest way is to just let the activeAssessment be set via handleSelectAssessment.
        // This is a bit tricky with split states, but setting loading false here is good.
      }
      setLoading(false);
    });

    examsUnsub = subscribeToExams(schoolId, (examsData) => {
      setExams(examsData);
    });

    return () => {
      if (studentsUnsub) studentsUnsub();
      if (assessmentsUnsub) assessmentsUnsub();
      if (examsUnsub) examsUnsub();
    };
  }, [schoolId, classId]);

  // Handle auto-selecting the first assessment when data is ready
  useEffect(() => {
    if (!activeAssessment && assessments.length > 0 && students.length > 0) {
      handleSelectAssessment(assessments[0], students);
    }
  }, [assessments, students, activeAssessment]);

  const handleSelectAssessment = (assessment, studentList = students) => {
    setActiveAssessment(assessment);
    const loadedGrades = {};
    studentList.forEach(student => {
      loadedGrades[student.id] = (assessment.grades && assessment.grades[student.id] !== undefined) 
        ? assessment.grades[student.id] 
        : '';
    });
    setGrades(loadedGrades);
    setSuccessMsg('');
  };

  const handleCreateAssessment = async (e) => {
    e.preventDefault();
    if (!newAssessment.title || !newAssessment.totalMarks) return;
    setCreating(true);
    try {
      const assessmentData = {
        ...newAssessment,
        classId,
        teacherId: currentUser.uid,
        totalMarks: Number(newAssessment.totalMarks),
        grades: {}
      };
      const newId = await createAssessment(schoolId, assessmentData);
      const createdAssessment = { id: newId, ...assessmentData };
      
      // setAssessments handled by listener
      setShowCreateModal(false);
      setNewAssessment({ title: '', date: new Date().toISOString().split('T')[0], totalMarks: 100 });
      
      // Auto-select the newly created assessment
      handleSelectAssessment(createdAssessment);
    } catch (error) {
      console.error("Error creating assessment", error);
      toast.error("Failed to create assessment.");
    } finally {
      setCreating(false);
    }
  };

  const handleExamLinkChange = (e) => {
    const selectedExamId = e.target.value;
    const selectedExam = exams.find(ex => ex.id === selectedExamId);
    
    if (selectedExam && selectedExam.maxMarks) {
       setNewAssessment(prev => ({
         ...prev,
         examId: selectedExamId,
         totalMarks: selectedExam.maxMarks
       }));
    } else {
       setNewAssessment(prev => ({
         ...prev,
         examId: selectedExamId
       }));
    }
  };

  const handleGradeChange = (studentId, value) => {
    // Only allow numbers
    if (value !== '' && isNaN(Number(value))) return;
    
    // Prevent entering more than max marks
    if (value !== '' && Number(value) > activeAssessment.totalMarks) {
      value = activeAssessment.totalMarks;
    }

    setGrades(prev => ({ ...prev, [studentId]: value }));
  };

  const handleSaveGrades = async () => {
    if (!activeAssessment) return;
    setSavingGrades(true);
    setSuccessMsg('');
    try {
      // Clean up empty strings to actual nulls or just don't save them
      const cleanedGrades = {};
      Object.keys(grades).forEach(id => {
        if (grades[id] !== '') {
          cleanedGrades[id] = Number(grades[id]);
        }
      });

      await updateAssessmentGrades(schoolId, activeAssessment.id, cleanedGrades);
      
      // Update local state to reflect saved grades
      // assessments listener handles state updates
      setSuccessMsg('Grades saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error saving grades:", error);
      toast.error("Failed to save grades.");
    } finally {
      setSavingGrades(false);
    }
  };

  const generateReportCards = () => {
    if (students.length === 0 || assessments.length === 0) {
      toast.error("Need students and assessments to generate report cards.");
      return;
    }
    const doc = new jsPDF();
    
    students.forEach((student, index) => {
      if (index > 0) doc.addPage();
      
      // School & Student Info Header
      doc.setFontSize(24);
      doc.setTextColor(15, 23, 42);
      doc.text("Student Progress Report", 105, 20, { align: "center" });
      
      doc.setFontSize(14);
      doc.text(`Student: ${student.firstName} ${student.lastName}`, 14, 40);
      doc.text(`Admission No: ${student.admissionNumber}`, 14, 50);

      // Grades Table
      const tableColumn = ["Assessment", "Date", "Marks Achieved", "Total Marks", "Percentage"];
      const tableRows = [];
      let totalAchieved = 0;
      let totalPossible = 0;

      assessments.forEach(assessment => {
        const val = assessment.grades?.[student.id];
        if (val !== undefined && val !== '') {
          const numVal = Number(val);
          totalAchieved += numVal;
          totalPossible += assessment.totalMarks;
          const percentage = ((numVal / assessment.totalMarks) * 100).toFixed(1) + '%';
          tableRows.push([
            assessment.title,
            assessment.date,
            numVal,
            assessment.totalMarks,
            percentage
          ]);
        } else {
          tableRows.push([
            assessment.title,
            assessment.date,
            'Not Graded',
            assessment.totalMarks,
            'N/A'
          ]);
        }
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 60,
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] }
      });

      const finalY = doc.lastAutoTable.finalY + 20;
      
      doc.setFontSize(16);
      if (totalPossible > 0) {
        const overallPercentage = ((totalAchieved / totalPossible) * 100).toFixed(1);
        doc.text(`Overall Performance: ${overallPercentage}%`, 14, finalY);
      } else {
        doc.text(`Overall Performance: N/A`, 14, finalY);
      }
      
      // Signatures
      doc.setFontSize(12);
      doc.setTextColor(100, 116, 139);
      doc.text("_______________________", 14, finalY + 40);
      doc.text("Class Teacher Signature", 14, finalY + 48);
      
      doc.text("_______________________", 140, finalY + 40);
      doc.text("Principal Signature", 140, finalY + 48);
    });

    doc.save("Class_Report_Cards.pdf");
  };

  const [publishing, setPublishing] = useState(false);

  const handlePublishReportCards = async () => {
    if (students.length === 0 || assessments.length === 0) {
      toast.error("Need students and assessments to publish report cards.");
      return;
    }
    
    setPublishing(true);
    const loadingToast = toast.loading("Publishing report cards to parent portal...");
    
    try {
      const defaultTemplate = {
        themeColor: '#3b82f6',
        header: {
          title: 'CLASS PROGRESS REPORT',
          subtitle: 'Continuous Assessment Summary',
          showLogo: true,
          showAddress: true,
          showPhone: true,
          showEmail: true
        }
      };

      const batchPromises = students.map(async (student) => {
        const studentId = student.id;
        const examId = `class_assessments_${classId}`;
        const docRef = doc(db, `schools/${schoolId}/students/${studentId}/report_cards`, examId);
        
        const marks = {};
        let totalObtained = 0;
        let totalMax = 0;
        
        assessments.forEach(assessment => {
          const score = assessment.grades?.[studentId];
          if (score !== undefined && score !== '') {
            const numScore = Number(score);
            totalObtained += numScore;
            totalMax += Number(assessment.totalMarks);
            marks[assessment.id] = {
              title: assessment.title,
              obtained: numScore,
              max: assessment.totalMarks
            };
          } else {
            marks[assessment.id] = {
              title: assessment.title,
              obtained: '-',
              max: assessment.totalMarks
            };
          }
        });
        
        const percentage = totalMax > 0 ? ((totalObtained / totalMax) * 100).toFixed(1) : '0.0';
        
        const reportCardDoc = {
          examId,
          examName: "Class Assessments Summary",
          classId: classId,
          className: classId,
          studentId,
          studentName: `${student.firstName} ${student.lastName}`,
          marks,
          totalObtained,
          totalMax,
          percentage,
          publishedAt: new Date().toISOString(),
          publishedBy: userProfile?.name || userProfile?.email || 'Class Teacher',
          reportTemplate: defaultTemplate
        };
        
        await setDoc(docRef, reportCardDoc);
      });
      
      await Promise.all(batchPromises);
      toast.dismiss(loadingToast);
      toast.success("Report cards published to parent portal successfully!");
    } catch (error) {
      console.error("Error publishing report cards:", error);
      toast.dismiss(loadingToast);
      toast.error("Failed to publish report cards.");
    } finally {
      setPublishing(false);
    }
  };


  if (!classId) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">You must be assigned to a class to manage grades.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 h-[calc(100vh-2rem)] flex flex-col min-w-0 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 shrink-0 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Grades & Assessments</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create exams and log student performance.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={handlePublishReportCards}
            disabled={publishing}
            className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-xl text-sm font-semibold hover:bg-green-100 shadow-sm transition-colors border border-green-200 disabled:opacity-50"
          >
            <Send size={18} className={publishing ? "animate-spin" : ""} /> {publishing ? "Publishing..." : "Publish to Parent Portal"}
          </button>
          <button 
            onClick={generateReportCards}
            className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-primary-50 text-primary-700 rounded-xl text-sm font-semibold hover:bg-primary-100 dark:hover:bg-slate-700 shadow-sm transition-colors border border-primary-200"
          >
            <Printer size={18} /> Print Report Cards
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus size={18} /> New Assessment
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-center gap-3 animate-fade-in-down shrink-0">
          <CheckCircle2 size={20} className="text-green-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8 flex-1 min-h-0">
        
        {/* Sidebar - Assessment List */}
        <div className="w-full lg:w-80 flex flex-col gap-4 shrink-0 overflow-y-auto">
          <h2 className="text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider pl-2">Assessments</h2>
          
          {assessments.length === 0 ? (
            <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center text-slate-500 dark:text-slate-400">
              <FileText size={32} className="mx-auto mb-3 text-slate-300" />
              <p className="font-medium text-slate-900 dark:text-white">No assessments yet</p>
              <p className="text-sm mt-1 mb-4">Create your first exam or homework assignment.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assessments.map(assessment => {
                const isActive = activeAssessment?.id === assessment.id;
                // Count graded students
                const gradedCount = assessment.grades ? Object.keys(assessment.grades).length : 0;
                const totalStudents = students.length;
                const isComplete = totalStudents > 0 && gradedCount === totalStudents;

                return (
                  <button
                    key={assessment.id}
                    onClick={() => handleSelectAssessment(assessment)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all ${
                      isActive 
                        ? 'bg-white dark:bg-slate-900 border-primary-500 shadow-md ring-1 ring-primary-500' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-slate-700 shadow-sm opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-white truncate">{assessment.title}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex justify-between">
                      <span>{assessment.date}</span>
                      <span className="font-mono">{assessment.totalMarks} Marks</span>
                    </div>
                    
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Progress</span>
                      <span className={`text-xs font-bold ${isComplete ? 'text-green-600' : 'text-primary-600'}`}>
                        {gradedCount} / {totalStudents} Graded
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Main Content - Grading Interface */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-0 overflow-hidden">
          {activeAssessment ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <BookOpen size={20} className="text-primary-600" />
                    {activeAssessment.title}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Grading out of <span className="font-bold text-slate-700 dark:text-slate-200">{activeAssessment.totalMarks}</span> total marks
                  </p>
                </div>
                <button 
                  onClick={handleSaveGrades}
                  disabled={savingGrades || students.length === 0}
                  className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-colors"
                >
                  {savingGrades ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Save size={18} />}
                  {savingGrades ? 'Saving...' : 'Save Grades'}
                </button>
              </div>

              {/* Data Table */}
              <div className="flex-1 overflow-y-auto overflow-x-auto w-full min-w-0">
                <table className="w-full text-left border-collapse min-w-max">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 shadow-sm z-10">
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                      <th className="p-4 pl-6">Student</th>
                      <th className="p-4">Admission No.</th>
                      <th className="p-4 w-48 text-right pr-6">Marks Achieved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {students.length === 0 ? (
                      <tr>
                        <td colSpan="3" className="p-16 text-center text-slate-500 dark:text-slate-400">
                          <GraduationCap size={40} className="mx-auto mb-4 text-slate-300" />
                          <p className="font-bold text-slate-900 dark:text-white">No students enrolled</p>
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => {
                        const val = grades[student.id];
                        const percentage = (val !== '' && val !== undefined) 
                          ? ((Number(val) / activeAssessment.totalMarks) * 100).toFixed(0) 
                          : null;

                        return (
                          <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 pl-6">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-xs border border-slate-200 dark:border-slate-700">
                                  {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                                </div>
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {student.firstName} {student.lastName}
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-sm text-slate-500 dark:text-slate-400">
                              {student.admissionNumber}
                            </td>
                            <td className="p-4 pr-6 text-right">
                              <div className="flex items-center justify-end gap-3">
                                {percentage !== null && (
                                  <span className={`text-xs font-bold ${Number(percentage) >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                                    {percentage}%
                                  </span>
                                )}
                                <div className="relative">
                                  <input 
                                    type="number"
                                    min="0"
                                    max={activeAssessment.totalMarks}
                                    value={grades[student.id] === undefined ? '' : grades[student.id]}
                                    onChange={(e) => handleGradeChange(student.id, e.target.value)}
                                    placeholder="--"
                                    className={`w-24 px-3 py-2 text-right rounded-lg border font-mono font-bold focus:ring-2 focus:ring-primary-500 transition-colors ${
                                      grades[student.id] !== '' && grades[student.id] !== undefined 
                                        ? 'border-green-300 bg-green-50 text-green-900' 
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                    }`}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 p-12 text-center">
              <FileText size={64} className="mb-4 text-slate-200" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Select an Assessment</h3>
              <p>Choose an assessment from the sidebar or create a new one to start grading.</p>
            </div>
          )}
        </div>

      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Assessment</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAssessment} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Assessment Title</label>
                  <input 
                    type="text" required
                    value={newAssessment.title}
                    onChange={(e) => setNewAssessment({...newAssessment, title: e.target.value})}
                    placeholder="e.g. Chapter 3 Quiz"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Date</label>
                    <input 
                      type="date" required
                      value={newAssessment.date}
                      onChange={(e) => setNewAssessment({...newAssessment, date: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Total Marks</label>
                    <input 
                      type="number" min="1" required
                      value={newAssessment.totalMarks}
                      onChange={(e) => setNewAssessment({...newAssessment, totalMarks: e.target.value})}
                      disabled={!!newAssessment.examId}
                      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 ${!!newAssessment.examId ? 'opacity-50 cursor-not-allowed bg-slate-50 dark:bg-slate-800' : ''}`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Link to Formal Exam (Optional)</label>
                  <select 
                    value={newAssessment.examId || ''}
                    onChange={handleExamLinkChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option value="">-- No Exam Link --</option>
                    {exams.map(exam => (
                      <option key={exam.id} value={exam.id}>
                        {exam.name} {exam.examType ? `(${exam.examType})` : ''} 
                        {exam.maxMarks ? ` - [${exam.maxMarks} Marks]` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Linking to an exam will include these marks in the formal Report Card.</p>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={creating}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
