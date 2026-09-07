import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, writeBatch, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuPlus, LuPencil, LuTrash2, LuLayoutGrid, LuX, LuSave, LuPaperclip, LuExternalLink } from 'react-icons/lu';
import { uploadFileToCloudinaryOrFirebase } from '../../utils/cloudinary';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function CustomModuleView() {
  const { moduleId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [moduleMetadata, setModuleMetadata] = useState(null);
  const [schema, setSchema] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({});
  const [formFiles, setFormFiles] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });

  useEffect(() => {
    if (schoolId && moduleId) {
      loadModuleData();
    }
  }, [schoolId, moduleId]);

  const loadModuleData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Module Metadata
      const metaRef = doc(db, `schools/${schoolId}/customModules`, moduleId);
      const metaSnap = await getDoc(metaRef);
      if (metaSnap.exists()) {
        setModuleMetadata(metaSnap.data());
      } else {
        setModuleMetadata({ name: 'Custom Module' });
      }

      // 2. Fetch Form Schema
      const schemaRef = doc(db, `schools/${schoolId}/formSchemas`, moduleId);
      const schemaSnap = await getDoc(schemaRef);
      if (schemaSnap.exists()) {
        setSchema(schemaSnap.data().sections || []);
      } else {
        setSchema([]);
      }

      // 3. Fetch Data Collection
      const dataRef = collection(db, `schools/${schoolId}/${moduleId}_data`);
      const dataSnap = await getDocs(dataRef);
      const records = dataSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setData(records);
    } catch (error) {
      console.error("Error loading module data:", error);
      toast.error("Failed to load module data");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (record = null) => {
    if (record) {
      setEditingId(record.id);
      setFormData(record);
    } else {
      setEditingId(null);
      setFormData({});
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({});
    setFormFiles({});
  };

  const handleFileChange = (fieldId, file) => {
    setFormFiles(prev => ({ ...prev, [fieldId]: file }));
  };

  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // 1. Upload files if any
      const uploadPromises = Object.entries(formFiles).map(async ([fieldId, file]) => {
        if (file) {
          const safeSchoolName = moduleMetadata?.name?.replace(/[^a-z0-9]/gi, '_').trim() || 'CustomModule';
          const safeFileName = file.name.replace(/[^a-z0-9.]/gi, '_');
          const storagePath = `CustomModules/${safeSchoolName}/${safeFileName}`;
          const url = await uploadFileToCloudinaryOrFirebase(file, schoolId, storagePath);
          return { fieldId, url };
        }
        return null;
      });
      
      const uploadedFiles = await Promise.all(uploadPromises);
      const finalFormData = { ...formData };
      uploadedFiles.forEach(res => {
        if (res) finalFormData[res.fieldId] = res.url;
      });

      // 2. Save data
      if (editingId) {
        const docRef = doc(db, `schools/${schoolId}/${moduleId}_data`, editingId);
        await updateDoc(docRef, { ...finalFormData, updatedAt: new Date().toISOString() });
        setData(data.map(d => d.id === editingId ? { ...d, ...finalFormData } : d));
        toast.success("Record updated");
      } else {
        const colRef = collection(db, `schools/${schoolId}/${moduleId}_data`);
        const docRef = await addDoc(colRef, { ...finalFormData, createdAt: new Date().toISOString() });
        setData([...data, { id: docRef.id, ...finalFormData }]);
        toast.success("Record created");
      }
      handleCloseModal();
    } catch (error) {
      console.error("Error saving record:", error);
      toast.error("Failed to save record");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Record",
      message: "Are you sure you want to delete this record?",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await deleteDoc(doc(db, `schools/${schoolId}/${moduleId}_data`, id));
          setData(data.filter(d => d.id !== id));
          toast.success("Record deleted");
        } catch (error) {
          console.error("Error deleting record:", error);
          toast.error("Failed to delete record");
        }
      }
    });
  };

  const handleDeleteModule = () => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${moduleMetadata?.name || 'Custom Module'}`,
      message: `Are you sure you want to permanently delete this custom module, its form schema, and all stored records? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        try {
          // 1. Delete module metadata document
          await deleteDoc(doc(db, `schools/${schoolId}/customModules`, moduleId));

          // 2. Delete form schema document
          await deleteDoc(doc(db, `schools/${schoolId}/formSchemas`, moduleId));

          // 3. Delete data collection documents
          const dataRef = collection(db, `schools/${schoolId}/${moduleId}_data`);
          const dataSnap = await getDocs(dataRef);
          let batch = writeBatch(db);
          let count = 0;
          for (const d of dataSnap.docs) {
            batch.delete(d.ref);
            count++;
            if (count >= 490) {
              await batch.commit();
              batch = writeBatch(db);
              count = 0;
            }
          }
          if (count > 0) {
            await batch.commit();
          }

          // 4. Update global sidebar order setting
          const sidebarRef = doc(db, `schools/${schoolId}/settings`, 'sidebar');
          const sidebarSnap = await getDoc(sidebarRef);
          if (sidebarSnap.exists() && sidebarSnap.data().order) {
            const newOrder = sidebarSnap.data().order.filter(id => id !== moduleId);
            await setDoc(sidebarRef, { order: newOrder }, { merge: true });
          }

          toast.success(`Module "${moduleMetadata?.name || 'Custom Module'}" deleted successfully.`);
          navigate('/admin/form-builder');
        } catch (error) {
          console.error("Error deleting custom module:", error);
          toast.error("Failed to delete custom module.");
        }
      }
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // Extract all fields from sections for table columns
  const allFields = schema?.flatMap(sec => sec.fields) || [];
  // Display up to 5 fields in the table
  const tableColumns = allFields.slice(0, 5);

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuLayoutGrid className="text-primary-600" />
            {moduleMetadata?.name || 'Custom Module'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage data for this module</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={handleDeleteModule}
            className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-bold transition-colors flex items-center gap-2"
          >
            <LuTrash2 size={18} /> Delete Module
          </button>
          <button 
            onClick={() => handleOpenModal()}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-sm transition-colors flex items-center gap-2"
          >
            <LuPlus size={18} /> Add Record
          </button>
        </div>
      </div>

      {!schema || schema.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-700 text-center text-slate-500 dark:text-slate-400">
          <p className="font-bold text-lg mb-2">Schema Not Configured</p>
          <p>Please go to the Custom Modules Manager and build the Form Schema for this module first.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {tableColumns.map(col => (
                    <th key={col.id} className="px-6 py-4">{col.label}</th>
                  ))}
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.length === 0 ? (
                  <tr>
                    <td colSpan={tableColumns.length + 1} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 font-medium">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  data.map(record => (
                    <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                      {tableColumns.map(col => (
                        <td key={col.id} className="px-6 py-4">
                          {record[col.id] !== undefined ? (
                            String(record[col.id]).startsWith('http') ? (
                              <a href={record[col.id]} target="_blank" rel="noreferrer" className="text-primary-600 hover:underline flex items-center gap-1">
                                <LuExternalLink size={14} /> View File
                              </a>
                            ) : (
                              String(record[col.id])
                            )
                          ) : '-'}
                        </td>
                      ))}
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleOpenModal(record)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <LuPencil size={18} />
                          </button>
                          <button onClick={() => handleDelete(record.id)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <LuTrash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur z-10">
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                {editingId ? 'Edit Record' : 'Add Record'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                <LuX size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="p-6 space-y-8">
              {schema.map(section => (
                <div key={section.id} className="space-y-4">
                  <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 pb-2">{section.title}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {section.fields.map(field => (
                      <div key={field.id} className="space-y-1">
                        <label className="block text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        
                        {field.type === 'select' ? (
                          <select
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                          >
                            <option value="">-- Select --</option>
                            {(field.options || '').split(',').map(opt => opt.trim()).filter(Boolean).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'checkbox' ? (
                          <input
                            type="checkbox"
                            required={field.required}
                            checked={!!formData[field.id]}
                            onChange={(e) => handleInputChange(field.id, e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                          />
                        ) : field.type === 'relation' ? (
                          // For relation, we use a text input for now. In a full implementation, you'd fetch the relation module's data.
                          <input
                            type="text"
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 placeholder-slate-400 dark:placeholder-slate-500"
                            placeholder={`Enter related ${field.relationModule || 'record'} ID`}
                          />
                        ) : field.type === 'file' ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              required={field.required && !formData[field.id]}
                              onChange={(e) => handleFileChange(field.id, e.target.files[0])}
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                            />
                            {formFiles[field.id] && (
                              <span className="text-xs text-green-600 flex items-center gap-1">
                                <LuPaperclip /> Selected: {formFiles[field.id].name}
                              </span>
                            )}
                            {!formFiles[field.id] && formData[field.id] && (
                              <a href={formData[field.id]} target="_blank" rel="noreferrer" className="text-xs text-primary-600 flex items-center gap-1 hover:underline">
                                <LuExternalLink /> View Current File
                              </a>
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type}
                            required={field.required}
                            value={formData[field.id] || ''}
                            onChange={(e) => handleInputChange(field.id, e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="px-6 py-2.5 font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  <LuSave size={18} /> {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
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
