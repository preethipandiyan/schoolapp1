import React, { useState, useEffect, Suspense } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  LuLayoutDashboard, LuUsers, LuCreditCard, LuLogOut, LuMenu, LuX, 
  LuKey, LuLifeBuoy, LuClipboardList, LuUserCog
} from 'react-icons/lu';
import { logoutUser } from '../firebase/auth';
import { useAuth } from '../context/AuthContext';
import TopNavbar from '../components/TopNavbar';

export default function SuperAdminDashboard() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close sidebar on route change for mobile
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const navItems = [
    { name: 'Global Analytics & Dashboard', path: '/superadmin', icon: LuLayoutDashboard, exact: true },
    { name: 'Tenant/School Management', path: '/superadmin/tenants', icon: LuUsers },
    { name: 'Subscription & Billing', path: '/superadmin/billing', icon: LuCreditCard },
    { name: 'License & Usage', path: '/superadmin/license-usage', icon: LuKey },
    { name: 'Support Tickets', path: '/superadmin/support-tickets', icon: LuLifeBuoy },
    { name: 'Audit Logs & Activity', path: '/superadmin/audit-logs', icon: LuClipboardList },
    { name: 'Email Templates', path: '/superadmin/email-templates', icon: LuUserCog },
  ];

  return (
    <div className="flex h-screen bg-[#f4f7fe] dark:bg-[#0b0f19] font-sans overflow-hidden p-0 lg:p-4 gap-0 lg:gap-4">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setIsSidebarOpen(false)}
        />
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
              <h2 className="text-xl font-black text-slate-900 dark:text-white leading-tight truncate">School</h2>
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">SuperAdmin</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 p-2 -mr-2">
            <LuX size={24} />
          </button>
        </div>
        
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
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
                  </>
                )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 shrink-0 mt-auto">
          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 flex items-center justify-between border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold shrink-0">
                {userProfile?.email ? userProfile.email.substring(0, 2).toUpperCase() : 'SU'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userProfile?.email?.split('@')[0] || 'SuperAdmin'}</p>
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">Platform Owner</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Logout"
            >
              <LuLogOut size={20} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden gap-4 relative">
        <TopNavbar 
          schoolName="SuperAdmin Portal" 
          toggleSidebar={() => setIsSidebarOpen(true)} 
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
    </div>
  );
}
