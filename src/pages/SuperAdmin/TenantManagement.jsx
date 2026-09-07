import React, { useState, useEffect } from 'react';
import { subscribeToAllSchools, updateSchoolStatus } from '../../firebase/firestore';
import { LuBuilding2 as Building2, LuSearch as Search, LuCircleCheck as CheckCircle2, LuCircleAlert as AlertCircle, LuBan as Ban, LuMail as Mail, LuPhone as Phone, LuCalendar as Calendar, LuSettings as Settings, LuX as X, LuShieldCheck as ShieldCheck, LuExternalLink as ExternalLink, LuFileText as FileText, LuDownload as Download } from 'react-icons/lu';
import toast from 'react-hot-toast';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ConfirmModal from '../../components/ConfirmModal';
import { sendEmail } from '../../services/emailService';

const mockSchools = [
  { id: 't1', name: 'Springfield Elementary', email: 'contact@springfield.edu', phone: '+1 234 567 8900', status: 'approved', createdAt: '2026-07-01' },
  { id: 't2', name: 'Shelbyville High', email: 'admin@shelbyville.edu', phone: '+1 234 567 8901', status: 'pending', createdAt: '2026-07-05' },
  { id: 't3', name: 'Capital City Academy', email: 'info@capitalcity.edu', phone: '+1 234 567 8902', status: 'approved', createdAt: '2026-07-08' },
  { id: 't4', name: 'Ogdenville School', email: 'hello@ogdenville.edu', phone: '+1 234 567 8903', status: 'rejected', createdAt: '2026-07-10' },
  { id: 't5', name: 'North Haverbrook Prep', email: 'contact@northhaverbrook.edu', phone: '+1 234 567 8904', status: 'approved', createdAt: '2026-07-11' },
  { id: 't6', name: 'Waverly Hills High', email: 'admin@waverly.edu', phone: '+1 234 567 8905', status: 'pending', createdAt: '2026-07-12' },
  { id: 't7', name: 'Cypress Creek High', email: 'info@cypresscreek.edu', phone: '+1 234 567 8906', status: 'approved', createdAt: '2026-07-12' },
  { id: 't8', name: 'West Springfield Elementary', email: 'contact@westspringfield.edu', phone: '+1 234 567 8907', status: 'pending', createdAt: '2026-07-13' },
  { id: 't9', name: 'East Shelbyville Academy', email: 'hello@eastshelbyville.edu', phone: '+1 234 567 8908', status: 'approved', createdAt: '2026-07-13' },
  { id: 't10', name: 'South Park Elementary', email: 'admin@southpark.edu', phone: '+1 234 567 8909', status: 'approved', createdAt: '2026-07-13' }
];

const AVAILABLE_MODULES = [
  { id: 'timetables', label: 'Timetables & Scheduling' },
  { id: 'transport', label: 'Transport Management (GPS/Routes)' },
  { id: 'library', label: 'Library Management' },
  { id: 'exams', label: 'Examinations & Report Cards' },
  { id: 'noticeboard', label: 'Noticeboard & Announcements' },
  { id: 'media', label: 'Media & Cloudinary Integration' },
  { id: 'classes', label: 'Classes & Sections' },
  { id: 'hr-payroll', label: 'HR & Payroll Management' },
  { id: 'attendance', label: 'Attendance Management' },
  { id: 'calendar', label: 'Academic Calendar' },
  { id: 'fees', label: 'Fees & Payments' },
  { id: 'hostel', label: 'Hostel Management' },
  { id: 'inventory', label: 'Inventory & Assets' },
  { id: 'health', label: 'Health & Medical Records' },
  { id: 'complaints', label: 'Complaint Redressal' },
  { id: 'alumni', label: 'Alumni Management' },
  { id: 'documents', label: 'Document Management' },
  { id: 'branches', label: 'Multi-Branch Management' },
  { id: 'reports', label: 'Reports & Analytics' },
  { id: 'billing', label: 'Billing & Subscriptions' }
];

export default function TenantManagement() {
  const [schools, setSchools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const [showModal, setShowModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [selectedModules, setSelectedModules] = useState([]);
  const [seatLimit, setSeatLimit] = useState(500);
  const [teacherLimit, setTeacherLimit] = useState(50);
  const [saving, setSaving] = useState(false);
  
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [configData, setConfigData] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  
  const [previewDoc, setPreviewDoc] = useState(null); // { url, title }
  const [modalAction, setModalAction] = useState('approve'); // 'approve' | 'edit'
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, schoolId: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    setLoading(true);
    const unsub = subscribeToAllSchools((data) => {
      setSchools(data.length > 0 ? data : mockSchools);
      setLoading(false);

      // AUTO-HEAL: Fix any disconnected admins (created before the LandingPage fix)
      data.forEach(async (school) => {
        if (school.adminId) {
          try {
            const userRef = doc(db, 'users', school.adminId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
              const userData = userSnap.data();
              if (!userData.schoolId) {
                await updateDoc(userRef, { schoolId: school.id });
                console.log(`Auto-healed admin connection for school: ${school.name}`);
              }
            }
          } catch (healErr) {
            console.error("Auto-heal failed for user:", school.adminId, healErr);
          }
        }
      });
    });

    return () => unsub();
  }, []);

  const openApprovalModal = (school) => {
    setSelectedSchool(school);
    setModalAction('approve');
    setSelectedModules(school.permittedModules || []);
    const defaultSeats = school.seatLimit !== undefined ? school.seatLimit : (school.plan?.toLowerCase() === 'enterprise' ? 2000 : school.plan?.toLowerCase() === 'basic' ? 100 : 500);
    const defaultTeachers = school.teacherLimit !== undefined ? school.teacherLimit : (school.plan?.toLowerCase() === 'enterprise' ? 150 : school.plan?.toLowerCase() === 'basic' ? 10 : 50);
    setSeatLimit(defaultSeats);
    setTeacherLimit(defaultTeachers);
    setShowModal(true);
  };

  const openEditModal = (school) => {
    setSelectedSchool(school);
    setModalAction('edit');
    setSelectedModules(school.permittedModules || []);
    const defaultSeats = school.seatLimit !== undefined ? school.seatLimit : (school.plan?.toLowerCase() === 'enterprise' ? 2000 : school.plan?.toLowerCase() === 'basic' ? 100 : 500);
    const defaultTeachers = school.teacherLimit !== undefined ? school.teacherLimit : (school.plan?.toLowerCase() === 'enterprise' ? 150 : school.plan?.toLowerCase() === 'basic' ? 10 : 50);
    setSeatLimit(defaultSeats);
    setTeacherLimit(defaultTeachers);
    setShowModal(true);
  };

  const toggleModule = (moduleId) => {
    setSelectedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId]
    );
  };

  const handleSavePermissions = async () => {
    setSaving(true);
    try {
      const parsedSeatLimit = Math.max(1, Number(seatLimit) || 500);
      const parsedTeacherLimit = Math.max(1, Number(teacherLimit) || 50);
      await updateSchoolStatus(selectedSchool.id, 'approved', selectedModules, {
        seatLimit: parsedSeatLimit,
        teacherLimit: parsedTeacherLimit
      });
      setSchools(schools.map(s => s.id === selectedSchool.id ? { 
        ...s, 
        status: 'approved', 
        permittedModules: selectedModules,
        seatLimit: parsedSeatLimit,
        teacherLimit: parsedTeacherLimit
      } : s));
      
      if (modalAction === 'approve') {
        try {
          await sendEmail({
            to: selectedSchool.adminEmail,
            templateType: 'APPROVAL',
            data: {
              schoolName: selectedSchool.schoolName || 'School Admin',
              dashboardLink: window.location.origin + '/login'
            }
          });
          toast.success("School approved with limits & email sent!");
        } catch (emailError) {
          console.error("Email error:", emailError);
          toast.error("Approved, but email failed to send.");
        }
      } else {
        toast.success("School limits and permissions updated successfully.");
      }

      setShowModal(false);
    } catch (error) {
      console.error("Failed to save:", error);
      toast.error("Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  const handleSuspendClick = (schoolId) => {
    setConfirmModalState({ isOpen: true, schoolId });
  };

  const executeSuspend = async () => {
    const schoolId = confirmModalState.schoolId;
    if (!schoolId) return;
    try {
      await updateSchoolStatus(schoolId, 'suspended', []); // Doesn't matter, status is suspended
      setSchools(schools.map(s => s.id === schoolId ? { ...s, status: 'suspended' } : s));
    } catch (error) {
      toast.error("Failed to suspend");
    } finally {
      setConfirmModalState({ isOpen: false, schoolId: null });
    }
  };

  const filteredSchools = schools.filter(school => {
    const matchesSearch = school.schoolName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          school.adminEmail?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || school.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredSchools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedSchools = filteredSchools.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 flex flex-col min-w-0">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8 shrink-0">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Tenant Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage licenses and access for all schools on the platform.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 mb-6 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
          <input
            type="text"
            placeholder="Search by school name or admin email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 transition-shadow"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'approved', 'suspended'].map(status => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
                statusFilter === status 
                  ? 'bg-primary-600 text-white shadow-sm' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="w-full min-w-0 overflow-x-auto custom-scrollbar flex-1">
          <table className="w-full text-left border-collapse min-w-max">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-sm">
                <th className="p-4 font-semibold w-1/3">School Details</th>
                <th className="p-4 font-semibold">Contact Info</th>
                <th className="p-4 font-semibold">Plan</th>
                <th className="p-4 font-semibold">Registration Date</th>
                <th className="p-4 font-semibold text-center">Status</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 dark:text-slate-400">
                    <Building2 size={48} className="mx-auto mb-4 text-slate-300" />
                    <p className="text-lg font-medium text-slate-900 dark:text-white">No tenants found</p>
                    <p>Try adjusting your search or filters.</p>
                  </td>
                </tr>
              ) : (
                paginatedSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">
                          {school.schoolName?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{school.schoolName}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">ID: {school.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                          <Mail size={14} className="text-slate-400 dark:text-slate-300" />
                          {school.adminEmail}
                        </div>
                        {school.phone && (
                          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                            <Phone size={14} className="text-slate-400 dark:text-slate-300" />
                            {school.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1">
                        <span className="inline-block w-fit px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 uppercase tracking-wider border border-slate-200 dark:border-slate-700">
                          {school.plan || 'Standard'}
                        </span>
                        <span className="text-xs font-semibold text-primary-700 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-200 w-fit">
                          {school.seatLimit || (school.plan?.toLowerCase() === 'enterprise' ? 2000 : school.plan?.toLowerCase() === 'basic' ? 100 : 500)} Student Seats
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                        <Calendar size={14} className="text-slate-400 dark:text-slate-300" />
                        {new Date(school.createdAt).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider
                        ${school.status === 'approved' ? 'bg-green-100 text-green-700 border border-green-200' : 
                          school.status === 'pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 
                          'bg-red-100 text-red-700 border border-red-200'}`}
                      >
                        {school.status === 'approved' && <CheckCircle2 size={12} />}
                        {school.status === 'pending' && <AlertCircle size={12} />}
                        {school.status === 'suspended' && <Ban size={12} />}
                        {school.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        {school.status === 'pending' && (
                          <button
                            onClick={() => openApprovalModal(school)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors tooltip-trigger"
                            title="Review Application"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                        {school.status === 'approved' && (
                          <>
                            <button
                              onClick={() => openEditModal(school)}
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                              title="Edit Permissions"
                            >
                              <Settings size={18} />
                            </button>
                            <button
                              onClick={() => handleSuspendClick(school.id)}
                              className="p-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                              title="Suspend Tenant"
                            >
                              <Ban size={18} />
                            </button>
                          </>
                        )}
                        {school.status === 'suspended' && (
                          <button
                            onClick={() => openApprovalModal(school)}
                            className="p-2 bg-green-50 text-green-600 hover:bg-green-100 rounded-xl transition-colors"
                            title="Restore Tenant"
                          >
                            <CheckCircle2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

      {/* Permissions Modal */}
      {showModal && selectedSchool && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-start justify-center z-50 p-4 sm:p-6 overflow-y-auto pt-10 md:pt-20">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="text-primary-600" />
                {modalAction === 'approve' ? 'Approve Tenant & Assign Modules' : 'Edit Tenant Modules'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <div className="mb-6 bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">{selectedSchool.schoolName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Purchased Plan: <span className="font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">{selectedSchool.plan || 'Standard'}</span></p>
                </div>
                <div className="bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  DB Enforcement: <span className="text-green-600 font-bold">Active</span>
                </div>
              </div>

              {/* License Capacity & Seat Limits (SuperAdmin Controlled) */}
              <div className="mb-6 border border-primary-200 bg-primary-50/40 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                    <ShieldCheck size={18} className="text-primary-600" />
                    School License Capacity & DB Rules Limit
                  </h4>
                  <span className="text-xs font-bold text-primary-700 bg-primary-100 px-2.5 py-0.5 rounded-full">
                    SuperAdmin Only
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                  Set or expand the maximum student and teacher capacity for this school document. The database rules and application enforce this limit strictly.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                      Student Seat Limit
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="1"
                        value={seatLimit}
                        onChange={(e) => setSeatLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                        placeholder="e.g. 500"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Quick presets:</span>
                      {[250, 500, 1000, 2500].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setSeatLimit(val)}
                          className={`text-[11px] px-2 py-0.5 rounded font-bold transition-colors ${seatLimit === val ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                      Teacher Limit
                    </label>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number"
                        min="1"
                        value={teacherLimit}
                        onChange={(e) => setTeacherLimit(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900"
                        placeholder="e.g. 50"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Quick presets:</span>
                      {[25, 50, 100, 200].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setTeacherLimit(val)}
                          className={`text-[11px] px-2 py-0.5 rounded font-bold transition-colors ${teacherLimit === val ? 'bg-primary-600 text-white' : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal Verification Section */}
              {modalAction === 'approve' && selectedSchool.verificationDetails && (
                <div className="mb-6 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="bg-slate-50 dark:bg-slate-800 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <FileText size={16} className="text-primary-600" />
                      Legal Verification Documents
                    </h4>
                  </div>
                  <div className="p-4 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">UDISE Code</p>
                        <p className="font-medium text-slate-900 dark:text-white truncate">{selectedSchool.verificationDetails.udise || 'N/A'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Board Affiliation</p>
                        <p className="font-medium text-slate-900 dark:text-white truncate">{selectedSchool.verificationDetails.boardAffiliation || 'N/A'}</p>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      {selectedSchool.verificationDetails.regCertUrl && (
                        <button onClick={() => setPreviewDoc({ url: selectedSchool.verificationDetails.regCertUrl, title: 'Registration Certificate' })} className="w-full flex items-center justify-between p-3 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                          <span className="font-semibold text-sm">View Registration Certificate</span>
                          <ExternalLink size={16} />
                        </button>
                      )}
                      {selectedSchool.verificationDetails.panUrl && (
                        <button onClick={() => setPreviewDoc({ url: selectedSchool.verificationDetails.panUrl, title: 'PAN / TAN Card' })} className="w-full flex items-center justify-between p-3 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors">
                          <span className="font-semibold text-sm">View PAN / TAN Card</span>
                          <ExternalLink size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center mb-3">
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Select Permitted Modules</h4>
                <button 
                  onClick={() => {
                    if (selectedModules.length === AVAILABLE_MODULES.length) {
                      setSelectedModules([]);
                    } else {
                      setSelectedModules(AVAILABLE_MODULES.map(m => m.id));
                    }
                  }}
                  className="text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  {selectedModules.length === AVAILABLE_MODULES.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Core modules (Dashboard, Students, Staff, Billing) are always included.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_MODULES.map(module => (
                  <label key={module.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                    <input 
                      type="checkbox"
                      checked={selectedModules.includes(module.id)}
                      onChange={() => toggleModule(module.id)}
                      className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200">{module.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="w-full sm:w-auto px-4 py-2 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handleSavePermissions}
                disabled={saving} 
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors"
              >
                {saving ? 'Saving...' : modalAction === 'approve' ? 'Approve & Save' : 'Save Permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Document Preview Modal --- */}
      {previewDoc && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 lg:p-8">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800 shrink-0">
              <h3 className="font-bold text-xl text-slate-900 dark:text-white truncate w-full">{previewDoc.title}</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto overflow-x-auto">
                <a 
                  href={previewDoc.url} 
                  download 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-semibold shadow-sm"
                >
                  <Download size={18} /> Download Original
                </a>
                <button 
                  onClick={() => setPreviewDoc(null)} 
                  className="p-2.5 text-slate-400 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-200/50 p-2 lg:p-6 overflow-hidden flex justify-center items-center">
              {/* iframe is excellent for rendering both PDFs and Images securely in a sandboxed way */}
              <iframe 
                src={previewDoc.url} 
                className="w-full h-full rounded-2xl bg-white dark:bg-slate-900 shadow-inner border border-slate-200 dark:border-slate-700" 
                title={previewDoc.title} 
              />
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, schoolId: null })}
        onConfirm={executeSuspend}
        title="Suspend Tenant"
        message="Are you sure you want to suspend this tenant? They will lose access to the platform."
        confirmText="Suspend"
        type="danger"
      />
    </div>
  );
}
