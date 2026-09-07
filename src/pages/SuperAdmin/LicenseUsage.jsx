import React, { useState, useEffect } from 'react';
import { 
  LuKey, 
  LuSearch, 
  LuTriangleAlert, 
  LuCircleCheck, 
  LuTrendingUp, 
  LuSlidersHorizontal, 
  LuX, 
  LuBuilding2, 
  LuShieldCheck
} from 'react-icons/lu';
import { subscribeToAllSchools, updateSchoolLimits } from '../../firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import toast from 'react-hot-toast';

export default function LicenseUsage() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Expand Limit Modal State
  const [expandModalOpen, setExpandModalOpen] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [newSeatLimit, setNewSeatLimit] = useState(500);
  const [newTeacherLimit, setNewTeacherLimit] = useState(50);
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllSchools(async (schoolsData) => {
      // Fetch live student and teacher counts for each school
      const enrichedSchools = await Promise.all(
        schoolsData.map(async (school) => {
          let currentStudents = school.studentCount || 0;
          let currentTeachers = school.teacherCount || 0;

          // If counts are not cached on document, query subcollections
          try {
            if (school.studentCount === undefined) {
              const studentsSnap = await getDocs(collection(db, `schools/${school.id}/students`));
              currentStudents = studentsSnap.size;
            }
            if (school.teacherCount === undefined) {
              const teachersSnap = await getDocs(collection(db, `schools/${school.id}/teachers`));
              currentTeachers = teachersSnap.size;
            }
          } catch (err) {
            console.warn(`Could not count subcollections for ${school.id}:`, err);
          }

          const studentLimit = school.seatLimit || (school.plan?.toLowerCase() === 'enterprise' ? 2000 : school.plan?.toLowerCase() === 'basic' ? 100 : 500);
          const teacherLimit = school.teacherLimit || (school.plan?.toLowerCase() === 'enterprise' ? 150 : school.plan?.toLowerCase() === 'basic' ? 10 : 50);

          const studentUsageRatio = studentLimit > 0 ? (currentStudents / studentLimit) : 0;
          const teacherUsageRatio = teacherLimit > 0 ? (currentTeachers / teacherLimit) : 0;

          let status = 'healthy';
          if (studentUsageRatio >= 1.0 || teacherUsageRatio >= 1.0) {
            status = 'exceeded';
          } else if (studentUsageRatio >= 0.85 || teacherUsageRatio >= 0.85) {
            status = 'warning';
          }

          return {
            ...school,
            name: school.schoolName || school.name || 'Unnamed School',
            plan: school.plan || 'Standard',
            students: { current: currentStudents, limit: studentLimit },
            teachers: { current: currentTeachers, limit: teacherLimit },
            status
          };
        })
      );

      setSchools(enrichedSchools);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const filteredSchools = schools.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.adminEmail && s.adminEmail.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchools = filteredSchools.slice(startIndex, startIndex + itemsPerPage);

  // Overall Statistics
  const totalActiveLicenses = schools.reduce((acc, s) => acc + (s.students?.limit || 0), 0);
  const schoolsNearLimit = schools.filter(s => s.status === 'warning').length;
  const schoolsExceededLimit = schools.filter(s => s.status === 'exceeded').length;

  const openExpandModal = (school) => {
    setSelectedSchool(school);
    setNewSeatLimit(school.students.limit || 500);
    setNewTeacherLimit(school.teachers.limit || 50);
    setExpandModalOpen(true);
  };

  const handleSaveLimit = async () => {
    if (!selectedSchool) return;
    setSavingLimit(true);
    try {
      const parsedSeats = Math.max(1, Number(newSeatLimit) || 500);
      const parsedTeachers = Math.max(1, Number(newTeacherLimit) || 50);

      await updateSchoolLimits(selectedSchool.id, {
        seatLimit: parsedSeats,
        teacherLimit: parsedTeachers
      });

      // Update local state
      setSchools(prev => prev.map(s => {
        if (s.id === selectedSchool.id) {
          const studentRatio = s.students.current / parsedSeats;
          const teacherRatio = s.teachers.current / parsedTeachers;
          let newStatus = 'healthy';
          if (studentRatio >= 1.0 || teacherRatio >= 1.0) newStatus = 'exceeded';
          else if (studentRatio >= 0.85 || teacherRatio >= 0.85) newStatus = 'warning';

          return {
            ...s,
            seatLimit: parsedSeats,
            teacherLimit: parsedTeachers,
            students: { ...s.students, limit: parsedSeats },
            teachers: { ...s.teachers, limit: parsedTeachers },
            status: newStatus
          };
        }
        return s;
      }));

      toast.success(`Limits updated for ${selectedSchool.name}!`);
      setExpandModalOpen(false);
    } catch (err) {
      console.error("Failed to update school limit:", err);
      toast.error("Failed to update school limit.");
    } finally {
      setSavingLimit(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'healthy': return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 whitespace-nowrap"><LuCircleCheck size={14} /> Healthy</span>;
      case 'warning': return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 whitespace-nowrap"><LuTriangleAlert size={14} /> Near Limit</span>;
      case 'exceeded': return <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 whitespace-nowrap"><LuTrendingUp size={14} /> Exceeded</span>;
      default: return null;
    }
  };

  const getUsageBar = (current, limit) => {
    const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
    const colorClass = percentage >= 100 ? 'bg-red-500' : percentage > 85 ? 'bg-amber-500' : 'bg-primary-600';
    return (
      <div className="w-full">
        <div className="flex justify-between text-xs mb-1 font-semibold">
          <span className="text-slate-700 dark:text-slate-200 font-bold">{current} used</span>
          <span className="text-slate-500 dark:text-slate-400">{limit} limit</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${colorClass} transition-all`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col min-w-0">
      <div className="mb-8 shrink-0 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuKey className="text-primary-600" /> License & Usage Management
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Monitor live active student & teacher counts against database rules limits, and expand capacity per school.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <LuKey size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Total Active License Capacity</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{totalActiveLicenses.toLocaleString()} Seats</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <LuTriangleAlert size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Schools Near Limit (&gt;85%)</p>
            <p className="text-2xl font-black text-amber-600">{schoolsNearLimit}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <LuTrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Schools Exceeded Limit</p>
            <p className="text-2xl font-black text-red-600">{schoolsExceededLimit}</p>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
            <input 
              type="text"
              placeholder="Search schools by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="w-full min-w-0 overflow-x-auto custom-scrollbar flex-1">
          {loading ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mx-auto mb-4"></div>
              <p className="font-semibold">Loading live school licenses...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-max">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                <tr className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm border-b border-slate-200 dark:border-slate-700">
                  <th className="p-4 font-bold">School Name</th>
                  <th className="p-4 font-bold">Current Plan</th>
                  <th className="p-4 font-bold w-1/4">Student Usage & Limit</th>
                  <th className="p-4 font-bold w-1/4">Teacher Usage & Limit</th>
                  <th className="p-4 font-bold text-center">Status</th>
                  <th className="p-4 font-bold text-right">Expansion Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedSchools.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-12 text-center text-slate-500 dark:text-slate-400">
                      <LuBuilding2 size={40} className="mx-auto mb-3 text-slate-300" />
                      <p className="font-bold text-slate-800 dark:text-slate-100">No schools found</p>
                      <p className="text-sm">Try adjusting your search query.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedSchools.map((school) => (
                    <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 font-bold text-slate-900 dark:text-white">
                        <div>
                          <span>{school.name}</span>
                          {school.adminEmail && (
                            <span className="block text-xs font-normal text-slate-400 dark:text-slate-300 mt-0.5">{school.adminEmail}</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-lg text-xs uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                          {school.plan}
                        </span>
                      </td>
                      <td className="p-4">
                        {getUsageBar(school.students.current, school.students.limit)}
                      </td>
                      <td className="p-4">
                        {getUsageBar(school.teachers.current, school.teachers.limit)}
                      </td>
                      <td className="p-4 text-center">
                        {getStatusBadge(school.status)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openExpandModal(school)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary-50 text-primary-700 border border-primary-200 hover:bg-primary-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-sm group"
                        >
                          <LuSlidersHorizontal size={14} className="group-hover:rotate-90 transition-transform" />
                          Expand Limit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filteredSchools.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-900 dark:text-white">{filteredSchools.length}</span> schools
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expand Limit Modal */}
      {expandModalOpen && selectedSchool && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <LuShieldCheck className="text-primary-600" />
                Expand License Limit
              </h2>
              <button 
                onClick={() => setExpandModalOpen(false)} 
                className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 min-w-0">
                <h3 className="font-bold text-slate-900 dark:text-white text-lg truncate w-full">{selectedSchool.name}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div className="min-w-0">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Current Students:</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{selectedSchool.students.current} enrolled</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Current Teachers:</span>
                    <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">{selectedSchool.teachers.current} registered</p>
                  </div>
                </div>
              </div>

              {/* Student Seat Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                  New Student Seat Limit (Database Rule Enforcement)
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min={selectedSchool.students.current || 1}
                    value={newSeatLimit}
                    onChange={(e) => setNewSeatLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quick add:</span>
                  {[+100, +250, +500, +1000].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setNewSeatLimit(prev => Number(prev) + inc)}
                      className="text-xs px-2.5 py-1 rounded-lg font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 border border-primary-200 transition-colors"
                    >
                      {inc > 0 ? `+${inc}` : inc} Seats
                    </button>
                  ))}
                </div>
              </div>

              {/* Teacher Limit */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
                  New Teacher Limit
                </label>
                <div className="flex items-center gap-2">
                  <input 
                    type="number"
                    min={selectedSchool.teachers.current || 1}
                    value={newTeacherLimit}
                    onChange={(e) => setNewTeacherLimit(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-black text-slate-900 dark:text-white bg-white dark:bg-slate-900 text-lg"
                  />
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Quick add:</span>
                  {[+10, +25, +50, +100].map(inc => (
                    <button
                      key={inc}
                      type="button"
                      onClick={() => setNewTeacherLimit(prev => Number(prev) + inc)}
                      className="text-xs px-2.5 py-1 rounded-lg font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      +{inc} Teachers
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
              <button 
                type="button" 
                onClick={() => setExpandModalOpen(false)} 
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSaveLimit}
                disabled={savingLimit} 
                className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm transition-colors flex items-center gap-2"
              >
                {savingLimit ? 'Applying Expansion...' : 'Apply Expansion to DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
