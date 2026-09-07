import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, subscribeToSubCollection } from '../../firebase/firestore';
import { LuFileText as FileText, LuSearch as Search, LuX as X, LuCircleCheck as CheckCircle, LuBookOpen as BookOpen } from 'react-icons/lu';
import { TableSkeleton } from '../../components/Skeleton';
import { sortClassesAscending } from '../../utils/classSorting';

export default function AdminHomework() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [allHomeworks, setAllHomeworks] = useState([]);
  const [filteredHomeworks, setFilteredHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let classesUnsub, hwUnsub;

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    hwUnsub = subscribeToSubCollection(schoolId, 'homeworks', (data) => {
      setAllHomeworks(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setLoading(false);
    });

    return () => {
      if (classesUnsub) classesUnsub();
      if (hwUnsub) hwUnsub();
    };
  }, [schoolId]);

  useEffect(() => {
    if (selectedClassId) {
      setFilteredHomeworks(allHomeworks.filter(hw => hw.classId === selectedClassId));
    } else {
      setFilteredHomeworks(allHomeworks);
    }
  }, [selectedClassId, allHomeworks]);

  const openTracking = (hw) => {
    setSelectedHomework(hw);
    setShowTrackingModal(true);
    // Fetch students in this class
    getSubCollection(schoolId, 'students').then(allStudents => {
      setClassStudents(allStudents.filter(s => s.classId === hw.classId));
    });
    // Listen to submissions
    return subscribeToSubCollection(schoolId, `homeworks/${hw.id}/submissions`, (subs) => {
      setSubmissions(subs);
    });
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in-up pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">Homework Overview</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View class-wise homework and student submissions.</p>
        </div>
        
        <div className="w-full sm:w-72">
          <select 
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900"
          >
            <option value="">All Classes</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Homework List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHomeworks.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <BookOpen size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No homework found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              {selectedClassId ? "No homework has been assigned to this class yet." : "No homework has been assigned in the school."}
            </p>
          </div>
        ) : (
          filteredHomeworks.map(hw => {
            const cls = classes.find(c => c.id === hw.classId);
            return (
              <div 
                key={hw.id} 
                onClick={() => openTracking(hw)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <FileText size={64} className="text-primary-600 transform rotate-12" />
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-4">
                    <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-bold">
                      {cls ? cls.name : 'Unknown Class'} • {hw.subject}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-300">
                      Due: {new Date(hw.dueDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{hw.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-2 line-clamp-2">{hw.description}</p>
                  <p className="text-xs font-medium text-slate-400 dark:text-slate-300 mb-4">Assigned by: {hw.teacherName || 'Unknown Teacher'}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle size={16} /> Active
                    </span>
                    <span className="text-xs font-bold text-primary-600 group-hover:underline">View Tracking &rarr;</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Tracking Modal */}
      {showTrackingModal && selectedHomework && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0 gap-4">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white truncate">{selectedHomework.title}</h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Student Progress Tracking</p>
              </div>
              <button onClick={() => setShowTrackingModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {classStudents.length === 0 ? (
                <p className="text-center text-slate-500 dark:text-slate-400 italic">No students found in this class.</p>
              ) : (
                <div className="space-y-3">
                  {classStudents.map(student => {
                    const submission = submissions.find(s => s.id === student.id);
                    const status = submission?.status || 'Not Started';
                    const lastUpdated = submission?.lastUpdated ? new Date(submission.lastUpdated).toLocaleString() : 'N/A';
                    
                    let statusColor = "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300";
                    if (status === 'In Progress') statusColor = "bg-amber-100 text-amber-700";
                    if (status === 'Completed') statusColor = "bg-blue-100 text-blue-700";
                    if (status === 'Submitted') statusColor = "bg-emerald-100 text-emerald-700";

                    return (
                      <div key={student.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-primary-300 dark:hover:border-slate-700 transition-colors gap-4">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-white">{student.firstName} {student.lastName}</p>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">ADM: {student.admissionNumber} | Last Updated: {lastUpdated}</p>
                        </div>
                        <div className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${statusColor}`}>
                          {status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
