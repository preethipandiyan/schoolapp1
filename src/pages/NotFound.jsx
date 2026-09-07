import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  LuHouse, 
  LuArrowLeft, 
  LuCompass, 
  LuCopy, 
  LuCheck, 
  LuLayoutDashboard, 
  LuGraduationCap, 
  LuUsers, 
  LuBookOpen, 
  LuCalendar, 
  LuCreditCard, 
  LuBriefcase, 
  LuLifeBuoy, 
  LuShieldAlert, 
  LuLogIn,
  LuSparkles,
  LuFileText,
  LuSearch,
  LuBuilding2,
  LuSun,
  LuMoon,
  LuSquareCheck,
  LuBus,
  LuLibrary,
  LuPackage,
  LuCoffee,
  LuSettings,
  LuMessageSquare
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, userProfile } = useAuth();
  const reducedMotion = useReducedMotion();
  
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Theme management for general pages & public visitors
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark') || localStorage.getItem('theme') === 'dark';
  });

  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const role = userProfile?.role?.toLowerCase();
  const schoolName = userProfile?.schoolName || 'School Management System';

  // Determine home dashboard path & title based on authenticated user role
  const getDashboardDestination = () => {
    if (!currentUser || !userProfile) {
      return { path: '/', label: 'Back to Homepage', roleLabel: 'Public / Visitor' };
    }
    if (userProfile.loginPanel === 'teacher') {
      return { path: '/teacher', label: 'Go to Teacher Portal', roleLabel: 'Teacher' };
    }
    if (userProfile.loginPanel === 'admin') {
      return { path: '/admin', label: 'Go to Admin Dashboard', roleLabel: 'Administrator' };
    }
    switch (role) {
      case 'superadmin':
        return { path: '/superadmin', label: 'SuperAdmin Hub', roleLabel: 'SuperAdmin' };
      case 'teacher':
        return { path: '/teacher', label: 'Teacher Portal', roleLabel: 'Teacher' };
      case 'parent':
        return { path: '/parent', label: 'Parent Portal', roleLabel: 'Parent' };
      case 'admin':
      case 'staff':
      default:
        return { path: '/admin', label: 'Admin Dashboard', roleLabel: 'Staff / Admin' };
    }
  };

  const destination = getDashboardDestination();

  // All searchable destinations across General Public pages and System Dashboards
  const allDestinations = useMemo(() => [
    // General Public Pages
    { label: 'Homepage', path: '/', category: 'General Public', icon: LuHouse, keywords: 'home landing main start' },
    { label: 'Portal Login', path: '/login', category: 'General Public', icon: LuLogIn, keywords: 'login signin authentication access credentials' },
    { label: 'Register New School', path: '/register', category: 'General Public', icon: LuBuilding2, keywords: 'register signup onboarding tenant create' },
    { label: 'Forgot Password', path: '/forgot-password', category: 'General Public', icon: LuLifeBuoy, keywords: 'forgot password reset recovery account' },
    
    // School Admin Modules
    { label: 'Admin Dashboard', path: '/admin', category: 'Admin & Staff', icon: LuLayoutDashboard, keywords: 'admin overview statistics kpi metrics' },
    { label: 'Student Directory', path: '/admin/students', category: 'Admin & Staff', icon: LuUsers, keywords: 'student directory admission enroll roll' },
    { label: 'Staff Management', path: '/admin/staff', category: 'Admin & Staff', icon: LuGraduationCap, keywords: 'staff teacher faculty employee assignment' },
    { label: 'Classes & Sections', path: '/admin/classes', category: 'Admin & Staff', icon: LuBookOpen, keywords: 'class grade section subjects' },
    { label: 'Attendance Management', path: '/admin/attendance', category: 'Admin & Staff', icon: LuSquareCheck, keywords: 'attendance daily records present absent' },
    { label: 'Fee Management & Payments', path: '/admin/fees', category: 'Admin & Staff', icon: LuCreditCard, keywords: 'fees invoices billing transactions receipt' },
    { label: 'Timetable Scheduling', path: '/admin/timetables', category: 'Admin & Staff', icon: LuCalendar, keywords: 'timetable periods schedule classes' },
    { label: 'Transport & Routes', path: '/admin/transport', category: 'Admin & Staff', icon: LuBus, keywords: 'transport bus vehicle routes driver' },
    { label: 'Library Books & Catalog', path: '/admin/library', category: 'Admin & Staff', icon: LuLibrary, keywords: 'library book issue return catalog' },
    { label: 'Exams & Results', path: '/admin/exams', category: 'Admin & Staff', icon: LuFileText, keywords: 'exam test marks report cards grade' },
    { label: 'HR & Payroll Management', path: '/admin/hr-payroll', category: 'Admin & Staff', icon: LuBriefcase, keywords: 'hr payroll salary pay slips pf esi staff' },
    { label: 'Inventory & Assets', path: '/admin/inventory', category: 'Admin & Staff', icon: LuPackage, keywords: 'inventory asset stock supply equipment' },
    { label: 'Canteen Orders', path: '/admin/canteen', category: 'Admin & Staff', icon: LuCoffee, keywords: 'canteen food lunch meals snacks' },
    { label: 'School Setup & Settings', path: '/admin/setup', category: 'Admin & Staff', icon: LuSettings, keywords: 'setup configuration environment academic year' },

    // Teacher Modules
    { label: 'Teacher Portal Roster', path: '/teacher', category: 'Teacher Portal', icon: LuGraduationCap, keywords: 'teacher roster students my class' },
    { label: 'Teacher Attendance Tracker', path: '/teacher/attendance', category: 'Teacher Portal', icon: LuSquareCheck, keywords: 'teacher mark attendance daily' },
    { label: 'Homework & Assignments', path: '/teacher/homework', category: 'Teacher Portal', icon: LuBookOpen, keywords: 'homework assignments submissions tasks' },
    { label: 'Class Timetable', path: '/teacher/timetable', category: 'Teacher Portal', icon: LuCalendar, keywords: 'teacher schedule periods routine' },
    { label: 'Teacher Salary & Payslips', path: '/teacher/salary', category: 'Teacher Portal', icon: LuCreditCard, keywords: 'teacher salary payslip statement net pay' },

    // Parent Modules
    { label: 'Parent Portal Overview', path: '/parent', category: 'Parent Portal', icon: LuUsers, keywords: 'parent child children family summary' },
    { label: 'My Children Profile', path: '/parent/children', category: 'Parent Portal', icon: LuGraduationCap, keywords: 'parent children switch student profile' },
    { label: 'Fee Payments (Parent)', path: '/parent/fees', category: 'Parent Portal', icon: LuCreditCard, keywords: 'parent pay fee invoice payment receipt' },
    { label: 'Student Attendance (Parent)', path: '/parent/attendance', category: 'Parent Portal', icon: LuCalendar, keywords: 'parent attendance history leaves' },

    // SuperAdmin Modules
    { label: 'SuperAdmin Analytics', path: '/superadmin', category: 'SuperAdmin', icon: LuLayoutDashboard, keywords: 'superadmin global stats tenants platform' },
    { label: 'Tenant Management', path: '/superadmin/tenants', category: 'SuperAdmin', icon: LuBuilding2, keywords: 'superadmin schools tenants institutes' },
    { label: 'Subscription Plans', path: '/superadmin/billing', category: 'SuperAdmin', icon: LuCreditCard, keywords: 'superadmin pricing plans subscription billing' }
  ], []);

  // Filter destinations based on user input
  const filteredDestinations = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return allDestinations.filter(item => 
      item.label.toLowerCase().includes(query) || 
      item.category.toLowerCase().includes(query) || 
      item.keywords.toLowerCase().includes(query) ||
      item.path.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [searchQuery, allDestinations]);

  // Featured Quick Links based on visitor or user status
  const featuredQuickLinks = useMemo(() => {
    if (!currentUser || !userProfile) {
      return [
        { label: 'Homepage', path: '/', icon: LuHouse, desc: 'Return to welcome page' },
        { label: 'Portal Sign In', path: '/login', icon: LuLogIn, desc: 'Access your account' },
        { label: 'Register School', path: '/register', icon: LuBuilding2, desc: 'Create a school tenant' },
        { label: 'Reset Password', path: '/forgot-password', icon: LuLifeBuoy, desc: 'Account recovery' },
      ];
    }
    if (role === 'superadmin') {
      return [
        { label: 'SuperAdmin Hub', path: '/superadmin', icon: LuLayoutDashboard, desc: 'Global platform analytics' },
        { label: 'Tenant Management', path: '/superadmin/tenants', icon: LuBuilding2, desc: 'Schools & institutes' },
        { label: 'Subscription Plans', path: '/superadmin/billing', icon: LuCreditCard, desc: 'Pricing & tier controls' },
        { label: 'Audit Logs', path: '/superadmin/audit-logs', icon: LuFileText, desc: 'System security logs' }
      ];
    }
    if (role === 'teacher') {
      return [
        { label: 'Class Roster', path: '/teacher', icon: LuGraduationCap, desc: 'Students in your class' },
        { label: 'Mark Attendance', path: '/teacher/attendance', icon: LuSquareCheck, desc: 'Record daily attendance' },
        { label: 'Homework', path: '/teacher/homework', icon: LuBookOpen, desc: 'Assign & review tasks' },
        { label: 'Weekly Timetable', path: '/teacher/timetable', icon: LuCalendar, desc: 'Class timetable & routine' }
      ];
    }
    if (role === 'parent') {
      return [
        { label: 'Student Overview', path: '/parent', icon: LuUsers, desc: 'Academic summary' },
        { label: 'My Children', path: '/parent/children', icon: LuGraduationCap, desc: 'Linked student profiles' },
        { label: 'Fee Payments', path: '/parent/fees', icon: LuCreditCard, desc: 'Pending & paid invoices' },
        { label: 'Attendance Records', path: '/parent/attendance', icon: LuCalendar, desc: 'Monthly presence log' }
      ];
    }
    // Admin / Staff default
    return [
      { label: 'Admin Overview', path: '/admin', icon: LuLayoutDashboard, desc: 'School operations & KPIs' },
      { label: 'Student Directory', path: '/admin/students', icon: LuUsers, desc: 'Student enrollment data' },
      { label: 'Staff Management', path: '/admin/staff', icon: LuGraduationCap, desc: 'Teachers & assignments' },
      { label: 'Fee Management', path: '/admin/fees', icon: LuCreditCard, desc: 'Collections & invoices' },
      { label: 'Classes & Sections', path: '/admin/classes', icon: LuBookOpen, desc: 'Curriculum & grades' },
      { label: 'HR & Payroll', path: '/admin/hr-payroll', icon: LuBriefcase, desc: 'Salary & staff payslips' }
    ];
  }, [currentUser, userProfile, role]);

  const handleCopyPath = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("URL copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#12101a] text-slate-900 dark:text-[#f5f5f7] font-sans selection:bg-primary-500 selection:text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
      
      {/* Background Decorative Mesh & Glow Orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[15%] -left-[10%] w-[65vw] h-[65vw] max-w-[750px] max-h-[750px] bg-gradient-to-br from-primary-400/20 via-indigo-500/15 to-transparent blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        <div className="absolute -bottom-[15%] -right-[10%] w-[65vw] h-[65vw] max-w-[750px] max-h-[750px] bg-gradient-to-tl from-cyan-400/15 via-primary-500/10 to-transparent blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute inset-0 bg-[radial-gradient(#ce9dc6_1px,transparent_1px)] [background-size:32px_32px] opacity-[0.15] dark:opacity-[0.08]" />
      </div>

      {/* Header Bar - Fully Functional for General Pages & Dashboards */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-5 flex items-center justify-between">
        <Link 
          to={destination.path} 
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary-400/50 rounded-2xl p-1 transition-all"
        >
          <div className="w-10 h-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-primary-900/40 shadow-sm flex items-center justify-center p-1.5 group-hover:scale-105 transition-transform">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain"
              onError={(e) => { 
                e.target.style.display = 'none'; 
                if (e.target.nextElementSibling) e.target.nextElementSibling.style.display = 'block'; 
              }} 
            />
            <div style={{ display: 'none' }} className="font-black text-primary-600 text-lg">Z</div>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-900 dark:text-white leading-tight tracking-tight">
              {schoolName}
            </span>
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              School Management System
            </span>
          </div>
        </Link>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5">
          {/* General Navigation Links (for Public/Guest view) */}
          {!currentUser && (
            <div className="hidden md:flex items-center gap-1.5 mr-2">
              <Link 
                to="/" 
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
              >
                Home
              </Link>
              <Link 
                to="/register" 
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
              >
                Register School
              </Link>
              <Link 
                to="/login" 
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/60 hover:bg-primary-100 dark:hover:bg-primary-900/60 border border-primary-200/60 dark:border-primary-800/40 transition-colors"
              >
                Sign In
              </Link>
            </div>
          )}

          {/* User Session Badge */}
          {currentUser && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/70 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span>Signed in as <strong className="text-primary-600 dark:text-primary-400 capitalize">{destination.roleLabel}</strong></span>
            </div>
          )}

          {/* Dark / Light Mode Toggle Button */}
          <button
            type="button"
            onClick={toggleDarkMode}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-primary-600 dark:hover:text-primary-400 shadow-2xs transition-all active:scale-95 cursor-pointer"
          >
            {isDarkMode ? <LuSun size={18} /> : <LuMoon size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 max-w-4xl mx-auto w-full text-center">
        
        {/* Animated 404 Hero Visual */}
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative mb-4"
        >
          {/* Subtle Glowing Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-100/70 dark:bg-primary-950/60 border border-primary-200/80 dark:border-primary-800/60 text-primary-700 dark:text-primary-300 text-xs font-bold uppercase tracking-widest mb-4 shadow-sm">
            <LuShieldAlert size={14} className="animate-pulse text-primary-600 dark:text-primary-400" />
            <span>HTTP 404 Error</span>
          </div>

          {/* Large Stylized 404 Display */}
          <div className="relative flex items-center justify-center select-none">
            <span className="text-8xl sm:text-9xl md:text-[10.5rem] font-black tracking-tighter bg-gradient-to-br from-primary-600 via-indigo-600 to-cyan-500 bg-clip-text text-transparent drop-shadow-sm leading-none">
              404
            </span>
            <div className="absolute -top-2 -right-4 sm:-right-8 p-3 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl rotate-12 text-primary-600 dark:text-primary-400 animate-bounce">
              <LuCompass size={28} />
            </div>
          </div>
        </motion.div>

        {/* Heading and Description */}
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="space-y-3 max-w-xl"
        >
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Page Not Found
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
            The page or resource you requested could not be found. It may have been moved, renamed, or is temporarily unavailable.
          </p>

          {/* Attempted Path Badge with Copy */}
          <div className="inline-flex items-center gap-2 max-w-full px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span className="truncate max-w-[240px] sm:max-w-md">{location.pathname}</span>
            <button
              type="button"
              onClick={handleCopyPath}
              title="Copy URL"
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {copied ? <LuCheck size={13} className="text-emerald-600" /> : <LuCopy size={13} />}
            </button>
          </div>
        </motion.div>

        {/* Live Search & Quick Navigator for General Pages and Dashboards */}
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: "easeOut" }}
          className="w-full max-w-lg mt-6 relative"
        >
          <div className="relative">
            <LuSearch size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search for pages, admissions, portals, or tools..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-semibold placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm transition-all text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Live Search Suggestions Dropdown */}
          {searchQuery && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-30 max-h-64 overflow-y-auto custom-scrollbar text-left animate-fade-in">
              {filteredDestinations.length > 0 ? (
                <div className="p-2 divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredDestinations.map((dest) => {
                    const Icon = dest.icon;
                    return (
                      <Link
                        key={dest.path + dest.label}
                        to={dest.path}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/60 transition-colors">
                            <Icon size={16} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-300">{dest.label}</p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{dest.category}</p>
                          </div>
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                          {dest.path}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="p-6 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                  No matching destinations found for "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Primary CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="flex flex-wrap items-center justify-center gap-3.5 mt-6"
        >
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-sm shadow-sm transition-all active:scale-[0.98] cursor-pointer"
          >
            <LuArrowLeft size={18} />
            <span>Go Back</span>
          </button>

          <Link
            to={destination.path}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm shadow-lg shadow-primary-600/25 hover:shadow-primary-600/35 transition-all active:scale-[0.98]"
          >
            <LuHouse size={18} />
            <span>{destination.label}</span>
          </Link>

          {!currentUser && (
            <Link
              to="/login"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 font-bold text-sm shadow-sm transition-all active:scale-[0.98]"
            >
              <LuLogIn size={18} />
              <span>Sign In</span>
            </Link>
          )}
        </motion.div>

        {/* Quick Shortcuts Card Grid */}
        <motion.div
          initial={{ opacity: 0, y: reducedMotion ? 0 : 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: "easeOut" }}
          className="w-full mt-8 p-6 rounded-3xl bg-white/70 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-xl"
        >
          <div className="flex items-center justify-center gap-2 mb-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <LuSparkles size={14} className="text-primary-500" />
            <span>Recommended Destinations</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {featuredQuickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path + item.label}
                  to={item.path}
                  className="flex flex-col text-left p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 hover:bg-primary-50 dark:hover:bg-primary-950/40 border border-slate-100 dark:border-slate-800/80 hover:border-primary-200 dark:hover:border-primary-800/60 text-slate-700 dark:text-slate-200 hover:text-primary-700 dark:hover:text-primary-300 transition-all group shadow-2xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="p-1.5 rounded-xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 group-hover:scale-110 transition-transform shadow-2xs">
                      <Icon size={16} />
                    </div>
                    <span className="text-xs font-bold truncate">{item.label}</span>
                  </div>
                  {item.desc && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{item.desc}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </motion.div>

      </main>

      {/* Footer Bar */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-slate-400 border-t border-slate-200/50 dark:border-slate-800/50">
        <p>© {new Date().getFullYear()} {schoolName}. All rights reserved.</p>
        <div className="flex items-center gap-4">
          <Link to="/" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Home</Link>
          <Link to="/register" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Register</Link>
          <Link to="/login" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Portal Login</Link>
        </div>
      </footer>

    </div>
  );
}
