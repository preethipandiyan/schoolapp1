import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { LuShield, LuSave, LuCheck, LuX, LuPlus, LuTrash2 } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

const DEFAULT_ROLES = [
  'Correspondent',
  'Principal',
  'Vice Principal',
  'Subject Wise Head',
  'Class Incharge',
  'Staffs',
  'Administrative Officer',
  'Finance Department',
  'Library',
  'Canteen',
  'Transport',
  'Janitors',
  'Hostel',
  'Inventory',
  'Security'
];

// Core modules that every school gets by default
const CORE_MODULES = [
  { id: 'classes', label: 'Classes & Sections' },
  { id: 'subjects', label: 'Subject Management' },
  { id: 'students', label: 'Student Directory' },
  { id: 'staff', label: 'Staff Management' },
  { id: 'chats', label: 'Chat & Messaging' },
  { id: 'homework', label: 'Homework Management' },
  { id: 'leaves', label: 'Leave Requests' },
  { id: 'lesson_plans', label: 'Lesson Plans' },
  { id: 'resources', label: 'Resource Sharing' },
  { id: 'ptm', label: 'PTM Scheduler' },
  { id: 'performance', label: 'Performance Tracking' }
];

// All modules available for approval by superadmin (Sync with TenantManagement)
const ALL_AVAILABLE_MODULES = [
  { id: 'timetables', label: 'Timetables & Scheduling' },
  { id: 'transport', label: 'Transport Management (GPS/Routes)' },
  { id: 'library', label: 'Library Management' },
  { id: 'exams', label: 'Examinations & Report Cards' },
  { id: 'noticeboard', label: 'Noticeboard & Announcements' },
  { id: 'media', label: 'Media & Cloudinary Integration' },
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
  { id: 'chats', label: 'Chat & Messaging' },
  { id: 'homework', label: 'Homework Management' },
  { id: 'leaves', label: 'Leave Requests' },
  { id: 'leads', label: 'Leads Management' },
  { id: 'form-builder', label: 'Custom Forms / Form Builder' },
  { id: 'lesson_plans', label: 'Lesson Plans' },
  { id: 'resources', label: 'Resource Sharing' },
  { id: 'ptm', label: 'PTM Scheduler' },
  { id: 'performance', label: 'Performance Tracking' },
  { id: 'billing', label: 'Billing & Subscriptions' }
];

const ADMIN_PANEL_MODULES = [
  'classes', 'subjects', 'students', 'staff', 'timetables', 'transport', 'library', 'exams',
  'noticeboard', 'hr-payroll', 'attendance', 'calendar', 'fees', 'hostel', 'inventory',
  'health', 'complaints', 'alumni', 'documents', 'branches', 'reports', 'form-builder', 'api', 'links', 'leads', 'billing'
];

const TEACHER_PANEL_MODULES = [
  'noticeboard', 'calendar', 'timetables', 'lesson_plans', 'resources', 'attendance',
  'homework', 'performance', 'ptm', 'exams', 'chats', 'hr-payroll', 'leaves', 'transport'
];

export default function RolesPermissions() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [rolesList, setRolesList] = useState(DEFAULT_ROLES);
  const [activeRole, setActiveRole] = useState(DEFAULT_ROLES[0]);
  const [newRoleName, setNewRoleName] = useState('');
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });

  const [permissions, setPermissions] = useState({}); // { [role]: { [moduleKey]: { read, create, edit, delete } } }
  const [loginPanels, setLoginPanels] = useState({}); // { [role]: 'admin' | 'teacher' }
  const [displayModules, setDisplayModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!schoolId) return;

    const fetchData = async () => {
      try {
        // Fetch School Data to get permitted modules
        const schoolDocRef = doc(db, 'schools', schoolId);
        const schoolDocSnap = await getDoc(schoolDocRef);
        const permitted = schoolDocSnap.exists() ? (schoolDocSnap.data().permittedModules || []) : [];
        
        // Build the dynamic modules list: CORE + approved modules
        const approvedModules = ALL_AVAILABLE_MODULES.filter(m => permitted.includes(m.id));
        setDisplayModules([...CORE_MODULES, ...approvedModules]);

        // Fetch custom roles and existing permissions
        const rolesRef = collection(db, `schools/${schoolId}/roles`);
        const snapshot = await getDocs(rolesRef);
        
        const fetchedPerms = {};
        const fetchedPanels = {};
        const customRoles = new Set();
        
        snapshot.forEach(doc => {
          const data = doc.data();
          fetchedPerms[doc.id] = data.permissions || {};
          fetchedPanels[doc.id] = data.loginPanel || 'admin';
          if (!DEFAULT_ROLES.includes(doc.id)) {
            customRoles.add(doc.id);
          }
        });
        
        setPermissions(fetchedPerms);
        setLoginPanels(fetchedPanels);
        setRolesList([...DEFAULT_ROLES, ...Array.from(customRoles)]);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load permissions.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [schoolId]);

  const handleAddRole = (e) => {
    e.preventDefault();
    const role = newRoleName.trim();
    if (!role) return;
    if (rolesList.includes(role)) {
      toast.error("Role already exists");
      return;
    }
    setRolesList(prev => [...prev, role]);
    setActiveRole(role);
    setNewRoleName('');
    setIsAddingRole(false);
  };

  const handleToggle = (moduleKey, action) => {
    setPermissions(prev => {
      const rolePerms = prev[activeRole] || {};
      const modulePerms = rolePerms[moduleKey] || { read: false, create: false, edit: false, delete: false };
      
      const newModulePerms = { ...modulePerms, [action]: !modulePerms[action] };
      
      // If turning on create/edit/delete, automatically turn on read
      if ((action === 'create' || action === 'edit' || action === 'delete') && newModulePerms[action]) {
        newModulePerms.read = true;
      }
      // If turning off read, automatically turn off create/edit/delete
      if (action === 'read' && !newModulePerms.read) {
        newModulePerms.create = false;
        newModulePerms.edit = false;
        newModulePerms.delete = false;
      }

      return {
        ...prev,
        [activeRole]: {
          ...rolePerms,
          [moduleKey]: newModulePerms
        }
      };
    });
  };

  const handleToggleAll = (moduleKey, value) => {
    setPermissions(prev => {
      const rolePerms = prev[activeRole] || {};
      return {
        ...prev,
        [activeRole]: {
          ...rolePerms,
          [moduleKey]: { read: value, create: value, edit: value, delete: value }
        }
      };
    });
  };

  const handleDeleteRole = (e, roleToDelete) => {
    e.stopPropagation();
    if (DEFAULT_ROLES.includes(roleToDelete)) {
      toast.error("Cannot delete core system roles");
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: "Delete Role",
      message: `Are you sure you want to delete the role "${roleToDelete}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await deleteDoc(doc(db, `schools/${schoolId}/roles`, roleToDelete));
          
          setRolesList(prev => prev.filter(r => r !== roleToDelete));
          setPermissions(prev => {
            const newPerms = { ...prev };
            delete newPerms[roleToDelete];
            return newPerms;
          });
          
          if (activeRole === roleToDelete) {
            setActiveRole(rolesList.find(r => r !== roleToDelete) || '');
          }
          
          toast.success(`${roleToDelete} role deleted successfully!`);
        } catch (error) {
          console.error("Error deleting role:", error);
          toast.error("Failed to delete role.");
        }
      }
    });
  };

  const handleSave = async () => {
    if (!schoolId) return;
    setSaving(true);
    try {
      const rolePerms = permissions[activeRole] || {};
      const activePanel = loginPanels[activeRole] || 'admin';
      const roleDocRef = doc(db, `schools/${schoolId}/roles`, activeRole);
      
      await setDoc(roleDocRef, {
        name: activeRole,
        permissions: rolePerms,
        loginPanel: activePanel,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success(`${activeRole} permissions saved successfully!`);
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to save permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center h-full">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const activeRolePerms = permissions[activeRole] || {};

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-6 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuShield className="text-primary-600" />
            Roles & Permissions
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure fine-grained access control for your staff members.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
        >
          <LuSave size={18} />
          {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Roles List */}
        <div className="w-full lg:w-64 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden shrink-0 max-h-[300px] lg:max-h-none">
          <div className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span className="font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-xs">Select Role</span>
            <button 
              onClick={() => setIsAddingRole(true)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400 hover:text-primary-600 transition-colors"
              title="Add New Role"
            >
              <LuPlus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
            {isAddingRole && (
              <form onSubmit={handleAddRole} className="mb-2 p-2 border border-primary-200 bg-primary-50 rounded-xl flex items-center gap-2">
                <input 
                  type="text"
                  autoFocus
                  value={newRoleName}
                  onChange={e => setNewRoleName(e.target.value)}
                  placeholder="Role Name"
                  className="w-full bg-white dark:bg-slate-900 px-2 py-1.5 rounded-lg text-sm border border-primary-200 focus:outline-none focus:border-primary-500"
                />
                <button type="submit" className="p-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700"><LuCheck size={14}/></button>
                <button type="button" onClick={() => setIsAddingRole(false)} className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300"><LuX size={14}/></button>
              </form>
            )}
            
            {rolesList.map(role => (
              <div
                key={role}
                onClick={() => setActiveRole(role)}
                className={`w-full text-left px-4 py-3 rounded-xl mb-1 font-semibold text-sm transition-all flex items-center justify-between cursor-pointer group ${
                  activeRole === role 
                    ? 'bg-primary-50 text-primary-700 shadow-sm border border-primary-100' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent'
                }`}
              >
                <span className="truncate pr-2">{role}</span>
                <button 
                  onClick={(e) => handleDeleteRole(e, role)}
                  className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${
                    activeRole === role ? 'text-primary-600 hover:bg-primary-100 dark:hover:bg-slate-700' : 'text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800'
                  }`}
                  title="Delete Role"
                >
                  <LuTrash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 md:p-6 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row justify-between sm:items-center gap-4 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{activeRole} Permissions</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select the modules and actions this role can access.</p>
            </div>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Target Login Panel:</label>
              <select
                value={loginPanels[activeRole] || 'admin'}
                onChange={e => setLoginPanels(prev => ({ ...prev, [activeRole]: e.target.value }))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary-500"
              >
                <option value="admin">Admin Panel</option>
                <option value="teacher">Teacher Panel</option>
              </select>
            </div>
          </div>
          
          <div className="flex-1 overflow-auto custom-scrollbar p-0">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead className="sticky top-0 bg-white dark:bg-slate-900 shadow-sm z-10">
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 pl-6">Module Name</th>
                  <th className="p-4 text-center">Read / View</th>
                  <th className="p-4 text-center">Create / Add</th>
                  <th className="p-4 text-center">Edit / Update</th>
                  <th className="p-4 text-center">Delete</th>
                  <th className="p-4 pr-6 text-right">Quick Select</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {(() => {
                  const activePanel = loginPanels[activeRole] || 'admin';
                  const filtered = displayModules.filter(module => {
                    if (activePanel === 'teacher') {
                      return TEACHER_PANEL_MODULES.includes(module.id);
                    } else {
                      return ADMIN_PANEL_MODULES.includes(module.id);
                    }
                  });

                  if (filtered.length === 0) {
                    return (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500 dark:text-slate-400">No modules available to configure.</td>
                      </tr>
                    );
                  }

                  return filtered.map(module => {
                    const p = activeRolePerms[module.id] || { read: false, create: false, edit: false, delete: false };
                    const isAll = p.read && p.create && p.edit && p.delete;

                    return (
                      <tr key={module.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 font-semibold text-slate-700 dark:text-slate-200">
                          {module.label}
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={p.read} 
                              onChange={() => handleToggle(module.id, 'read')}
                              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={p.create} 
                              onChange={() => handleToggle(module.id, 'create')}
                              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={p.edit} 
                              onChange={() => handleToggle(module.id, 'edit')}
                              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="p-4 text-center">
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={p.delete} 
                              onChange={() => handleToggle(module.id, 'delete')}
                              className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500 cursor-pointer" 
                            />
                          </label>
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <button 
                            onClick={() => handleToggleAll(module.id, !isAll)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                              isAll 
                                ? 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600' 
                                : 'bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 border border-primary-200'
                            }`}
                          >
                            {isAll ? 'Clear All' : 'Select All'}
                          </button>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
