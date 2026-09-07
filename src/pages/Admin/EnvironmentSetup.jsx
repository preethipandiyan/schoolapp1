import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSchool, updateSchool, subscribeToFeeCollectionPeriods, createFeeCollectionPeriod, updateFeeCollectionPeriod, deleteFeeCollectionPeriod, getAttendanceSettings, saveAttendanceSettings, subscribeToLeaveApprovalRules, createLeaveApprovalRule, updateLeaveApprovalRule, deleteLeaveApprovalRule } from '../../firebase/firestore';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuSave as Save, LuBuilding2 as Building2, LuMapPin as MapPin, LuPhone as Phone, LuGlobe as Globe, LuImage as ImageIcon, LuPalette as Palette, LuCalendar as Calendar, LuCircleCheck as CheckCircle2, LuSettings as Settings, LuPlus as Plus, LuPencil as Pencil, LuTrash as Trash, LuX as X, LuIndianRupee as IndianRupee, LuClock as Clock, LuTriangleAlert as AlertTriangle, LuUserCheck as UserCheck } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function EnvironmentSetup() {
  const { userProfile, updateProfileData } = useAuth(); // Assume we can refresh auth context
  const schoolId = userProfile?.schoolId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });

  const [formData, setFormData] = useState({
    name: '',
    contactPhone: '',
    location: '',
    website: '',
    branding: {
      logoUrl: ''
    },
    academicConfig: {
      currentYear: '2026-2027',
      termType: 'Semester'
    }
  });
  const [customData, setCustomData] = useState({});
  const [formSchema, setFormSchema] = useState([]);
  const [termTypes, setTermTypes] = useState([
    'Semester',
    'Annual',
    'Trimester_TN',
    'Quarterly_HalfYearly_Annual'
  ]);
  const [showCustomTermInput, setShowCustomTermInput] = useState(false);
  const [customTermName, setCustomTermName] = useState('');

  // --- Fee Collection Periods State ---
  const [periods, setPeriods] = useState([]);
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState(null); // null = create, object = edit
  const [periodForm, setPeriodForm] = useState({ name: '', code: '', displayOrder: '', description: '', status: 'active' });
  const [savingPeriod, setSavingPeriod] = useState(false);

  // --- Attendance Settings State ---
  const [attendanceConfig, setAttendanceConfig] = useState({
    cutoffTime: '09:30',
    lateThreshold: '09:30',
    absenteeThreshold: 2,
    workingHoursStart: '09:00',
    workingHoursEnd: '16:00'
  });
  const [savingAttendance, setSavingAttendance] = useState(false);

  // --- Leave Approval Rules State ---
  const [leaveRules, setLeaveRules] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showLeaveRuleModal, setShowLeaveRuleModal] = useState(false);
  const [editingLeaveRule, setEditingLeaveRule] = useState(null);
  const [leaveRuleForm, setLeaveRuleForm] = useState({ minDays: '', maxDays: '', roleId: '', order: '' });
  const [savingLeaveRule, setSavingLeaveRule] = useState(false);

  useEffect(() => {
    if (schoolId) fetchSchoolData();
  }, [schoolId]);

  // Subscribe to fee collection periods in real-time
  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeToFeeCollectionPeriods(schoolId, setPeriods);
    return () => unsub();
  }, [schoolId]);

  // Subscribe to leave approval rules in real-time
  useEffect(() => {
    if (!schoolId) return;
    const unsub = subscribeToLeaveApprovalRules(schoolId, setLeaveRules);
    return () => unsub();
  }, [schoolId]);

  // Fetch roles list for dropdown
  const fetchRolesList = async () => {
    if (!schoolId) return;
    try {
      const rolesRef = collection(db, `schools/${schoolId}/roles`);
      const snapshot = await getDocs(rolesRef);
      const rolesData = [];
      snapshot.forEach(doc => {
        rolesData.push({ id: doc.id, name: doc.id });
      });
      if (rolesData.length === 0) {
        const DEFAULT_ROLES = [
          'Correspondent', 'Principal', 'Vice Principal', 'Subject Wise Head',
          'Class Incharge', 'Staffs', 'Administrative Officer', 'Finance Department',
          'Library', 'Canteen', 'Transport', 'Janitors', 'Hostel', 'Inventory', 'Security'
        ];
        setRoles(DEFAULT_ROLES.map(r => ({ id: r, name: r })));
      } else {
        setRoles(rolesData);
      }
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  useEffect(() => {
    if (schoolId) fetchRolesList();
  }, [schoolId]);

  // --- Fee Period Handlers ---
  const openAddPeriod = () => {
    setEditingPeriod(null);
    setPeriodForm({ name: '', code: '', displayOrder: periods.length + 1, description: '', status: 'active' });
    setShowPeriodModal(true);
  };

  const openEditPeriod = (p) => {
    setEditingPeriod(p);
    setPeriodForm({ name: p.name, code: p.code || '', displayOrder: p.displayOrder || '', description: p.description || '', status: p.status || 'active' });
    setShowPeriodModal(true);
  };

  const handleSavePeriod = async (e) => {
    e.preventDefault();
    if (!periodForm.name.trim()) return toast.error('Period name is required.');
    setSavingPeriod(true);
    try {
      const payload = {
        name: periodForm.name.trim(),
        code: periodForm.code.trim() || periodForm.name.trim().toUpperCase().replace(/\s+/g, '_'),
        displayOrder: Number(periodForm.displayOrder) || periods.length + 1,
        description: periodForm.description.trim(),
        status: periodForm.status
      };
      if (editingPeriod) {
        await updateFeeCollectionPeriod(schoolId, editingPeriod.id, payload);
        toast.success('Period updated successfully.');
      } else {
        await createFeeCollectionPeriod(schoolId, payload);
        toast.success('Fee collection period added.');
      }
      setShowPeriodModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save period.');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleDeletePeriod = (p) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Period",
      message: `Delete period "${p.name}"? This will NOT affect existing invoices.`,
      onConfirm: async () => {
        try {
          await deleteFeeCollectionPeriod(schoolId, p.id);
          toast.success('Period deleted.');
        } catch (err) {
          toast.error('Failed to delete period.');
        }
      }
    });
  };

  const handleTogglePeriodStatus = async (p) => {
    const newStatus = p.status === 'active' ? 'inactive' : 'active';
    try {
      await updateFeeCollectionPeriod(schoolId, p.id, { status: newStatus });
      toast.success(`Period marked as ${newStatus}.`);
    } catch (err) {
      toast.error('Failed to update status.');
    }
  };

  // --- Attendance Settings Handlers ---
  const handleSaveAttendanceConfig = async (e) => {
    e.preventDefault();
    setSavingAttendance(true);
    try {
      await saveAttendanceSettings(schoolId, attendanceConfig);
      toast.success('Attendance settings updated successfully.');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save attendance settings.');
    } finally {
      setSavingAttendance(false);
    }
  };

  // --- Leave Approval Rules Handlers ---
  const openAddLeaveRule = () => {
    setEditingLeaveRule(null);
    setLeaveRuleForm({ minDays: '', maxDays: '', roleId: roles[0]?.id || '', order: leaveRules.length + 1 });
    setShowLeaveRuleModal(true);
  };

  const openEditLeaveRule = (rule) => {
    setEditingLeaveRule(rule);
    setLeaveRuleForm({
      minDays: rule.minDays,
      maxDays: rule.maxDays === null || rule.maxDays === undefined ? '' : rule.maxDays,
      roleId: rule.roleId,
      order: rule.order || 1
    });
    setShowLeaveRuleModal(true);
  };

  const handleSaveLeaveRule = async (e) => {
    e.preventDefault();
    if (leaveRuleForm.minDays === '' || !leaveRuleForm.roleId) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSavingLeaveRule(true);
    try {
      const payload = {
        minDays: Number(leaveRuleForm.minDays),
        maxDays: leaveRuleForm.maxDays === '' ? null : Number(leaveRuleForm.maxDays),
        roleId: leaveRuleForm.roleId,
        order: Number(leaveRuleForm.order) || 1
      };
      if (editingLeaveRule) {
        await updateLeaveApprovalRule(schoolId, editingLeaveRule.id, payload);
        toast.success('Leave rule updated successfully.');
      } else {
        await createLeaveApprovalRule(schoolId, payload);
        toast.success('Leave rule added successfully.');
      }
      setShowLeaveRuleModal(false);
    } catch (err) {
      console.error(err);
      toast.error('Failed to save leave rule.');
    } finally {
      setSavingLeaveRule(false);
    }
  };

  const handleDeleteLeaveRule = (rule) => {
    setConfirmModal({
      isOpen: true,
      title: "Delete Leave Rule",
      message: 'Delete this leave approval rule?',
      onConfirm: async () => {
        try {
          await deleteLeaveApprovalRule(schoolId, rule.id);
          toast.success('Leave rule deleted.');
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete leave rule.');
        }
      }
    });
  };

  const getLeaveRulesWarnings = () => {
    const warnings = [];
    if (leaveRules.length === 0) return warnings;

    const coversOneDay = leaveRules.some(r => {
      const min = Number(r.minDays);
      const max = r.maxDays === null || r.maxDays === undefined ? Infinity : Number(r.maxDays);
      return min <= 1 && max >= 1;
    });
    if (!coversOneDay) {
      warnings.push("No leave approval rule covers 1-day leaves.");
    }

    const sorted = [...leaveRules].sort((a, b) => Number(a.minDays) - Number(b.minDays));
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentMin = Number(sorted[i].minDays);
      const currentMax = sorted[i].maxDays === null || sorted[i].maxDays === undefined ? Infinity : Number(sorted[i].maxDays);
      const nextMin = Number(sorted[i+1].minDays);
      const nextMax = sorted[i+1].maxDays === null || sorted[i+1].maxDays === undefined ? Infinity : Number(sorted[i+1].maxDays);

      if (currentMax >= nextMin) {
        warnings.push(`Overlap detected: Band [${currentMin} - ${currentMax === Infinity ? 'and above' : currentMax}] overlaps with Band [${nextMin} - ${nextMax === Infinity ? 'and above' : nextMax}].`);
      } else if (currentMax < nextMin - 1) {
        warnings.push(`Gap detected: Gaps exist between Band [${currentMin} - ${currentMax}] and Band [${nextMin} - ${nextMax === Infinity ? 'and above' : nextMax}]. Days ${currentMax + 1} to ${nextMin - 1} are not covered.`);
      }
    }

    return warnings;
  };

  const fetchSchoolData = async () => {
    try {
      const data = await getSchool(schoolId);
      if (data) {
        setFormData({
          name: data.name || '',
          contactPhone: data.contactPhone || '',
          location: data.location || '',
          website: data.website || '',
          branding: data.branding || { logoUrl: '' },
          academicConfig: data.academicConfig || { currentYear: '2026-2027', termType: 'Semester' }
        });
        if (data.academicConfig?.termType) {
          const loadedType = data.academicConfig.termType;
          setTermTypes(prev => {
            if (!prev.includes(loadedType)) {
              return [...prev, loadedType];
            }
            return prev;
          });
        }
        if (data.customData) {
          setCustomData(data.customData);
        }
      }

      // Fetch Attendance Settings
      const attSettings = await getAttendanceSettings(schoolId);
      if (attSettings) {
        setAttendanceConfig({
          cutoffTime: attSettings.cutoffTime || '09:30',
          lateThreshold: attSettings.lateThreshold || attSettings.cutoffTime || '09:30',
          absenteeThreshold: attSettings.absenteeThreshold !== undefined ? Number(attSettings.absenteeThreshold) : 2,
          workingHoursStart: attSettings.workingHoursStart || '09:00',
          workingHoursEnd: attSettings.workingHoursEnd || '16:00'
        });
      }

      // Fetch Schema
      const schemaSnap = await getDoc(doc(db, `schools/${schoolId}/formSchemas/environment_setup`));
      if (schemaSnap.exists()) {
        const data = schemaSnap.data();
        let allFields = [];
        if (data.sections) {
          data.sections.forEach(sec => {
            if (sec.fields) {
              allFields = allFields.concat(sec.fields);
            }
          });
        } else if (data.fields) {
          allFields = data.fields;
        }
        setFormSchema(allFields);
      }
    } catch (error) {
      console.error("Error fetching school:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccessMsg('');
    try {
      await updateSchool(schoolId, {
        ...formData,
        customData
      });
      setSuccessMsg('Environment settings saved successfully!');
      
      // Update local profile context if branding changed
      if (formData.branding.logoUrl !== userProfile?.school?.branding?.logoUrl || 
          formData.name !== userProfile?.schoolName) {
        updateProfileData({
          schoolName: formData.name,
          school: {
            ...userProfile.school,
            branding: formData.branding
          }
        });
      }

      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (error) {
      console.error("Error saving setup:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Logo file size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({
          ...formData,
          branding: { ...formData.branding, logoUrl: reader.result }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Environment Setup</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your school's branding, contact info, and academic settings.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
        >
          {saving ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Save size={18} />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl flex items-center gap-3 animate-fade-in-down">
          <CheckCircle2 size={20} className="text-green-600" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      <div className="space-y-8">
        {/* General Information */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Building2 className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">General Information</h2>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">School Name</label>
              <input 
                type="text" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><MapPin size={16} className="text-slate-400 dark:text-slate-300"/> Location / Address</label>
              <input 
                type="text" 
                value={formData.location}
                onChange={(e) => setFormData({...formData, location: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><Phone size={16} className="text-slate-400 dark:text-slate-300"/> Contact Phone</label>
              <input 
                type="tel" 
                value={formData.contactPhone}
                onChange={(e) => setFormData({...formData, contactPhone: e.target.value})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><Globe size={16} className="text-slate-400 dark:text-slate-300"/> Official Website</label>
              <input 
                type="url" 
                value={formData.website}
                onChange={(e) => setFormData({...formData, website: e.target.value})}
                placeholder="https://www.yourschool.edu"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Palette className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Branding & Theming</h2>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-8 items-start">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1 flex items-center gap-2"><ImageIcon size={16} className="text-slate-400 dark:text-slate-300"/> Upload Logo</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Upload your school's logo image (PNG/JPG/SVG, max 2MB).</p>
              <input 
                type="file" 
                accept="image/*"
                onChange={handleLogoUpload}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 transition-all cursor-pointer"
              />
              
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center min-h-[200px] text-center">
              <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider">Preview</p>
              {formData.branding.logoUrl ? (
                <img src={formData.branding.logoUrl} alt="School Logo" className="h-16 object-contain" onError={(e) => { e.target.src = ''; e.target.className='hidden'; }} />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                  <ImageIcon size={32} className="mb-2" />
                  <span className="text-sm">No logo uploaded</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Academic Settings */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Calendar className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Academic Configuration</h2>
          </div>
          <div className="p-8 grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Current Academic Year</label>
              <select 
                value={formData.academicConfig.currentYear}
                onChange={(e) => setFormData({...formData, academicConfig: { ...formData.academicConfig, currentYear: e.target.value }})}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                <option value="2025-2026">2025 - 2026</option>
                <option value="2026-2027">2026 - 2027</option>
                <option value="2027-2028">2027 - 2028</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Term Type</label>
              <select 
                value={formData.academicConfig.termType}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'ADD_NEW') {
                    setShowCustomTermInput(true);
                  } else {
                    setFormData({...formData, academicConfig: { ...formData.academicConfig, termType: value }});
                  }
                }}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
              >
                {termTypes.map(type => {
                  let displayName = type;
                  if (type === 'Trimester_TN') displayName = 'Term I, Term II, Term III';
                  else if (type === 'Quarterly_HalfYearly_Annual') displayName = 'Quarterly, Half Yearly, Annual';
                  else if (type === 'Semester') displayName = 'Semesters (2 terms)';
                  else if (type === 'Annual') displayName = 'Annual (1 term)';
                  return <option key={type} value={type}>{displayName}</option>;
                })}
                <option value="ADD_NEW" className="text-primary-650 font-extrabold text-blue-600">+ Add custom type...</option>
              </select>

              {showCustomTermInput && (
                <div className="mt-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center gap-3 animate-fade-in">
                  <input
                    type="text"
                    placeholder="Enter new term type..."
                    value={customTermName}
                    onChange={(e) => setCustomTermName(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const trimmed = customTermName.trim();
                      if (trimmed) {
                        setTermTypes(prev => [...prev, trimmed]);
                        setFormData({...formData, academicConfig: { ...formData.academicConfig, termType: trimmed }});
                        setCustomTermName('');
                        setShowCustomTermInput(false);
                      }
                    }}
                    className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCustomTermInput(false);
                      setCustomTermName('');
                    }}
                    className="px-3 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Custom Form Builder Settings */}
        {formSchema.length > 0 && (
          <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
              <Settings className="text-primary-600" size={24} />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Additional Settings</h2>
            </div>
            <div className="p-8 grid md:grid-cols-2 gap-6">
              {formSchema.map(field => (
                <div key={field.id} className={field.type === 'checkbox' ? 'col-span-2' : ''}>
                  {field.type !== 'checkbox' && (
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                  )}
                  
                  {field.type === 'select' ? (
                    <select
                      required={field.required}
                      value={customData[field.id] || ''}
                      onChange={e => setCustomData({...customData, [field.id]: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 transition-all"
                    >
                      <option value="">Select...</option>
                      {field.options && field.options.split(',').map(opt => (
                        <option key={opt.trim()} value={opt.trim()}>{opt.trim()}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <label className="flex items-center gap-3 mt-1 cursor-pointer">
                      <input
                        type="checkbox"
                        required={field.required}
                        checked={customData[field.id] || false}
                        onChange={e => setCustomData({...customData, [field.id]: e.target.checked})}
                        className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      required={field.required}
                      value={customData[field.id] || ''}
                      onChange={e => setCustomData({...customData, [field.id]: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 transition-all"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fee Collection Periods */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <IndianRupee className="text-primary-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Fee Collection Periods</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Define your school's fee collection schedule (e.g. Term 1, Quarter 1, Annual).</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddPeriod}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} /> Add Period
            </button>
          </div>

          {periods.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-300">
              <IndianRupee className="mx-auto mb-3 opacity-30" size={40} />
              <p className="font-semibold text-sm text-slate-500 dark:text-slate-400">No fee collection periods configured yet.</p>
              <p className="text-xs mt-1">Add periods like Term 1, Quarter 1, Annual to assign fees against them.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {periods.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-black text-sm shrink-0">
                      {p.displayOrder || '—'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{p.name}</p>
                      {p.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.description}</p>}
                      <span className="text-[10px] font-mono text-slate-400 dark:text-slate-300">{p.code}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleTogglePeriodStatus(p)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${
                        p.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                      }`}
                    >
                      {p.status === 'active' ? 'Active' : 'Inactive'}
                    </button>
                    <button type="button" onClick={() => openEditPeriod(p)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => handleDeletePeriod(p)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Attendance Settings (SOP alignment) */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center gap-3">
            <Clock className="text-primary-600" size={24} />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Attendance Configuration</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Configure school timings, thresholds, and thresholds for automated flags.</p>
            </div>
          </div>
          <form onSubmit={handleSaveAttendanceConfig} className="p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Working Hours Start</label>
                <input
                  type="time" required
                  value={attendanceConfig.workingHoursStart}
                  onChange={(e) => setAttendanceConfig({ ...attendanceConfig, workingHoursStart: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Working Hours End</label>
                <input
                  type="time" required
                  value={attendanceConfig.workingHoursEnd}
                  onChange={(e) => setAttendanceConfig({ ...attendanceConfig, workingHoursEnd: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Cutoff Time (Late after this)</label>
                <input
                  type="time" required
                  value={attendanceConfig.cutoffTime}
                  onChange={(e) => setAttendanceConfig({ ...attendanceConfig, cutoffTime: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Absentee Threshold For Students (Absences/Month before Flag)</label>
                <input
                  type="number" required min="1"
                  value={attendanceConfig.absenteeThreshold}
                  onChange={(e) => setAttendanceConfig({ ...attendanceConfig, absenteeThreshold: Number(e.target.value) })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div className="flex justify-end pt-4">
              <button
                type="submit"
                disabled={savingAttendance}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                <Save size={18} /> {savingAttendance ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
        </section>

        {/* Leave Approval Rules builder */}
        <section className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="text-primary-600" size={24} />
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Leave Approval Rules</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Build a custom multi-level leave approval ladder by duration bands.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAddLeaveRule}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-xl font-semibold text-sm hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} /> Add Band
            </button>
          </div>

          {/* Validation Warnings */}
          {getLeaveRulesWarnings().length > 0 && (
            <div className="mx-8 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
              <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                <AlertTriangle size={16} />
                <span>Configuration Warnings (Non-blocking):</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-700 pl-2 space-y-1">
                {getLeaveRulesWarnings().map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {leaveRules.length === 0 ? (
            <div className="p-12 text-center text-slate-400 dark:text-slate-300">
              <UserCheck className="mx-auto mb-3 opacity-30" size={40} />
              <p className="font-semibold text-sm text-slate-500 dark:text-slate-400">No leave approval rules configured.</p>
              <p className="text-xs mt-1">Leaves will trigger manual routing to general admins until rules are added.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {leaveRules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/60 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-black text-sm shrink-0">
                      {rule.order || '—'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {rule.minDays} {rule.maxDays === null ? 'and above' : `to ${rule.maxDays}`} Days
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Route to Role: <span className="font-semibold text-indigo-600">{rule.roleId}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEditLeaveRule(rule)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Pencil size={15} />
                    </button>
                    <button type="button" onClick={() => handleDeleteLeaveRule(rule)} className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                      <Trash size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Period Modal */}
      {showPeriodModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingPeriod ? 'Edit Period' : 'Add Fee Collection Period'}</h3>
              <button type="button" onClick={() => setShowPeriodModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={handleSavePeriod} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Period Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required
                  value={periodForm.name}
                  onChange={(e) => setPeriodForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Term 1, Quarter 2, Annual"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Code</label>
                  <input
                    type="text"
                    value={periodForm.code}
                    onChange={(e) => setPeriodForm(p => ({ ...p, code: e.target.value }))}
                    placeholder="e.g. TERM1"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 font-mono uppercase text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Display Order</label>
                  <input
                    type="number" min="1"
                    value={periodForm.displayOrder}
                    onChange={(e) => setPeriodForm(p => ({ ...p, displayOrder: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Description</label>
                <input
                  type="text"
                  value={periodForm.description}
                  onChange={(e) => setPeriodForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional description"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowPeriodModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={savingPeriod} className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60">
                  {savingPeriod ? 'Saving...' : editingPeriod ? 'Update Period' : 'Add Period'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Leave Approval Rule Modal */}
      {showLeaveRuleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">{editingLeaveRule ? 'Edit Approval Rule' : 'Add Leave Approval Band'}</h3>
              <button type="button" onClick={() => setShowLeaveRuleModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"><X size={18} /></button>
            </div>
            <form onSubmit={handleSaveLeaveRule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Min Days <span className="text-red-500">*</span></label>
                  <input
                    type="number" required min="1"
                    value={leaveRuleForm.minDays}
                    onChange={(e) => setLeaveRuleForm(p => ({ ...p, minDays: e.target.value }))}
                    placeholder="e.g. 1"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Max Days (blank for +)</label>
                  <input
                    type="number" min={leaveRuleForm.minDays || 1}
                    value={leaveRuleForm.maxDays}
                    onChange={(e) => setLeaveRuleForm(p => ({ ...p, maxDays: e.target.value }))}
                    placeholder="e.g. 3"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Route to Role <span className="text-red-500">*</span></label>
                <select
                  required
                  value={leaveRuleForm.roleId}
                  onChange={(e) => setLeaveRuleForm(p => ({ ...p, roleId: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                >
                  <option value="">Select role...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Evaluation Order (Priority)</label>
                <input
                  type="number" min="1"
                  value={leaveRuleForm.order}
                  onChange={(e) => setLeaveRuleForm(p => ({ ...p, order: e.target.value }))}
                  placeholder="e.g. 1"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLeaveRuleModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={savingLeaveRule} className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl transition-colors disabled:opacity-60">
                  {savingLeaveRule ? 'Saving...' : editingLeaveRule ? 'Update Rule' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
