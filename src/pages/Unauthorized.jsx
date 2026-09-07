import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { 
  LuShieldAlert, 
  LuHouse, 
  LuArrowLeft, 
  LuLock, 
  LuLifeBuoy, 
  LuUserCheck 
} from 'react-icons/lu';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const reducedMotion = useReducedMotion();

  const role = userProfile?.role?.toLowerCase();
  const schoolName = userProfile?.schoolName || 'School Management System';

  // Determine home dashboard path based on role
  const getDashboardDestination = () => {
    if (!currentUser || !userProfile) {
      return { path: '/login', label: 'Login to Authorized Account' };
    }
    if (userProfile.loginPanel === 'teacher') {
      return { path: '/teacher', label: 'Back to Teacher Portal' };
    }
    if (userProfile.loginPanel === 'admin') {
      return { path: '/admin', label: 'Back to Admin Dashboard' };
    }
    switch (role) {
      case 'superadmin':
        return { path: '/superadmin', label: 'Back to SuperAdmin Hub' };
      case 'teacher':
        return { path: '/teacher', label: 'Back to Teacher Portal' };
      case 'parent':
        return { path: '/parent', label: 'Back to Parent Portal' };
      case 'admin':
      case 'staff':
      default:
        return { path: '/admin', label: 'Back to Admin Dashboard' };
    }
  };

  const destination = getDashboardDestination();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#12101a] text-slate-900 dark:text-[#f5f5f7] font-sans selection:bg-primary-500 selection:text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-200">
      
      {/* Background Decorative Glow Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-[20%] -right-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-gradient-to-br from-red-500/15 via-primary-500/10 to-transparent blur-[130px] rounded-full mix-blend-multiply dark:mix-blend-screen animate-pulse" />
        <div className="absolute -bottom-[20%] -left-[10%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px] bg-gradient-to-tr from-amber-500/15 via-primary-500/10 to-transparent blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
      </div>

      {/* Header Bar */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 flex items-center justify-between">
        <Link to={destination.path} className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary-400/50 rounded-2xl p-1 transition-all">
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
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-8 max-w-lg mx-auto w-full text-center">
        <motion.div
          initial={{ opacity: 0, scale: reducedMotion ? 1 : 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="p-8 sm:p-10 rounded-3xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full flex flex-col items-center"
        >
          {/* Shield Lock Icon */}
          <div className="w-20 h-20 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/50 text-red-600 dark:text-red-400 flex items-center justify-center mb-6 shadow-inner">
            <LuLock size={36} />
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-red-100/70 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-bold uppercase tracking-wider mb-4">
            <LuShieldAlert size={14} />
            <span>403 Access Restricted</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Access Denied
          </h1>

          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            You don't have permission to access this module. Please contact your school administrator if you believe this is an error.
          </p>

          {currentUser && userProfile && (
            <div className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 text-xs text-left mb-6 flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary-100 dark:bg-primary-950 text-primary-600 dark:text-primary-400 shrink-0">
                <LuUserCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 dark:text-slate-200 truncate">{currentUser.email || userProfile.name}</p>
                <p className="text-slate-500 dark:text-slate-400 capitalize">Role: {userProfile.role || 'Standard User'}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors"
            >
              <LuArrowLeft size={16} />
              <span>Go Back</span>
            </button>
            <Link
              to={destination.path}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-xs shadow-md shadow-primary-600/20 transition-all"
            >
              <LuHouse size={16} />
              <span>{destination.label}</span>
            </Link>
          </div>
        </motion.div>
      </main>

      {/* Footer Bar */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-8 py-6 text-center text-xs font-medium text-slate-500 dark:text-slate-400">
        <p>© {new Date().getFullYear()} {schoolName}. All rights reserved.</p>
      </footer>

    </div>
  );
}
