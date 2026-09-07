import React from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LuAtom as Atom, LuLogOut as LogOut, LuLayoutDashboard as LayoutDashboard, LuBuilding2 as Building2, LuCreditCard as CreditCard, LuSettings as Settings } from 'react-icons/lu';
import { LuAtom as Atom, LuLogOut as LogOut, LuLayoutDashboard as LayoutDashboard, LuBuilding2 as Building2, LuCreditCard as CreditCard, LuSettings as Settings } from 'react-icons/lu';
import { logoutUser } from '../../firebase/auth';
import TopNavbar from '../../components/TopNavbar';

export default function SuperAdminLayout() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/superadmin', exact: true },
    { label: 'Tenants', icon: Building2, path: '/superadmin' }, 
    { label: 'Plans & Pricing', icon: CreditCard, path: '/superadmin/plans' },
    { label: 'Subscriptions', icon: CreditCard, path: '/superadmin/subscriptions' },
    { label: 'Settings', icon: Settings, path: '/superadmin/settings' },
  ];

  return (
    <div className="flex flex-col h-screen bg-[#1D1D1D] font-sans overflow-hidden">
      {/* Full Width Top Navbar */}
      <TopNavbar 
        schoolName="SuperAdmin Portal" 
        toggleSidebar={() => {}} 
        navItems={navItems.map(item => ({ ...item, name: item.label }))}
      />

      <div className="flex flex-1 overflow-hidden relative">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1D1D1D] text-slate-300 flex flex-col shrink-0 pt-4">
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            // Very simple active check
            const isActive = item.exact 
              ? location.pathname === item.path 
              : location.pathname.startsWith(item.path) && (item.path !== '/superadmin' || location.pathname === '/superadmin');
            
            return (
              <Link
                key={item.label}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-primary-500 text-slate-900 dark:text-white font-bold shadow-lg shadow-primary-500/30' 
                    : 'text-slate-400 dark:text-slate-300 hover:bg-white/10 hover:text-white font-medium'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-300'} />
                {item.label}
              </Link>
            )
          })}
        </nav>

      </aside>

      {/* Main Content Area */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-800 m-2 lg:mb-4 lg:mr-4 rounded-[1.5rem] flex flex-col min-w-0 overflow-hidden shadow-inner relative z-10">
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar">
          <Outlet />
        </div>
      </main>
      </div>
    </div>
  );
}
