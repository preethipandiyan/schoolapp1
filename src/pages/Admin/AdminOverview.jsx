import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubCollection, getNotices, subscribeToSubCollection, subscribeToNotices, subscribeToInvoices, cleanupOldChatAudio } from '../../firebase/firestore';
import { doc, getDoc, updateDoc, collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import { 
  LuUsers as Users, 
  LuGraduationCap as GraduationCap, 
  LuBookOpen as BookOpen, 
  LuBell as Bell,
  LuTrendingUp as TrendingUp,
  LuWallet as Wallet,
  LuCalendarDays as Calendar,
  LuZap as Zap,
  LuBriefcase as Briefcase,
  LuUser as User,
  LuCheck as Check,
  LuCopy as Copy,
  LuTrash2 as Trash2,
  LuCircleAlert as AlertCircle
} from 'react-icons/lu';
import { 
  FiSettings as Settings,
  FiX as X,
  FiSave as Save,
  FiLink as LinkIcon,
  FiBarChart2 as BarChart2,
  FiUserPlus as UserPlus,
  FiEdit as FileEdit,
  FiCheckSquare as ClipboardCheck
} from 'react-icons/fi';

export default function AdminOverview() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const hasModule = (moduleKey) => {
    if (userProfile?.role === 'superadmin') return true;
    return userProfile?.permittedModules?.includes(moduleKey) ?? true;
  };

  const [stats, setStats] = useState({
    students: 0,
    staff: 0,
    classes: 0,
    notices: 0
  });

  const [systemStatus, setSystemStatus] = useState({
    feeCollectedPct: 0,
    feesActive: false,
    payrollProcessed: false,
    payrollActive: false,
    activeEvents: 0
  });
  
  const [recentNotices, setRecentNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [pendingAttendanceAlerts, setPendingAttendanceAlerts] = useState([]);
  const [isInviteDropdownOpen, setIsInviteDropdownOpen] = useState(false);
  const [copiedRole, setCopiedRole] = useState(null);
  const dropdownRef = useRef(null);
  const [isCleaningAudio, setIsCleaningAudio] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });

  // Customization State
  const defaultConfig = {
    metrics: { students: true, staff: true, classes: true, notices: true },
    widgets: { recentNotices: true, systemStatus: true, quickActions: true, attendanceSummary: true }
  };
  const [config, setConfig] = useState(defaultConfig);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [tempConfig, setTempConfig] = useState(defaultConfig);
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsInviteDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopyLink = (role) => {
    const link = `${window.location.origin}/register/${role}/${schoolId}`;
    navigator.clipboard.writeText(link);
    setCopiedRole(role);
    setTimeout(() => {
      setCopiedRole(null);
      setIsInviteDropdownOpen(false);
    }, 2000);
  };

  // Fetch dashboard config
  useEffect(() => {
    const fetchConfig = async () => {
      if (userProfile?.uid) {
        try {
          const userDoc = await getDoc(doc(db, 'users', userProfile.uid));
          if (userDoc.exists() && userDoc.data().dashboardConfig) {
            const savedConfig = userDoc.data().dashboardConfig;
            // Merge with default config to ensure new keys aren't missing
            const mergedConfig = {
              metrics: { ...defaultConfig.metrics, ...(savedConfig.metrics || {}) },
              widgets: { ...defaultConfig.widgets, ...(savedConfig.widgets || {}) }
            };
            setConfig(mergedConfig);
            setTempConfig(mergedConfig);
          }
        } catch (error) {
          console.error("Error fetching config:", error);
        }
      }
    };
    fetchConfig();
  }, [userProfile]);

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await updateDoc(doc(db, 'users', userProfile.uid), {
        dashboardConfig: tempConfig
      });
      setConfig(tempConfig);
      setIsConfigModalOpen(false);
    } catch (error) {
      console.error("Error saving config:", error);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDismissAlert = async (alertId) => {
    try {
      await updateDoc(doc(db, `schools/${schoolId}/notifications`, alertId), {
        read: true,
        resolvedAt: new Date().toISOString()
      });
      toast.success("Alert dismissed successfully");
    } catch (error) {
      console.error("Error dismissing alert:", error);
      toast.error("Failed to dismiss alert");
    }
  };

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let studentsUnsub, staffUnsub, classesUnsub, noticesUnsub, invoicesUnsub, payrollUnsub, calendarUnsub, alertsUnsub;

    studentsUnsub = subscribeToSubCollection(schoolId, 'students', (data) => {
      setStats(prev => ({ ...prev, students: data.length }));
    });

    staffUnsub = subscribeToSubCollection(schoolId, 'teachers', (data) => {
      setStats(prev => ({ ...prev, staff: data.length }));
    });

    classesUnsub = subscribeToSubCollection(schoolId, 'classes', (data) => {
      setStats(prev => ({ ...prev, classes: data.length }));
    });

    noticesUnsub = subscribeToNotices(schoolId, null, (data) => {
      setStats(prev => ({ ...prev, notices: data.length }));
      setRecentNotices(data.slice(0, 3));
      setLoading(false); // Stop loading after notices load
    });

    invoicesUnsub = subscribeToInvoices(schoolId, (invoicesData) => {
      let expected = 0, collected = 0;
      invoicesData.forEach(inv => {
        const amount = Number(inv.amount || 0);
        expected += amount;
        if(inv.status === 'paid') collected += amount;
      });
      const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      setSystemStatus(prev => ({ ...prev, feeCollectedPct: pct, feesActive: invoicesData.length > 0 }));
    });

    payrollUnsub = subscribeToSubCollection(schoolId, 'payroll', (data) => {
      const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      const isProcessed = data.some(p => p.month === currentMonth);
      setSystemStatus(prev => ({ ...prev, payrollProcessed: isProcessed, payrollActive: data.length > 0 }));
    });

    calendarUnsub = subscribeToSubCollection(schoolId, 'calendar', (data) => {
      const upcoming = data.filter(e => new Date(e.date) >= new Date()).length;
      setSystemStatus(prev => ({ ...prev, activeEvents: upcoming }));
    });

    // Subscriptions for pending attendance alerts
    const alertsQuery = query(
      collection(db, `schools/${schoolId}/notifications`),
      where('type', '==', 'attendance_pending')
    );
    alertsUnsub = onSnapshot(alertsQuery, (snapshot) => {
      const alerts = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.read === false) {
          alerts.push({ id: docSnap.id, ...data });
        }
      });
      // Sort by createdAt desc in memory to bypass composite index requirement
      alerts.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setPendingAttendanceAlerts(alerts);
    }, (error) => {
      console.error("Error fetching pending attendance alerts:", error);
    });

    return () => {
      if (studentsUnsub) studentsUnsub();
      if (staffUnsub) staffUnsub();
      if (classesUnsub) classesUnsub();
      if (noticesUnsub) noticesUnsub();
      if (invoicesUnsub) invoicesUnsub();
      if (payrollUnsub) payrollUnsub();
      if (calendarUnsub) calendarUnsub();
      if (alertsUnsub) alertsUnsub();
    };
  }, [schoolId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent"></div>
      </div>
    );
  }

  const allStatCards = [
    {
      id: 'students',
      title: "Total Students",
      value: stats.students,
      icon: <GraduationCap className="h-6 w-6 text-blue-600" />,
      bg: "bg-blue-50",
      trend: "+12% from last month"
    },
    {
      id: 'staff',
      title: "Teaching Staff",
      value: stats.staff,
      icon: <Users className="h-6 w-6 text-purple-600" />,
      bg: "bg-purple-50",
      trend: "+2 new this month"
    },
    {
      id: 'classes',
      title: "Active Classes",
      value: stats.classes,
      icon: <BookOpen className="h-6 w-6 text-green-600" />,
      bg: "bg-green-50",
      trend: "Across all sections"
    },
    {
      id: 'notices',
      title: "School Notices",
      value: stats.notices,
      icon: <Bell className="h-6 w-6 text-amber-600" />,
      bg: "bg-amber-50",
      trend: `${recentNotices.length} new this week`
    }
  ];

  const visibleStatCards = allStatCards.filter(card => config.metrics[card.id] !== false);

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="space-y-6 animate-fade-in-up">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Dashboard Overview</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Welcome back, here's what's happening at your school today.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            
            <button 
              onClick={() => setIsConfigModalOpen(true)}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-xl shadow-sm font-semibold transition-all active:scale-[0.98]"
            >
              <Settings size={18} />
              Customize
            </button>

            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsInviteDropdownOpen(!isInviteDropdownOpen)}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-5 py-2.5 rounded-xl shadow-sm font-semibold transition-all active:scale-[0.98]"
              >
                <Zap size={18} />
                Generate Invite Links
              </button>
              
              {isInviteDropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-100 dark:border-slate-800 p-2 z-50">
                  <div className="flex flex-col space-y-1">
                    <button onClick={() => handleCopyLink('teacher')} className="flex items-center justify-between w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-cyan-600 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <Users size={18} className="text-cyan-600 group-hover:scale-110 transition-transform" />
                        Teacher Link
                      </div>
                      {copiedRole === 'teacher' ? <Check size={16} className="text-primary-500" /> : <Copy size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                    <button onClick={() => handleCopyLink('parent')} className="flex items-center justify-between w-full px-3 py-2.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-amber-600 rounded-lg transition-colors group">
                      <div className="flex items-center gap-3">
                        <User size={18} className="text-amber-600 group-hover:scale-110 transition-transform" />
                        Parent Link
                      </div>
                      {copiedRole === 'parent' ? <Check size={16} className="text-primary-500" /> : <Copy size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="hidden sm:flex items-center gap-2 rounded-lg bg-white dark:bg-slate-900 px-4 py-2.5 shadow-sm border border-slate-200 dark:border-slate-700">
              <Calendar className="h-5 w-5 text-slate-400 dark:text-slate-300" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {new Date().toLocaleDateString('en-GB')}
              </span>
            </div>
          </div>
        </div>

      {/* Metrics Grid */}
      {visibleStatCards.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {visibleStatCards.map((stat, idx) => (
            <div key={idx} className="overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-6 shadow-sm border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md hover:-translate-y-1">
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${stat.bg}`}>
                  {stat.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{stat.value}</p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                <span>{stat.trend}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {/* Pending Attendance Alerts */}
        {pendingAttendanceAlerts.length > 0 && (
          <div className="col-span-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-red-200 overflow-hidden">
            <div className="border-b border-red-100 px-6 py-4 bg-red-50/55 flex items-center justify-between">
              <h2 className="text-base font-bold text-red-800 flex items-center gap-2">
                <AlertCircle className="text-red-600" size={20} /> Pending Attendance
              </h2>
              <span className="bg-red-100 text-red-800 text-xs px-2.5 py-0.5 rounded-full font-black">
                {pendingAttendanceAlerts.length}
              </span>
            </div>
            <div className="p-6 space-y-4 max-h-[380px] overflow-y-auto divide-y divide-slate-50">
              {pendingAttendanceAlerts.map((alert) => (
                <div key={alert.id} className="flex items-start justify-between gap-4 pt-3 first:pt-0">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{alert.message}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                      Cutoff Date: <span className="font-semibold text-slate-700 dark:text-slate-200">{alert.date}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => handleDismissAlert(alert.id)}
                    className="text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-red-600 hover:bg-red-50/80 px-2 py-1 rounded-lg transition-colors shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Notices */}
        {config.widgets.recentNotices !== false && (
          <div className="col-span-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Recent Notices</h2>
            </div>
            <div className="p-6">
              {recentNotices.length > 0 ? (
                <div className="space-y-4">
                  {recentNotices.map((notice) => (
                    <div key={notice.id} className="group relative flex gap-4 rounded-xl border border-slate-100 dark:border-slate-800 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                        <Bell className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-slate-900 dark:text-white">{notice.title}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{notice.content}</p>
                        <p className="mt-2 text-xs font-medium text-slate-400 dark:text-slate-300">
                          {new Date(notice.date).toLocaleDateString('en-GB')} • {notice.targetAudience ? notice.targetAudience.charAt(0).toUpperCase() + notice.targetAudience.slice(1) : 'All'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-3 rounded-full bg-slate-50 dark:bg-slate-800 p-3">
                    <Bell className="h-6 w-6 text-slate-400 dark:text-slate-300" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white">No notices yet</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Create a notice to keep everyone informed.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions / Status */}
        {config.widgets.systemStatus !== false && (
          <div className="col-span-1 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-md">
            <h2 className="text-lg font-semibold text-white">System Status</h2>
            <p className="mt-1 text-sm text-slate-300">All modules running smoothly</p>
            
            <div className="mt-8 space-y-4">
              {hasModule('fees') && (
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wallet className="h-5 w-5 text-amber-400" />
                      <span className="font-medium">Fee Collection</span>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${systemStatus.feesActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'}`}>
                      {systemStatus.feesActive ? 'Active' : 'No Invoices'}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-amber-400 transition-all duration-1000" style={{ width: `${systemStatus.feeCollectedPct}%` }}></div>
                  </div>
                  <div className="mt-2 text-right text-xs text-slate-300">{systemStatus.feeCollectedPct}% Collected</div>
                </div>
              )}

              {hasModule('calendar') && (
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-blue-400" />
                      <span className="font-medium">Academic Calendar</span>
                    </div>
                    <span className="text-xs font-medium text-slate-300">Events</span>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-blue-400 transition-all duration-1000" style={{ width: `${Math.min(systemStatus.activeEvents * 10, 100)}%` }}></div>
                  </div>
                  <div className="mt-2 text-right text-xs text-slate-300">{systemStatus.activeEvents} Upcoming Event{systemStatus.activeEvents !== 1 && 's'}</div>
                </div>
              )}

              {hasModule('hr-payroll') && (
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Briefcase className="h-5 w-5 text-purple-400" />
                      <span className="font-medium">HR & Payroll</span>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${systemStatus.payrollProcessed ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                      {systemStatus.payrollProcessed ? 'Processed' : 'Pending'}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-purple-400 transition-all duration-1000" style={{ width: systemStatus.payrollProcessed ? '100%' : '25%' }}></div>
                  </div>
                  <div className="mt-2 text-right text-xs text-slate-300">
                    {systemStatus.payrollProcessed ? 'Payroll Processed' : 'Payroll Pending'}
                  </div>
                </div>
              )}

              {!hasModule('fees') && !hasModule('calendar') && !hasModule('hr-payroll') && (
                <div className="text-center text-sm text-slate-400 dark:text-slate-300 py-6">
                  No system status widgets available for your active modules.
                </div>
              )}
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <button onClick={() => window.location.href = '/admin/setup'} className="w-full rounded-lg bg-white/10 hover:bg-white/20 px-4 py-2.5 text-sm font-semibold text-white transition-colors">
                Configure Environment
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        {config.widgets.quickActions !== false && (
          <div className="col-span-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Zap className="text-primary-500" size={20} /> Quick Actions
              </h2>
            </div>
            <div className="p-6 flex-1 flex flex-col justify-center">
              <div className="grid grid-cols-2 gap-4 h-full">
                <button onClick={() => window.location.href = '/admin/students'} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <UserPlus size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Add Student</span>
                </button>
                <button onClick={() => window.location.href = '/admin/staff'} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <Users size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Add Staff</span>
                </button>
                <button onClick={() => window.location.href = '/admin/attendance'} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <ClipboardCheck size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Mark Attendance</span>
                </button>
                <button onClick={() => window.location.href = '/admin/notices'} className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-primary-50 dark:hover:bg-slate-800 transition-colors group">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                    <FileEdit size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">Create Notice</span>
                </button>
                <button 
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: "Cleanup Audio Files",
                      message: "Are you sure you want to delete all chat audio messages older than 7 days? This action cannot be undone.",
                      onConfirm: async () => {
                        setConfirmModal({ ...confirmModal, isOpen: false });
                        setIsCleaningAudio(true);
                        try {
                          const count = await cleanupOldChatAudio(schoolId);
                          toast.success(`Cleaned up ${count} old audio message${count !== 1 ? 's' : ''}`);
                        } catch (err) {
                          toast.error("Failed to clean up audio");
                        } finally {
                          setIsCleaningAudio(false);
                        }
                      }
                    });
                  }} 
                  disabled={isCleaningAudio}
                  className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-red-200 dark:hover:border-slate-700 hover:bg-red-50 dark:hover:bg-slate-800 transition-colors group col-span-2 sm:col-span-1"
                >
                  <div className={`w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-2 transition-transform ${isCleaningAudio ? 'animate-spin' : 'group-hover:scale-110'}`}>
                    <Trash2 size={20} />
                  </div>
                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 text-center">{isCleaningAudio ? 'Cleaning...' : 'Cleanup DB Space'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attendance Summary */}
        {config.widgets.attendanceSummary !== false && (
          <div className="col-span-1 rounded-xl bg-white dark:bg-slate-900 shadow-sm border border-slate-200 dark:border-slate-700 flex flex-col">
            <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-4 shrink-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart2 className="text-primary-500" size={20} /> Today's Attendance
              </h2>
            </div>
            <div className="p-6 flex flex-col justify-center flex-1">
              <div className="text-center mb-6">
                <div className="text-4xl font-black text-slate-800 dark:text-slate-100">85%</div>
                <div className="text-sm font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mt-1">School Average</div>
              </div>
              <div className="space-y-4 w-full max-w-sm mx-auto">
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Students</span>
                    <span className="text-emerald-600">82% Present</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{width: '82%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Teaching Staff</span>
                    <span className="text-emerald-600">96% Present</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{width: '96%'}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="text-slate-600 dark:text-slate-300">Non-Teaching Staff</span>
                    <span className="text-emerald-600">90% Present</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{width: '90%'}}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      </div>

      {/* Settings Modal */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="text-primary-600" />
                Customize Dashboard
              </h2>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300">
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto">
              {/* Metrics */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Metrics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {['students', 'staff', 'classes', 'notices'].map(metric => (
                    <label key={metric} className="flex items-center gap-3 cursor-pointer group p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tempConfig.metrics[metric] !== false ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300'}`}>
                        {metric === 'students' && <GraduationCap size={20} />}
                        {metric === 'staff' && <Users size={20} />}
                        {metric === 'classes' && <BookOpen size={20} />}
                        {metric === 'notices' && <Bell size={20} />}
                      </div>
                      <div className="flex-1 font-semibold text-slate-700 dark:text-slate-200 capitalize text-sm">{metric}</div>
                      <input 
                        type="checkbox" 
                        checked={tempConfig.metrics[metric] !== false}
                        onChange={(e) => setTempConfig({ ...tempConfig, metrics: { ...tempConfig.metrics, [metric]: e.target.checked } })}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                      />
                    </label>
                  ))}
                </div>
              </div>

              {/* Widgets */}
              <div>
                <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">Widgets</h3>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'recentNotices', name: 'Recent Notices', icon: <Bell size={20} /> },
                    { id: 'systemStatus', name: 'System Status', icon: <Zap size={20} /> },
                    { id: 'quickActions', name: 'Quick Actions', icon: <LinkIcon size={20} /> },
                    { id: 'attendanceSummary', name: 'Attendance Summary', icon: <BarChart2 size={20} /> }
                  ].map(widget => (
                    <label key={widget.id} className="flex items-center justify-between cursor-pointer group p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-primary-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tempConfig.widgets[widget.id] !== false ? 'bg-primary-100 text-primary-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300'}`}>
                          {widget.icon}
                        </div>
                        <div className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{widget.name}</div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={tempConfig.widgets[widget.id] !== false}
                        onChange={(e) => setTempConfig({ ...tempConfig, widgets: { ...tempConfig.widgets, [widget.id]: e.target.checked } })}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                      />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex justify-end gap-3 shrink-0">
              <button 
                onClick={() => setIsConfigModalOpen(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveConfig}
                disabled={savingConfig}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingConfig ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <Save size={18} />}
                Save Changes
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
