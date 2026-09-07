import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  addDoc, 
  onSnapshot, 
  updateDoc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  LuUsers, 
  LuPlus, 
  LuTrash2, 
  LuChevronDown, 
  LuChevronUp, 
  LuCopy, 
  LuFileDown, 
  LuSearch, 
  LuFilter, 
  LuX, 
  LuCheck, 
  LuPencilLine, 
  LuEye,
  LuExternalLink
} from 'react-icons/lu';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import ConfirmModal from '../../components/ConfirmModal';

export default function LeadsManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [activeTab, setActiveTab] = useState('leads'); // 'leads' or 'forms'
  const [leads, setLeads] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, formId: null, formTitle: '' });

  // Leads Filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterForm, setFilterForm] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Selected Lead details Modal
  const [selectedLead, setSelectedLead] = useState(null);

  // Field selector Modal for Exporting
  const [showExportModal, setShowExportModal] = useState(false);
  const [availableFields, setAvailableFields] = useState([]);
  const [selectedFields, setSelectedFields] = useState({});
  const [exportFileName, setExportFileName] = useState('');

  // Form Builder states
  const [editingForm, setEditingForm] = useState(null); // Form doc being built or edited
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formSuccessMsg, setFormSuccessMsg] = useState('');
  const [formFields, setFormFields] = useState([]);

  // New field properties
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldRequired, setNewFieldRequired] = useState(false);
  const [newFieldOptions, setNewFieldOptions] = useState('');

  // Subscriptions to leads and forms
  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    const leadsRef = collection(db, `schools/${schoolId}/leads`);
    const formsRef = collection(db, `schools/${schoolId}/leadForms`);

    const unsubLeads = onSnapshot(leadsRef, (snap) => {
      const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      // Sort by date desc
      items.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setLeads(items);
    });

    const unsubForms = onSnapshot(formsRef, (snap) => {
      const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setForms(items);
      setLoading(false);
    });

    return () => {
      unsubLeads();
      unsubForms();
    };
  }, [schoolId]);

  // Lead status update
  const handleUpdateStatus = async (leadId, newStatus) => {
    try {
      const leadRef = doc(db, `schools/${schoolId}/leads`, leadId);
      await updateDoc(leadRef, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update status.');
    }
  };

  // Form builder: add field to form
  const handleAddField = () => {
    if (!newFieldLabel.trim()) {
      toast.error('Field label is required.');
      return;
    }
    const fieldId = 'field_' + Date.now();
    const parsedOptions = newFieldOptions
      ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : [];

    const field = {
      id: fieldId,
      label: newFieldLabel,
      type: newFieldType,
      required: newFieldRequired,
      options: parsedOptions
    };

    setFormFields(prev => [...prev, field]);
    setNewFieldLabel('');
    setNewFieldRequired(false);
    setNewFieldOptions('');
  };

  // Form builder: delete field
  const handleRemoveField = (fieldId) => {
    setFormFields(prev => prev.filter(f => f.id !== fieldId));
  };

  // Form builder: reorder fields
  const handleMoveField = (index, direction) => {
    const updated = [...formFields];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= updated.length) return;
    const temp = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = temp;
    setFormFields(updated);
  };

  // Form builder: save to Firestore
  const handleSaveForm = async () => {
    if (!formTitle.trim()) {
      toast.error('Form title is required.');
      return;
    }

    const payload = {
      title: formTitle,
      description: formDescription,
      successMessage: formSuccessMsg || 'Your enquiry has been successfully submitted. We will get back to you shortly.',
      fields: formFields,
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingForm.id === 'new') {
        const formsRef = collection(db, `schools/${schoolId}/leadForms`);
        await addDoc(formsRef, {
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success('Form created successfully!');
      } else {
        const formRef = doc(db, `schools/${schoolId}/leadForms`, editingForm.id);
        await updateDoc(formRef, payload);
        toast.success('Form updated successfully!');
      }
      setEditingForm(null);
    } catch (err) {
      console.error(err);
      toast.error('Error saving form configuration.');
    }
  };

  // Form builder: edit existing form trigger
  const handleStartEditForm = (form) => {
    setEditingForm(form);
    setFormTitle(form.title || '');
    setFormDescription(form.description || '');
    setFormSuccessMsg(form.successMessage || '');
    setFormFields(form.fields || []);
  };

  // Form builder: delete form configuration
  const handleDeleteFormClick = (formId, title) => {
    setConfirmModal({
      isOpen: true,
      formId,
      formTitle: title
    });
  };

  const handleConfirmDeleteForm = async () => {
    const { formId } = confirmModal;
    if (!formId) return;

    setConfirmModal({ isOpen: false, formId: null, formTitle: '' });

    try {
      await deleteDoc(doc(db, `schools/${schoolId}/leadForms`, formId));
      toast.success('Form deleted.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete form.');
    }
  };

  // Copy shareable link to clipboard
  const handleCopyLink = (formId) => {
    const link = `${window.location.origin}/leads/form/${schoolId}/${formId}`;
    navigator.clipboard.writeText(link);
    toast.success('Public link copied to clipboard!');
  };

  // Filter leads list
  const filteredLeads = leads.filter(lead => {
    // Search filter (handles custom inputs as well)
    const matchesSearch = searchTerm.trim() === '' || (() => {
      const term = searchTerm.toLowerCase();
      const rawData = JSON.stringify(lead.data || {}).toLowerCase();
      const title = (lead.formTitle || '').toLowerCase();
      return rawData.includes(term) || title.includes(term) || (lead.status || '').toLowerCase().includes(term);
    })();

    // Status filter
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;

    // Form filter
    const matchesForm = filterForm === 'all' || lead.formId === filterForm;

    // Date range filter
    const matchesDate = (() => {
      if (!lead.submittedAt) return true;
      const subDate = new Date(lead.submittedAt.split('T')[0]);
      if (startDate && subDate < new Date(startDate)) return false;
      if (endDate && subDate > new Date(endDate)) return false;
      return true;
    })();

    return matchesSearch && matchesStatus && matchesForm && matchesDate;
  });

  // Setup Available columns dynamically for XLSX exporting
  const handleOpenExportModal = () => {
    if (filteredLeads.length === 0) {
      toast.error("No lead data available to export.");
      return;
    }
    // Determine unique field labels from the filtered leads
    const customKeys = new Set();
    filteredLeads.forEach(lead => {
      Object.keys(lead.data || {}).forEach(k => {
        // Try to look up label from forms fields
        const matchingForm = forms.find(f => f.id === lead.formId);
        const matchingField = matchingForm?.fields?.find(fld => fld.id === k);
        const label = matchingField ? matchingField.label : k;
        customKeys.add(JSON.stringify({ key: k, label }));
      });
    });

    const fieldsList = [
      { key: 'formTitle', label: 'Source Form' },
      { key: 'status', label: 'Status' },
      { key: 'submittedAt', label: 'Submitted Date' }
    ];

    customKeys.forEach(str => {
      fieldsList.push(JSON.parse(str));
    });

    setAvailableFields(fieldsList);

    // Initialize all as checked
    const initSelected = {};
    fieldsList.forEach(f => {
      initSelected[f.key] = true;
    });
    setSelectedFields(initSelected);
    setExportFileName(`leads_export_${new Date().toISOString().split('T')[0]}`);
    setShowExportModal(true);
  };

  // Perform Excel exporting
  const handleExportExcel = () => {
    try {
      const exportData = filteredLeads.map((lead, idx) => {
        const row = { 'S.No': idx + 1 };
        availableFields.forEach(field => {
          if (!selectedFields[field.key]) return;
          if (field.key === 'formTitle') {
            row['Source Form'] = lead.formTitle || 'Unknown';
          } else if (field.key === 'status') {
            row['Status'] = lead.status || 'Cold';
          } else if (field.key === 'submittedAt') {
            row['Submitted Date'] = lead.submittedAt ? new Date(lead.submittedAt).toLocaleDateString('en-GB') : '-';
          } else {
            const val = lead.data?.[field.key];
            row[field.label] = Array.isArray(val) ? val.join(', ') : (val || '');
          }
        });
        return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Leads Report");
      
      const rawName = exportFileName.trim() || 'leads_export';
      const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
      
      XLSX.writeFile(workbook, finalFileName);
      setShowExportModal(false);
      toast.success('Leads report exported successfully!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to export Excel.');
    }
  };

  // Field selector toggle helpers
  const handleFieldToggle = (key) => {
    setSelectedFields(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSelectAllFields = (val) => {
    const updated = {};
    availableFields.forEach(f => { updated[f.key] = val; });
    setSelectedFields(updated);
  };

  // Get status color styling
  const getStatusColor = (status) => {
    if (status === 'Hot') return 'bg-red-50 text-red-600 border-red-200';
    if (status === 'Warm') return 'bg-amber-50 text-amber-600 border-amber-200';
    return 'bg-blue-50 text-blue-600 border-blue-200'; // Cold
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <LuUsers className="text-primary-600" /> Leads Management
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Design lead forms, embed links, and track enquiries.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'leads'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Leads Directory
          </button>
          <button
            onClick={() => setActiveTab('forms')}
            className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'forms'
                ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Form Builder
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
        </div>
      ) : activeTab === 'leads' ? (
        /* ========================================================================= */
        /* LEADS DIRECTORY VIEW                                                      */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Filters & Search Toolbar */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Search Bar */}
              <div className="relative col-span-1 md:col-span-2">
                <LuSearch className="absolute left-4 top-3.5 text-slate-400 dark:text-slate-300" size={18} />
                <input 
                  type="text" 
                  placeholder="Search leads by name, email, or content..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="Hot">Hot</option>
                  <option value="Warm">Warm</option>
                  <option value="Cold">Cold</option>
                </select>
              </div>

              {/* Source Form Filter */}
              <div>
                <select 
                  value={filterForm}
                  onChange={(e) => setFilterForm(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                >
                  <option value="all">All Source Forms</option>
                  {forms.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Advanced Date Range + Export */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">From:</span>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">To:</span>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                {(startDate || endDate) && (
                  <button 
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-xs text-red-500 font-bold hover:underline cursor-pointer"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              <button
                onClick={handleOpenExportModal}
                disabled={filteredLeads.length === 0}
                className="bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 py-2.5 px-5 font-bold rounded-xl text-sm transition-colors flex items-center gap-2 shadow-sm shrink-0 cursor-pointer"
              >
                <LuFileDown size={18} />
                <span>Export Report</span>
              </button>
            </div>
          </div>

          {/* Leads Grid/Table */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            {filteredLeads.length === 0 ? (
              <div className="p-20 text-center text-slate-500 dark:text-slate-400">
                No matching leads found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300 pl-6">Submitted Date</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Source Form</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Primary Contact / Details</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300">Status</th>
                      <th className="p-4 text-xs font-bold text-slate-400 dark:text-slate-300 text-right pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      // Attempt to construct a summary details preview
                      const values = Object.values(lead.data || {});
                      const summaryPreview = values.slice(0, 3).map(val => Array.isArray(val) ? val.join(', ') : val).join(' | ');

                      return (
                        <tr key={lead.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6 text-sm text-slate-600 dark:text-slate-300 font-semibold">
                            {lead.submittedAt ? new Date(lead.submittedAt).toLocaleString() : '-'}
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-900 dark:text-white">
                            {lead.formTitle || 'Untitled Form'}
                          </td>
                          <td className="p-4 text-sm text-slate-600 dark:text-slate-300 truncate max-w-xs">
                            {summaryPreview || <span className="text-slate-400 dark:text-slate-300 italic">No details submitted</span>}
                          </td>
                          <td className="p-4">
                            <select
                              value={lead.status || 'Cold'}
                              onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border outline-none ${getStatusColor(lead.status || 'Cold')}`}
                            >
                              <option value="Cold">Cold</option>
                              <option value="Warm">Warm</option>
                              <option value="Hot">Hot</option>
                            </select>
                          </td>
                          <td className="p-4 text-right pr-6 space-x-2">
                            <button
                              onClick={() => setSelectedLead(lead)}
                              className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer"
                              title="View details"
                            >
                              <LuEye size={18} />
                            </button>
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
      ) : (
        /* ========================================================================= */
        /* FORM BUILDER VIEW                                                         */
        /* ========================================================================= */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of active forms */}
          <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="font-bold text-lg text-slate-900 dark:text-white">Configured Forms</h2>
              <button
                onClick={() => handleStartEditForm({ id: 'new', title: '', description: '', successMessage: '', fields: [] })}
                className="bg-primary-600 text-white hover:bg-primary-700 py-1.5 px-3 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <LuPlus size={14} /> Add Form
              </button>
            </div>

            {forms.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 text-center py-10">No forms config found. Add one above.</p>
            ) : (
              <div className="space-y-3">
                {forms.map(f => (
                  <div key={f.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100/50 transition-colors space-y-3">
                    <div>
                      <h3 className="font-bold text-slate-950 text-sm">{f.title}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">{f.description || 'No description'}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleCopyLink(f.id)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                        title="Copy Public Link"
                      >
                        <LuCopy size={13} /> Link
                      </button>
                      <a
                        href={`/leads/form/${schoolId}/${f.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1"
                        title="Test Public Form"
                      >
                        <LuExternalLink size={13} /> View
                      </a>
                      <button
                        onClick={() => handleStartEditForm(f)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-primary-600 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <LuPencilLine size={13} /> Edit
                      </button>
                      <button
                        onClick={() => handleDeleteFormClick(f.id, f.title)}
                        className="p-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-600 text-slate-400 dark:text-slate-300 rounded-lg text-xs font-semibold flex items-center gap-1 ml-auto cursor-pointer"
                      >
                        <LuTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Form Editing Workspace */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6">
            {!editingForm ? (
              <div className="p-20 text-center text-slate-500 dark:text-slate-400 space-y-3">
                <LuPencilLine className="mx-auto text-slate-300" size={48} />
                <h3 className="font-bold text-slate-700 dark:text-slate-200">Form Designer Workspace</h3>
                <p className="text-xs text-slate-400 dark:text-slate-300 max-w-sm mx-auto">Select an existing form configuration or click "Add Form" to design a new one.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="font-bold text-lg text-slate-900 dark:text-white">
                    {editingForm.id === 'new' ? 'Create Form Configuration' : `Edit: ${editingForm.title}`}
                  </h2>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setEditingForm(null)}
                      className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold py-1.5 px-3 rounded-xl text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveForm}
                      className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-1.5 px-3 rounded-xl text-xs transition-colors shadow-sm cursor-pointer"
                    >
                      Save Configuration
                    </button>
                  </div>
                </div>

                {/* Form Meta Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Form Title</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Admission Enquiry 2026"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
                    <input 
                      type="text" 
                      placeholder="Display prompt or helper text for enquiries"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Success / Thank-you Message</label>
                    <input 
                      type="text" 
                      placeholder="e.g., Thank you. Your enquiry has been received!"
                      value={formSuccessMsg}
                      onChange={(e) => setFormSuccessMsg(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                    />
                  </div>
                </div>

                {/* Fields Builder list */}
                <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm">Form Inputs & Field Configurations</h3>

                  {/* Add Field Inputs Control panel */}
                  <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50 dark:bg-slate-800 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Input Label</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Email Address"
                        value={newFieldLabel}
                        onChange={(e) => setNewFieldLabel(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Field Type</label>
                      <select 
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs outline-none"
                      >
                        <option value="text">Text Input</option>
                        <option value="number">Number Input</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="date">Date</option>
                        <option value="textarea">Textarea (Long text)</option>
                        <option value="dropdown">Dropdown Options</option>
                        <option value="checkbox">Checkboxes (Multiple)</option>
                        <option value="radio">Radio Buttons (Single)</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 col-span-1">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Required Field</label>
                      <div className="flex items-center gap-2 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2">
                        <input 
                          type="checkbox" 
                          id="newFieldReq"
                          checked={newFieldRequired}
                          onChange={(e) => setNewFieldRequired(e.target.checked)}
                          className="text-primary-600 focus:ring-primary-500 rounded"
                        />
                        <label htmlFor="newFieldReq" className="text-xs text-slate-600 dark:text-slate-300 cursor-pointer">Yes, Required</label>
                      </div>
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="w-full py-2 bg-primary-600 text-white rounded-lg font-bold text-xs hover:bg-primary-700 transition-colors shadow-sm cursor-pointer"
                      >
                        Add Input
                      </button>
                    </div>

                    {['dropdown', 'checkbox', 'radio'].includes(newFieldType) && (
                      <div className="md:col-span-4 space-y-1">
                        <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Options (comma-separated list)</label>
                        <input 
                          type="text" 
                          placeholder="e.g. Option A, Option B, Option C"
                          value={newFieldOptions}
                          onChange={(e) => setNewFieldOptions(e.target.value)}
                          className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg text-xs outline-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Render build schema fields list */}
                  <div className="space-y-2">
                    {formFields.map((field, index) => (
                      <div key={field.id} className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-slate-400 dark:text-slate-300">#{index + 1}</span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">{field.label}</span>
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded font-mono uppercase">{field.type}</span>
                          {field.required && (
                            <span className="text-[10px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded font-bold uppercase">Required</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => handleMoveField(index, -1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <LuChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={index === formFields.length - 1}
                            onClick={() => handleMoveField(index, 1)}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <LuChevronDown size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveField(field.id)}
                            className="p-1 hover:bg-red-50 dark:hover:bg-slate-800 text-red-500 rounded cursor-pointer"
                          >
                            <LuTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================= DETAIL VIEW MODAL ========================= */}
      {selectedLead && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 animate-scale-in">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white">Lead Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Submitted via {selectedLead.formTitle}</p>
              </div>
              <button 
                onClick={() => setSelectedLead(null)}
                className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <LuX size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Submission metadata */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase">Status</span>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border mt-1 ${getStatusColor(selectedLead.status)}`}>
                    {selectedLead.status || 'Cold'}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 dark:text-slate-300 uppercase">Submitted Date</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-slate-100 mt-1">
                    {selectedLead.submittedAt ? new Date(selectedLead.submittedAt).toLocaleString() : '-'}
                  </span>
                </div>
              </div>

              {/* Submitted dynamic values */}
              <div className="space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm border-b border-slate-100 dark:border-slate-800 pb-2">Enquiry Response Data</h4>
                <div className="space-y-4">
                  {Object.entries(selectedLead.data || {}).map(([key, val]) => {
                    const matchingForm = forms.find(f => f.id === selectedLead.formId);
                    const matchingField = matchingForm?.fields?.find(fld => fld.id === key);
                    const label = matchingField ? matchingField.label : key;

                    return (
                      <div key={key} className="space-y-1">
                        <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{label}</span>
                        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100 bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl leading-relaxed">
                          {Array.isArray(val) ? val.join(', ') : (val || '-')}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedLead(null)}
                className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2 px-6 rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FIELD SELECTOR EXPORT MODAL ==================== */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 animate-scale-in">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <div>
                <h3 className="font-black text-xl text-slate-900 dark:text-white">Select Export Columns</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Customize columns to output to Excel.</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all cursor-pointer"
              >
                <LuX size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              {/* Custom Filename Input */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. leads_export"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm font-semibold"
                  />
                  <span className="absolute right-4 top-3 text-xs text-slate-400 dark:text-slate-300 font-bold font-mono select-none">.xlsx</span>
                </div>
              </div>

              <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Available Columns ({availableFields.length})</span>
                <div className="space-x-2">
                  <button 
                    onClick={() => handleSelectAllFields(true)}
                    className="text-xs text-primary-600 font-bold hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <button 
                    onClick={() => handleSelectAllFields(false)}
                    className="text-xs text-red-500 font-bold hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {availableFields.map(field => (
                  <label 
                    key={field.key} 
                    className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 bg-slate-50/50 dark:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <input 
                      type="checkbox"
                      checked={!!selectedFields[field.key]}
                      onChange={() => handleFieldToggle(field.key)}
                      className="text-primary-600 focus:ring-primary-500 rounded h-4 w-4"
                    />
                    <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setShowExportModal(false)}
                className="border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold py-2 px-4 rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleExportExcel}
                className="bg-primary-600 hover:bg-primary-700 text-white font-bold py-2 px-6 rounded-xl text-sm transition-all shadow-sm cursor-pointer"
              >
                Export Now
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, formId: null, formTitle: '' })}
        onConfirm={handleConfirmDeleteForm}
        title="Delete Custom Form"
        message={`Are you sure you want to delete the form "${confirmModal.formTitle}"? Leads submitted through it will not be deleted.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
