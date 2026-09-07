import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, createFeeStructure, getInvoices, markInvoicePaid, subscribeToSubCollection, subscribeToInvoices, subscribeToFeeCollectionPeriods } from '../../firebase/firestore';
import { LuCreditCard as CreditCard, LuPlus as Plus, LuCircleCheck as CheckCircle2, LuSearch as Search, LuX as X, LuReceipt as Receipt, LuIndianRupee as DollarSign, LuTrendingUp as TrendingUp, LuTriangleAlert as AlertTriangle, LuFilter as Filter } from 'react-icons/lu';
import toast from 'react-hot-toast';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import { uploadCustomDataFiles } from '../../utils/cloudinary';
import usePermissions from '../../hooks/usePermissions';
import { sortClassesAscending } from '../../utils/classSorting';

export default function FeeManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('fees');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('fees');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('fees');

  const [classes, setClasses] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [students, setStudents] = useState({}); // Map of studentId -> student data
  const [periods, setPeriods] = useState([]); // Fee collection periods from Environment Setup
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPeriodId, setFilterPeriodId] = useState(''); // '' = All Periods
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'overdue' | 'unpaid' | 'paid'

  // Dashboard Stats
  const [stats, setStats] = useState({ expected: 0, collected: 0, outstanding: 0 });
  const [feeAlerts, setFeeAlerts] = useState({
    overdueCount: 0,
    overdueAmount: 0,
    unpaidCount: 0,
    unpaidStudentsCount: 0,
    overdueStudentsCount: 0
  });

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newFee, setNewFee] = useState({
    name: '',
    amount: '',
    dueDate: new Date().toISOString().split('T')[0],
    classId: '',
    collectionPeriodId: '',
    collectionPeriodName: '',
    customData: {}
  });

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let classesUnsub, studentsUnsub, invoicesUnsub, periodsUnsub;

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    studentsUnsub = subscribeToSubCollection(schoolId, 'students', (studentsData) => {
      const studentMap = {};
      studentsData.forEach(s => studentMap[s.id] = s);
      setStudents(studentMap);
    });

    invoicesUnsub = subscribeToInvoices(schoolId, (invoicesData) => {
      setInvoices(invoicesData);
      calculateStats(invoicesData);
      setLoading(false);
    });

    // Load fee collection periods configured in Environment Setup
    periodsUnsub = subscribeToFeeCollectionPeriods(schoolId, setPeriods);

    return () => {
      if (classesUnsub) classesUnsub();
      if (studentsUnsub) studentsUnsub();
      if (invoicesUnsub) invoicesUnsub();
      if (periodsUnsub) periodsUnsub();
    };
  }, [schoolId]);

  const calculateStats = (invoicesData) => {
    let expected = 0, collected = 0, outstanding = 0;
    let overdueCount = 0, overdueAmount = 0, unpaidCount = 0;
    const unpaidStudentsSet = new Set();
    const overdueStudentsSet = new Set();
    const today = new Date();

    invoicesData.forEach(inv => {
      const amt = Number(inv.amount) || 0;
      expected += amt;
      if (inv.status === 'Paid') {
        collected += amt;
      } else {
        outstanding += amt;
        unpaidCount++;
        if (inv.studentId) unpaidStudentsSet.add(inv.studentId);

        const isOverdue = inv.dueDate && new Date(inv.dueDate + 'T23:59:59') < today;
        if (isOverdue) {
          overdueCount++;
          overdueAmount += amt;
          if (inv.studentId) overdueStudentsSet.add(inv.studentId);
        }
      }
    });

    setStats({ expected, collected, outstanding });
    setFeeAlerts({
      overdueCount,
      overdueAmount,
      unpaidCount,
      unpaidStudentsCount: unpaidStudentsSet.size,
      overdueStudentsCount: overdueStudentsSet.size
    });
  };

  // When a collection period is selected, auto-generate the fee name
  const handlePeriodChange = (periodId) => {
    const selected = periods.find(p => p.id === periodId);
    setNewFee(prev => ({
      ...prev,
      collectionPeriodId: periodId,
      collectionPeriodName: selected ? selected.name : '',
      // Auto-generate fee name: "Term 1" or left blank for manual entry if no period
      name: selected ? selected.name : prev.name
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!hasCreatePermission) {
      toast.error("You do not have permission to create fee structures.");
      return;
    }
    if (!newFee.name || !newFee.amount || !newFee.classId) return;
    setCreating(true);

    try {
      const uploadedCustomData = await uploadCustomDataFiles(newFee.customData, schoolId, 'fees');
      const result = await createFeeStructure(schoolId, {
        ...newFee,
        customData: uploadedCustomData
      });
      // Re-fetch invoices handled by listener
      
      if (result && result.invoiceCount === 0) {
        toast.error("Fee assigned, but NO invoices were generated because there are no active students in this class!", { duration: 5000 });
      } else {
        toast.success(`Fee assigned successfully! Generated ${result.invoiceCount} invoices.`);
      }
      
      setShowCreateModal(false);
      setNewFee({ name: '', amount: '', dueDate: new Date().toISOString().split('T')[0], classId: '', collectionPeriodId: '', collectionPeriodName: '', customData: {} });
    } catch (error) {
      console.error("Error creating fee:", error);
      toast.error("Failed to create fee and generate invoices.");
    } finally {
      setCreating(false);
    }
  };

  const handleMarkPaid = async (invoiceId) => {
    if (!hasEditPermission) {
      toast.error("You do not have permission to record payments.");
      return;
    }
    try {
      await markInvoicePaid(schoolId, invoiceId);
      // Optimistically update local state - Handled by real-time listener
      const updatedInvoices = invoices.map(inv => 
        inv.id === invoiceId ? { ...inv, status: 'Paid', paidAt: new Date().toISOString() } : inv
      );
      setInvoices(updatedInvoices);
      calculateStats(updatedInvoices);
      toast.success("Payment recorded successfully!");
    } catch (error) {
      toast.error("Failed to record payment.");
    }
  };

  // Filter invoices based on status, period, and search query
  const filteredInvoices = invoices.filter(inv => {
    const today = new Date();
    const isOverdue = inv.dueDate && new Date(inv.dueDate + 'T23:59:59') < today && inv.status !== 'Paid';

    // Status filter
    if (statusFilter === 'overdue' && !isOverdue) return false;
    if (statusFilter === 'unpaid' && inv.status === 'Paid') return false;
    if (statusFilter === 'paid' && inv.status !== 'Paid') return false;

    // Period filter
    if (filterPeriodId && inv.collectionPeriodId !== filterPeriodId) return false;

    // Search filter
    if (!searchQuery) return true;
    const student = students[inv.studentId];
    const searchTerm = searchQuery.toLowerCase().trim();
    
    const studentNameMatch = student ? (
      (student.firstName || '').toLowerCase().includes(searchTerm) ||
      (student.lastName || '').toLowerCase().includes(searchTerm) ||
      `${(student.firstName || '').toLowerCase()} ${(student.lastName || '').toLowerCase()}`.includes(searchTerm) ||
      (student.admissionNumber || '').toLowerCase().includes(searchTerm)
    ) : false;

    return (
      studentNameMatch ||
      (inv.feeName || '').toLowerCase().includes(searchTerm) ||
      (inv.collectionPeriodName || '').toLowerCase().includes(searchTerm) ||
      (inv.status || '').toLowerCase().includes(searchTerm) ||
      (isOverdue && 'overdue'.includes(searchTerm))
    );
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Fee Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Track revenue, manage student payments, and monitor fee dues alerts.</p>
        </div>
        {hasCreatePermission && (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto justify-center px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors shrink-0"
          >
            <Plus size={18} /> Assign New Fee
          </button>
        )}
      </div>

      {/* Fee Dues Alert Banner */}
      {feeAlerts.overdueCount > 0 ? (
        <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-red-600 text-white rounded-2xl shrink-0 shadow-md shadow-red-600/20 animate-pulse">
              <AlertTriangle size={26} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-red-200 text-red-950 text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                  ⚠️ Overdue Fees Alert
                </span>
                <span className="bg-white dark:bg-slate-900 text-red-700 text-xs font-bold px-2.5 py-0.5 rounded-full border border-red-200">
                  {feeAlerts.overdueCount} Overdue Invoices
                </span>
              </div>
              <h2 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                ₹{feeAlerts.overdueAmount.toLocaleString()} Overdue Across {feeAlerts.overdueStudentsCount} Student(s)
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                Total outstanding: ₹{stats.outstanding.toLocaleString()} ({feeAlerts.unpaidCount} unpaid invoices across {feeAlerts.unpaidStudentsCount} students).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
              className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${
                statusFilter === 'overdue'
                  ? 'bg-red-700 text-white shadow-red-700/20'
                  : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
              }`}
            >
              <Filter size={16} />
              {statusFilter === 'overdue' ? 'Showing Overdue Invoices' : 'Filter Overdue Invoices'}
            </button>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-3 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>
      ) : feeAlerts.unpaidCount > 0 ? (
        <div className="mb-8 p-5 rounded-3xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shrink-0 shadow-md shadow-amber-500/20">
              <AlertTriangle size={24} />
            </div>
            <div>
              <span className="bg-amber-200 text-amber-950 text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                💳 Pending Collection Alert
              </span>
              <h2 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                ₹{stats.outstanding.toLocaleString()} Pending Collection ({feeAlerts.unpaidCount} Invoices)
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Pending across {feeAlerts.unpaidStudentsCount} students within their active payment deadlines.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setStatusFilter(statusFilter === 'unpaid' ? 'all' : 'unpaid')}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm flex items-center gap-2 ${
                statusFilter === 'unpaid'
                  ? 'bg-amber-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }`}
            >
              <Filter size={14} />
              {statusFilter === 'unpaid' ? 'Showing Unpaid Only' : 'View Unpaid Invoices'}
            </button>
            {statusFilter !== 'all' && (
              <button
                onClick={() => setStatusFilter('all')}
                className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      ) : null}

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Receipt size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Expected</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">₹{stats.expected.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Collected Revenue</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">₹{stats.collected.toLocaleString()}</p>
          </div>
        </div>
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
            feeAlerts.overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <AlertTriangle size={28} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {feeAlerts.overdueCount > 0 ? 'Outstanding (Overdue Alert)' : 'Outstanding'}
            </p>
            <p className={`text-2xl font-black ${feeAlerts.overdueCount > 0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
              ₹{stats.outstanding.toLocaleString()}
            </p>
            {feeAlerts.overdueCount > 0 && (
              <p className="text-xs font-bold text-red-600 mt-0.5">
                ₹{feeAlerts.overdueAmount.toLocaleString()} overdue
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search by student, admission no, or fee name..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium"
              >
                <option value="all">All Invoices ({invoices.length})</option>
                {feeAlerts.overdueCount > 0 && (
                  <option value="overdue">⚠️ Overdue ({feeAlerts.overdueCount})</option>
                )}
                <option value="unpaid">Unpaid / Pending ({feeAlerts.unpaidCount})</option>
                <option value="paid">Paid ({invoices.length - feeAlerts.unpaidCount})</option>
              </select>
            </div>

            {/* Period Filter */}
            {periods.length > 0 && (
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400 dark:text-slate-300 shrink-0" />
                <select
                  value={filterPeriodId}
                  onChange={(e) => setFilterPeriodId(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-medium"
                >
                  <option value="">All Periods</option>
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                  <option value="null_period">General (No Period)</option>
                </select>
              </div>
            )}
          </div>
        </div>

        <div className="overflow-x-auto w-full min-w-0">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Student</th>
                <th className="p-4">Fee Details</th>
                <th className="p-4">Collection Period</th>
                <th className="p-4">Amount</th>
                <th className="p-4">Status</th>
                <th className="p-4 pr-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <CreditCard size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="font-bold text-slate-900 dark:text-white mb-1">No invoices found</p>
                    <p>
                      {statusFilter !== 'all' || filterPeriodId || searchQuery 
                        ? 'Try clearing the active filters or search terms.' 
                        : 'Assign a fee to a class to generate invoices.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const student = students[inv.studentId];
                  const today = new Date();
                  const isOverdue = inv.dueDate && new Date(inv.dueDate + 'T23:59:59') < today && inv.status !== 'Paid';
                  
                  return (
                    <tr 
                      key={inv.id} 
                      className={`transition-colors ${
                        isOverdue 
                          ? 'bg-red-50/30 hover:bg-red-50/60' 
                          : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="p-4 pl-6">
                        {student ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center font-bold text-sm border border-slate-200 dark:border-slate-700 shrink-0">
                              {(student.firstName?.charAt(0) || '')}{(student.lastName?.charAt(0) || '')}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {student.firstName} {student.lastName}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                                {student.admissionNumber}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-300 italic">Unknown Student</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-slate-900 dark:text-white">{inv.feeName}</div>
                        <div className={`text-xs mt-0.5 ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500 dark:text-slate-400'}`}>
                          Due: {inv.dueDate || 'N/A'}
                        </div>
                      </td>
                      <td className="p-4">
                        {inv.collectionPeriodName && inv.collectionPeriodName !== 'General' ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {inv.collectionPeriodName}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-300 italic">General</span>
                        )}
                      </td>
                      <td className="p-4 font-mono font-bold text-slate-700 dark:text-slate-200">
                        ₹{Number(inv.amount || 0).toLocaleString()}
                      </td>
                      <td className="p-4">
                        {inv.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                            <CheckCircle2 size={14} /> Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            <AlertTriangle size={14} /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">
                            <AlertTriangle size={14} /> Pending
                          </span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {inv.status !== 'Paid' && hasEditPermission && (
                          <button 
                            onClick={() => handleMarkPaid(inv.id)}
                            className={`px-4 py-2 rounded-xl font-bold transition-all text-xs border ${
                              isOverdue
                                ? 'bg-red-600 hover:bg-red-700 text-white border-red-600 shadow-sm shadow-red-600/20'
                                : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white border-primary-100 hover:border-primary-600 dark:hover:border-slate-700'
                            }`}
                          >
                            Record Payment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Fee Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Assign New Fee</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">

                {/* Collection Period Selector */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Collection Period
                    {periods.length === 0 && (
                      <span className="ml-2 text-xs font-normal text-amber-600">
                        (Configure periods in Environment Setup)
                      </span>
                    )}
                  </label>
                  {periods.length > 0 ? (
                    <select
                      value={newFee.collectionPeriodId}
                      onChange={(e) => handlePeriodChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    >
                      <option value="">No Period (General)</option>
                      {periods.filter(p => p.status === 'active').map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-sm text-slate-400 dark:text-slate-300 bg-slate-50 dark:bg-slate-800">
                      No periods configured. Fee will be saved as "General".
                    </div>
                  )}
                </div>

                {/* Fee Name (auto-filled from period, but editable) */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                    Fee Description
                    <span className="ml-1 text-xs font-normal text-slate-400 dark:text-slate-300">(auto-filled from period, editable)</span>
                  </label>
                  <input 
                    type="text" required
                    value={newFee.name}
                    onChange={(e) => setNewFee({...newFee, name: e.target.value})}
                    placeholder="e.g. Term 1 Tuition"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Amount (₹)</label>
                    <input 
                      type="number" required min="0" step="0.01"
                      value={newFee.amount}
                      onChange={(e) => setNewFee({...newFee, amount: e.target.value})}
                      placeholder="e.g. 1500"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Due Date</label>
                    <input 
                      type="date" required
                      value={newFee.dueDate}
                      onChange={(e) => setNewFee({...newFee, dueDate: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Apply to Class</label>
                  <select 
                    required
                    value={newFee.classId}
                    onChange={(e) => setNewFee({...newFee, classId: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option value="">Select a class...</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name} - Section {c.section}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    Invoices will be automatically generated for all students currently enrolled in this class.
                  </p>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <CustomFieldsRenderer
                    moduleKey="fees"
                    customData={newFee.customData}
                    onChange={(k, v) => setNewFee(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                  />
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
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors"
                >
                  {creating ? 'Saving...' : 'Assign Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
