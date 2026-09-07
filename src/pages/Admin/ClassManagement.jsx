import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, addSubDocument, subscribeToSubCollection, updateSubDocument } from '../../firebase/firestore';
import { deleteDoc, doc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuBookOpen as BookOpen, LuPlus as Plus, LuTrash2 as Trash2, LuUsers as Users, LuPencil as Pencil, LuTags, LuFilter, LuX, LuFileDown, LuUpload } from 'react-icons/lu';
import * as XLSX from 'xlsx';
import { TableSkeleton } from '../../components/Skeleton';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import usePermissions from '../../hooks/usePermissions';
import { sortClassesAscending } from '../../utils/classSorting';

const defaultCategories = [
  { id: 'cat_kg', name: 'KG', isDefault: true },
  { id: 'cat_mid', name: 'Middle', isDefault: true },
  { id: 'cat_higher', name: 'Higher Secondary', isDefault: true }
];

export default function ClassManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('classes');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('classes');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('classes');

  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', section: '', categoryId: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, classId: null });

  // Filters State
  const [filters, setFilters] = useState({ categoryId: 'All', className: 'All', section: 'All' });

  // Category Modal State
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Bulk Import State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    
    setLoading(true);
    let classesLoaded = false;
    let studentsLoaded = false;
    let categoriesLoaded = false;

    const checkLoading = () => {
      if (classesLoaded && studentsLoaded && categoriesLoaded) setLoading(false);
    };

    const unsubscribeClasses = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setClasses(sortClassesAscending(data));
      classesLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Classes error:", error);
      classesLoaded = true;
      checkLoading();
    });

    const unsubscribeStudents = subscribeToSubCollection(schoolId, 'students', (data) => {
      setStudents(data);
      studentsLoaded = true;
      checkLoading();
    }, (error) => {
      console.error("Students error:", error);
      studentsLoaded = true;
      checkLoading();
    });

    const unsubscribeCategories = subscribeToSubCollection(schoolId, 'classCategories', (data) => {
      setCustomCategories(data);
      categoriesLoaded = true;
      checkLoading();
    }, (error) => {
      console.warn("ClassCategories permission missing. Using defaults.", error);
      setCustomCategories([]);
      categoriesLoaded = true;
      checkLoading();
    });

    return () => {
      unsubscribeClasses();
      unsubscribeStudents();
      unsubscribeCategories();
    };
  }, [schoolId]);

  const allCategories = useMemo(() => {
    return [...defaultCategories, ...customCategories];
  }, [customCategories]);

  const uniqueClassNames = useMemo(() => {
    return [...new Set(classes.map(c => c.name))].sort();
  }, [classes]);

  const uniqueSections = useMemo(() => {
    return [...new Set(classes.map(c => c.section))].sort();
  }, [classes]);

  const classStats = useMemo(() => {
    const stats = {};
    students.forEach(student => {
      if (student.classId) {
        stats[student.classId] = (stats[student.classId] || 0) + 1;
      }
    });
    return stats;
  }, [students]);

  const filteredClasses = useMemo(() => {
    return classes.filter(c => {
      if (filters.categoryId !== 'All' && c.categoryId !== filters.categoryId) return false;
      if (filters.className !== 'All' && c.name !== filters.className) return false;
      if (filters.section !== 'All' && c.section !== filters.section) return false;
      return true;
    });
  }, [classes, filters]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (editingId && !hasEditPermission) {
      toast.error("You do not have permission to edit classes.");
      return;
    }
    if (!editingId && !hasCreatePermission) {
      toast.error("You do not have permission to create classes.");
      return;
    }
    if (!formData.name.trim() || !formData.section.trim()) {
      toast.error("Please fill all required fields.");
      return;
    }

    const normalizedName = formData.name.trim();
    const normalizedSection = formData.section.trim().toUpperCase();

    const isDuplicate = classes.some(
      c => c.name.toLowerCase() === normalizedName.toLowerCase() && 
           c.section.toLowerCase() === normalizedSection.toLowerCase() &&
           c.categoryId === formData.categoryId &&
           c.id !== editingId
    );

    if (isDuplicate) {
      toast.error(`Class ${normalizedName} - ${normalizedSection} already exists in this category.`);
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateSubDocument(schoolId, 'classes', editingId, {
          name: formData.name.trim(),
          section: formData.section.trim().toUpperCase(),
          categoryId: formData.categoryId
        });
        toast.success("Class updated successfully");
      } else {
        await addSubDocument(schoolId, 'classes', {
          name: formData.name.trim(),
          section: formData.section.trim().toUpperCase(),
          categoryId: formData.categoryId,
          createdAt: new Date().toISOString()
        });
        toast.success("Class created successfully");
      }
      setFormData({ name: '', section: '', categoryId: '' });
      setShowForm(false);
      setEditingId(null);
    } catch (error) {
      console.error("Error saving class:", error);
      toast.error("Failed to save class");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (cls) => {
    if (!hasEditPermission) return;
    setEditingId(cls.id);
    setFormData({ name: cls.name, section: cls.section, categoryId: cls.categoryId || '' });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (classId) => {
    if (!hasDeletePermission) return;
    setConfirmModalState({ isOpen: true, classId });
  };

  const executeDelete = async () => {
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete classes.");
      return;
    }
    const classId = confirmModalState.classId;
    if (!classId) return;
    
    try {
      await deleteDoc(doc(db, `schools/${schoolId}/classes`, classId));
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Failed to delete class.");
    } finally {
      setConfirmModalState({ isOpen: false, classId: null });
    }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await addSubDocument(schoolId, 'classCategories', {
        name: newCategoryName.trim(),
        isDefault: false,
        createdAt: new Date().toISOString()
      });
      setNewCategoryName('');
      toast.success("Category added successfully");
    } catch (error) {
      console.error("Error adding category:", error);
      toast.error("Failed to add category");
    }
  };

  const handleDeleteCategory = async (catId) => {
    try {
      const isInUse = classes.some(c => c.categoryId === catId);
      if (isInUse) {
        toast.error("Cannot delete category in use by existing classes.");
        return;
      }
      await deleteDoc(doc(db, `schools/${schoolId}/classCategories`, catId));
      toast.success("Category deleted");
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Failed to delete category");
    }
  };

  const getCategoryName = (catId) => {
    const cat = allCategories.find(c => c.id === catId);
    return cat ? cat.name : 'Unknown Category';
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        "Class Name": "Grade 10",
        "Section": "A",
        "Category": "High School"
      },
      {
        "Class Name": "Grade 10",
        "Section": "B",
        "Category": "High School"
      }
    ];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Classes Template");
    XLSX.writeFile(workbook, "Class_Import_Template.xlsx");
  };

  const handleFileUpload = async () => {
    if (!importFile) {
      toast.error("Please select a file first.");
      return;
    }

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          toast.error("The uploaded file is empty.");
          setImporting(false);
          return;
        }

        const batch = writeBatch(db);
        let addedCount = 0;
        let skippedCount = 0;
        let categoryCreationCount = 0;
        
        // Map to keep track of newly created categories during this import run
        const createdCategoriesMap = new Map();

        for (const row of jsonData) {
          const classNameRaw = row['Class Name'] || row['class name'] || row['Class'] || '';
          const sectionRaw = row['Section'] || row['section'] || '';
          const categoryRaw = row['Category'] || row['category'] || '';

          const className = String(classNameRaw).trim();
          const section = String(sectionRaw).trim().toUpperCase();
          const categoryText = String(categoryRaw).trim();

          if (!className || !section) {
            skippedCount++;
            continue;
          }

          // Duplicate check
          const isDuplicate = classes.some(
            c => c.name.toLowerCase() === className.toLowerCase() && 
                 c.section.toLowerCase() === section.toLowerCase()
          );

          if (isDuplicate) {
            skippedCount++;
            continue;
          }

          let matchedCategoryId = '';

          if (categoryText) {
             const existingCat = allCategories.find(c => c.name.toLowerCase() === categoryText.toLowerCase());
             if (existingCat) {
               matchedCategoryId = existingCat.id;
             } else if (createdCategoriesMap.has(categoryText.toLowerCase())) {
               matchedCategoryId = createdCategoriesMap.get(categoryText.toLowerCase());
             } else {
               // Create new category
               const newCatRef = doc(collection(db, `schools/${schoolId}/classCategories`));
               batch.set(newCatRef, {
                 name: categoryText,
                 isDefault: false,
                 createdAt: new Date().toISOString()
               });
               matchedCategoryId = newCatRef.id;
               createdCategoriesMap.set(categoryText.toLowerCase(), matchedCategoryId);
               categoryCreationCount++;
             }
          }

          const newClassRef = doc(collection(db, `schools/${schoolId}/classes`));
          batch.set(newClassRef, {
            name: className,
            section: section,
            categoryId: matchedCategoryId,
            createdAt: new Date().toISOString()
          });

          addedCount++;
        }

        if (addedCount > 0 || categoryCreationCount > 0) {
          await batch.commit();
          toast.success(`Imported ${addedCount} classes and created ${categoryCreationCount} categories. Skipped ${skippedCount} existing/invalid rows.`);
          setShowImportModal(false);
          setImportFile(null);
        } else {
          toast.error(`No new classes to import. Skipped ${skippedCount} rows.`);
        }
      } catch (error) {
        console.error("Error processing file:", error);
        toast.error("Error parsing the file. Please check the format.");
      } finally {
        setImporting(false);
      }
    };

    reader.onerror = () => {
      toast.error("Failed to read file");
      setImporting(false);
    };

    reader.readAsArrayBuffer(importFile);
  };

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 w-full">
        <div className="w-full md:w-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Class & Section Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Define the academic structure and categories of your institution.</p>
        </div>
        <div className="flex gap-3 flex-wrap w-full md:w-auto">
          {hasCreatePermission && (
            <button 
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm flex items-center gap-2 transition-colors"
            >
              <LuTags size={18} /> Manage Categories
            </button>
          )}
          {hasCreatePermission && (
            <button 
              onClick={() => setShowImportModal(true)}
              className="px-4 py-2 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl font-medium hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm flex items-center gap-2 transition-colors"
            >
              <LuUpload size={18} /> Bulk Import
            </button>
          )}
          {hasCreatePermission && (
            <button 
              onClick={() => { 
                setShowForm(!showForm); 
                if (showForm) { 
                  setEditingId(null); 
                  setFormData({name: '', section: '', categoryId: ''}); 
                } 
              }}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
            >
              {showForm ? 'Cancel' : <><Plus size={18} /> Create New Class</>}
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="mb-8 p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm animate-fade-in-down">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{editingId ? 'Edit Class' : 'Add New Class'}</h3>
          <form onSubmit={handleCreate} className="flex flex-col md:flex-row gap-4 items-end">
            <div className="w-full md:w-64">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Category (Optional)</label>
              <select
                value={formData.categoryId}
                onChange={(e) => setFormData({...formData, categoryId: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 shadow-sm"
              >
                <option value="">Select Category...</option>
                {allCategories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Class/Grade Name <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Grade 10, Freshman"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                required
              />
            </div>
            <div className="w-full md:w-48">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Section/Group <span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={formData.section}
                onChange={(e) => setFormData({...formData, section: e.target.value})}
                placeholder="e.g., A, B, Science"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase transition-all"
                required
              />
            </div>
            <button 
              type="submit" 
              disabled={saving}
              className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors h-11 shrink-0"
            >
              {saving ? 'Saving...' : (editingId ? 'Update Class' : 'Save Class')}
            </button>
          </form>
        </div>
      )}

      {classes.length > 0 && (
        <div className="mb-6 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 font-medium">
            <LuFilter size={18} />
            <span>Filters:</span>
          </div>
          <select 
            value={filters.categoryId}
            onChange={(e) => setFilters({...filters, categoryId: e.target.value})}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="All">All Categories</option>
            {allCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          <select 
            value={filters.className}
            onChange={(e) => setFilters({...filters, className: e.target.value})}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="All">All Classes</option>
            {uniqueClassNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <select 
            value={filters.section}
            onChange={(e) => setFilters({...filters, section: e.target.value})}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus:ring-2 focus:ring-primary-500 outline-none"
          >
            <option value="All">All Sections</option>
            {uniqueSections.map(sec => (
              <option key={sec} value={sec}>{sec}</option>
            ))}
          </select>

          {(filters.categoryId !== 'All' || filters.className !== 'All' || filters.section !== 'All') && (
            <button 
              onClick={() => setFilters({ categoryId: 'All', className: 'All', section: 'All' })}
              className="text-sm text-primary-600 hover:text-primary-700 font-bold ml-auto"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {filteredClasses.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpen size={32} className="text-slate-400 dark:text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{classes.length === 0 ? 'No classes found' : 'No classes match filters'}</h3>
          <p className="text-slate-500 dark:text-slate-400 mt-1 mb-6">
            {classes.length === 0 ? 'Start by creating classes and sections before admitting students.' : 'Try adjusting or clearing your filters.'}
          </p>
          {classes.length === 0 && (
            <button 
              onClick={() => setShowForm(true)}
              className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors"
            >
              Create Your First Class
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClasses.map((cls) => (
            <div 
              key={cls.id} 
              onClick={() => hasEditPermission && handleEditClick(cls)}
              className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 hover:shadow-md transition-shadow relative group ${hasEditPermission ? 'cursor-pointer' : 'cursor-default'}`}
            >
              <div className="absolute top-4 right-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 z-10 transition-opacity">
                {hasEditPermission && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEditClick(cls); }}
                    className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Edit Class"
                  >
                    <Pencil size={18} />
                  </button>
                )}
                {hasDeletePermission && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDeleteClick(cls.id); }}
                    className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Delete Class"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-primary-50 text-primary-600 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{cls.name}</h3>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                      Section {cls.section}
                    </span>
                    {cls.categoryId && (
                       <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-primary-50 text-primary-700 border border-primary-100">
                         {getCategoryName(cls.categoryId)}
                       </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <Users size={16} />
                <span>{classStats[cls.id] || 0} Students currently assigned</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Category Management Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Manage Categories</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Add or remove custom class categories</p>
              </div>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <LuX size={20} />
              </button>
            </div>
            <div className="p-6 bg-slate-50 dark:bg-slate-800">
              <form onSubmit={handleAddCategory} className="flex gap-2">
                <input 
                  type="text" 
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="New category name..."
                  className="flex-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  required
                />
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800 transition-colors flex items-center gap-2"
                >
                  <Plus size={16} /> Add
                </button>
              </form>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {allCategories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-3 mx-2 my-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 transition-colors">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{cat.name}</span>
                  {cat.isDefault ? (
                    <span className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-md">Default</span>
                  ) : (
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete custom category"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-right">
              <button 
                onClick={() => setShowCategoryModal(false)}
                className="px-6 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Bulk Import Classes</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Upload an Excel file to create multiple classes.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <LuX size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700">
                <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-2">Instructions:</h4>
                <ul className="text-sm text-slate-600 dark:text-slate-400 list-disc list-inside space-y-1">
                  <li>Download the template file.</li>
                  <li>Fill in <b>Class Name</b> and <b>Section</b> (Mandatory).</li>
                  <li>Fill in <b>Category</b> (Optional). New categories will be auto-created.</li>
                  <li>Upload the filled file below.</li>
                </ul>
                <button 
                  onClick={handleDownloadTemplate}
                  className="mt-3 text-primary-600 hover:text-primary-700 text-sm font-semibold flex items-center gap-1 transition-colors"
                >
                  <LuFileDown size={16} /> Download Template
                </button>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Select Excel File</label>
                <input 
                  type="file" 
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-all border border-slate-200 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleFileUpload}
                disabled={importing || !importFile}
                className="px-6 py-2 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {importing ? 'Importing...' : <><LuUpload size={18} /> Start Import</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, classId: null })}
        onConfirm={executeDelete}
        title="Delete Class"
        message="Are you sure you want to delete this class? Make sure no students are currently assigned to it."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
