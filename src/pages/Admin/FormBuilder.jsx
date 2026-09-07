import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc, setDoc, collection, getDocs, deleteDoc, addDoc, writeBatch, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuPlus, LuSettings, LuTrash2, LuSave, LuEye, LuLayoutGrid, LuType, LuAlignLeft, LuHash, LuCalendar, LuList, LuToggleLeft, LuArrowUp, LuArrowDown, LuChevronUp, LuChevronDown, LuX } from 'react-icons/lu';
import { Settings, Plus, LayoutGrid, MoveUp, MoveDown, Trash2, Folder, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { allNavItems } from '../AdminDashboard';
import ConfirmModal from '../../components/ConfirmModal';

const defaultCoreSchemas = {
  'staff': {
    sections: [
      { id: 'sec_1', title: 'Personal Details', fields: [
        { id: 'f_1', label: 'First Name', type: 'text', required: true },
        { id: 'f_2', label: 'Last Name', type: 'text', required: true },
        { id: 'f_3', label: 'Email', type: 'email', required: true },
        { id: 'f_4', label: 'Phone', type: 'text', required: true },
      ]},
      { id: 'sec_2', title: 'Academic Details', fields: [
        { id: 'f_5', label: 'Qualification', type: 'text', required: true },
        { id: 'f_6', label: 'Experience (Years)', type: 'number', required: false },
      ]}
    ]
  },
  'students': {
    sections: [
      { id: 'sec_1', title: 'Student Details', fields: [
        { id: 'f_1', label: 'First Name', type: 'text', required: true },
        { id: 'f_2', label: 'Last Name', type: 'text', required: true },
        { id: 'f_3', label: 'Date of Birth', type: 'date', required: true },
      ]},
      { id: 'sec_2', title: 'Parent Details', fields: [
        { id: 'f_4', label: 'Parent Name', type: 'text', required: true },
        { id: 'f_5', label: 'Parent Phone', type: 'text', required: true },
      ]}
    ]
  }
};

export default function FormBuilder() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [activeTab, setActiveTab] = useState('schema'); // 'schema' or 'manager'
  
  // -- Schema Builder State --
  const [activeModule, setActiveModule] = useState('staff');
  const [sections, setSections] = useState([]);
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [savingSchema, setSavingSchema] = useState(false);

  // -- Custom Modules Manager State --
  const [customModules, setCustomModules] = useState([]);
  const [loadingModules, setLoadingModules] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [sidebarOrder, setSidebarOrder] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const [unifiedModules, setUnifiedModules] = useState([]);
  const [importModuleId, setImportModuleId] = useState('');

  const coreModules = [
    { id: 'staff', name: 'Staff Directory' },
    { id: 'students', name: 'Student Directory' },
    { id: 'inventory', name: 'Inventory Management' },
    { id: 'hr-payroll', name: 'HR & Payroll' },
    { id: 'timetables', name: 'Timetables' },
    { id: 'exams', name: 'Exams & Results' },
    { id: 'fees', name: 'Fees & Payments' },
    { id: 'transport', name: 'Transport' },
    { id: 'library', name: 'Library' },
    { id: 'environment_setup', name: 'Environment Setup' },
  ];

  const fieldTypes = [
    { value: 'text', label: 'Text Input' },
    { value: 'number', label: 'Number Input' },
    { value: 'email', label: 'Email Input' },
    { value: 'date', label: 'Date Picker' },
    { value: 'select', label: 'Dropdown (Select)' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'relation', label: 'Relation (Lookup)' },
    { value: 'file', label: 'File Upload' },
  ];

  // Fetch Custom Modules
  const fetchCustomModules = async () => {
    if (!schoolId) return;
    setLoadingModules(true);
    try {
      const qSnap = await getDocs(collection(db, `schools/${schoolId}/customModules`));
      const modules = qSnap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.order - b.order);
      setCustomModules(modules);
    } catch (error) {
      console.error("Error loading custom modules:", error);
      toast.error("Failed to load custom modules.");
    } finally {
      setLoadingModules(false);
    }
  };

  useEffect(() => {
    fetchCustomModules();
    
    if (schoolId) {
      const unsub = onSnapshot(doc(db, `schools/${schoolId}/settings`, 'sidebar'), (docSnap) => {
        if (docSnap.exists() && docSnap.data().order) {
          setSidebarOrder(docSnap.data().order);
        } else {
          setSidebarOrder([]);
        }
      });
      return () => unsub();
    }
  }, [schoolId]);

  useEffect(() => {
    // Combine core modules (excluding Dashboard/Environment) and custom modules
    const coreList = allNavItems
      .filter(i => i.name !== 'Dashboard' && i.name !== 'Environment Setup')
      .map(i => ({
        id: i.moduleKey || i.name.toLowerCase().replace(/\s+/g, '-'),
        name: i.name,
        isCore: true
      }));
      
    const customList = customModules.map(c => ({
      id: c.id,
      name: c.name,
      isCore: false
    }));
    
    const combined = [...coreList, ...customList];
    
    // Sort by global order if it exists
    if (sidebarOrder.length > 0) {
      combined.sort((a, b) => {
        const indexA = sidebarOrder.indexOf(a.id);
        const indexB = sidebarOrder.indexOf(b.id);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return 0;
      });
    }
    setUnifiedModules(combined);
  }, [customModules, sidebarOrder]);

  useEffect(() => {
    if (schoolId && activeModule && activeTab === 'schema') {
      loadSchema();
      setImportModuleId('');
    }
  }, [schoolId, activeModule, activeTab]);

  const loadSchema = async () => {
    setLoadingSchema(true);
    try {
      const schemaRef = doc(db, `schools/${schoolId}/formSchemas`, activeModule);
      const schemaSnap = await getDoc(schemaRef);
      if (schemaSnap.exists()) {
        const data = schemaSnap.data();
        if (data.sections) {
          setSections(data.sections || []);
        } else if (data.fields && data.fields.length > 0) {
          setSections([{
            id: `sec_${Date.now()}`,
            title: 'General Details',
            fields: data.fields
          }]);
        } else {
          setSections([]);
        }
      } else {
        setSections([]);
      }
    } catch (error) {
      console.error("Error loading schema:", error);
      toast.error("Failed to load module schema.");
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleSaveSchema = async () => {
    setSavingSchema(true);
    try {
      const schemaRef = doc(db, `schools/${schoolId}/formSchemas`, activeModule);
      await setDoc(schemaRef, {
        sections,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success("Module schema saved successfully!");
    } catch (error) {
      console.error("Error saving schema:", error);
      toast.error("Failed to save module schema.");
    } finally {
      setSavingSchema(false);
    }
  };

  const handleImportSchema = async (moduleId) => {
    if (!moduleId) return;
    try {
      const schemaRef = doc(db, `schools/${schoolId}/formSchemas`, moduleId);
      const schemaSnap = await getDoc(schemaRef);
      let importedSections = [];

      if (schemaSnap.exists()) {
        const data = schemaSnap.data();
        if (data.sections && data.sections.length > 0) {
          importedSections = data.sections;
        } else if (data.fields && data.fields.length > 0) {
          importedSections = [{
            id: `sec_${Date.now()}`,
            title: 'Imported General Details',
            fields: data.fields
          }];
        }
      }

      // Fallback for core modules that don't have a saved schema in Firestore yet
      if (importedSections.length === 0) {
        const isCore = coreModules.some(m => m.id === moduleId);
        if (isCore) {
          importedSections = defaultCoreSchemas[moduleId]?.sections || [
            { id: `sec_default`, title: 'General Details', fields: [
              { id: 'f_def_1', label: 'Name / Title', type: 'text', required: true, options: '', relationModule: '' }
            ]}
          ];
        }
      }
      
      if (importedSections.length > 0) {
        const clonedSections = importedSections.map((sec, sIdx) => ({
          ...sec,
          id: `sec_${Date.now()}_${sIdx}_${Math.random().toString(36).substr(2, 5)}`,
          fields: (sec.fields || []).map((f, fIdx) => ({
            ...f,
            id: `field_${Date.now()}_${fIdx}_${Math.random().toString(36).substr(2, 5)}`
          }))
        }));
        
        setSections(prev => [...prev, ...clonedSections]);
        toast.success("Sections imported successfully!");
      } else {
        toast.error("Selected module has no sections or schema to import.");
      }
    } catch (error) {
      console.error("Error importing schema:", error);
      toast.error("Failed to import schema.");
    }
  };

  // --- Custom Module Manager Functions ---
  const handleCreateModule = async () => {
    if (!newModuleName.trim()) return toast.error("Module name cannot be empty");
    try {
      const order = customModules.length;
      const docRef = await addDoc(collection(db, `schools/${schoolId}/customModules`), {
        name: newModuleName.trim(),
        icon: 'Folder', // default
        order,
        createdAt: new Date().toISOString()
      });
      
      const newMod = { id: docRef.id, name: newModuleName.trim(), icon: 'Folder', order };
      setCustomModules([...customModules, newMod]);
      
      // Also append to global sidebarOrder to ensure it stays at bottom initially
      const newOrderArray = unifiedModules.map(m => m.id);
      newOrderArray.push(docRef.id);
      await setDoc(doc(db, `schools/${schoolId}/settings`, 'sidebar'), { order: newOrderArray }, { merge: true });
      
      // Create initial schema for the module
      const initialSchema = {
        sections: [{
          id: `sec_${Date.now()}`,
          title: 'General Details',
          fields: [{
             id: `field_${Date.now()}`,
             label: 'Name',
             type: 'text',
             required: true,
             options: '',
             relationModule: ''
          }]
        }],
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, `schools/${schoolId}/formSchemas`, docRef.id), initialSchema);
      
      setNewModuleName('');
      toast.success("Custom module created with initial schema!");
    } catch (error) {
      console.error("Error creating module:", error);
      toast.error("Failed to create module.");
    }
  };

  const handleDeleteModule = (id) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Module",
      message: "Are you sure? This will delete the module from the sidebar, ITS SCHEMA, and ALL DATA COLLECTIONS. This action is irreversible.",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          // 1. Delete module record
          await deleteDoc(doc(db, `schools/${schoolId}/customModules`, id));
          
          // 2. Delete schema
          await deleteDoc(doc(db, `schools/${schoolId}/formSchemas`, id));
          
          // 3. Delete all collection documents
          const collectionRef = collection(db, `schools/${schoolId}/${id}_data`);
          const snapshot = await getDocs(collectionRef);
          
          // Batch delete (note: batch has a limit of 500, but we can iterate)
          let batch = writeBatch(db);
          let count = 0;
          let totalDeleted = 0;
          
          for (const d of snapshot.docs) {
             batch.delete(d.ref);
             count++;
             totalDeleted++;
             
             if (count >= 490) { // Keep under 500 limit
                 await batch.commit();
                 batch = writeBatch(db);
                 count = 0;
             }
          }
          if (count > 0) {
             await batch.commit();
          }

          // Re-order remaining
          const remaining = customModules.filter(m => m.id !== id);
          setCustomModules(remaining);
          
          // Remove from global sidebarOrder
          const newOrderArray = sidebarOrder.filter(key => key !== id);
          await setDoc(doc(db, `schools/${schoolId}/settings`, 'sidebar'), { order: newOrderArray }, { merge: true });
          
          toast.success(`Module and ${totalDeleted} records deleted.`);
        } catch (error) {
          console.error("Error deleting module:", error);
          toast.error("Failed to delete module.");
        }
      }
    });
  };

  const moveModule = async (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === unifiedModules.length - 1)) return;
    const newList = [...unifiedModules];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newList[index], newList[swapIndex]] = [newList[swapIndex], newList[index]];
    
    setUnifiedModules(newList); // Optimistic UI update
    
    // Save new global order to Firestore
    try {
      const orderArray = newList.map(m => m.id);
      await setDoc(doc(db, `schools/${schoolId}/settings`, 'sidebar'), { order: orderArray }, { merge: true });
    } catch (error) {
      console.error("Error saving global order:", error);
      toast.error("Failed to save sidebar order.");
    }
  };

  // --- Schema Builder Functions ---
  const addSection = () => {
    setSections([...sections, {
      id: `sec_${Date.now()}`,
      title: 'New Section',
      fields: []
    }]);
  };

  const updateSectionTitle = (secId, title) => {
    setSections(sections.map(s => s.id === secId ? { ...s, title } : s));
  };

  const removeSection = (secId) => {
    setConfirmModal({
      isOpen: true,
      title: "Remove Section",
      message: "Are you sure you want to remove this entire section and its fields?",
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        setSections(sections.filter(s => s.id !== secId));
      }
    });
  };

  const moveSection = (index, direction) => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === sections.length - 1)) return;
    const newSections = [...sections];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    [newSections[index], newSections[swapIndex]] = [newSections[swapIndex], newSections[index]];
    setSections(newSections);
  };

  const addField = (secId) => {
    setSections(sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          fields: [...s.fields, {
            id: `field_${Date.now()}`,
            label: 'New Field',
            type: 'text',
            required: false,
            options: '',
            relationModule: ''
          }]
        };
      }
      return s;
    }));
  };

  const removeField = (secId, fieldId) => {
    setSections(sections.map(s => {
      if (s.id === secId) {
        return { ...s, fields: s.fields.filter(f => f.id !== fieldId) };
      }
      return s;
    }));
  };

  const updateField = (secId, fieldId, key, value) => {
    setSections(sections.map(s => {
      if (s.id === secId) {
        return {
          ...s,
          fields: s.fields.map(f => f.id === fieldId ? { ...f, [key]: value } : f)
        };
      }
      return s;
    }));
  };

  const moveField = (secId, index, direction) => {
    setSections(sections.map(s => {
      if (s.id === secId) {
        if ((direction === 'up' && index === 0) || (direction === 'down' && index === s.fields.length - 1)) return s;
        const newFields = [...s.fields];
        const swapIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[swapIndex]] = [newFields[swapIndex], newFields[index]];
        return { ...s, fields: newFields };
      }
      return s;
    }));
  };

  const allModulesOptions = [...coreModules, ...customModules.map(m => ({ id: m.id, name: `[Custom] ${m.name}` }))];

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Settings className="text-primary-600" />
            Module Customization
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage custom modules and define dynamic form schemas.</p>
        </div>
      </div>

      {/* Tabs */}
        <div className="flex bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-1 mb-6">
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'schema' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Form Schema Builder
          </button>
          <button
            onClick={() => setActiveTab('manager')}
            className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${activeTab === 'manager' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            Sidebar & Modules Manager
          </button>
        </div>

        {/* --- Sidebar & Modules Manager Tab --- */}
        {activeTab === 'manager' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Sidebar & Modules Manager</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Create custom modules or drag ANY module to reorder your sidebar.</p>
              </div>
            </div>
            
            <div className="p-6">
              {/* Create Module Section */}
              <div className="flex gap-4 mb-8">
                <input
                  type="text"
                  placeholder="Enter new custom module name (e.g. Alumni)"
                  value={newModuleName}
                  onChange={e => setNewModuleName(e.target.value)}
                  className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all outline-none"
                />
                <button
                  onClick={handleCreateModule}
                  className="px-6 py-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors font-medium flex items-center gap-2 shadow-sm shadow-primary-600/20"
                >
                  <Plus size={18} />
                  Create Module
                </button>
              </div>

              {/* Unified List */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-4">Sidebar Order</h3>
                {loadingModules ? (
                  <div className="text-slate-500 dark:text-slate-400 text-sm">Loading modules...</div>
                ) : unifiedModules.length === 0 ? (
                  <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-8">No modules found.</div>
                ) : (
                  unifiedModules.map((mod, idx) => (
                    <div key={mod.id} className={`flex items-center justify-between p-4 bg-white dark:bg-slate-900 border ${mod.isCore ? 'border-slate-200 dark:border-slate-700' : 'border-primary-100'} rounded-xl hover:shadow-md transition-shadow group`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${mod.isCore ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-primary-50 text-primary-600'}`}>
                          {mod.isCore ? <Settings size={18} /> : <LayoutGrid size={18} />}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">{mod.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{mod.isCore ? 'Built-in Module' : 'Custom Module'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => moveModule(idx, 'up')} 
                          disabled={idx === 0} 
                          className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30"
                          title="Move Up"
                        >
                          <MoveUp size={16} />
                        </button>
                        <button 
                          onClick={() => moveModule(idx, 'down')} 
                          disabled={idx === unifiedModules.length - 1} 
                          className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-30"
                          title="Move Down"
                        >
                          <MoveDown size={16}/>
                        </button>
                        {!mod.isCore && (
                          <button 
                            onClick={() => handleDeleteModule(mod.id)} 
                            className="px-3 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl transition-colors ml-2 flex items-center gap-1.5 text-xs font-bold shadow-sm"
                            title="Delete Custom Module"
                          >
                            <Trash2 size={15}/>
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      {activeTab === 'schema' && (
        <>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <select
              value={activeModule}
              onChange={(e) => setActiveModule(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 shadow-sm flex-1 md:w-64 font-semibold text-slate-700 dark:text-slate-200"
            >
              {allModulesOptions.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <select
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 shadow-sm text-sm font-semibold text-slate-700 dark:text-slate-200"
                  value={importModuleId}
                  onChange={(e) => setImportModuleId(e.target.value)}
                >
                  <option value="">-- Select Module to Import --</option>
                  {allModulesOptions.filter(m => m.id !== activeModule).map(m => (
                    <option key={`import-${m.id}`} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    handleImportSchema(importModuleId);
                    setImportModuleId('');
                  }}
                  disabled={!importModuleId}
                  className="px-4 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Plus size={16} /> Import
                </button>
              </div>
              {customModules.some(m => m.id === activeModule) && (
                <button 
                  type="button"
                  onClick={() => handleDeleteModule(activeModule)}
                  className="px-4 py-2.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-xl font-bold transition-colors flex items-center gap-2 text-sm whitespace-nowrap"
                >
                  <Trash2 size={16} /> Delete Custom Module
                </button>
              )}
              <button 
                onClick={handleSaveSchema}
                disabled={savingSchema}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-sm disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <Save size={18} /> {savingSchema ? 'Saving...' : 'Save Schema'}
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Folder size={20} className="text-primary-500" />
                Module Structure
              </h2>
              <button 
                onClick={addSection}
                className="px-4 py-2 bg-primary-50 text-primary-700 rounded-lg font-bold hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 text-sm shadow-sm border border-primary-100"
              >
                <Plus size={16} /> Add Section
              </button>
            </div>

            <div className="p-6 bg-slate-50/30">
              {loadingSchema ? (
                <div className="flex justify-center p-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
                </div>
              ) : sections.length === 0 ? (
                <div className="text-center p-16 text-slate-500 dark:text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-white dark:bg-slate-900">
                  <Folder size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">No sections defined yet</p>
                  <p className="mb-6">Start building this module by adding a section.</p>
                  <button 
                    onClick={addSection}
                    className="px-6 py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={18} /> Add Your First Section
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {sections.map((section, sIndex) => (
                    <div key={section.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden transition-colors hover:border-primary-200 dark:hover:border-slate-700">
                      {/* Section Header */}
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="flex flex-col justify-center gap-1 shrink-0 text-slate-400 dark:text-slate-300">
                            <button onClick={() => moveSection(sIndex, 'up')} disabled={sIndex === 0} className="p-1 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                              <MoveUp size={16} />
                            </button>
                            <button onClick={() => moveSection(sIndex, 'down')} disabled={sIndex === sections.length - 1} className="p-1 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                              <MoveDown size={16} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={section.title}
                            onChange={(e) => updateSectionTitle(section.id, e.target.value)}
                            className="flex-1 max-w-sm px-3 py-2 text-lg font-bold text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-primary-500"
                            placeholder="Section Title"
                          />
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={() => addField(section.id)} className="px-3 py-1.5 bg-primary-50 text-primary-700 rounded-lg font-bold hover:bg-primary-100 dark:hover:bg-slate-700 text-sm flex items-center gap-1">
                            <Plus size={14} /> Add Field
                          </button>
                          <button onClick={() => removeSection(section.id)} className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg">
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>

                      {/* Section Fields */}
                      <div className="p-4 space-y-4">
                        {section.fields.length === 0 ? (
                          <div className="text-center p-6 text-sm font-medium text-slate-400 dark:text-slate-300 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                            No fields in this section.
                          </div>
                        ) : (
                          section.fields.map((field, fIndex) => (
                            <div key={field.id} className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/50 flex gap-4 hover:border-slate-300 transition-colors flex-wrap md:flex-nowrap">
                              <div className="flex flex-col justify-center gap-1 shrink-0 text-slate-400 dark:text-slate-300">
                                <button onClick={() => moveField(section.id, fIndex, 'up')} disabled={fIndex === 0} className="p-1 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                                  <MoveUp size={16} />
                                </button>
                                <button onClick={() => moveField(section.id, fIndex, 'down')} disabled={fIndex === section.fields.length - 1} className="p-1 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded disabled:opacity-30">
                                  <MoveDown size={16} />
                                </button>
                              </div>

                              <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 items-start w-full">
                                <div className="md:col-span-3">
                                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Field Label</label>
                                  <input 
                                    type="text" 
                                    value={field.label}
                                    onChange={(e) => updateField(section.id, field.id, 'label', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                                    placeholder="e.g. Blood Group"
                                  />
                                </div>
                                
                                <div className="md:col-span-3">
                                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Field Type</label>
                                  <select 
                                    value={field.type}
                                    onChange={(e) => updateField(section.id, field.id, 'type', e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-200"
                                  >
                                    {fieldTypes.map(t => (
                                      <option key={t.value} value={t.value}>{t.label}</option>
                                    ))}
                                  </select>
                                </div>

                                <div className="md:col-span-5">
                                  {field.type === 'select' && (
                                    <div>
                                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Options (comma separated)</label>
                                      <input 
                                        type="text" 
                                        value={field.options || ''}
                                        onChange={(e) => updateField(section.id, field.id, 'options', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-sm"
                                        placeholder="e.g. A+, O+, B-"
                                      />
                                    </div>
                                  )}
                                  {field.type === 'relation' && (
                                    <div>
                                      <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Lookup Target Module</label>
                                      <select 
                                        value={field.relationModule || ''}
                                        onChange={(e) => updateField(section.id, field.id, 'relationModule', e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 text-sm bg-white dark:bg-slate-900"
                                      >
                                        <option value="">-- Select Module --</option>
                                        {allModulesOptions.map(m => (
                                          <option key={m.id} value={m.id}>{m.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>

                                <div className="md:col-span-1 flex items-center justify-end md:justify-center pt-6">
                                  <label className="flex items-center gap-2 cursor-pointer group">
                                    <input 
                                      type="checkbox" 
                                      checked={field.required}
                                      onChange={(e) => updateField(section.id, field.id, 'required', e.target.checked)}
                                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                                    />
                                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-slate-700">Req.</span>
                                  </label>
                                </div>
                              </div>

                              <div className="shrink-0 pt-6">
                                <button 
                                  onClick={() => removeField(section.id, field.id)}
                                  className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Remove Field"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
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
