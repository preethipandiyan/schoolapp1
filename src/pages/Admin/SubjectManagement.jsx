import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection, addSubDocument, deleteSubDocument, updateSubDocument } from '../../firebase/firestore';
import { LuBookOpen, LuPlus, LuX, LuTrash2, LuPencil } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import usePermissions from '../../hooks/usePermissions';

export default function SubjectManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('subjects');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('subjects');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('subjects');

  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    assignedTeacherIds: [] // Array of teacher IDs
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    let subUnsub, teacherUnsub;

    setLoading(true);
    subUnsub = subscribeToSubCollection(schoolId, 'subjects', (data) => {
      setSubjects(data);
      setLoading(false);
    }, (error) => {
      console.error(error);
      setLoading(false);
      toast.error("Database access denied. Please update Firestore Rules.");
    });

    teacherUnsub = subscribeToSubCollection(schoolId, 'teachers', (data) => {
      // Filter for Teaching Staff using staff_type
      const teachingStaff = data.filter(t => t.staff_type === 'teaching');
      setTeachers(teachingStaff);
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => {
      if (subUnsub) subUnsub();
      if (teacherUnsub) teacherUnsub();
    };
  }, [schoolId]);

  const handleOpenModal = (subject = null) => {
    if (subject) {
      setEditingId(subject.id);
      setFormData({
        name: subject.name,
        code: subject.code || '',
        assignedTeacherIds: subject.assignedTeacherIds || []
      });
    } else {
      setEditingId(null);
      setFormData({ name: '', code: '', assignedTeacherIds: [] });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name) return;
    const isDuplicate = subjects.some(s => 
      s.id !== editingId && (
        s.name?.toLowerCase() === formData.name.trim().toLowerCase() ||
        (formData.code?.trim() && s.code?.toLowerCase() === formData.code.trim().toLowerCase())
      )
    );

    if (isDuplicate) {
      toast.error(`A subject with this Name or Code already exists.`);
      return;
    }
    
    if (editingId && !hasEditPermission) {
      toast.error("You do not have permission to edit subjects.");
      return;
    }
    if (!editingId && !hasCreatePermission) {
      toast.error("You do not have permission to create subjects.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateSubDocument(schoolId, 'subjects', editingId, formData);
        toast.success("Subject updated successfully!");
      } else {
        await addSubDocument(schoolId, 'subjects', formData);
        toast.success("Subject created successfully!");
      }
      setShowModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to save subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete subjects.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Delete Subject",
      message: "Are you sure you want to delete this subject?",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await deleteSubDocument(schoolId, 'subjects', id);
          toast.success("Subject deleted!");
        } catch (error) {
          console.error(error);
          toast.error("Failed to delete subject.");
        }
      }
    });
  };

  const toggleTeacherAssignment = (teacherId) => {
    setFormData(prev => {
      const ids = prev.assignedTeacherIds || [];
      if (ids.includes(teacherId)) {
        return { ...prev, assignedTeacherIds: ids.filter(id => id !== teacherId) };
      } else {
        return { ...prev, assignedTeacherIds: [...ids, teacherId] };
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 h-[calc(100vh-2rem)] flex flex-col print:p-0 print:h-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 shrink-0 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Subject Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Create subjects and assign them to teaching staff.</p>
        </div>
        {hasCreatePermission && (
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition-colors flex items-center gap-2"
          >
            <LuPlus size={18} /> Add Subject
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 flex-1 overflow-y-auto custom-scrollbar">
        {subjects.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
            <LuBookOpen size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">No Subjects Created</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Click the button above to add your first subject.</p>
          </div>
        ) : (
          subjects.map(subject => (
            <div key={subject.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center text-primary-600">
                  <LuBookOpen size={24} />
                </div>
                <div className="flex gap-2">
                  {hasEditPermission && (
                    <button onClick={() => handleOpenModal(subject)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <LuPencil size={18} />
                    </button>
                  )}
                  {hasDeletePermission && (
                    <button onClick={() => handleDelete(subject.id)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <LuTrash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{subject.name}</h3>
              {subject.code && <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4">{subject.code}</p>}
              
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase mb-2">Assigned Teachers</p>
                <div className="flex flex-wrap gap-2">
                  {subject.assignedTeacherIds?.length > 0 ? (
                    subject.assignedTeacherIds.map(tid => {
                      const teacher = teachers.find(t => t.id === tid);
                      if (!teacher) return null;
                      const name = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
                      return (
                        <span key={tid} className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700">
                          {name}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-sm text-slate-400 dark:text-slate-300 italic">No teachers assigned</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingId ? 'Edit Subject' : 'Add Subject'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                <LuX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Subject Name *</label>
                <input 
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. Mathematics"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Subject Code (Optional)</label>
                <input 
                  type="text"
                  value={formData.code}
                  onChange={e => setFormData({...formData, code: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                  placeholder="e.g. MATH101"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Assign to Teaching Staff</label>
                <div className="space-y-2 border border-slate-200 dark:border-slate-700 rounded-xl p-4 max-h-60 overflow-y-auto custom-scrollbar bg-slate-50/50 dark:bg-slate-800/50">
                  {teachers.length === 0 ? (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No teaching staff found.</p>
                  ) : (
                    teachers.map(teacher => {
                      const name = teacher.name || `${teacher.firstName || ''} ${teacher.lastName || ''}`.trim();
                      const isAssigned = (formData.assignedTeacherIds || []).includes(teacher.id);
                      return (
                        <label key={teacher.id} className="flex items-center gap-3 p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors border border-transparent hover:border-slate-200">
                          <input 
                            type="checkbox"
                            checked={isAssigned}
                            onChange={() => toggleTeacherAssignment(teacher.id)}
                            className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{name}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </form>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0 bg-slate-50 dark:bg-slate-800">
              <button 
                type="button" onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={saving}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Subject'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        message={confirmModal.message}
        title={confirmModal.title}
      />
    </div>
  );
}
