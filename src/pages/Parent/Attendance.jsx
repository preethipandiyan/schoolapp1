import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToAttendanceForClass } from '../../firebase/firestore';
import { LuCalendar as Calendar, LuCircleCheck as CheckCircle2, LuCircleX as XCircle, LuCircleAlert as AlertCircle } from 'react-icons/lu';

export default function ParentAttendance() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.linkedClassId;
  const studentId = userProfile?.linkedStudentId;

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!schoolId || !classId || !studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToAttendanceForClass(schoolId, classId, (docs) => {
      const records = [];
      docs.forEach(doc => {
        const status = doc.records?.[studentId];
        if (status) {
          records.push({
            id: doc.id,
            date: doc.date,
            status: status,
          });
        }
      });
      // Sort by date descending
      records.sort((a, b) => new Date(b.date ? b.date.split('_')[0] : '') - new Date(a.date ? a.date.split('_')[0] : ''));
      setAttendanceRecords(records);
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId, classId, studentId]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    return attendanceRecords.filter(record => {
      const recordDate = new Date(record.date ? record.date.split('_')[0] : '');
      if (filter === 'weekly') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return recordDate >= sevenDaysAgo && recordDate <= now;
      }
      if (filter === 'monthly') {
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }
      if (filter === 'term') {
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
  }, [attendanceRecords, filter]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const getStatusIcon = (status) => {
    if (status === 'Present') return <CheckCircle2 size={20} className="text-green-500" />;
    if (status === 'Absent') return <XCircle size={20} className="text-red-500" />;
    if (status === 'Late') return <AlertCircle size={20} className="text-amber-500" />;
    return null;
  };

  const getStatusColor = (status) => {
    if (status === 'Present') return 'bg-green-50 text-green-700 border-green-200';
    if (status === 'Absent') return 'bg-red-50 text-red-700 border-red-200';
    if (status === 'Late') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700';
  };

  const presentCount = filteredRecords.filter(r => r.status === 'Present').length;
  const absentCount = filteredRecords.filter(r => r.status === 'Absent').length;
  const lateCount = filteredRecords.filter(r => r.status === 'Late').length;
  const totalCount = filteredRecords.length;
  const percentage = totalCount === 0 ? 100 : Math.round(((presentCount + lateCount) / totalCount) * 100);

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto animate-fade-in-up pb-24 min-w-0 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">Detailed Attendance</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View your child's daily attendance records.</p>
        </div>
        
        <div className="w-full sm:w-48">
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
          >
            <option value="all">All Time</option>
            <option value="weekly">This Week</option>
            <option value="monthly">This Month</option>
            <option value="term">This Term</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm text-center">
          <div className="text-3xl font-black text-slate-900 dark:text-white mb-1">{percentage}%</div>
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall</div>
        </div>
        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 shadow-sm text-center">
          <div className="text-3xl font-black text-green-700 mb-1">{presentCount}</div>
          <div className="text-xs font-bold text-green-600/70 uppercase tracking-wider">Present</div>
        </div>
        <div className="bg-red-50 p-6 rounded-2xl border border-red-100 shadow-sm text-center">
          <div className="text-3xl font-black text-red-700 mb-1">{absentCount}</div>
          <div className="text-xs font-bold text-red-600/70 uppercase tracking-wider">Absent</div>
        </div>
        <div className="bg-amber-50 p-6 rounded-2xl border border-amber-100 shadow-sm text-center">
          <div className="text-3xl font-black text-amber-700 mb-1">{lateCount}</div>
          <div className="text-xs font-bold text-amber-600/70 uppercase tracking-wider">Late</div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400">
            <Calendar size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">No Records Found</p>
            <p>No attendance records found for this period.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRecords.map(record => (
              <div key={record.id} className="p-4 sm:p-6 hover:bg-slate-50/50 transition-colors flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">{new Date(record.date ? record.date.split('_')[0] : '').toLocaleDateString('en-GB')}</h3>
                  </div>
                </div>
                <div className={`px-4 py-1.5 rounded-lg border font-bold text-sm flex items-center gap-2 ${getStatusColor(record.status)}`}>
                  {getStatusIcon(record.status)}
                  {record.status}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
