import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logoutUser } from '../firebase/auth';
import { findStudentByAdmission, linkStudentToParent, switchActiveStudent } from '../firebase/firestore';
import { getDoc, doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import TopNavbar from '../components/TopNavbar';
import { LuCircleUser as UserCircle, LuLogOut as LogOut, LuSquareCheck as CheckSquare, LuGraduationCap as GraduationCap, LuCreditCard as CreditCard, LuLink as LinkIcon, LuBell as Bell, LuMenu as Menu, LuX as X, LuFileText as FileText, LuCalendar as Calendar, LuCoffee as Coffee, LuBuilding2 as Building2, LuTrendingUp as TrendingUp, LuCalendarClock as CalendarClock, LuMessageSquare as MessageSquare, LuUsers as Users, LuChevronDown as ChevronDown, LuPlus as Plus } from 'react-icons/lu';
import useSchoolBranding from '../hooks/useSchoolBranding';
import { useNotifications } from '../context/NotificationContext';

export default function ParentDashboard() {
  const { currentUser, userProfile, updateProfileData } = useAuth();
  const { unreadCounts, clearBadge } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [unpaidFeeCount, setUnpaidFeeCount] = useState(0);
  const [hasOverdueFees, setHasOverdueFees] = useState(false);

  // Link Student Form State
  const [admissionNumber, setAdmissionNumber] = useState('');
  const [dob, setDob] = useState('');
  const [linkingError, setLinkingError] = useState('');
  const [isLinking, setIsLinking] = useState(false);

  // Multiple Children State
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
  const [isLinkAnotherModalOpen, setIsLinkAnotherModalOpen] = useState(false);
  const [anotherAdmission, setAnotherAdmission] = useState('');
  const [anotherDob, setAnotherDob] = useState('');
  const [anotherError, setAnotherError] = useState('');
  const [isLinkingAnother, setIsLinkingAnother] = useState(false);

  // Apply dynamic title and favicon
  useSchoolBranding(school);

  useEffect(() => {
    let unsubSchool;
    if (userProfile && userProfile.role !== 'parent') {
      navigate('/');
    } else if (userProfile?.schoolId) {
      unsubSchool = onSnapshot(doc(db, "schools", userProfile.schoolId), snap => {
        if (snap.exists()) setSchool(snap.data());
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
    return () => {
      if (unsubSchool) unsubSchool();
    };
  }, [userProfile, navigate]);

  // Subscribe to unpaid invoices for the linked student
  useEffect(() => {
    if (!userProfile?.schoolId || !userProfile?.linkedStudentId) {
      setUnpaidFeeCount(0);
      setHasOverdueFees(false);
      return;
    }

    const q = query(
      collection(db, `schools/${userProfile.schoolId}/invoices`),
      where("studentId", "==", userProfile.linkedStudentId)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      let count = 0;
      let overdue = false;
      const today = new Date();
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (data.status !== 'Paid') {
          count++;
          if (data.dueDate && new Date(data.dueDate + 'T23:59:59') < today) {
            overdue = true;
          }
        }
      });
      setUnpaidFeeCount(count);
      setHasOverdueFees(overdue);
    }, (err) => {
      console.error("Error subscribing to parent fee invoices:", err);
    });

    return () => unsub();
  }, [userProfile?.schoolId, userProfile?.linkedStudentId]);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const matchedItem = navItems.find(item => location.pathname === item.path);
    if (matchedItem && matchedItem.moduleKey) {
      clearBadge(matchedItem.moduleKey);
    }
  }, [location.pathname, clearBadge]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/login');
  };

  const handleLinkStudent = async (e) => {
    e.preventDefault();
    setLinkingError('');
    setIsLinking(true);

    try {
      // 1. Find the student
      const student = await findStudentByAdmission(userProfile.schoolId, admissionNumber, dob);
      
      if (!student) {
        setLinkingError("No student found matching this Admission Number and Date of Birth.");
        setIsLinking(false);
        return;
      }

      const studentName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';

      // 2. Link the student to the parent's profile
      await linkStudentToParent(currentUser.uid, student.id, student.classId, studentName);
      
      // 3. Update local auth context to trigger re-render
      await updateProfileData();
    } catch (error) {
      console.error("Link error:", error);
      setLinkingError("An error occurred while linking. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  const handleLinkAnotherChild = async (e) => {
    e.preventDefault();
    setAnotherError('');
    setIsLinkingAnother(true);

    try {
      const student = await findStudentByAdmission(userProfile.schoolId, anotherAdmission, anotherDob);
      if (!student) {
        setAnotherError("No student found matching this Admission Number and Date of Birth.");
        setIsLinkingAnother(false);
        return;
      }
      
      const studentName = student.name || `${student.firstName || ''} ${student.lastName || ''}`.trim() || 'Student';
      await linkStudentToParent(currentUser.uid, student.id, student.classId, studentName);
      await updateProfileData();
      
      setIsLinkAnotherModalOpen(false);
      setIsChildDropdownOpen(false);
      setAnotherAdmission('');
      setAnotherDob('');
    } catch (error) {
      console.error("Link error:", error);
      setAnotherError("An error occurred while linking. Please try again.");
    } finally {
      setIsLinkingAnother(false);
    }
  };

  const handleSwitchChild = async (studentId, classId) => {
    if (studentId === userProfile.linkedStudentId) return;
    try {
      await switchActiveStudent(currentUser.uid, studentId, classId);
      await updateProfileData();
      setIsChildDropdownOpen(false);
    } catch (error) {
      console.error("Failed to switch child:", error);
    }
  };

  const activeStudentInfo = userProfile?.linkedStudents?.find(s => s.studentId === userProfile?.linkedStudentId);
  const activeChildName = activeStudentInfo?.name || 'Active Child';

  const navItems = [
    { name: 'Student Overview', path: '/parent', icon: UserCircle, exact: true },
    { name: 'My Children', path: '/parent/children', icon: Users },
    { name: 'Performance', path: '/parent/performance', icon: TrendingUp },
    { name: 'PTM Meetings', path: '/parent/ptm', icon: CalendarClock },
    { name: 'Noticeboard', path: '/parent/notices', icon: Bell, moduleKey: 'noticeboard' },
    { name: 'Calendar', path: '/parent/calendar', icon: Calendar },
    { name: 'Attendance', path: '/parent/attendance', icon: CheckSquare },
    { name: 'Canteen', path: '/parent/canteen', icon: Coffee },
    { name: 'Homework', path: '/parent/homework', icon: FileText, moduleKey: 'homework' },
    { name: 'Report Card', path: '/parent/grades', icon: GraduationCap },
    { name: 'Fees & Payments', path: '/parent/fees', icon: CreditCard, moduleKey: 'fees' },
    { name: 'Leave Requests', path: '/parent/leaves', icon: Calendar },
    { name: 'Messages', path: '/parent/chat', icon: MessageSquare, moduleKey: 'chats' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex justify-center items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  // --- LOCK SCREEN: Link Student ---
  if (!userProfile?.linkedStudentId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-xl border border-slate-200 dark:border-slate-700 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-primary-500"></div>
          
          <div className="w-16 h-16 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mb-6">
            <LinkIcon size={32} />
          </div>
          
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Link Your Child</h1>
          <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
            To view academic records, please securely link your account using your child's Admission Number and Date of Birth.
          </p>

          {linkingError && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
              {linkingError}
            </div>
          )}

          <form onSubmit={handleLinkStudent} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Admission Number</label>
              <input 
                type="text" 
                required
                value={admissionNumber}
                onChange={(e) => setAdmissionNumber(e.target.value)}
                placeholder="e.g. ADM-2024-001"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Date of Birth</label>
              <input 
                type="date" 
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
              />
            </div>

            <button 
              type="submit" 
              disabled={isLinking}
              className="w-full py-3 bg-primary-600 text-white hover:bg-primary-700 rounded-xl font-bold shadow-md transition-all active:scale-95 disabled:opacity-50 mt-4 flex items-center justify-center gap-2"
            >
              {isLinking ? 'Verifying...' : 'Link Account securely'}
            </button>
          </form>

          <button 
            onClick={handleLogout}
            className="w-full py-3 mt-4 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-semibold transition-colors flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl"
          >
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f4f7fe] dark:bg-[#0b0f19] font-sans overflow-hidden p-0 lg:p-4 gap-0 lg:gap-4">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 lg:inset-y-4 lg:left-4 z-50 w-64 bg-white dark:bg-slate-900 rounded-none lg:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col transition-transform duration-300 ease-in-out lg:static lg:translate-x-0
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-[120%]'}
      `}>
        <div className="px-6 pb-6 pt-8 flex justify-between items-start">

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center p-1 shrink-0">
              <img src="/logo.png" alt="School" className="w-full h-full object-contain" onError={(e) => { e.target.style.display='none'; e.target.nextElementSibling.style.display='block'; }} />
              <div style={{display: 'none'}} className="font-black text-slate-900 dark:text-white text-xl">Z</div>
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">Zuna</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">Parent Portal</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-1">
            <X size={24} />
          </button>
        </div>

        {/* Child Switcher Dropdown */}
        {userProfile?.linkedStudents && userProfile.linkedStudents.length > 0 && (
          <div className="mb-4 relative px-4">
            <button 
              onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
              className="w-full flex items-center justify-between bg-primary-50 dark:bg-slate-800 hover:bg-primary-100 dark:hover:bg-slate-700 text-primary-900 dark:text-primary-100 px-4 py-2.5 rounded-xl border border-primary-100 dark:border-slate-700 transition-colors"
            >
              <div className="flex flex-col items-start min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-600">Viewing</span>
                <span className="text-sm font-bold truncate max-w-[150px]">{activeChildName}</span>
              </div>
              <ChevronDown size={16} className={`text-primary-600 transition-transform ${isChildDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isChildDropdownOpen && (
              <div className="absolute top-full left-4 right-4 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-[0_10px_40px_rgb(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 py-2 z-50 animate-fade-in">
                {userProfile.linkedStudents.map((child, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSwitchChild(child.studentId, child.classId)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      child.studentId === userProfile.linkedStudentId 
                        ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-700 dark:text-primary-200 font-bold' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm font-bold ${
                      child.studentId === userProfile.linkedStudentId ? 'bg-primary-200 text-primary-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                    }`}>
                      {child.name?.substring(0, 2).toUpperCase() || 'ST'}
                    </div>
                    <span className="truncate text-sm">{child.name || 'Student'}</span>
                  </button>
                ))}
                
                <div className="px-3 pt-2 mt-2 border-t border-slate-100 dark:border-slate-800">
                  <button 
                    onClick={() => {
                      setIsChildDropdownOpen(false);
                      setIsLinkAnotherModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <Plus size={16} /> Link Another Child
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.exact}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 font-semibold text-sm ${
                  isActive 
                    ? 'bg-primary-50 dark:bg-primary-900/40 text-primary-900 dark:text-primary-100 shadow-md shadow-slate-900/20 dark:shadow-none' 
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute -left-4 top-1/2 -translate-y-1/2 w-1.5 h-8 bg-primary-500 rounded-r-md"></div>
                  )}
                  <item.icon size={20} className="shrink-0" />
                  <span>{item.name}</span>
                  {item.moduleKey === 'fees' && unpaidFeeCount > 0 ? (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full select-none shrink-0 ml-auto animate-pulse ${
                      hasOverdueFees 
                        ? 'bg-red-600 text-white shadow-sm shadow-red-500/50' 
                        : 'bg-amber-500 text-white shadow-sm shadow-amber-500/50'
                    }`}>
                      {hasOverdueFees ? `${unpaidFeeCount} Overdue` : `${unpaidFeeCount} Due`}
                    </span>
                  ) : item.moduleKey && unreadCounts[item.moduleKey] > 0 ? (
                    <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full select-none shrink-0 ml-auto animate-pulse">
                      {unreadCounts[item.moduleKey]}
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 shrink-0 mt-auto">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-between border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                {userProfile?.name ? userProfile.name.substring(0, 2).toUpperCase() : userProfile?.email?.substring(0, 2).toUpperCase() || 'PA'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userProfile?.name || userProfile?.email?.split('@')[0]}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">{userProfile?.role || 'Parent'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-500 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors shrink-0"
              title="Logout"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-4 relative">
        <TopNavbar 
          schoolName={school?.name || school?.schoolName || 'Parent Portal'} 
          schoolLogo={school?.branding?.logoUrl}
          toggleSidebar={() => setIsSidebarOpen(true)} 
          navItems={navItems}
        />
        
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <Suspense fallback={
            <div className="flex-1 flex justify-center items-center h-[50vh]">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          }>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {/* Link Another Child Modal */}
      {isLinkAnotherModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-scale-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Link Another Child</h3>
              <button 
                onClick={() => setIsLinkAnotherModalOpen(false)} 
                className="text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleLinkAnotherChild} className="p-6 space-y-4">
              {anotherError && (
                <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-200">
                  {anotherError}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Admission Number <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  required
                  value={anotherAdmission}
                  onChange={(e) => setAnotherAdmission(e.target.value)}
                  placeholder="e.g. ADM-2024-001"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Date of Birth <span className="text-red-500">*</span></label>
                <input 
                  type="date" 
                  required
                  value={anotherDob}
                  onChange={(e) => setAnotherDob(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                <button 
                  type="button" 
                  onClick={() => setIsLinkAnotherModalOpen(false)}
                  className="px-6 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={isLinkingAnother}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 shadow-sm transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {isLinkingAnother ? 'Linking...' : 'Link Child'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
