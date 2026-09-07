import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  subscribeToAttendanceForClass, 
  subscribeToAssessmentsByClass 
} from '../../firebase/firestore';
import { LuTrendingUp, LuAward, LuBookOpen } from 'react-icons/lu';

export default function Performance() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const studentId = userProfile?.linkedStudentId;
  const classId = userProfile?.linkedClassId;

  const [student, setStudent] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [assessmentsData, setAssessmentsData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId || !studentId || !classId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let unsubAttendance, unsubAssessments;

    // Fetch student once for performance status
    getDoc(doc(db, `schools/${schoolId}/students`, studentId)).then(docSnap => {
      if (docSnap.exists()) {
        setStudent({ id: docSnap.id, ...docSnap.data() });
      }
    });

    unsubAttendance = subscribeToAttendanceForClass(schoolId, classId, (data) => {
      setAttendanceData(data);
    });

    unsubAssessments = subscribeToAssessmentsByClass(schoolId, classId, (data) => {
      setAssessmentsData(data);
      setLoading(false);
    });

    return () => {
      if (unsubAttendance) unsubAttendance();
      if (unsubAssessments) unsubAssessments();
    };
  }, [schoolId, studentId, classId]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!student) return <div className="p-8">No student linked to this account.</div>;

  // Calculate Metrics
  let present = 0, totalDays = 0;
  attendanceData.forEach(day => {
    if (day.records && day.records[studentId]) {
      totalDays++;
      if (day.records[studentId] === 'Present' || day.records[studentId] === 'Late') {
        present++;
      }
    }
  });
  const attendancePerc = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

  let totalObtained = 0, totalMax = 0;
  let recentAssessments = [];

  assessmentsData.forEach(assessment => {
    const grade = assessment.grades?.[studentId];
    if (grade !== undefined && grade !== '') {
      totalObtained += Number(grade);
      totalMax += Number(assessment.totalMarks);
      recentAssessments.push({
        ...assessment,
        score: grade,
        perc: Math.round((Number(grade) / Number(assessment.totalMarks)) * 100)
      });
    }
  });
  recentAssessments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const avgPerc = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  let avgGrade = '-';
  if (avgPerc > 0) {
    if (avgPerc >= 90) avgGrade = 'A+';
    else if (avgPerc >= 80) avgGrade = 'A';
    else if (avgPerc >= 70) avgGrade = 'B';
    else if (avgPerc >= 60) avgGrade = 'C';
    else if (avgPerc >= 50) avgGrade = 'D';
    else avgGrade = 'F';
  }

  const getStatusColor = (status) => {
    switch(status) {
      case 'excellent': return 'text-purple-700 bg-purple-100';
      case 'improving': return 'text-green-700 bg-green-100';
      case 'stable': return 'text-blue-700 bg-blue-100';
      case 'warning': return 'text-amber-700 bg-amber-100';
      case 'critical': return 'text-red-700 bg-red-100';
      default: return 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-700';
    }
  };

  const trendStatus = student.performanceStatus || 'stable';

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 min-w-0 w-full">
      <div className="mb-8 min-w-0 w-full">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
          <LuTrendingUp className="text-primary-600 shrink-0" /> Academic Performance
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Review your child's academic progress and teacher feedback.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-gradient-to-br from-primary-600 to-primary-800 p-6 rounded-3xl text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
          <p className="text-primary-100 font-bold mb-1">Teacher's Status</p>
          <div className="flex items-center gap-3">
            <span className={`px-4 py-1.5 rounded-xl text-sm font-black uppercase tracking-widest ${getStatusColor(trendStatus)} bg-white dark:bg-slate-900 shadow-sm`}>
              {trendStatus}
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <LuAward size={32} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Overall Grade</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-3xl font-black text-slate-900 dark:text-white">{avgGrade}</span>
              <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{avgPerc > 0 ? `${avgPerc.toFixed(1)}%` : ''}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-1">Attendance</p>
          <span className={`text-3xl font-black ${attendancePerc < 75 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{attendancePerc}%</span>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50 dark:bg-slate-800">
          <LuBookOpen className="text-primary-600" size={24} />
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Recent Assessments</h2>
        </div>
        <div className="p-6">
          {recentAssessments.length > 0 ? (
            <div className="space-y-4">
              {recentAssessments.map(assessment => (
                <div key={assessment.id} className="flex justify-between items-center p-4 rounded-2xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-primary-50/30 transition-all gap-4 w-full min-w-0">
                  <div className="min-w-0">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate">{assessment.title}</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{new Date(assessment.date).toLocaleDateString('en-GB')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-lg text-slate-900 dark:text-white">{assessment.score} <span className="text-slate-400 dark:text-slate-300 text-sm font-bold">/ {assessment.totalMarks}</span></p>
                    <p className="text-xs font-bold text-primary-600">{assessment.perc}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400 font-medium">
              No assessments recorded yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
