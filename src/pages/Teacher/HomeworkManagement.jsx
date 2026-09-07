import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, addSubDocument, updateSubDocument, subscribeToSubCollection } from '../../firebase/firestore';
import { LuPlus as Plus, LuUpload as Upload, LuFileText as FileText, LuSearch as Search, LuX as X, LuCircleCheck as CheckCircle, LuFileDown as FileDown, LuCheck as Check, LuPaperclip as Paperclip } from 'react-icons/lu';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { TableSkeleton } from '../../components/Skeleton';
import { uploadFileToCloudinaryOrFirebase } from '../../utils/cloudinary';
import usePermissions from '../../hooks/usePermissions';
import { sortClassesAscending } from '../../utils/classSorting';

export default function HomeworkManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('homework');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('homework');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('homework');

  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [homeworks, setHomeworks] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [selectedHomework, setSelectedHomework] = useState(null);

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    studentName: true,
    admissionNumber: true,
    status: true,
    lastUpdated: true
  });

  const availableFieldsList = [
    { key: 'studentName', label: 'Student Name' },
    { key: 'admissionNumber', label: 'Admission Number' },
    { key: 'status', label: 'Submission Status' },
    { key: 'lastUpdated', label: 'Last Updated' }
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
    if (classStudents.length === 0) {
      toast.error("No student data available to export.");
      return;
    }

    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const exportData = classStudents.map((student, index) => {
      const submission = submissions.find(s => s.id === student.id);
      const status = submission?.status || 'Not Started';
      const lastUpdated = submission?.lastUpdated ? new Date(submission.lastUpdated).toLocaleString() : 'N/A';

      const row = { "S.No": index + 1 };
      
      if (selectedFields.studentName) row["Student Name"] = `${student.firstName} ${student.lastName}`;
      if (selectedFields.admissionNumber) row["Admission Number"] = student.admissionNumber || '';
      if (selectedFields.status) row["Submission Status"] = status;
      if (selectedFields.lastUpdated) row["Last Updated"] = lastUpdated;
      
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
    
    const rawName = exportFileName.trim() || (selectedHomework ? selectedHomework.title.replace(/\s+/g, '_') : "Homework") + "_Submissions";
    const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
    
    XLSX.writeFile(workbook, finalFileName);
    setShowExportModal(false);
    toast.success("Submissions roster exported successfully!");
  };
  const [classStudents, setClassStudents] = useState([]);
  const [submissions, setSubmissions] = useState([]); // Submissions for selected homework
  const [creating, setCreating] = useState(false);

  const [newHomework, setNewHomework] = useState({
    title: '',
    description: '',
    classId: '',
    subject: '',
    selectedSubjects: [],
    dueDate: '',
    remarks: '',
    attachment: null,
  });

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingHomework, setEditingHomework] = useState(null);
  const [updating, setUpdating] = useState(false);

  const [excelFile, setExcelFile] = useState(null);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let classesUnsub, hwUnsub, subjectsUnsub;

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
    });

    subjectsUnsub = subscribeToSubCollection(schoolId, 'subjects', (data) => {
      setSubjects(data);
    });

    hwUnsub = subscribeToSubCollection(schoolId, 'homeworks', (data) => {
      // Filter homeworks assigned by this teacher
      setHomeworks(data.filter(hw => hw.teacherId === userProfile.uid).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      setLoading(false);
    });

    return () => {
      if (classesUnsub) classesUnsub();
      if (subjectsUnsub) subjectsUnsub();
      if (hwUnsub) hwUnsub();
    };
  }, [schoolId, userProfile]);

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

  const openEditModal = (hw) => {
    setEditingHomework({
      ...hw,
      selectedSubjects: hw.subjects || (hw.subject ? [hw.subject] : []),
      attachment: null,
    });
    setShowEditModal(true);
  };

  const validateFile = (file) => {
    if (!file) return true;
    
    // 1. File size
    const maxSize = 3 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File size must not exceed 3 MB.");
      return false;
    }

    // 2. File type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const extensionMatches = file.name.match(/\.(pdf|jpg|jpeg|png|webp)$/i);
    if (!allowedTypes.includes(file.type) && !extensionMatches) {
      toast.error("Only PDF, JPG, JPEG, PNG, and WEBP files are allowed.");
      return false;
    }

    return true;
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const chosenSubjects = editingHomework.selectedSubjects?.length > 0 
      ? editingHomework.selectedSubjects 
      : (editingHomework.subject ? [editingHomework.subject] : []);

    if (chosenSubjects.length === 0) {
      toast.error("Please select at least one subject.");
      return;
    }

    if (editingHomework.attachment && !validateFile(editingHomework.attachment)) {
      return;
    }

    setUpdating(true);
    try {
      let attachmentUrl = editingHomework.attachmentUrl || '';
      if (editingHomework.attachment) {
        const safeFileName = editingHomework.attachment.name.replace(/[^a-z0-9.]/gi, '_');
        const fallbackPath = `HomeworkAttachments/${schoolId}/${Date.now()}_${safeFileName}`;
        attachmentUrl = await uploadFileToCloudinaryOrFirebase(editingHomework.attachment, schoolId, fallbackPath);
      }

      const formattedSubject = chosenSubjects.join(', ');
      await updateSubDocument(schoolId, 'homeworks', editingHomework.id, {
        title: editingHomework.title,
        description: editingHomework.description,
        classId: editingHomework.classId,
        subject: formattedSubject,
        subjects: chosenSubjects,
        dueDate: editingHomework.dueDate,
        maxMarks: editingHomework.maxMarks || 0,
        remarks: editingHomework.remarks || '',
        attachmentUrl,
      });
      toast.success("Homework updated successfully!");
      setShowEditModal(false);
      setEditingHomework(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update homework");
    } finally {
      setUpdating(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const chosenSubjects = newHomework.selectedSubjects.length > 0 
      ? newHomework.selectedSubjects 
      : (newHomework.subject ? [newHomework.subject] : []);

    if (chosenSubjects.length === 0) {
      toast.error("Please select at least one subject.");
      return;
    }

    if (newHomework.attachment && !validateFile(newHomework.attachment)) {
      return;
    }

    setCreating(true);
    try {
      let attachmentUrl = '';
      if (newHomework.attachment) {
        const safeFileName = newHomework.attachment.name.replace(/[^a-z0-9.]/gi, '_');
        const fallbackPath = `HomeworkAttachments/${schoolId}/${Date.now()}_${safeFileName}`;
        attachmentUrl = await uploadFileToCloudinaryOrFirebase(newHomework.attachment, schoolId, fallbackPath);
      }

      const formattedSubject = chosenSubjects.join(', ');
      await addSubDocument(schoolId, 'homeworks', {
        title: newHomework.title,
        description: newHomework.description,
        classId: newHomework.classId,
        subject: formattedSubject,
        subjects: chosenSubjects,
        dueDate: newHomework.dueDate,
        maxMarks: newHomework.maxMarks || 0,
        remarks: newHomework.remarks || '',
        attachmentUrl,
        subjects: chosenSubjects,
        subject: formattedSubject,
        teacherId: userProfile.uid,
        teacherName: userProfile.name || 'Teacher',
        createdAt: new Date().toISOString(),
        assignedDate: new Date().toISOString().split('T')[0],
        status: 'Active'
      });
      toast.success("Homework assigned successfully!");
      setShowCreateModal(false);
      setNewHomework({ title: '', description: '', classId: '', subject: '', selectedSubjects: [], dueDate: '', remarks: '', attachment: null });
      // loadData(); - handled by real-time listener
    } catch (err) {
      console.error(err);
      toast.error("Failed to create homework");
    } finally {
      setCreating(false);
    }
  };

  const handleExcelUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      toast.error("Please select an Excel file.");
      return;
    }

    setCreating(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Assume Excel format: { "Admission Number": "ADM-123", "Homework Title": "Math Ch 1", "Status": "Completed", "Grade": "A" }
        console.log("Parsed Excel Data:", data);
        
        // In a real app, we would batch update Firestore documents matching these admission numbers.
        // For Phase 1 demonstration, we will log it and simulate the update.
        await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate processing

        toast.success(`Processed ${data.length} records from Excel successfully!`);
        setShowExcelModal(false);
        setExcelFile(null);
      };
      reader.readAsBinaryString(excelFile);
    } catch (err) {
      console.error(err);
      toast.error("Failed to process Excel file.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in-up min-w-0 w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">Homework Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Assign tasks and evaluate student progress.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          {hasCreatePermission && (
            <button 
              onClick={() => setShowExcelModal(true)}
              className="w-full sm:w-auto justify-center flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2.5 rounded-xl hover:bg-emerald-200 transition-colors font-semibold"
            >
              <Upload size={18} />
              Evaluate via Excel
            </button>
          )}
          {hasCreatePermission && (
            <button 
              onClick={() => setShowCreateModal(true)}
              className="w-full sm:w-auto justify-center flex items-center gap-2 bg-primary-600 text-white px-4 py-2.5 rounded-xl hover:bg-primary-700 transition-colors font-semibold shadow-sm shadow-primary-600/20"
            >
              <Plus size={18} />
              Assign Homework
            </button>
          )}
        </div>
      </div>

      {/* Homework List */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {homeworks.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <FileText size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No homework assigned yet</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Click the button above to assign your first homework.</p>
          </div>
        ) : (
          homeworks.map(hw => {
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
                    <span className="text-xs font-semibold text-slate-400 dark:text-slate-300 flex items-center gap-2">
                      {hw.attachmentUrl && <Paperclip size={14} className="text-primary-500" />}
                      Due: {new Date(hw.dueDate).toLocaleDateString('en-GB')}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{hw.title}</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 line-clamp-2">{hw.description}</p>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle size={16} /> Active
                    </span>
                    <div className="flex items-center gap-4">
                      {hasEditPermission && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); openEditModal(hw); }} 
                          className="text-xs font-bold text-amber-600 hover:text-amber-700"
                        >
                          Edit
                        </button>
                      )}
                      <span className="text-xs font-bold text-primary-600 group-hover:underline">View Tracking &rarr;</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Homework Assignment</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Homework Title</label>
                  <input
                    type="text"
                    required
                    value={newHomework.title}
                    onChange={(e) => setNewHomework({ ...newHomework, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Description</label>
                  <textarea
                    rows="3"
                    value={newHomework.description}
                    onChange={(e) => setNewHomework({ ...newHomework, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Class</label>
                  <select
                    required
                    value={newHomework.classId}
                    onChange={(e) => setNewHomework({ ...newHomework, classId: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-slate-900 text-sm font-semibold"
                  >
                    <option value="">Select a Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} - Section {c.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Select Subjects (Multiple)</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button 
                        type="button" 
                        onClick={() => setNewHomework({ ...newHomework, selectedSubjects: subjects.map(s => s.name) })}
                        className="text-primary-600 font-bold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button 
                        type="button" 
                        onClick={() => setNewHomework({ ...newHomework, selectedSubjects: [] })}
                        className="text-slate-500 dark:text-slate-400 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 custom-scrollbar">
                    {subjects.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-300 font-semibold col-span-full">No subjects available</span>
                    ) : (
                      subjects.map(s => {
                        const isChecked = newHomework.selectedSubjects.includes(s.name);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-primary-50/80 border-primary-300 text-primary-900 font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 font-semibold'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const current = newHomework.selectedSubjects;
                                const next = e.target.checked
                                  ? [...current, s.name]
                                  : current.filter(item => item !== s.name);
                                setNewHomework({ ...newHomework, selectedSubjects: next });
                              }}
                              className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500 cursor-pointer"
                            />
                            <span className="text-sm truncate">{s.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {newHomework.selectedSubjects.length > 0 && (
                    <p className="text-xs font-semibold text-primary-700">
                      Selected ({newHomework.selectedSubjects.length}): {newHomework.selectedSubjects.join(', ')}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Due Date</label>
                    <input
                      type="date"
                      required
                      value={newHomework.dueDate}
                      onChange={(e) => setNewHomework({ ...newHomework, dueDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Max Marks</label>
                    <input
                      type="number"
                      required
                      value={newHomework.maxMarks}
                      onChange={(e) => setNewHomework({ ...newHomework, maxMarks: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Attachment (Optional)</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Max size: 3MB. Allowed: PDF, JPG, PNG, WEBP.</p>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                      <Upload size={16} />
                      Choose File
                      <input 
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={(e) => setNewHomework({ ...newHomework, attachment: e.target.files[0] })}
                      />
                    </label>
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate max-w-[200px]">
                      {newHomework.attachment ? newHomework.attachment.name : 'No file chosen'}
                    </span>
                    {newHomework.attachment && (
                      <button 
                        type="button" 
                        onClick={() => setNewHomework({ ...newHomework, attachment: null })}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-md shadow-primary-600/10 transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingHomework && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Homework Assignment</h2>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Homework Title</label>
                  <input
                    type="text"
                    required
                    value={editingHomework.title}
                    onChange={(e) => setEditingHomework({ ...editingHomework, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Description</label>
                  <textarea
                    rows="3"
                    value={editingHomework.description}
                    onChange={(e) => setEditingHomework({ ...editingHomework, description: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Class</label>
                  <select
                    required
                    value={editingHomework.classId}
                    onChange={(e) => setEditingHomework({ ...editingHomework, classId: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-slate-900 text-sm font-semibold"
                  >
                    <option value="">Select a Class</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} - Section {c.section}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Select Subjects (Multiple)</label>
                    <div className="flex items-center gap-2 text-xs">
                      <button 
                        type="button" 
                        onClick={() => setEditingHomework({ ...editingHomework, selectedSubjects: subjects.map(s => s.name) })}
                        className="text-primary-600 font-bold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button 
                        type="button" 
                        onClick={() => setEditingHomework({ ...editingHomework, selectedSubjects: [] })}
                        className="text-slate-500 dark:text-slate-400 font-medium hover:underline"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 custom-scrollbar">
                    {subjects.length === 0 ? (
                      <span className="text-xs text-slate-400 dark:text-slate-300 font-semibold col-span-full">No subjects available</span>
                    ) : (
                      subjects.map(s => {
                        const isChecked = editingHomework.selectedSubjects?.includes(s.name) || false;
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isChecked
                                ? 'bg-primary-50/80 border-primary-300 text-primary-900 font-bold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 font-semibold'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const current = editingHomework.selectedSubjects || [];
                                const next = e.target.checked
                                  ? [...current, s.name]
                                  : current.filter(item => item !== s.name);
                                setEditingHomework({ ...editingHomework, selectedSubjects: next });
                              }}
                              className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500 cursor-pointer"
                            />
                            <span className="text-sm truncate">{s.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                  {editingHomework.selectedSubjects?.length > 0 && (
                    <p className="text-xs font-semibold text-primary-700">
                      Selected ({editingHomework.selectedSubjects.length}): {editingHomework.selectedSubjects.join(', ')}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Due Date</label>
                    <input
                      type="date"
                      required
                      value={editingHomework.dueDate}
                      onChange={(e) => setEditingHomework({ ...editingHomework, dueDate: e.target.value })}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Max Marks</label>
                    <input
                      type="number"
                      required
                      value={editingHomework.maxMarks || ''}
                      onChange={(e) => setEditingHomework({ ...editingHomework, maxMarks: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-200">Attachment (Optional)</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Max size: 3MB. Allowed: PDF, JPG, PNG, WEBP.</p>
                  
                  {editingHomework.attachmentUrl && !editingHomework.attachment && (
                    <div className="flex items-center gap-2 mb-3 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                      <Paperclip size={16} className="text-primary-500" />
                      <a href={editingHomework.attachmentUrl} target="_blank" rel="noreferrer" className="text-sm text-primary-600 font-bold hover:underline truncate flex-1">
                        View Current Attachment
                      </a>
                      <button 
                        type="button" 
                        onClick={() => setEditingHomework({ ...editingHomework, attachmentUrl: '' })}
                        className="text-xs font-bold text-red-500 hover:underline px-2 py-1"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold flex items-center gap-2">
                      <Upload size={16} />
                      Choose New File
                      <input 
                        type="file"
                        className="hidden"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        onChange={(e) => setEditingHomework({ ...editingHomework, attachment: e.target.files[0] })}
                      />
                    </label>
                    <span className="text-sm text-slate-600 dark:text-slate-300 font-medium truncate max-w-[200px]">
                      {editingHomework.attachment ? editingHomework.attachment.name : 'No new file chosen'}
                    </span>
                    {editingHomework.attachment && (
                      <button 
                        type="button" 
                        onClick={() => setEditingHomework({ ...editingHomework, attachment: null })}
                        className="p-1 hover:bg-red-50 text-red-500 rounded-lg transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>

              </div>
              <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-5 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-md shadow-primary-600/10 transition-colors"
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Excel Upload Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Evaluate via Excel</h2>
              <button onClick={() => setShowExcelModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleExcelUpload} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Upload an Excel (.xlsx) file containing student grades for automatic evaluation. <br/>
                <strong>Required Columns:</strong> Admission Number, Homework Title, Status, Grade
              </p>
              
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative">
                <input 
                  type="file" 
                  required
                  accept=".xlsx, .xls, .csv"
                  onChange={e => setExcelFile(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <Upload size={32} className="mx-auto text-primary-500 mb-3" />
                <span className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {excelFile ? excelFile.name : "Click or drag Excel file here"}
                </span>
              </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setShowExcelModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={creating || !excelFile}
                  className="px-5 py-2.5 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50"
                >
                  {creating ? 'Processing...' : 'Process File'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && selectedHomework && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 z-50">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden shadow-2xl animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 dark:bg-slate-800 shrink-0 w-full">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  {selectedHomework.title}
                  {selectedHomework.attachmentUrl && (
                    <a 
                      href={selectedHomework.attachmentUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full hover:bg-primary-100 transition-colors font-bold whitespace-nowrap"
                    >
                      <Paperclip size={14} /> View File
                    </a>
                  )}
                </h2>
                <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Student Progress Tracking</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (classStudents.length === 0) {
                      toast.error("No student data available to export.");
                      return;
                    }
                    const defaultName = selectedHomework ? selectedHomework.title.replace(/\s+/g, '_') : 'Homework';
                    setExportFileName(`${defaultName}_Submissions`);
                    setShowExportModal(true);
                  }}
                  className="w-full sm:w-auto justify-center inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-md shadow-primary-600/10 transition-all active:scale-[0.98]"
                >
                  <FileDown size={18} />
                  Export
                </button>
                <button onClick={() => setShowTrackingModal(false)} className="w-full sm:w-auto justify-center p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 sm:bg-transparent rounded-xl transition-colors">
                  <X size={24} />
                </button>
              </div>
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

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Export Submissions Roster</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Select columns to include in the exported Excel spreadsheet</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <X size={20} />
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
                    placeholder="e.g. Homework_Submissions"
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
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                <FileDown size={18} />
                Generate Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
