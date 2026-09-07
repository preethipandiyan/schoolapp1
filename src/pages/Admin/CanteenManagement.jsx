import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { subscribeToSubCollection, updateSubDocument } from '../../firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { 
  LuCoffee as Coffee, 
  LuUtensils as Utensils, 
  LuSearch as Search, 
  LuSlidersHorizontal as Sliders, 
  LuCheck as Check, 
  LuX as X, 
  LuClock as Clock, 
  LuSparkles as Sparkles, 
  LuRotateCcw as ResetIcon,
  LuCalendar as CalendarIcon
} from 'react-icons/lu';
import { sortClassesAscending } from '../../utils/classSorting';

export default function CanteenManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { clearBadge } = useNotifications();

  // State Variables
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [mealFilter, setMealFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('Today'); // Today, All, Past

  // Clear notifications for canteen on component mount
  useEffect(() => {
    clearBadge('canteen');
  }, [clearBadge]);

  // Subscribe to Canteen Requests, Students, and Classes
  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);

    const unsubRequests = subscribeToSubCollection(schoolId, 'canteen_requests', (data) => {
      setRequests(data);
      setLoading(false);
    });

    const unsubStudents = subscribeToSubCollection(schoolId, 'students', (data) => {
      setStudents(data);
    });

    const unsubClasses = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    return () => {
      unsubRequests();
      unsubStudents();
      unsubClasses();
    };
  }, [schoolId]);

  // Helper Maps
  const studentMap = React.useMemo(() => {
    const map = {};
    students.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [students]);

  const classMap = React.useMemo(() => {
    const map = {};
    classes.forEach(c => {
      map[c.id] = c;
    });
    return map;
  }, [classes]);

  // Handle Status Update
  const handleUpdateStatus = async (requestId, newStatus) => {
    setUpdatingId(requestId);
    try {
      await updateSubDocument(schoolId, 'canteen_requests', requestId, {
        status: newStatus,
        resolvedAt: new Date().toISOString()
      });
      toast.success(`Request status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper to extract YYYY-MM-DD string reliably
  const getReqDateStr = (r) => {
    if (r.date) return r.date;
    if (r.timestamp) {
      return new Date(r.timestamp).toISOString().split('T')[0];
    }
    if (r.createdAt) {
      return new Date(r.createdAt).toISOString().split('T')[0];
    }
    return '';
  };

  // Filter Logic
  const todayStr = new Date().toISOString().split('T')[0];

  const filteredRequests = React.useMemo(() => {
    return requests
      .map(req => {
        const student = studentMap[req.studentId];
        const studentClass = student ? classMap[student.classId] : null;
        const resolvedDateStr = getReqDateStr(req);
        return {
          ...req,
          studentName: student?.name || (student?.firstName ? `${student.firstName} ${student.lastName || ''}`.trim() : 'Unknown Student'),
          admissionNumber: student?.admissionNumber || 'N/A',
          className: studentClass ? `${studentClass.name} - Section ${studentClass.section}` : (student?.classId || 'N/A'),
          resolvedDateStr
        };
      })
      .filter(req => {
        // Search filter
        const matchesSearch = 
          req.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          req.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Status filter
        const matchesStatus = statusFilter === 'All' || req.status === statusFilter;

        // Meal filter
        const matchesMeal = mealFilter === 'All' || req.mealType === mealFilter;

        // Date filter
        let matchesDate = true;
        if (dateFilter === 'Today') {
          matchesDate = req.resolvedDateStr === todayStr;
        } else if (dateFilter === 'Past') {
          matchesDate = req.resolvedDateStr !== todayStr;
        }

        return matchesSearch && matchesStatus && matchesMeal && matchesDate;
      })
      .sort((a, b) => new Date(b.timestamp || b.createdAt || 0) - new Date(a.timestamp || a.createdAt || 0));
  }, [requests, studentMap, classMap, searchQuery, statusFilter, mealFilter, dateFilter, todayStr]);

  // Summary Metrics
  const stats = React.useMemo(() => {
    const todayReqs = requests.filter(r => getReqDateStr(r) === todayStr);
    return {
      todayPending: todayReqs.filter(r => r.status === 'Pending').length,
      todayApproved: todayReqs.filter(r => r.status === 'Approved').length,
      todayDelivered: todayReqs.filter(r => r.status === 'Delivered' || r.status === 'Completed').length,
      totalCount: requests.length
    };
  }, [requests, todayStr]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="relative">
          <div className="absolute animate-ping w-12 h-12 rounded-full bg-primary-400 opacity-20"></div>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent shadow-md"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 shrink-0 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Coffee className="text-primary-600" /> Canteen Orders & Requests
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and resolve emergency canteen requests raised by parents in real-time.</p>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Pending</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.todayPending}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
            <Sparkles size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Approved</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.todayApproved}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center font-bold">
            <Check size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today's Delivered</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.todayDelivered}</h3>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm flex items-center gap-5">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold">
            <Utensils size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">All-Time Requests</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-700 p-6 shadow-sm mb-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-center">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search by student or admission..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm font-medium text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Filters Selects */}
          <div className="flex gap-4 col-span-3 flex-wrap">
            {/* Date Filter Toggle */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1.5 rounded-2xl">
              {['Today', 'Past', 'All'].map((d) => (
                <button
                  key={d}
                  onClick={() => setDateFilter(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    dateFilter === d 
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-850'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Sliders size={16} className="text-slate-400 dark:text-slate-300" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Delivered">Delivered</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Meal Filter */}
            <div>
              <select
                value={mealFilter}
                onChange={(e) => setMealFilter(e.target.value)}
                className="px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none text-sm font-semibold bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200"
              >
                <option value="All">All Meals</option>
                <option value="Breakfast">Breakfast</option>
                <option value="Lunch">Lunch</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(searchQuery || statusFilter !== 'All' || mealFilter !== 'All' || dateFilter !== 'Today') && (
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setMealFilter('All');
                  setDateFilter('Today');
                }}
                className="flex items-center gap-1.5 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-2xl transition-colors"
              >
                <ResetIcon size={16} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Requests List */}
      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="p-16 text-center text-slate-500 dark:text-slate-400 flex flex-col items-center justify-center gap-3">
            <Coffee size={48} className="text-slate-300 animate-bounce" />
            <p className="font-bold text-lg text-slate-700 dark:text-slate-200">No matching canteen requests found</p>
            <p className="text-sm max-w-sm text-slate-400 dark:text-slate-300">Try adjusting your filters or wait for a parent to submit a request.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full min-w-0">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-extrabold">
                  <th className="p-5 pl-8">Student / Admission</th>
                  <th className="p-5">Class</th>
                  <th className="p-5">Meal & Date</th>
                  <th className="p-5">Status</th>
                  <th className="p-5 pr-8 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <AnimatePresence>
                  {filteredRequests.map((req) => (
                    <motion.tr 
                      key={req.id} 
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Student Info */}
                      <td className="p-5 pl-8">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{req.studentName}</span>
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-300 mt-0.5">{req.admissionNumber}</span>
                        </div>
                      </td>

                      {/* Class */}
                      <td className="p-5">
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {req.className}
                        </span>
                      </td>

                      {/* Meal & Date */}
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 text-sm">
                            {req.mealType === 'Breakfast' ? (
                              <Coffee className="text-amber-500" size={16} />
                            ) : (
                              <Utensils className="text-rose-500" size={16} />
                            )}
                            {req.mealType}
                          </span>
                          <span className="text-xs font-semibold text-slate-400 dark:text-slate-300 mt-1 flex items-center gap-1">
                            <CalendarIcon size={12} /> {req.date} {req.date === todayStr && <span className="text-primary-600 font-bold bg-primary-50 px-1.5 py-0.5 rounded-md text-[9px] uppercase tracking-wider">Today</span>}
                          </span>
                        </div>
                      </td>

                      {/* Status chip */}
                      <td className="p-5">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold border ${
                          req.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          req.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          req.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600'
                        }`}>
                          {req.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-5 pr-8 text-right">
                        <div className="flex gap-2 justify-end">
                          {req.status === 'Pending' && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'Approved')}
                              disabled={updatingId !== null}
                              className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 hover:border-blue-300 dark:hover:border-slate-700 transition-all active:scale-95 disabled:opacity-50"
                              title="Approve Request"
                            >
                              <Check size={16} />
                            </button>
                          )}
                          {(req.status === 'Pending' || req.status === 'Approved') && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'Delivered')}
                              disabled={updatingId !== null}
                              className="p-2 rounded-xl bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 hover:border-green-300 transition-all active:scale-95 disabled:opacity-50"
                              title="Mark Delivered"
                            >
                              <Utensils size={16} />
                            </button>
                          )}
                          {req.status === 'Pending' && (
                            <button
                              onClick={() => handleUpdateStatus(req.id, 'Cancelled')}
                              disabled={updatingId !== null}
                              className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 dark:hover:border-slate-700 transition-all active:scale-95 disabled:opacity-50"
                              title="Cancel Request"
                            >
                              <X size={16} />
                            </button>
                          )}
                          {req.status !== 'Pending' && req.status !== 'Approved' && (
                            <span className="text-xs text-slate-400 dark:text-slate-300 font-semibold italic">Resolved</span>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
