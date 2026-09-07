import React, { useState, useEffect } from 'react';
import { subscribeToSubCollection, subscribeToStudentsByClass, subscribeToAttendance, saveAttendance, getAttendanceForClass, getAttendanceSettings, updateStudentRunningStatsAndFlags } from '../../firebase/firestore';
import { useAuth } from '../../context/AuthContext';
import { doc, onSnapshot, updateDoc, setDoc, collection, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuCalendar as CalendarIcon, LuCircleCheck as CheckCircle2, LuSave as Save, LuUsers as Users, LuCircleAlert as AlertCircle, LuLayoutDashboard as DashboardIcon, LuClipboardCheck as ClipboardIcon, LuChevronDown as ChevronDown, LuChevronUp as ChevronUp, LuTrendingUp as TrendIcon, LuDownload as DownloadIcon, LuFileSpreadsheet as ExcelIcon } from 'react-icons/lu';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { sortClassesAscending } from '../../utils/classSorting';

export default function Attendance() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;

  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedSession, setSelectedSession] = useState('FN');
  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');

  const [students, setStudents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState('daily');
  const [historicalRecords, setHistoricalRecords] = useState([]);
  const [reportStats, setReportStats] = useState({});

  // --- SOP Cutoff & Alerting State ---
  const [cutoffTime, setCutoffTime] = useState('09:30');
  const [isPastCutoff, setIsPastCutoff] = useState(false);
  const [hasExistingRecord, setHasExistingRecord] = useState(false);

  // --- Phase 3 & 4 Tabs, Dashboard & Analytics States ---
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'marking' | 'analytics'
  const [dashboardStats, setDashboardStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [pendingAlerts, setPendingAlerts] = useState([]);
  const [expandedGrades, setExpandedGrades] = useState({});

  // Phase 4 Analytics states
  const [monthlyStatsList, setMonthlyStatsList] = useState([]);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [absenteeFlags, setAbsenteeFlags] = useState([]);
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [filterClassId, setFilterClassId] = useState('all');

  // Role details
  const isCoordinator = userProfile?.role === 'coordinator' || userProfile?.role === 'Grade Coordinator';
  const assignedGrades = userProfile?.assignedGrades || []; // e.g. ['5', 'Grade 5']

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

  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      const sortedClasses = sortClassesAscending(data);
      setClasses(sortedClasses);
      if (sortedClasses.length > 0 && !selectedClassId) {
        setSelectedClassId(sortedClasses[0].id);
      }
    });
    return () => unsub();
  }, [schoolId]);

  useEffect(() => {
    if (!schoolId || !selectedClassId) {
      setStudents([]);
      return;
    }
    const unsub = subscribeToStudentsByClass(schoolId, selectedClassId, (data) => {
      data.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(data);
    });
    return () => unsub();
  }, [schoolId, selectedClassId]);

  useEffect(() => {
    if (students.length === 0 || !selectedClassId || viewMode !== 'daily') return;
    setLoading(true);
    const attendanceKey = `${selectedDate}_${selectedSession}`;
    const unsub = subscribeToAttendance(schoolId, selectedClassId, attendanceKey, (existingRecord) => {
      const newRecords = {};
      if (existingRecord && existingRecord.records) {
        setHasExistingRecord(true);
        students.forEach(student => {
          newRecords[student.id] = existingRecord.records[student.id] || 'Present';
        });
      } else {
        setHasExistingRecord(false);
        const defaultStatus = isPastCutoff ? 'Late' : 'Present';
        students.forEach(student => {
          newRecords[student.id] = defaultStatus;
        });
      }
      setAttendanceRecords(newRecords);
      setLoading(false);
    });
    return () => unsub();
  }, [selectedDate, students, schoolId, selectedClassId, viewMode, isPastCutoff]);

  useEffect(() => {
    if (viewMode === 'daily' || !schoolId || !selectedClassId) return;

    setLoading(true);
    getAttendanceForClass(schoolId, selectedClassId).then(records => {
      setHistoricalRecords(records);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [viewMode, schoolId, selectedClassId]);

  useEffect(() => {
    if (viewMode === 'daily' || students.length === 0) return;

    const now = new Date();
    const filteredRecords = historicalRecords.filter(record => {
      const dateString = record.date ? record.date.split('_')[0] : '';
      const recordDate = new Date(dateString);

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

  // Real-time Dashboard stats subscription
  useEffect(() => {
    if (!schoolId || activeTab !== 'dashboard') return;
    setLoadingStats(true);
    const statsDocRef = doc(db, `schools/${schoolId}/dashboardStats`, selectedDate);
    const unsub = onSnapshot(statsDocRef, (snap) => {
      if (snap.exists()) {
        setDashboardStats(snap.data());
      } else {
        setDashboardStats(null);
      }
      setLoadingStats(false);
    }, (error) => {
      console.error("Error loading dashboard stats:", error);
      setLoadingStats(false);
    });
    return () => unsub();
  }, [schoolId, selectedDate, activeTab]);

  // Real-time Pending alerts subscription
  useEffect(() => {
    if (!schoolId) return;
    const q = query(
      collection(db, `schools/${schoolId}/notifications`),
      where('type', '==', 'attendance_pending'),
      where('date', '==', selectedDate),
      where('read', '==', false)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const alerts = [];
      snapshot.forEach(docSnap => {
        alerts.push({ id: docSnap.id, ...docSnap.data() });
      });
      setPendingAlerts(alerts);
    }, (error) => {
      console.error("Error fetching pending alerts:", error);
    });
    return () => unsub();
  }, [schoolId, selectedDate]);

  // Real-time Monthly stats subscription for current month trend
  useEffect(() => {
    if (!schoolId || activeTab !== 'analytics') return;
    setLoadingMonthly(true);
    const currentMonthPrefix = selectedDate.slice(0, 7); // e.g. YYYY-MM
    const q = query(
      collection(db, `schools/${schoolId}/dashboardStats`),
      orderBy('date', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(docSnap => {
        if (docSnap.id.startsWith(currentMonthPrefix)) {
          list.push(docSnap.data());
        }
      });
      setMonthlyStatsList(list);
      setLoadingMonthly(false);
    }, (error) => {
      console.error("Error loading monthly stats list:", error);
      setLoadingMonthly(false);
    });
    return () => unsub();
  }, [schoolId, selectedDate, activeTab]);

  // Real-time Absentee flags subscription for current month
  useEffect(() => {
    if (!schoolId || activeTab !== 'analytics') return;
    setLoadingFlags(true);
    const currentMonthStr = selectedDate.slice(0, 7); // YYYY-MM
    const q = query(
      collection(db, `schools/${schoolId}/absenteeFlags`),
      where('month', '==', currentMonthStr)
    );
    const unsub = onSnapshot(q, async (snap) => {
      const flags = [];
      const studentPromises = [];
      snap.forEach(docSnap => {
        const flagData = docSnap.data();
        flags.push(flagData);
        studentPromises.push(
          getDoc(doc(db, `schools/${schoolId}/students`, flagData.studentId))
        );
      });

      const studentSnaps = await Promise.all(studentPromises);
      const studentMap = {};
      studentSnaps.forEach(sSnap => {
        if (sSnap.exists()) {
          studentMap[sSnap.id] = sSnap.data();
        }
      });

      const enrichedFlags = flags.map(f => ({
        ...f,
        studentName: studentMap[f.studentId] ? `${studentMap[f.studentId].firstName} ${studentMap[f.studentId].lastName}` : 'Unknown Student',
        rollNumber: studentMap[f.studentId] ? studentMap[f.studentId].rollNumber : '-'
      }));

      // Sort client-side to avoid composite index requirements
      enrichedFlags.sort((a, b) => (b.absentCount || 0) - (a.absentCount || 0));

      setAbsenteeFlags(enrichedFlags);
      setLoadingFlags(false);
    }, (error) => {
      console.error("Error loading absentee flags:", error);
      setLoadingFlags(false);
    });
    return () => unsub();
  }, [schoolId, selectedDate, activeTab]);

  // Export to Excel trigger
  const handleExportExcel = () => {
    try {
      const dataToExport = absenteeFlags.map(f => ({
        "Roll No": f.rollNumber,
        "Student Name": f.studentName,
        "Class ID": f.classId,
        "Month": f.month,
        "Absence Count": f.absentCount,
        "Flagged At": f.flaggedAt ? new Date(f.flaggedAt).toLocaleDateString('en-GB') : '-'
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Repeated Absentees");
      XLSX.writeFile(workbook, `repeated_absentees_${selectedDate.slice(0, 7)}.xlsx`);
      toast.success("Excel exported successfully!");
    } catch (e) {
      console.error("Failed to export Excel:", e);
      toast.error("Failed to export Excel.");
    }
  };


  // Helper to compile grade averages
  const getGradeMonthAverages = () => {
    const gradesMap = {};
    monthlyStatsList.forEach(stat => {
      Object.entries(stat.byGrade || {}).forEach(([gradeId, gradeData]) => {
        if (!gradesMap[gradeId]) {
          gradesMap[gradeId] = { totalPercentage: 0, count: 0 };
        }
        gradesMap[gradeId].totalPercentage += gradeData.percentage;
        gradesMap[gradeId].count++;
      });
    });

    return Object.entries(gradesMap).map(([gradeId, accum]) => ({
      gradeId,
      average: Math.round(accum.totalPercentage / accum.count)
    }));
  };

  const renderTrendSVG = () => {
    if (monthlyStatsList.length === 0) return null;
    const width = 600;
    const height = 150;
    const padding = 30;

    const points = monthlyStatsList.map((stat, idx) => {
      const x = padding + (idx / (monthlyStatsList.length - 1 || 1)) * (width - 2 * padding);
      const percentage = stat.schoolWide?.percentage ?? 100;
      const y = height - padding - (percentage / 100) * (height - 2 * padding);
      return { x, y, date: stat.date, percentage };
    });

    const pathData = points.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, "");

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48 bg-slate-50/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 p-2">
        {[0, 25, 50, 75, 100].map(val => {
          const y = height - padding - (val / 100) * (height - 2 * padding);
          return (
            <g key={val}>
              <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padding - 5} y={y + 4} textAnchor="end" className="text-[8px] fill-slate-400 font-bold font-mono">{val}%</text>
            </g>
          );
        })}
        {pathData && <path d={pathData} fill="none" stroke="rgb(79, 70, 229)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((p, idx) => (
          <g key={idx} className="group cursor-pointer">
            <circle cx={p.x} cy={p.y} r="4" className="fill-indigo-600 stroke-white stroke-2 hover:r-6 transition-all" />
            <title>{p.date}: {p.percentage}%</title>
          </g>
        ))}
      </svg>
    );
  };

  const handleStatusChange = (studentId, status) => {
    setAttendanceRecords(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const attendanceKey = `${selectedDate}_${selectedSession}`;
      await saveAttendance(schoolId, selectedClassId, attendanceKey, currentUser.uid, attendanceRecords);
      toast.success('Attendance saved successfully!');
    } catch (error) {
      console.error("Error saving attendance:", error);
      toast.error("Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const handleDismissAlert = async (alertId) => {
    try {
      await updateDoc(doc(db, `schools/${schoolId}/notifications`, alertId), {
        read: true,
        resolvedAt: new Date().toISOString()
      });
      toast.success("Alert dismissed.");
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast.error("Failed to dismiss alert.");
    }
  };

  const toggleGrade = (gradeId) => {
    setExpandedGrades(prev => ({ ...prev, [gradeId]: !prev[gradeId] }));
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Present': return 'bg-green-100 text-green-700 border-green-200';
      case 'Absent': return 'bg-red-100 text-red-700 border-red-200';
      case 'Late': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
    }
  };

  // Helper to filter and compile grade coordinator metrics client-side
  const getScopedStats = () => {
    if (!dashboardStats) return null;
    if (!isCoordinator || assignedGrades.length === 0) return dashboardStats;

    const filteredByGrade = {};
    const filteredBySection = {};

    Object.entries(dashboardStats.byGrade || {}).forEach(([gradeId, data]) => {
      const matches = assignedGrades.some(g =>
        g.toLowerCase() === gradeId.toLowerCase() ||
        gradeId.toLowerCase().includes(g.toLowerCase())
      );
      if (matches) filteredByGrade[gradeId] = data;
    });

    Object.entries(dashboardStats.bySection || {}).forEach(([classId, data]) => {
      const gradeId = data.gradeId || '';
      const matches = assignedGrades.some(g =>
        g.toLowerCase() === gradeId.toLowerCase() ||
        gradeId.toLowerCase().includes(g.toLowerCase())
      );
      if (matches) filteredBySection[classId] = data;
    });

    const schoolWide = { total: 0, present: 0, absent: 0, late: 0, percentage: 100 };
    Object.values(filteredByGrade).forEach(g => {
      schoolWide.total += g.total;
      schoolWide.present += g.present;
      schoolWide.absent += g.absent;
      schoolWide.late += g.late;
    });
    if (schoolWide.total > 0) {
      schoolWide.percentage = Math.round(((schoolWide.present + schoolWide.late) / schoolWide.total) * 100);
    }

    const classesTotal = Object.keys(filteredBySection).length;
    // Map marked classes based on having stats present inside bySection
    const classesMarked = Object.values(filteredBySection).filter(s => s.total > 0).length;

    return {
      ...dashboardStats,
      schoolWide,
      byGrade: filteredByGrade,
      bySection: filteredBySection,
      classesMarked,
      classesTotal
    };
  };

  const scopedStats = getScopedStats();

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      {/* Top Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Attendance Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View analytics, run cutoff audits, and log student attendance records.</p>
        </div>

        {/* Tab Selection Wrapper for Mobile Scroll */}
        <div className="w-full min-w-0 overflow-x-auto custom-scrollbar pb-1 -mb-1">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm min-w-max">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'dashboard'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
            >
              <DashboardIcon size={16} /> Dashboard
            </button>
            <button
              onClick={() => setActiveTab('marking')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'marking'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
            >
              <ClipboardIcon size={16} /> Daily Marking
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-md'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                }`}
            >
              <TrendIcon size={16} /> Analytics
            </button>
          </div>
        </div>
      </div>

      {/* --- DASHBOARD TAB VIEW --- */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          {/* Dashboard Filtering Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CalendarIcon className="text-primary-600" size={24} />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Historical Archives</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Select a calendar date to view the daily attendance snapshot.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-slate-700 dark:text-slate-200 font-semibold bg-white dark:bg-slate-900 cursor-pointer shadow-sm text-sm"
              />
              {selectedDate !== today && (
                <button
                  onClick={() => setSelectedDate(today)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {loadingStats ? (
            <div className="p-20 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : !scopedStats ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 dark:text-slate-300">
              <ClipboardIcon className="mx-auto mb-3 opacity-30" size={48} />
              <p className="font-bold text-base text-slate-600 dark:text-slate-300">No Statistics Calculated</p>
              <p className="text-xs mt-1">There are no dashboard records compiled for {selectedDate}. Marks must be saved to compile stats.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Left Column: Aggregated Breakdown */}
              <div className="xl:col-span-2 space-y-6">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Attendance Rate</p>
                    <p className="text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
                      {scopedStats.schoolWide?.percentage ?? 100}%
                    </p>
                    <div className="mt-4 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${scopedStats.schoolWide?.percentage ?? 100}%` }}></div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Classes Marked</p>
                    <p className="text-4xl font-extrabold text-slate-900 dark:text-white mt-2">
                      {scopedStats.classesMarked} <span className="text-lg font-medium text-slate-400 dark:text-slate-300">/ {scopedStats.classesTotal}</span>
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-300 mt-4">
                      {scopedStats.classesTotal - scopedStats.classesMarked} classes remaining today
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pending Alerts</p>
                    <p className={`text-4xl font-extrabold mt-2 ${pendingAlerts.length > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                      {pendingAlerts.length}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-300 mt-4">
                      Unresolved cutoff warning notifications
                    </p>
                  </div>
                </div>

                {/* Grade and Section Breakdown Table */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white text-lg">Grade & Section Breakdown</h3>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {Object.entries(scopedStats.byGrade || {})
                      .sort(([gradeA], [gradeB]) => gradeA.localeCompare(gradeB, undefined, { numeric: true, sensitivity: 'base' }))
                      .map(([gradeId, gradeData]) => {
                        const isExpanded = !!expandedGrades[gradeId];
                        // Filter and sort sections under this grade in ascending order
                        const sections = Object.values(scopedStats.bySection || {})
                          .filter(s => s.gradeId === gradeId)
                          .sort((a, b) => (a.section || '').toString().localeCompare((b.section || '').toString(), undefined, { numeric: true, sensitivity: 'base' }));

                        return (
                          <div key={gradeId} className="group">
                            {/* Grade Summary Header */}
                            <div
                              onClick={() => toggleGrade(gradeId)}
                              className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <span className="font-bold text-slate-800 dark:text-slate-100 text-base">Grade {gradeId}</span>
                                <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                                  {sections.length} Sections
                                </span>
                              </div>
                              <div className="flex items-center gap-8">
                                <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
                                  <span>Present: <b className="text-green-600">{gradeData.present}</b></span>
                                  <span>Absent: <b className="text-red-600">{gradeData.absent}</b></span>
                                  <span>Late: <b className="text-amber-600">{gradeData.late}</b></span>
                                </div>
                                <span className={`text-sm font-black px-3 py-1 rounded-full border ${gradeData.percentage >= 75
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : gradeData.percentage >= 50
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-red-50 text-red-700 border-red-200'
                                  }`}>
                                  {gradeData.percentage}%
                                </span>
                                {isExpanded ? <ChevronUp className="text-slate-400 dark:text-slate-300" size={18} /> : <ChevronDown className="text-slate-400 dark:text-slate-300" size={18} />}
                              </div>
                            </div>

                            {/* Section Drilldown */}
                            {isExpanded && (
                              <div className="bg-slate-50/40 px-6 py-2 border-t border-slate-100 dark:border-slate-800">
                                <table className="w-full text-left border-collapse my-2">
                                  <thead>
                                    <tr className="text-slate-400 dark:text-slate-300 font-bold text-[10px] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800">
                                      <th className="pb-2">Section / Class</th>
                                      <th className="pb-2">Total Students</th>
                                      <th className="pb-2 text-green-600">Present</th>
                                      <th className="pb-2 text-red-600">Absent</th>
                                      <th className="pb-2 text-amber-600">Late</th>
                                      <th className="pb-2 text-right">Percentage</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sections.map((sectionData, sIdx) => (
                                      <tr key={sIdx} className="border-b border-slate-100/50 last:border-0 hover:bg-slate-100/40 text-sm">
                                        <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">{sectionData.name} - {sectionData.section}</td>
                                        <td className="py-2.5 font-medium text-slate-500 dark:text-slate-400">{sectionData.total}</td>
                                        <td className="py-2.5 font-semibold text-green-600">{sectionData.present}</td>
                                        <td className="py-2.5 font-semibold text-red-600">{sectionData.absent}</td>
                                        <td className="py-2.5 font-semibold text-amber-600">{sectionData.late}</td>
                                        <td className="py-2.5 text-right">
                                          <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-lg border ${sectionData.total === 0
                                              ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                                              : sectionData.percentage >= 75
                                                ? 'bg-green-50 text-green-600 border-green-200'
                                                : sectionData.percentage >= 50
                                                  ? 'bg-amber-50 text-amber-600 border-amber-200'
                                                  : 'bg-red-50 text-red-600 border-red-200'
                                            }`}>
                                            {sectionData.total === 0 ? 'Unmarked' : `${sectionData.percentage}%`}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Right Column: Pending Alert Panel */}
              <div className="xl:col-span-1">
                <div className="bg-white dark:bg-slate-900 rounded-3xl border border-red-200 overflow-hidden shadow-sm sticky top-6">
                  <div className="border-b border-red-100 px-6 py-4 bg-red-50/55 flex items-center justify-between">
                    <h2 className="text-base font-bold text-red-800 flex items-center gap-2">
                      <AlertCircle className="text-red-600" size={20} /> Pending Alert Logs
                    </h2>
                    <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                      {pendingAlerts.length}
                    </span>
                  </div>
                  {pendingAlerts.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 dark:text-slate-300">
                      <CheckCircle2 className="mx-auto mb-2 text-green-500" size={28} />
                      <p className="font-bold text-sm text-slate-700 dark:text-slate-200">All Attendance Logged</p>
                      <p className="text-xs mt-0.5">No missing attendance reports flagged for {selectedDate}.</p>
                    </div>
                  ) : (
                    <div className="p-6 space-y-4 max-h-[480px] overflow-y-auto divide-y divide-slate-100">
                      {pendingAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-start justify-between gap-4 pt-3 first:pt-0">
                          <div>
                            <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{alert.message}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-300 mt-0.5">
                              Alert Date: {alert.date}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDismissAlert(alert.id)}
                            className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50/80 px-2 py-1 rounded-lg transition-colors shrink-0"
                          >
                            Dismiss
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- ANALYTICS TAB VIEW --- */}
      {activeTab === 'analytics' && (
        <div className="space-y-8 animate-fade-in">
          {/* Header Controls */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <TrendIcon className="text-primary-600" size={24} />
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Historical & Trend Analytics</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Explore monthly statistics, compare grade averages, and track repeated absentees.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-slate-700 dark:text-slate-200 font-semibold bg-white dark:bg-slate-900 cursor-pointer shadow-sm text-sm"
              />
              {selectedDate !== today && (
                <button
                  onClick={() => setSelectedDate(today)}
                  className="px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors shadow-sm"
                >
                  Today
                </button>
              )}
            </div>
          </div>

          {loadingMonthly ? (
            <div className="p-20 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : monthlyStatsList.length === 0 ? (
            <div className="p-16 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm text-slate-400 dark:text-slate-300">
              <TrendIcon className="mx-auto mb-3 opacity-30" size={48} />
              <p className="font-bold text-base text-slate-600 dark:text-slate-300">No Monthly Data Available</p>
              <p className="text-xs mt-1">There are no records computed for the month of {selectedDate.slice(0, 7)}.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Trend Chart */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">School-Wide Monthly Trend</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Daily attendance percentage rate plotted across the month.</p>
                </div>
                <div className="pt-2">
                  {renderTrendSVG()}
                </div>
              </div>

              {/* Grade Averages Bar Chart */}
              <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">Grade-by-Grade Comparison</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Average monthly attendance rate comparison per grade level.</p>
                </div>
                <div className="space-y-4 overflow-y-auto max-h-[220px] pr-2">
                  {getGradeMonthAverages().map((grade) => (
                    <div key={grade.gradeId} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                        <span>Grade {grade.gradeId}</span>
                        <span>{grade.average}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-primary-500 to-indigo-600 rounded-full transition-all duration-500"
                          style={{ width: `${grade.average}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Repeated Absentees Card */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Repeated Absentees Audit</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Students whose monthly absences meet or exceed the school threshold.</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto shrink-0 justify-end">
                <select
                  value={filterClassId}
                  onChange={(e) => setFilterClassId(e.target.value)}
                  className="border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold py-2 px-3 bg-white dark:bg-slate-900 shadow-sm outline-none text-xs"
                >
                  <option value="all">All Classes</option>
                  {classes.map(cls => (
                    <option key={cls.id} value={cls.id}>{cls.name} - {cls.section}</option>
                  ))}
                </select>
                <button
                  onClick={handleExportExcel}
                  disabled={absenteeFlags.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
                >
                  <ExcelIcon size={14} /> Export Excel
                </button>
              </div>
            </div>

            {loadingFlags ? (
              <div className="p-12 flex justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-600 border-t-transparent"></div>
              </div>
            ) : absenteeFlags.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400 text-sm">
                No repeated absentees flagged for {selectedDate.slice(0, 7)}.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300 pl-6">Roll No</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Student Name</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Class</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Month</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300 text-right pr-6">Monthly Absences</th>
                    </tr>
                  </thead>
                  <tbody>
                    {absenteeFlags
                      .filter(f => filterClassId === 'all' || f.classId === filterClassId)
                      .map((flag, idx) => (
                        <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-4 text-slate-600 dark:text-slate-300 font-medium pl-6">{flag.rollNumber || '-'}</td>
                          <td className="p-4 font-bold text-slate-900 dark:text-white">{flag.studentName}</td>
                          <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{flag.classId}</td>
                          <td className="p-4 font-semibold text-slate-500 dark:text-slate-400">{flag.month}</td>
                          <td className="p-4 text-right pr-6 font-black text-red-600 text-sm">{flag.absentCount}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DAILY MARKING TAB VIEW --- */}
      {activeTab === 'marking' && (
        <div className="space-y-8 animate-fade-in">
          {/* Class, Session & Date selectors */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-semibold py-2.5 pl-4 pr-10 bg-white dark:bg-slate-900 shadow-sm outline-none text-sm w-full sm:w-auto"
              >
                <option value="" disabled>Select Class</option>
                {classes.map(cls => (
                  <option key={cls.id} value={cls.id}>{cls.name} - Section {cls.section}</option>
                ))}
              </select>
              <select
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                className="border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-semibold py-2.5 pl-4 pr-10 bg-white dark:bg-slate-900 shadow-sm outline-none text-sm w-full sm:w-auto"
              >
                <option value="daily">Daily Marking</option>
                <option value="weekly">This Week Report</option>
                <option value="monthly">This Month Report</option>
                <option value="term">This Term Report</option>
              </select>
            </div>

            {viewMode === 'daily' && (
              <div className="flex flex-wrap items-center gap-3 shrink-0 w-full md:w-auto justify-end">
                <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  <CalendarIcon size={18} className="text-slate-400 dark:text-slate-300 ml-1" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border-none focus:ring-0 text-slate-700 dark:text-slate-200 font-semibold text-sm py-0 pr-1 bg-transparent cursor-pointer outline-none"
                  />
                </div>
                <select
                  value={selectedSession}
                  onChange={(e) => setSelectedSession(e.target.value)}
                  className="border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-primary-500 text-slate-700 dark:text-slate-200 font-bold py-2.5 px-4 bg-white dark:bg-slate-900 shadow-sm outline-none text-sm"
                >
                  <option value="FN">FN (Forenoon)</option>
                  <option value="AN">AN (Afternoon)</option>
                </select>
              </div>
            )}
          </div>

          {viewMode === 'daily' && isPastCutoff && !hasExistingRecord && (
            <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl flex items-start gap-3 animate-fade-in-down">
              <AlertCircle size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm">Attendance not marked — past cutoff ({cutoffTime})</p>
                <p className="text-xs text-amber-700 mt-0.5">New marks will default to Late. Teachers can still mark attendance manually.</p>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 pl-2">
                <Users size={18} />
                <span>{students.length} Students</span>
              </div>
              {viewMode === 'daily' && (
                <button
                  onClick={handleSave}
                  disabled={saving || loading || students.length === 0}
                  className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
                >
                  {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Save size={18} />}
                  {saving ? 'Saving...' : 'Save Attendance'}
                </button>
              )}
            </div>

            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
              <input
                type="text"
                placeholder="Search student by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-1/3 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
              />
            </div>

            {loading ? (
              <div className="p-20 flex justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
              </div>
            ) : students.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">No students found in this class.</div>
            ) : viewMode === 'daily' ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="p-4 text-sm font-semibold text-slate-400 dark:text-slate-300 pl-6">Roll No</th>
                      <th className="p-4 text-sm font-semibold text-slate-400 dark:text-slate-300">Student Name</th>
                      <th className="p-4 text-sm font-semibold text-slate-400 dark:text-slate-300">Status</th>
                      <th className="p-4 text-sm font-semibold text-slate-400 dark:text-slate-300 text-right pr-6">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students
                      .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((student) => (
                        <tr key={student.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                          <td className="p-4 text-slate-600 dark:text-slate-300 font-medium pl-6">{student.rollNumber || '-'}</td>
                          <td className="p-4 font-bold text-slate-900 dark:text-white">
                            {student.firstName} {student.lastName}
                          </td>
                          <td className="p-4">
                            <span className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${getStatusColor(attendanceRecords[student.id])}`}>
                              {attendanceRecords[student.id] || 'Present'}
                            </span>
                          </td>
                          <td className="p-4 text-right pr-6">
                            <div className="flex justify-end gap-2">
                              {['Present', 'Absent', 'Late'].map(status => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(student.id, status)}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${attendanceRecords[student.id] === status
                                      ? getStatusColor(status)
                                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                      <th className="p-4 pl-6">Roll No</th>
                      <th className="p-4">Student Name</th>
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
                            <td className="p-4 pl-6 text-slate-600 dark:text-slate-300 font-medium">{student.rollNumber || '-'}</td>
                            <td className="p-4">
                              <div className="font-bold text-slate-900 dark:text-white">{student.firstName} {student.lastName}</div>
                            </td>
                            <td className="p-4 font-semibold text-slate-600 dark:text-slate-300">{stat.total}</td>
                            <td className="p-4 font-semibold text-green-600">{stat.present}</td>
                            <td className="p-4 font-semibold text-red-600">{stat.absent}</td>
                            <td className="p-4 font-semibold text-amber-600">{stat.late}</td>
                            <td className="p-4 pr-6 text-right">
                              <span className={`inline-flex items-center justify-center px-3 py-1 text-xs font-bold rounded-full border ${percentage >= 75 ? 'bg-green-50 text-green-700 border-green-200' :
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
        </div>
      )}
    </div>
  );
}
