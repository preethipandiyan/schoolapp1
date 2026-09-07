import React, { useState, useEffect } from 'react';
import { LuBookOpen, LuPlus, LuSearch, LuCalendar, LuFileText, LuCircleCheck, LuClock, LuX, LuTrash, LuFileDown } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection, addSubDocument, updateSubDocument, deleteSubDocument } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import usePermissions from '../../hooks/usePermissions';
import ConfirmModal from '../../components/ConfirmModal';
import { sortClassesAscending } from '../../utils/classSorting';

export default function LessonPlans() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('lesson_plans');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('lesson_plans');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('lesson_plans');

  const [activeTab, setActiveTab] = useState('upcoming');
  const [searchTerm, setSearchTerm] = useState('');
  const [plans, setPlans] = useState([]);
  const [classes, setClasses] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, planId: null, planTopic: '' });
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal & Form State
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    class: true,
    subject: true,
    topic: true,
    date: true,
    status: true
  });

  const availableFieldsList = [
    { key: 'class', label: 'Class / Section' },
    { key: 'subject', label: 'Subject Name' },
    { key: 'topic', label: 'Topic Name' },
    { key: 'date', label: 'Target Date' },
    { key: 'status', label: 'Plan Status' }
  ];

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

  const handleExport = () => {
    if (plans.length === 0) {
      toast.error("No lesson plan data available to export.");
      return;
    }

    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const exportData = plans.map((plan, index) => {
      const row = { "S.No": index + 1 };
      availableFieldsList.forEach(field => {
        if (selectedFields[field.key]) {
          if (field.key === 'date') {
            row[field.label] = plan.date ? new Date(plan.date).toLocaleDateString('en-GB') : '';
          } else {
            row[field.label] = plan[field.key] || '';
          }
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Lesson Plans");
    
    const rawName = exportFileName.trim() || "My_Lesson_Plans";
    const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
    
    XLSX.writeFile(workbook, finalFileName);
    setShowExportModal(false);
    toast.success("Lesson plans exported successfully!");
  };
  const [formData, setFormData] = useState({
    class: '',
    subject: '',
    topic: '',
    date: '',
    status: 'draft'
  });

  // Subscribe to Lesson Plans, Classes, and Subjects
  useEffect(() => {
    if (!schoolId || !currentUser?.uid) return;

    setLoading(true);
    let plansUnsub, classesUnsub, subjectsUnsub;

    plansUnsub = subscribeToSubCollection(schoolId, 'lesson_plans', (data) => {
      // Filter plans by current teacher's user ID
      const teacherPlans = data.filter(p => p.teacherId === currentUser.uid);
      setPlans(teacherPlans);
      setLoading(false);
    });

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    subjectsUnsub = subscribeToSubCollection(schoolId, 'subjects', (data) => {
      setSubjects(data);
    });

    return () => {
      if (plansUnsub) plansUnsub();
      if (classesUnsub) classesUnsub();
      if (subjectsUnsub) subjectsUnsub();
    };
  }, [schoolId, currentUser]);

  const handleOpenCreate = () => {
    setEditingPlan(null);
    setFormData({
      class: '',
      subject: '',
      topic: '',
      date: '',
      status: 'draft'
    });
    setShowModal(true);
  };

  const handleOpenEdit = (plan) => {
    setEditingPlan(plan);
    setFormData({
      class: plan.class || '',
      subject: plan.subject || '',
      topic: plan.topic || '',
      date: plan.date || '',
      status: plan.status || 'draft'
    });
    setShowModal(true);
  };

  const handleDeleteClick = (planId, topic) => {
    setConfirmModal({
      isOpen: true,
      planId,
      planTopic: topic
    });
  };

  const handleConfirmDelete = async () => {
    const { planId } = confirmModal;
    if (!planId) return;

    setConfirmModal({ isOpen: false, planId: null, planTopic: '' });

    try {
      await deleteSubDocument(schoolId, 'lesson_plans', planId);
      toast.success("Lesson plan deleted successfully!");
    } catch (error) {
      toast.error("Failed to delete lesson plan.");
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!formData.class || !formData.subject || !formData.topic || !formData.date) {
      toast.error("Please fill in all fields.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        teacherId: currentUser.uid,
        teacherName: currentUser.displayName || currentUser.email || 'Teacher',
        updatedAt: new Date().toISOString()
      };

      if (editingPlan) {
        await updateSubDocument(schoolId, 'lesson_plans', editingPlan.id, payload);
        toast.success("Lesson plan updated successfully!");
      } else {
        await addSubDocument(schoolId, 'lesson_plans', {
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success("Lesson plan created successfully!");
      }
      setShowModal(false);
    } catch (error) {
      toast.error("Failed to save lesson plan.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPlans = plans.filter(p => {
    const matchesSearch = 
      (p.topic || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (p.subject || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const planDate = new Date(p.date);
    planDate.setHours(0, 0, 0, 0);
    
    const isPast = planDate < today || p.status === 'completed';
    if (activeTab === 'upcoming') return matchesSearch && !isPast;
    return matchesSearch && isPast;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'ready': return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuCircleCheck size={14} /> Ready</span>;
      case 'draft': return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuClock size={14} /> Draft</span>;
      case 'completed': return <span className="flex items-center gap-1 px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider"><LuFileText size={14} /> Completed</span>;
      default: return null;
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto h-full flex flex-col min-w-0 w-full">
      <div className="mb-8 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
            <LuBookOpen className="text-primary-600 shrink-0" /> Lesson Plans
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create, organize, and track your daily lesson plans.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {hasCreatePermission && (
            <button 
              onClick={handleOpenCreate}
              className="w-full sm:w-auto flex justify-center items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors"
            >
              <LuPlus size={18} /> New Plan
            </button>
          )}
          <button
            onClick={() => {
              if (plans.length === 0) {
                toast.error("No lesson plan data available to export.");
                return;
              }
              setExportFileName('My_Lesson_Plans');
              setShowExportModal(true);
            }}
            className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-md shadow-primary-600/10 transition-all active:scale-[0.98]"
          >
            <LuFileDown size={18} />
            Export
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 px-6 pt-4 shrink-0 overflow-x-auto w-full custom-scrollbar">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'upcoming' ? 'border-primary-600 text-primary-700 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50'}`}
          >
            <LuCalendar size={18} /> Upcoming Lessons
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 font-bold text-sm border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 ${activeTab === 'past' ? 'border-primary-600 text-primary-700 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50'}`}
          >
            <LuFileText size={18} /> Past Lessons
          </button>
        </div>

        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex gap-4 shrink-0">
          <div className="relative flex-1 max-w-md">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
            <input 
              type="text"
              placeholder="Search by topic or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPlans.map(plan => (
                <div key={plan.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-slate-700 hover:shadow-md transition-all group flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 mb-2 inline-block">
                        {plan.class}
                      </span>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{plan.topic}</h3>
                    </div>
                    {getStatusBadge(plan.status)}
                  </div>
                  
                  <p className="text-sm font-semibold text-primary-600 mb-6 flex-1">{plan.subject}</p>
                  
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-sm font-medium text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <LuCalendar size={14} /> 
                      {plan.date ? new Date(plan.date).toLocaleDateString('en-GB') : 'No Date'}
                    </span>
                    {hasEditPermission && (
                      <button 
                        onClick={() => handleOpenEdit(plan)}
                        className="text-primary-600 hover:text-primary-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Edit Plan &rarr;
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {filteredPlans.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                  <LuBookOpen size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-200">No lesson plans found.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <form 
            onSubmit={handleFormSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingPlan ? 'Edit Lesson Plan' : 'New Lesson Plan'}
              </h3>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Class / Section</label>
                {classes.length > 0 ? (
                  <select
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  >
                    <option value="">Select a Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={`${c.name} - Section ${c.section}`}>
                        {c.name} - Section {c.section}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. Grade 10 - A"
                    value={formData.class}
                    onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Subject</label>
                {subjects.length > 0 ? (
                  <select
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  >
                    <option value="">Select a Subject</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    placeholder="e.g. Mathematics"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  />
                )}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Topic Name</label>
                <input
                  type="text"
                  placeholder="e.g. Calculus Basics"
                  value={formData.topic}
                  onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Target Date</label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                >
                  <option value="draft">Draft</option>
                  <option value="ready">Ready</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>
            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
              <div className="flex justify-between items-center w-full">
                {editingPlan && hasDeletePermission ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowModal(false);
                      handleDelete(editingPlan.id);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-700 rounded-xl text-sm font-bold hover:bg-red-100 transition-colors border border-red-200"
                  >
                    <LuTrash size={16} /> Delete Plan
                  </button>
                ) : <div />}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors disabled:opacity-50"
                  >
                    {submitting ? 'Saving...' : 'Save Plan'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Export Lesson Plans</h3>
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
                    placeholder="e.g. My_Lesson_Plans"
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
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, planId: null, planTopic: '' })}
        onConfirm={handleConfirmDelete}
        title="Delete Lesson Plan"
        message={`Are you sure you want to delete the lesson plan "${confirmModal.planTopic}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
