import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, Bell, RefreshCw, ChevronRight, X, AlertTriangle, ArrowLeft, LifeBuoy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { subscribeToNotices } from '../firebase/firestore';
import { db } from '../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import RaiseTicketModal from './RaiseTicketModal';
import { useNotifications } from '../context/NotificationContext';
import { FiSun, FiMoon } from 'react-icons/fi';

export default function TopNavbar({ schoolName, schoolLogo, toggleSidebar, navItems = [] }) {
  const { userProfile } = useAuth();
  const { unreadCounts, clearBadge, lastViewed } = useNotifications();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [showTicketModal, setShowTicketModal] = useState(false);

  const isAdminUser = userProfile?.role === 'admin' || userProfile?.role === 'superadmin' || userProfile?.role === 'school_admin' || userProfile?.type === 'admin' || (userProfile && !['teacher', 'parent', 'student'].includes(userProfile?.role));

  const [notices, setNotices] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef(null);

  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  // Apply Theme on load and change
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const handleMarkAsRead = (moduleKey) => {
    clearBadge(moduleKey);
  };

  const handleMarkAllAsRead = () => {
    clearBadge('noticeboard');
    clearBadge('notifications');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!userProfile?.schoolId) return;
    
    // Subscribe to global notices
    const unsubNotices = subscribeToNotices(userProfile.schoolId, userProfile.role, (data) => {
      setNotices(data);
    });

    // Subscribe to user-specific notifications
    let unsubNotifications = () => {};
    if (userProfile?.uid) {
      const q = query(
        collection(db, `schools/${userProfile.schoolId}/notifications`),
        where("userId", "==", userProfile.uid)
      );
      unsubNotifications = onSnapshot(q, (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...doc.data() });
        });
        setNotifications(list);
      }, (err) => {
        console.error("Error subscribing to personal notifications:", err);
      });
    }

    return () => {
      unsubNotices();
      unsubNotifications();
    };
  }, [userProfile?.schoolId, userProfile?.role, userProfile?.uid]);

  const allNotifications = [
    ...notifications.map(n => ({ ...n, type: 'personal' })),
    ...notices.map(n => ({ ...n, type: 'notice' }))
  ];

  if (unreadCounts?.chats > 0) {
    allNotifications.push({
      id: 'unread_chats',
      type: 'chat',
      title: 'New Messages',
      description: `You have ${unreadCounts.chats} unread message(s).`,
      createdAt: new Date().toISOString()
    });
  }

  allNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const unreadCount = allNotifications.filter(n => {
    if (n.type === 'notice') return n.createdAt > (lastViewed?.noticeboard || '1970');
    if (n.type === 'personal') return n.createdAt > (lastViewed?.notifications || '1970');
    return true; // chats are unread by definition if they exist here
  }).length;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (filteredNavItems.length > 0) {
      navigate(filteredNavItems[0].path);
      setShowDropdown(false);
      setSearchQuery('');
    }
  };

  const filteredNavItems = navItems.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getInitials = (name, email) => {
    if (name) return name.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return 'U';
  };

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  return (
    <header className="bg-white dark:bg-slate-900 rounded-none lg:rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] h-16 lg:h-[4.5rem] shrink-0 flex items-center justify-between px-4 lg:px-8 z-30 relative min-w-0">
      {/* Left Group: Menu/Arrow + Search */}
      <div className="flex items-center flex-1 min-w-0 gap-2 lg:gap-4">
        {/* Left section: Mobile menu & Logo (if needed) */}
        <div className={`flex items-center gap-2 sm:gap-4 shrink-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </button>

          {toggleSidebar && (
            <button 
              onClick={toggleSidebar}
              className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Menu size={24} />
            </button>
          )}
        </div>
        
        {/* Search Bar Wrapper */}
      <div className={`absolute inset-0 px-4 flex items-center z-40 bg-white dark:bg-slate-900 md:relative md:inset-auto md:px-0 md:bg-transparent md:flex md:w-64 lg:w-80 md:ml-2 lg:ml-4 h-10 md:z-20 ${isMobileSearchOpen ? 'flex' : 'hidden md:flex'}`}>
        <form onSubmit={handleSearch} className="relative w-full h-10 transition-all duration-300 ease-out" ref={dropdownRef}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
            <Search size={18} className="text-slate-400 dark:text-slate-300" />
          </div>
          <input
            type="text"
            className="block w-full h-full pl-10 pr-10 border border-slate-200 dark:border-slate-700 md:border-transparent rounded-2xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white focus:border-primary-200 focus:shadow-md transition-all duration-300 ease-out"
            placeholder="Search modules..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            autoFocus={isMobileSearchOpen}
          />
          {/* Close Search Mobile / Clear Search Desktop */}
          {(searchQuery.length > 0 || isMobileSearchOpen) && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setShowDropdown(false);
                if (isMobileSearchOpen) setIsMobileSearchOpen(false);
              }}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X size={16} />
            </button>
          )}
          
          {/* Search Dropdown */}
          {showDropdown && searchQuery && (
            <div className="absolute top-full left-0 mt-2 w-full min-w-[300px] bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 max-h-64 overflow-y-auto custom-scrollbar animate-fade-in-up">
              {filteredNavItems.length > 0 ? (
                <ul className="py-2">
                  {filteredNavItems.map((item, idx) => (
                    <li key={idx}>
                      <button
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setShowDropdown(false);
                          setSearchQuery('');
                          setIsMobileSearchOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 text-left transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-slate-400 dark:text-slate-300">
                            <item.icon size={18} />
                          </div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.name}</span>
                        </div>
                        <ChevronRight size={16} className="text-slate-300" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  No modules found matching "{searchQuery}"
                </div>
              )}
            </div>
          )}
        </form>
      </div>
      </div>

      {/* Right section: Icons & Profile */}
      <div className={`flex items-center gap-2 sm:gap-4 shrink-0 min-w-0 ${isMobileSearchOpen ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Mobile Search Icon (Instead of full bar) */}
        <button 
          onClick={() => setIsMobileSearchOpen(true)}
          className="md:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
        >
          <Search size={20} />
        </button>

        <button 
          onClick={handleRefresh}
          className={`p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all shrink-0 ${isRefreshing ? 'animate-spin text-primary-500' : ''}`}
          title="Refresh"
        >
          <RefreshCw size={20} />
        </button>

        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors shrink-0"
          title="Toggle Theme"
        >
          {isDarkMode ? <FiSun size={20} /> : <FiMoon size={20} />}
        </button>
        
        <div className="relative shrink-0" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors relative" 
            title="Notifications"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {/* Raise Support Ticket Button (Admin Only) */}
          {isAdminUser && (
            <>
              <button
                onClick={() => setShowTicketModal(true)}
                className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-full transition-colors relative"
                title="Raise Support Ticket to Zuna"
              >
                <LifeBuoy size={20} />
              </button>
              
              <RaiseTicketModal 
                isOpen={showTicketModal} 
                onClose={() => setShowTicketModal(false)} 
                schoolName={schoolName || userProfile?.name || 'School Admin'}
                schoolEmail={userProfile?.email || ''}
              />
            </>
          )}
          
          {showNotifications && (
            <div className="absolute top-full right-[-2rem] sm:right-0 mt-2 w-[300px] sm:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 flex flex-col animate-fade-in-up">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button 
                      onClick={handleMarkAllAsRead} 
                      className="text-xs font-bold text-primary-600 hover:text-primary-700 transition-colors"
                    >
                      Mark all read
                    </button>
                  )}
                  <span className="text-xs font-medium bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">{unreadCount} new</span>
                </div>
              </div>
              <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                {allNotifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                    <Bell size={32} className="mx-auto mb-3 text-slate-300" />
                    <p className="text-sm font-medium">No new notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {allNotifications.map((notice) => {
                      const isUnread = notice.type === 'notice' 
                        ? notice.createdAt > (lastViewed?.noticeboard || '1970')
                        : notice.type === 'personal'
                          ? notice.createdAt > (lastViewed?.notifications || '1970')
                          : true;

                      return (
                        <div 
                          key={notice.id} 
                          onClick={() => {
                            if (notice.type === 'notice') handleMarkAsRead('noticeboard');
                            if (notice.type === 'personal') handleMarkAsRead('notifications');
                            if (notice.type === 'chat') {
                              setShowNotifications(false);
                              navigate(`/${userProfile?.role?.toLowerCase() || 'admin'}/chat`);
                            }
                          }}
                          className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer ${notice.priority === 'high' || notice.type !== 'notice' ? 'bg-red-50/10' : ''} ${isUnread ? 'bg-primary-50/30' : 'opacity-70'}`}
                        >
                          <div className="flex gap-3">
                            <div className={`shrink-0 mt-1 ${notice.priority === 'high' ? 'text-red-500' : 'text-primary-500'}`}>
                              {notice.priority === 'high' ? <AlertTriangle size={16} /> : <Bell size={16} />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1">{notice.title}</p>
                              <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 mt-1 line-clamp-2 leading-relaxed">{notice.description || notice.message}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-bold">
                                {new Date(notice.createdAt).toLocaleDateString('en-GB')}
                              </p>
                            </div>
                            {isUnread && (notice.type === 'notice' || notice.type === 'personal') && (
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notice.type === 'notice' ? 'noticeboard' : 'notifications');
                                }}
                                className="ml-auto mt-1 shrink-0 w-2.5 h-2.5 bg-primary-500 rounded-full self-start hover:scale-125 transition-transform"
                                title="Mark as read"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center bg-slate-50/50 dark:bg-slate-800/50">
                <button 
                  onClick={() => {
                    setShowNotifications(false);
                    const baseRoute = userProfile?.role?.toLowerCase() || 'admin';
                    // The superadmin module might use a different noticeboard path, or none at all, but we map to /notices safely
                    navigate(`/${baseRoute}/notices`);
                  }} 
                  className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  View All Notices
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="hidden sm:block h-6 w-px bg-slate-200 dark:bg-slate-700 mx-1 shrink-0"></div>

        {/* User Profile */}
        <div className="flex items-center gap-3 pl-1 min-w-0 shrink-0">
          <div className="hidden md:flex flex-col text-right min-w-0 max-w-xs lg:max-w-sm overflow-hidden group">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {userProfile?.name || userProfile?.email?.split('@')[0] || 'User'}
            </p>
            <div className="overflow-hidden whitespace-nowrap">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider inline-block animate-marquee hover-pause pr-8">
                {schoolName || userProfile?.role || 'Portal'}
              </p>
            </div>
          </div>
          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 shadow-sm relative z-10 overflow-hidden ${schoolLogo ? 'bg-white dark:bg-slate-900' : 'bg-emerald-500 text-white'}`}>
            {schoolLogo ? (
              <img src={schoolLogo} alt="School Logo" className="w-full h-full object-contain" />
            ) : (
              getInitials(userProfile?.name, userProfile?.email)
            )}
          </div>
        </div>
      </div>

    </header>
  );
}
