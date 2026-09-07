import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, getAttendance, saveAttendance, subscribeToStudentsByClass, subscribeToAttendance, getAttendanceForClass, getAttendanceSettings } from '../../firebase/firestore';
import { getDoc, doc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuCalendar as CalendarIcon, LuCircleCheck as CheckCircle2, LuCircleX as XCircle, LuCircleAlert as AlertCircle, LuSave as Save, LuUsers as Users, LuFileDown, LuX, LuSquareCheck as CheckSquare } from 'react-icons/lu';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export default function Attendance() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.assignedClassId;

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSession, setSelectedSession] = useState('FN');

  const [classDetails, setClassDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState({}); // { studentId: 'Present' | 'Absent' | 'Late' }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const [viewMode, setViewMode] = useState('daily');
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [reportStats, setReportStats] = useState({});

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');

  // --- SOP Cutoff & Alerting State ---
  const [cutoffTime, setCutoffTime] = useState('09:30');
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    getAttendanceSettings(schoolId).then(settings => {
      if (settings && settings.cutoffTime) {
        setCutoffTime(settings.cutoffTime);
      }
    });
  }, [schoolId]);

  useEffect(() => {
    if (!cutoffTime || selectedDate !== today) {
      setIsPastCutoff(false);
      return;
    }
    const checkCutoff = () => {
      const now = new Date();
      const [h, m] = cutoffTime.split(':').map(Number);
      const cutoffDate = new Date();
      cutoffDate.setHours(h, m, 0, 0);
      setIsPastCutoff(now > cutoffDate);
    };
    checkCutoff();
    const interval = setInterval(checkCutoff, 60000);
    return () => clearInterval(interval);
  }, [cutoffTime, selectedDate, today]);

  const dailyFieldsList = [
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'status', label: 'Status' },
    { key: 'date', label: 'Date' },
    { key: 'session', label: 'Session' },
  ];
  const reportFieldsList = [
    { key: 'admissionNo', label: 'Admission No' },
    { key: 'studentName', label: 'Student Name' },
    { key: 'totalClasses', label: 'Total Classes' },
    { key: 'present', label: 'Present' },
    { key: 'absent', label: 'Absent' },
    { key: 'late', label: 'Late' },
    { key: 'percentage', label: 'Attendance %' },
  ];

  const availableFieldsList = viewMode === 'daily' ? dailyFieldsList : reportFieldsList;

  const [selectedFields, setSelectedFields] = useState(() => {
    const init = {};
    dailyFieldsList.forEach(f => { init[f.key] = true; });
    return init;
  });

  // Reset selected fields when view mode changes
  useEffect(() => {
    const init = {};
    availableFieldsList.forEach(f => { init[f.key] = true; });
    setSelectedFields(init);
  }, [viewMode]);

  const handleFieldToggle = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSelectAll = (selectVal) => {
    const updated = {};
    availableFieldsList.forEach(field => {
      updated[field.key] = selectVal;
    });
    setSelectedFields(updated);
  };

  useEffect(() => {
    if (!schoolId || !classId) return;
    
    getDoc(doc(db, `schools/${schoolId}/classes`, classId)).then(classDoc => {
      if (classDoc.exists()) setClassDetails({ id: classDoc.id, ...classDoc.data() });
    });

    const unsubStudents = subscribeToStudentsByClass(schoolId, classId, (studentsData) => {
      studentsData.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(studentsData);
    });

    return () => unsubStudents();
  }, [schoolId, classId]);

  useEffect(() => {
    if (students.length === 0 || viewMode !== 'daily') return;
    
    setLoading(true);
    const attendanceKey = `${selectedDate}_${selectedSession}`;
    const unsub = subscribeToAttendance(schoolId, classId, attendanceKey, (existingRecord) => {
      const newRecords = {};
      if (existingRecord && existingRecord.records) {
        setHasExistingRecord(true);
        // Load existing statuses
        students.forEach(student => {
          newRecords[student.id] = existingRecord.records[student.id] || 'Present';
        });
      } else {
        setHasExistingRecord(false);
        // Default everyone to Present, or Late if past cutoff
        const defaultStatus = isPastCutoff ? 'Late' : 'Present';
        students.forEach(student => {
          newRecords[student.id] = defaultStatus;
        });
      }
      setAttendanceRecords(newRecords);
      setLoading(false);
    });

    return () => unsub();
  }, [selectedDate, students, schoolId, classId, viewMode, isPastCutoff]);

  useEffect(() => {
    if (viewMode === 'daily' || !schoolId || !classId) return;
    
    setLoading(true);
    getAttendanceForClass(schoolId, classId).then(records => {
      setHistoricalRecords(records);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [viewMode, schoolId, classId]);

  useEffect(() => {
    if (viewMode === 'daily' || students.length === 0) return;

    const now = new Date();
    const filteredRecords = historicalRecords.filter(record => {
      // Record date might be stored as "YYYY-MM-DD" or "YYYY-MM-DD_FN"
      const dateString = record.date ? record.date.split('_')[0] : '';
      const recordDate = new Date(dateString);
      
      // Check for valid date
      if (isNaN(recordDate.getTime())) return false;
      
      if (viewMode === 'weekly') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return recordDate >= sevenDaysAgo && recordDate <= now;
      }
      if (viewMode === 'monthly') {
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }
      if (viewMode === 'term') {
        const recordMonth = recordDate.getMonth();
        const nowMonth = now.getMonth();
        const recordTerm = recordMonth >= 3 && recordMonth <= 8 ? 1 : 2;
        const nowTerm = nowMonth >= 3 && nowMonth <= 8 ? 1 : 2;
        let recordAcademicYear = recordDate.getFullYear();
        if (recordMonth < 3) recordAcademicYear -= 1;
        let nowAcademicYear = now.getFullYear();
        if (nowMonth < 3) nowAcademicYear -= 1;
        return recordTerm === nowTerm && recordAcademicYear === nowAcademicYear;
      }
      return true;
    });

    const stats = {};
    students.forEach(student => {
      stats[student.id] = { present: 0, absent: 0, late: 0, total: 0 };
    });

    filteredRecords.forEach(record => {
      if (!record.records) return;
      Object.keys(record.records).forEach(studentId => {
        if (stats[studentId]) {
          const status = record.records[studentId];
          if (status === 'Present') stats[studentId].present++;
          if (status === 'Absent') stats[studentId].absent++;
          if (status === 'Late') stats[studentId].late++;
          stats[studentId].total++;
        }
      });
    });

    setReportStats(stats);
  }, [historicalRecords, viewMode, students]);

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      const attendanceKey = `${selectedDate}_${selectedSession}`;
      await saveAttendance(schoolId, classId, attendanceKey, currentUser.uid, attendanceRecords);

      // Trigger notifications for Absent/Late students
      for (const [studentId, status] of Object.entries(attendanceRecords)) {
        if (status === 'Absent' || status === 'Late') {
          const student = students.find(s => s.id === studentId);
          const studentName = student ? `${student.firstName} ${student.lastName}` : 'Your child';

          // Query parents linked to this student
          const parentQuery = query(
            collection(db, 'users'),
            where('schoolId', '==', schoolId),
            where('linkedStudentId', '==', studentId),
            where('role', '==', 'parent')
          );
          const parentSnap = await getDocs(parentQuery);

          for (const parentDoc of parentSnap.docs) {
            await addDoc(collection(db, `schools/${schoolId}/notifications`), {
              userId: parentDoc.id,
              title: `Attendance Alert: ${status}`,
              message: `${studentName} was marked ${status} today (${new Date(selectedDate).toLocaleDateString('en-GB')}).`,
              createdAt: new Date().toISOString(),
              read: false,
              type: 'attendance'
            });
          }
        }
      }
      setSuccessMsg('Attendance saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const handleExport = () => {
    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error('Please select at least one column to export.');
      return;
    }
    try {
      const className = classDetails ? `${classDetails.name}-${classDetails.section}` : 'class';
      let wsData = [];
      let fileName = '';

      if (viewMode === 'daily') {
        fileName = `Attendance_${className}_${selectedDate}_${selectedSession}.xlsx`;
        wsData = students.map((student) => {
          const row = {};
          availableFieldsList.forEach(field => {
            if (!selectedFields[field.key]) return;
            if (field.key === 'admissionNo') row[field.label] = student.admissionNumber || '';
            if (field.key === 'studentName') row[field.label] = `${student.firstName} ${student.lastName}`;
            if (field.key === 'status') row[field.label] = attendanceRecords[student.id] || 'Present';
            if (field.key === 'date') row[field.label] = selectedDate;
            if (field.key === 'session') row[field.label] = selectedSession === 'FN' ? 'Forenoon' : 'Afternoon';
          });
          return row;
        });
      } else {
        const periodLabel = viewMode === 'weekly' ? 'Weekly' : viewMode === 'monthly' ? 'Monthly' : 'Term';
        fileName = `Attendance_${className}_${periodLabel}_Report.xlsx`;
        wsData = students.map((student) => {
          const stat = reportStats[student.id] || { present: 0, absent: 0, late: 0, total: 0 };
          const percentage = stat.total === 0 ? 100 : Math.round(((stat.present + stat.late) / stat.total) * 100);
          const row = {};
          availableFieldsList.forEach(field => {
            if (!selectedFields[field.key]) return;
            if (field.key === 'admissionNo') row[field.label] = student.admissionNumber || '';
            if (field.key === 'studentName') row[field.label] = `${student.firstName} ${student.lastName}`;
            if (field.key === 'totalClasses') row[field.label] = stat.total;
            if (field.key === 'present') row[field.label] = stat.present;
            if (field.key === 'absent') row[field.label] = stat.absent;
            if (field.key === 'late') row[field.label] = stat.late;
            if (field.key === 'percentage') row[field.label] = `${percentage}%`;
          });
          return row;
        });
      }

      if (wsData.length === 0 || Object.keys(wsData[0]).length === 0) {
        toast.error('No data to export.');
        return;
      }

      const ws = XLSX.utils.json_to_sheet(wsData);
      const colWidths = Object.keys(wsData[0]).map(key => ({
        wch: Math.max(key.length, ...wsData.map(row => String(row[key] || '').length)) + 2
      }));
      ws['!cols'] = colWidths;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
      
      const rawName = exportFileName.trim() || fileName.replace(/\.xlsx$/i, '');
      const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
      
      XLSX.writeFile(wb, finalFileName);
      setShowExportModal(false);
      toast.success('Attendance exported successfully!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export attendance.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-700 border-green-200';
      case 'Absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'Late': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    }
  };

  if (!classId) {
    return <div className="p-8 text-center text-slate-500 dark:text-slate-400">You must be assigned to a class to take attendance.</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col min-w-0 w-full">
      {/* Banner */}
      <div className="relative bg-gradient-to-br from-primary-600 to-indigo-700 rounded-3xl p-6 md:p-8 text-white overflow-hidden shadow-lg mb-8 shrink-0">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-primary-500/20 rounded-full blur-2xl translate-y-1/2"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 mb-4 backdrop-blur-sm">
              <CheckSquare size={14} /> My Assigned Class
            </span>
            <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
              Attendance Manager
            </h1>
            <p className="text-slate-300 text-lg flex items-center gap-2">
              {classDetails ? `${classDetails.name} - Section ${classDetails.section}` : 'Loading Class...'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0 w-full">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Mark Attendance</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Select date/session to register or view class attendance statistics.</p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50 p-2 rounded-2xl border border-slate-100 dark:border-slate-800 w-full sm:w-auto">
          <select 
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value)}
            className="w-full sm:w-auto border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-semibold py-2 pl-4 pr-10 bg-white dark:bg-slate-900 shadow-sm outline-none"
          >
            <option value="daily">Daily Marking</option>
            <option value="weekly">This Week Report</option>
            <option value="monthly">This Month Report</option>
            <option value="term">This Term Report</option>
          </select>
          {viewMode === 'daily' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 w-full sm:w-auto">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm w-full sm:w-auto">
                <div className="pl-2 text-slate-400 dark:text-slate-300">
                  <CalendarIcon size={20} />
                </div>
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full sm:w-auto border-none focus:ring-0 text-slate-700 dark:text-slate-200 font-medium py-1 pr-2 bg-transparent cursor-pointer outline-none"
                />
              </div>
              <select 
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="w-full sm:w-auto border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 bg-white dark:bg-slate-900 shadow-sm outline-none"
              >
                <option value="FN">FN (Forenoon)</option>
                <option value="AN">AN (Afternoon)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'daily' && isPastCutoff && !hasExistingRecord && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-3 animate-fade-in-down">
          <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-sm">Attendance not marked — past cutoff ({cutoffTime})</p>
            <p className="text-xs text-amber-700 mt-0.5">New marks will default to Late. Teachers can still mark attendance manually.</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-center gap-3 animate-fade-in-down">
          <CheckCircle2 size={20} className="text-green-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Table Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 pl-2">
            <Users size={18} />
            <span>{students.length} Students</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={() => {
                if (students.length === 0) {
                  toast.error("No student data available to export.");
                  return;
                }
                const className = classDetails ? `${classDetails.name}-${classDetails.section}` : 'class';
                const defaultName = viewMode === 'daily' 
                  ? `Attendance_${className}_${selectedDate}_${selectedSession}` 
                  : `Attendance_${className}_${viewMode === 'weekly' ? 'Weekly' : viewMode === 'monthly' ? 'Monthly' : 'Term'}_Report`;
                setExportFileName(defaultName);
                setShowExportModal(true);
              }}
              disabled={loading || students.length === 0}
              className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-md shadow-primary-600/10 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              <LuFileDown size={18} />
              Export
            </button>
            {viewMode === 'daily' && (
              <button 
                onClick={handleSave}
                disabled={saving || loading || students.length === 0}
                className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-colors"
              >
                {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Save size={18} />}
                {saving ? 'Saving...' : 'Save Attendance'}
              </button>
            )}
          </div>
        </div>
        
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <input 
            type="text" 
            placeholder="Search student by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/3 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
          />
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="p-20 flex justify-center">
             <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
          </div>
        ) : students.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">No students found</p>
            <p>There are no students enrolled in this class yet.</p>
          </div>
        ) : viewMode === 'daily' ? (
          <div className="divide-y divide-slate-100">
            {students
              .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((student) => {
              const currentStatus = attendanceRecords[student.id];

              return (
                <div key={student.id} className="p-4 pl-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-slate-700 shadow-sm">
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {student.firstName} {student.lastName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                        {student.admissionNumber}
                      </div>
                    </div>
                  </div>

                  {/* Status Toggles */}
                  <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg border border-slate-200 dark:border-slate-700 w-full sm:w-auto">
                    <button 
                      onClick={() => handleStatusChange(student.id, 'Present')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                        currentStatus === 'Present' ? 'bg-white dark:bg-slate-900 text-green-700 shadow-sm border border-slate-200/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {currentStatus === 'Present' && <CheckCircle2 size={16} className="text-green-500"/>}
                      Present
                    </button>
                    
                    <button 
                      onClick={() => handleStatusChange(student.id, 'Absent')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                        currentStatus === 'Absent' ? 'bg-white dark:bg-slate-900 text-red-700 shadow-sm border border-slate-200/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {currentStatus === 'Absent' && <XCircle size={16} className="text-red-500"/>}
                      Absent
                    </button>

                    <button 
                      onClick={() => handleStatusChange(student.id, 'Late')}
                      className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
                        currentStatus === 'Late' ? 'bg-white dark:bg-slate-900 text-amber-700 shadow-sm border border-slate-200/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                    >
                      {currentStatus === 'Late' && <AlertCircle size={16} className="text-amber-500"/>}
                      Late
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="overflow-x-auto w-full min-w-0">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 pl-6">Student Name</th>
                  <th className="p-4">Total Classes</th>
                  <th className="p-4 text-green-600">Present</th>
                  <th className="p-4 text-red-600">Absent</th>
                  <th className="p-4 text-amber-600">Late</th>
                  <th className="p-4 pr-6 text-right">Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {students
                  .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(student => {
                  const stat = reportStats[student.id] || { present: 0, absent: 0, late: 0, total: 0 };
                  const percentage = stat.total === 0 ? 100 : Math.round(((stat.present + stat.late) / stat.total) * 100);
                  
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-slate-900 dark:text-white">{student.firstName} {student.lastName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{student.admissionNumber}</div>
                      </td>
                      <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{stat.total}</td>
                      <td className="p-4 font-semibold text-green-600">{stat.present}</td>
                      <td className="p-4 font-semibold text-red-600">{stat.absent}</td>
                      <td className="p-4 font-semibold text-amber-600">{stat.late}</td>
                      <td className="p-4 pr-6 text-right">
                        <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full border ${
                          percentage >= 75 ? 'bg-green-50 text-green-700 border-green-200' : 
                          percentage >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' : 
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {percentage}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Export Field Selector Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Export Attendance</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Select columns to include in the exported Excel spreadsheet</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* File Name Input */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Attendance_Report"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm font-semibold"
                  />
                  <span className="absolute right-4 top-2.5 text-xs text-slate-400 dark:text-slate-300 font-bold font-mono select-none">.xlsx</span>
                </div>
              </div>

              {/* Select All / Deselect All Controls */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Deselect All
                </button>
              </div>

              {/* Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availableFieldsList.map((field) => (
                  <label 
                    key={field.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 cursor-pointer select-none transition-colors"
                  >
                    <input 
                      type="checkbox"
                      checked={selectedFields[field.key]}
                      onChange={() => handleFieldToggle(field.key)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors flex justify-center items-center gap-2"
              >
                <LuFileDown size={18} />
                Generate Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
