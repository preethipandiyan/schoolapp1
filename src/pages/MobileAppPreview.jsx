import React, { useState } from 'react';
import { 
  Calendar, Clock, BookOpen, MessageSquare, Grid, Megaphone, 
  Book, FolderOpen, BarChart2, Users, Bus, Award, DollarSign, 
  FileText, User, CheckCircle2, XCircle, AlertCircle, Plus, Send, 
  Search, Shield, ChevronRight, Save, ArrowLeft, RefreshCw, Smartphone, ChevronLeft, LogOut
} from 'lucide-react';
import { Link } from 'react-router-dom';

const staffModulesList = [
  { id: 'sm0', name: 'Timetable', icon: Clock, color: 'bg-amber-500', textCol: 'text-amber-500', badge: 'Daily', desc: 'Quick access to daily & period-wise classes' },
  { id: 'sm1', name: 'Noticeboard', icon: Megaphone, color: 'bg-amber-600', textCol: 'text-amber-600', badge: '3 Memos', desc: 'School announcements, circulars & staff memos' },
  { id: 'sm2', name: 'Academic Calendar', icon: Calendar, color: 'bg-red-500', textCol: 'text-red-500', badge: 'Term 1', desc: 'Academic calendar, holidays & exam dates' },
  { id: 'sm3', name: 'Lesson Plans', icon: BookOpen, color: 'bg-blue-600', textCol: 'text-blue-600', badge: 'Weekly', desc: 'Syllabus tracker & weekly topic planning' },
  { id: 'sm4', name: 'Resources', icon: FolderOpen, color: 'bg-sky-500', textCol: 'text-sky-500', badge: '12 Files', desc: 'Teaching materials, lab manuals & reference links' },
  { id: 'sm5', name: 'Reports & Analytics', icon: BarChart2, color: 'bg-purple-600', textCol: 'text-purple-600', badge: 'Class 10A', desc: 'Student academic analytics & class metrics' },
  { id: 'sm6', name: 'PTM Scheduler', icon: Users, color: 'bg-emerald-600', textCol: 'text-emerald-600', badge: '5 Slots', desc: 'Parent-Teacher meeting slots & appointments' },
  { id: 'sm7', name: 'Transport', icon: Bus, color: 'bg-indigo-600', textCol: 'text-indigo-600', badge: 'Route 3', desc: 'Bus routes, student drop-off lists & driver details' },
  { id: 'sm8', name: 'Grades & Exams', icon: Award, color: 'bg-rose-600', textCol: 'text-rose-600', badge: 'Marks Entry', desc: 'Enter marks, evaluate tests & issue report cards' },
  { id: 'sm9', name: 'My Salary', icon: DollarSign, color: 'bg-emerald-600', textCol: 'text-emerald-600', badge: 'Payslip', desc: 'Monthly payslips, salary slips & tax statements' },
  { id: 'sm10', name: 'Leave Requests', icon: FileText, color: 'bg-amber-600', textCol: 'text-amber-600', badge: '8 Days Left', desc: 'Apply for casual/sick leaves & track approval' },
  { id: 'sm11', name: 'Profile', icon: User, color: 'bg-slate-600', textCol: 'text-slate-600', badge: 'Verified', desc: 'Staff credentials, designation & personal info' },
];

export default function MobileAppPreview() {
  const [isLoggedIn, setIsLoggedIn] = useState(true);
  const [loginEmail, setLoginEmail] = useState('teacher@zuna.edu');
  const [loginPassword, setLoginPassword] = useState('password123');
  const [activeRole, setActiveRole] = useState('Staff');
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [selectedDay, setSelectedDay] = useState('Mon');
  const [toastMessage, setToastMessage] = useState(null);
  const [activeModuleModal, setActiveModuleModal] = useState(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [chatInput, setChatInput] = useState('');
  const [moduleSearch, setModuleSearch] = useState('');
  const [staffModulePage, setStaffModulePage] = useState(1);
  const PAGE_SIZE = 10;


  // Interactive Module States
  const [noticeTab, setNoticeTab] = useState('Global Notices');
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [noticesList, setNoticesList] = useState([]);

  const [lessonTab, setLessonTab] = useState('Upcoming Lessons');
  const [showNewPlanModal, setShowNewPlanModal] = useState(false);
  const [newPlanTopic, setNewPlanTopic] = useState('');
  const [lessonPlansList, setLessonPlansList] = useState([]);

  const [resourceTab, setResourceTab] = useState('All Files');
  const [showAddResourceModal, setShowAddResourceModal] = useState(false);
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [resourcesList, setResourcesList] = useState([]);

  // Filtered & Paginated Staff Modules
  const filteredModules = staffModulesList.filter(m => 
    m.name.toLowerCase().includes(moduleSearch.toLowerCase())
  );
  const totalPages = Math.ceil(filteredModules.length / PAGE_SIZE) || 1;
  const paginatedModules = filteredModules.slice((staffModulePage - 1) * PAGE_SIZE, staffModulePage * PAGE_SIZE);

  // Sample State Data
  const [newHw, setNewHw] = useState({ title: '', grade: 'Class 10A', subject: 'Physics', dueDate: 'Sep 12, 2026' });
  const [homeworkList, setHomeworkList] = useState([
    { id: 'hw1', title: 'Physics Ch 4 Numerical Problems', grade: 'Class 10A', subject: 'Physics', dueDate: 'Sep 09, 2026', submissions: '24/30 Submitted' },
    { id: 'hw2', title: 'Algebra & Quadratic Equations Set 3', grade: 'Class 10B', subject: 'Mathematics', dueDate: 'Sep 11, 2026', submissions: '18/28 Submitted' },
    { id: 'hw3', title: 'Optics & Wave Motion Lab Sheet', grade: 'Class 11A', subject: 'Physics', dueDate: 'Sep 12, 2026', submissions: '12/25 Submitted' },
  ]);

  const [students, setStudents] = useState([
    { id: '1', name: 'Rahul Kumar', grade: 'Class 10', rollNo: '101', status: 'Present' },
    { id: '2', name: 'Priya Sharma', grade: 'Class 10', rollNo: '102', status: 'Present' },
    { id: '3', name: 'Aarav Singh', grade: 'Class 10', rollNo: '103', status: 'Absent' },
    { id: '4', name: 'Ananya Reddy', grade: 'Class 11', rollNo: '104', status: 'Present' },
    { id: '5', name: 'Vikram Patel', grade: 'Class 11', rollNo: '105', status: 'OD' },
  ]);

  const [chatList, setChatList] = useState([
    { id: 'c1', name: 'Dr. Robert (Principal)', role: 'Admin', avatar: 'DR', lastMsg: 'Please submit the term exam questions before 3 PM.', time: '10:15 AM', unread: true },
    { id: 'c2', name: 'Mrs. Sunita Sharma (Parent)', role: 'Parent', avatar: 'SS', lastMsg: 'Aarav has fever today, medical note submitted.', time: '09:40 AM', unread: true },
    { id: 'c3', name: 'Rahul Kumar (Student)', role: 'Student', avatar: 'RK', lastMsg: 'Ma\'am, could you clarify problem #4 from homework?', time: 'Yesterday', unread: false },
  ]);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleStudentStatus = (id) => {
    setStudents(prev => prev.map(s => {
      if (s.id === id) {
        const nextMap = { Present: 'Absent', Absent: 'OD', OD: 'Present' };
        const newStatus = nextMap[s.status];
        showToast(`${s.name} marked as ${newStatus}`);
        return { ...s, status: newStatus };
      }
      return s;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4 font-sans selection:bg-purple-500 selection:text-white">
      
      {/* Top Header Control Bar */}
      <div className="w-full max-w-4xl flex flex-wrap justify-between items-center bg-slate-800/80 border border-slate-700 backdrop-blur-md p-4 rounded-2xl mb-6 shadow-xl gap-4">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 bg-slate-700/60 hover:bg-slate-700 rounded-xl transition text-slate-300">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-black text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-400" />
              ZUNA Mobile App Emulator
            </h1>
            <p className="text-xs text-slate-400">Live preview of mobile/App.tsx inside Chrome</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              const next = activeRole === 'Staff' ? 'Admin' : 'Staff';
              setActiveRole(next);
              showToast(`Switched to ${next} Mobile View`);
            }}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl shadow-lg transition flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            Switch View: {activeRole} Portal
          </button>
        </div>
      </div>

      {/* Realistic Mobile Device Container (iPhone 14 Pro Frame) */}
      <div className="relative w-full max-w-[395px] h-[820px] bg-slate-950 border-[10px] border-slate-800 rounded-[50px] shadow-2xl overflow-hidden flex flex-col border-opacity-90 ring-1 ring-slate-700/50">
        
        {/* Phone Dynamic Island / Speaker Notch */}
        <div className="absolute top-0 inset-x-0 h-7 bg-slate-950 z-50 flex justify-center items-center">
          <div className="w-28 h-4 bg-black rounded-full flex items-center justify-end px-2">
            <div className="w-2 h-2 rounded-full bg-slate-800 border border-slate-700"></div>
          </div>
        </div>

        {/* Mobile Top App Bar (Matching Image 2 Reference) */}
        <div className="pt-8 px-3.5 pb-2.5 bg-white border-b border-slate-200 flex justify-between items-center shadow-sm z-30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-md overflow-hidden p-1.5">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-900 leading-tight">Zuna International Academy</h2>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 fill-emerald-100" /> Official
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">• ZUNA Teacher Mobile Portal</span>
              </div>
            </div>
          </div>

          {isLoggedIn && (
            <div className="flex items-center gap-1.5">
              <div className="w-8 h-8 rounded-full bg-purple-600 text-white font-bold text-[11px] flex items-center justify-center shadow-sm">
                JA
              </div>
              <button 
                onClick={() => {
                  setIsLoggedIn(false);
                  showToast('Logged out of Staff Portal');
                }}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 transition shadow-sm"
                title="Log out">
                <LogOut className="w-4 h-4 text-slate-600" />
              </button>
            </div>
          )}
        </div>

        {/* Toast Banner */}
        {toastMessage && (
          <div className="bg-emerald-600 text-white text-xs font-bold px-3 py-2 text-center animate-fadeIn z-40 shadow-md">
            ✨ {toastMessage}
          </div>
        )}

        {/* Scrollable Mobile Screen Content Area */}
        {!isLoggedIn ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-5 pt-8 text-slate-900 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-600 font-black text-xl shadow-inner overflow-hidden p-2">
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 leading-tight">ZUNA</h2>
                  <p className="text-xs text-slate-500 font-semibold">School Management System</p>
                </div>
              </div>

              <h1 className="text-xl font-black text-slate-900 mb-1">Log in to your account</h1>
              <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                Access your school management tasks, students, and modules seamlessly in one place.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email or Admission No.</label>
                  <input 
                    type="text" 
                    value={loginEmail} 
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="Enter your email or admission number" 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500 shadow-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Password</label>
                  <input 
                    type="password" 
                    value={loginPassword} 
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="Enter your password" 
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-purple-500 shadow-sm"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 font-semibold text-slate-600 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-purple-600 focus:ring-purple-500" />
                    Remember me
                  </label>
                  <a href="#forgot" onClick={(e) => { e.preventDefault(); showToast('Password reset link sent!'); }} className="font-bold text-purple-600 hover:text-purple-700">Forgot password?</a>
                </div>

                <button 
                  onClick={() => {
                    const emailLower = (loginEmail || '').trim().toLowerCase();
                    let role = activeRole;
                    if (emailLower.includes('admin')) {
                      role = 'Admin';
                    } else if (emailLower.includes('teacher') || emailLower.includes('staff')) {
                      role = 'Staff';
                    } else if (emailLower.includes('student')) {
                      role = 'Student';
                    }

                    if (role === 'Student') {
                      showToast('Student Mobile Portal under development in Student branch');
                      return;
                    }

                    setActiveRole(role);
                    setIsLoggedIn(true);
                    setActiveTab('Dashboard');
                    showToast(`Welcome back! Authenticated as ${role === 'Staff' ? 'Teacher' : role}`);
                  }}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-700 active:scale-[0.98] text-white font-bold text-sm rounded-xl shadow-lg shadow-purple-200 transition">
                  Log in
                </button>

                <p className="text-center text-xs text-slate-500 pt-2">
                  Don't have an account? <span className="font-bold text-purple-600 cursor-pointer">Sign up</span>
                </p>
              </div>
            </div>

            <div className="mt-8 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-sm mb-4">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">QUICK DEMO ACCESS</p>
              <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => {
                    setLoginEmail('admin@zuna.edu');
                    setLoginPassword('password123');
                    setActiveRole('Admin');
                    setIsLoggedIn(true);
                    setActiveTab('Dashboard');
                    showToast('Welcome back! Authenticated as Admin');
                  }}
                  className="py-2 px-2 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-purple-600" /> Admin
                </button>
                <button 
                  onClick={() => {
                    setLoginEmail('teacher@zuna.edu');
                    setLoginPassword('password123');
                    setActiveRole('Staff');
                    setIsLoggedIn(true);
                    setActiveTab('Dashboard');
                    showToast('Welcome back! Authenticated as Teacher');
                  }}
                  className="py-2 px-2 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl text-xs font-bold text-purple-700 flex items-center justify-center gap-1 shadow-sm">
                  🎓 Teacher
                </button>
                <button 
                  onClick={() => {
                    setLoginEmail('student@zuna.edu');
                    setLoginPassword('password123');
                    setActiveRole('Student');
                    showToast('Student Mobile Portal under development in Student branch');
                  }}
                  className="py-2 px-2 bg-slate-50 hover:bg-purple-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-600" /> Student
                </button>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 pb-24 text-slate-900">

          
          {/* ================= STAFF TAB: DASHBOARD ================= */}
          {activeTab === 'Dashboard' && (
            <div className="space-y-3.5">
              {/* Complete Your Profile Orange Banner */}
              <div 
                onClick={() => { setActiveTab('All Modules'); setActiveModuleModal('Profile'); }}
                className="bg-orange-500 text-white p-3.5 rounded-2xl shadow-md cursor-pointer flex justify-between items-center">
                <div className="flex-1 pr-3">
                  <h3 className="text-sm font-black mb-1">Complete Your Profile</h3>
                  <p className="text-[11px] text-orange-100 leading-tight">
                    You are 45% complete. Click here to add missing details like address, qualifications, and bank info.
                  </p>
                </div>
                <div className="w-11 h-11 rounded-full border-2 border-white bg-white/20 flex items-center justify-center font-black text-xs text-white">
                  45%
                </div>
              </div>

              {/* Dark Class Dashboard Hero Card */}
              <div className="bg-slate-900 text-white p-4 rounded-2xl shadow-lg">
                <span className="text-[9px] font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-md">📌 My Assigned Class</span>
                <h3 className="text-xl font-black mt-2">Class Dashboard</h3>
                <p className="text-xs text-slate-400">PRE KG - Section A</p>
              </div>

              {/* Stat Summary Cards Grid */}
              <div className="grid grid-cols-4 gap-1.5">
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm text-center">
                  <p className="text-[9px] text-slate-500 font-bold">Class</p>
                  <p className="text-base font-black text-slate-900">3</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm text-center">
                  <p className="text-[9px] text-slate-500 font-bold">Boys</p>
                  <p className="text-base font-black text-purple-700">2</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm text-center">
                  <p className="text-[9px] text-slate-500 font-bold">Girls</p>
                  <p className="text-base font-black text-pink-600">1</p>
                </div>
                <div className="bg-white p-2 rounded-xl border border-slate-100 shadow-sm text-center">
                  <p className="text-[9px] text-slate-500 font-bold">Today</p>
                  <p className="text-sm font-black text-emerald-600">0 / 0</p>
                </div>
              </div>

              {/* Student Roster Section */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Search students..."
                      className="w-full pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none"
                    />
                  </div>
                  <button onClick={() => showToast('Exported roster to Excel')} className="px-3 py-1.5 bg-purple-600 text-white font-bold text-xs rounded-xl flex items-center gap-1">
                    Export
                  </button>
                </div>

                {[
                  { name: 'Ana K', admNo: 'ADM-7', gender: 'Female', route: '03', avatar: 'AK' },
                  { name: 'pavithran a', admNo: '002', gender: 'Male', route: '03', avatar: 'pa' },
                  { name: 'raja a', admNo: 'ADM-2025-003', gender: 'Male', route: '03', avatar: 'ra' },
                ].map((st, i) => (
                  <div key={i} className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-pink-100 text-pink-700 font-bold text-[10px] flex items-center justify-center">
                          {st.avatar}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">{st.name}</p>
                          <p className="text-[10px] text-slate-500">Adm: {st.admNo} • {st.gender}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-500">Bus: Route {st.route}</span>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => showToast(`Grade added for ${st.name}`)} className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100">
                        Add Grade
                      </button>
                      <button onClick={() => { setActiveTab('Attendance'); showToast(`Attendance marked for ${st.name}`); }} className="flex-1 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 hover:bg-slate-100">
                        Attendance
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Access Single Row (Attendance, Fees, Homework, Timetable) */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <h4 className="text-xs font-bold text-slate-800 mb-2.5">Quick Access</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Attendance', action: () => setActiveTab('Attendance'), icon: Calendar, bg: 'bg-emerald-50 text-emerald-600' },
                    { label: 'Fees', action: () => { setActiveTab('All Modules'); setActiveModuleModal('My Salary'); showToast('Opened Fees'); }, icon: DollarSign, bg: 'bg-teal-50 text-teal-600' },
                    { label: 'Homework', action: () => setActiveTab('Homework'), icon: BookOpen, bg: 'bg-purple-50 text-purple-600' },
                    { label: 'Timetable', action: () => { setActiveTab('All Modules'); setActiveModuleModal('Timetable'); }, icon: Clock, bg: 'bg-blue-50 text-blue-600' },
                  ].map((m, idx) => {
                    const IconComponent = m.icon;
                    return (
                      <button
                        key={idx}
                        onClick={m.action}
                        className="flex flex-col items-center justify-center p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${m.bg} mb-1`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-800 leading-tight text-center">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Today's Schedule Overview */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-xs font-bold text-slate-800">Today's Class Schedule</h4>
                  <button onClick={() => { setActiveTab('All Modules'); setActiveModuleModal('Timetable'); }} className="text-[11px] font-bold text-purple-600">Full Timetable →</button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Class 10A • Mathematics</p>
                    <p className="text-[10px] text-slate-500">08:30 - 09:15 AM • Room 302</p>
                  </div>
                  <button onClick={() => { setActiveTab('Attendance'); showToast('Opened Attendance'); }} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold">
                    Mark
                  </button>
                </div>

                <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-900">Class 10B • Physics</p>
                    <p className="text-[10px] text-slate-500">09:15 - 10:00 AM • Room 204</p>
                  </div>
                  <button onClick={() => { setActiveTab('Attendance'); showToast('Opened Attendance'); }} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold">
                    Mark
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ================= STAFF TAB: TIMETABLE ================= */}
          {activeTab === 'Timetable' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">Daily Schedule & Timetable</h3>
                <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-bold">Mon - Fri</span>
              </div>

              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${selectedDay === day ? 'bg-purple-600 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                    {day}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {[
                  { time: '08:30 - 09:15 AM', class: 'Class 10A', subject: 'Mathematics', room: 'Room 302', status: 'Upcoming' },
                  { time: '09:15 - 10:00 AM', class: 'Class 10B', subject: 'Physics', room: 'Lab 2', status: 'Upcoming' },
                  { time: '10:15 - 11:00 AM', class: 'Class 11A', subject: 'Applied Mathematics', room: 'Room 401', status: 'Upcoming' },
                  { time: '11:45 - 12:30 PM', class: 'Class 9C', subject: 'Physics Practical', room: 'Lab 1', status: 'Completed' },
                ].map((item, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.class} • {item.subject}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">{item.time} • {item.room}</p>
                    </div>
                    <button 
                      onClick={() => { setActiveTab('Attendance'); showToast(`Attendance opened for ${item.class}`); }}
                      className="px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-lg shadow-sm">
                      Mark
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= STAFF TAB: ATTENDANCE (MATCHING SCREENSHOT 1) ================= */}
          {activeTab === 'Attendance' && (
            <div className="space-y-3">
              {/* Purple Hero Card */}
              <div className="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 rounded-2xl shadow-lg">
                <span className="text-[9px] font-bold bg-white/20 px-2 py-0.5 rounded-md">📌 My Assigned Class</span>
                <h3 className="text-xl font-black mt-2">Attendance Manager</h3>
                <p className="text-xs text-purple-200">PRE KG - Section A</p>
              </div>

              {/* Mark Attendance Header & Controls */}
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
                <h4 className="text-xs font-bold text-slate-900">Mark Attendance</h4>
                <p className="text-[10px] text-slate-500">Select date/session to register or view class attendance statistics.</p>

                <div className="grid grid-cols-3 gap-1 text-[9px] font-bold text-slate-700">
                  <select className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-[9px]">
                    <option>Daily Marking</option>
                  </select>
                  <input type="text" value="08-09-2026" readOnly className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-[9px] text-center" />
                  <select className="bg-slate-50 border border-slate-200 p-1.5 rounded-xl text-[9px]">
                    <option>FN (Forenoon)</option>
                  </select>
                </div>

                {/* Yellow Alert Banner */}
                <div className="bg-amber-50 border border-amber-200 p-2 rounded-xl text-[10px] text-amber-800 flex items-start gap-1.5">
                  <span>⚠️</span>
                  <div>
                    <span className="font-bold">Attendance not marked — past cutoff (09:30)</span>
                    <p className="text-[9px] text-amber-700">New marks will default to Late. Teachers can still mark attendance manually.</p>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-bold text-slate-700">👥 3 Students</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => showToast('Exported attendance roster')} className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg">Export</button>
                    <button onClick={() => showToast('Attendance Saved to Server!')} className="px-2 py-1 bg-purple-600 text-white text-[10px] font-bold rounded-lg">Save Attendance</button>
                  </div>
                </div>

                {/* Student Roster Table */}
                <div className="space-y-1.5 pt-1">
                  {[
                    { name: 'Anu K', admNo: 'ADM-7', status: 'Present' },
                    { name: 'pavithran a', admNo: '002', status: 'Present' },
                    { name: 'raja a', admNo: 'ADM-2025-003', status: 'Late' },
                  ].map((st, i) => (
                    <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{st.name}</p>
                        <p className="text-[9px] text-slate-400">{st.admNo}</p>
                      </div>
                      <div className="flex gap-1">
                        {['Present', 'Absent', 'Late'].map(stt => (
                          <button
                            key={stt}
                            onClick={() => showToast(`${st.name} marked as ${stt}`)}
                            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${stt === 'Present' ? 'bg-emerald-100 text-emerald-700' : stt === 'Absent' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                            {stt}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= STAFF TAB: HOMEWORK ================= */}
          {activeTab === 'Homework' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">Homework & Assignments</h3>
                <button onClick={() => setShowAssignModal(true)} className="px-2.5 py-1 bg-purple-600 text-white rounded-xl text-[10px] font-bold flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Assign
                </button>
              </div>

              <div className="space-y-2.5">
                {homeworkList.map(hw => (
                  <div key={hw.id} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{hw.grade} • {hw.subject}</span>
                      <span className="text-[10px] text-slate-400 font-medium">Due: {hw.dueDate}</span>
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">{hw.title}</h4>
                    <p className="text-[11px] text-slate-500">Submissions: <span className="font-bold text-emerald-600">{hw.submissions}</span></p>
                    <button onClick={() => showToast(`Reviewing ${hw.title}`)} className="w-full py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold">
                      Grade Submissions
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= STAFF TAB: MESSAGES ================= */}
          {activeTab === 'Messages' && (
            <div className="space-y-3">
              <h3 className="text-sm font-black text-slate-900">Staff Inbox</h3>
              <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {chatList.map(chat => (
                  <div key={chat.id} onClick={() => setActiveChat(chat)} className="p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-slate-50 rounded-xl transition">
                    <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                      {chat.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-bold text-slate-900 truncate">{chat.name}</p>
                        <span className="text-[9px] text-slate-400">{chat.time}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{chat.lastMsg}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= STAFF TAB: 📂 ALL MODULES ================= */}
          {activeTab === 'All Modules' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-black text-slate-900">All Modules</h3>
                <span className="text-xs text-slate-500 font-medium">{filteredModules.length} Available Modules</span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={moduleSearch}
                  onChange={(e) => {
                    setModuleSearch(e.target.value);
                    setStaffModulePage(1);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-purple-500 shadow-sm"
                />
              </div>

              {/* 2-Column 12 Modules Grid with Line Icons (Matching Reference Image) */}
              <div className="grid grid-cols-2 gap-2.5">
                {paginatedModules.map(mod => {
                  const IconComp = mod.icon;
                  return (
                    <div
                      key={mod.id}
                      onClick={() => {
                        setActiveModuleModal(mod.name);
                        showToast(`Opened ${mod.name} Module`);
                      }}
                      className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm cursor-pointer hover:border-purple-300 transition flex flex-col justify-between min-h-[96px] group">
                      <div className="flex justify-between items-center w-full">
                        <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                          <IconComp className="w-5 h-5" />
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-purple-600 transition" />
                      </div>
                      <p className="text-xs font-bold text-slate-900 leading-tight text-left mt-2.5">{mod.name}</p>
                    </div>
                  );
                })}
              </div>

              {/* Reference Image Pagination Controls */}
              <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between text-xs font-semibold text-slate-600">
                <span className="text-[10px]">
                  Showing <span className="font-bold text-slate-900">{(staffModulePage - 1) * PAGE_SIZE + 1}–{Math.min(staffModulePage * PAGE_SIZE, filteredModules.length)}</span> of <span className="font-bold text-slate-900">{filteredModules.length}</span>
                </span>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setStaffModulePage(prev => Math.max(prev - 1, 1))}
                    disabled={staffModulePage === 1}
                    className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setStaffModulePage(1)}
                    className={`w-6 h-6 rounded-lg text-[10px] font-bold ${staffModulePage === 1 ? 'bg-purple-600 text-white' : 'border border-slate-200 hover:bg-slate-100'}`}>
                    1
                  </button>

                  {totalPages > 1 && (
                    <button
                      onClick={() => setStaffModulePage(2)}
                      className={`w-6 h-6 rounded-lg text-[10px] font-bold ${staffModulePage === 2 ? 'bg-purple-600 text-white' : 'border border-slate-200 hover:bg-slate-100'}`}>
                      2
                    </button>
                  )}

                  <button
                    onClick={() => setStaffModulePage(prev => Math.min(prev + 1, totalPages))}
                    disabled={staffModulePage === totalPages}
                    className="w-6 h-6 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <span className="text-[10px] font-bold border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-600">10 / page ▾</span>
              </div>
            </div>
          )}
        </div>

        {/* FLOATING MOBILE BOTTOM NAVIGATION BAR (EXACTLY 5 TABS MATCHING MASTER INSTRUCTIONS) */}
        <div className="absolute bottom-3 inset-x-3 z-40">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl rounded-3xl p-1.5 flex justify-around items-center">
            {[
              { id: 'Dashboard', label: 'Dashboard', icon: Grid },
              { id: 'Timetable', label: 'Timetable', icon: Clock },
              { id: 'Attendance', label: 'Attendance', icon: Calendar },
              { id: 'Homework', label: 'Homework', icon: BookOpen },
              { id: 'All Modules', label: 'All Modules', icon: Grid },
            ].map(tab => {
              const TabIcon = tab.icon;
              const isActive = activeTab === tab.id && !activeModuleModal;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setActiveModuleModal(null); }}
                  className={`flex flex-col items-center px-2.5 py-1 rounded-2xl transition ${isActive ? 'bg-purple-100 text-purple-700' : 'text-slate-500 hover:text-slate-800'}`}>
                  <TabIcon className="w-4 h-4" />
                  <span className="text-[9px] font-bold mt-0.5 leading-none">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    )}

        {/* FULL MOBILE MODULE SCREEN VIEW (COVERING 100% OF MOBILE APP VIEW SIZE) */}
        {activeModuleModal && (
          <div className="absolute inset-0 bg-slate-50 z-50 flex flex-col animate-fadeIn">
            
            {/* Full Screen Header Bar */}
            <div className="pt-8 px-4 pb-3 bg-purple-600 text-white flex justify-between items-center shadow-md">
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setActiveModuleModal(null)}
                  className="p-1 hover:bg-purple-700 rounded-xl transition">
                  <ArrowLeft className="w-5 h-5 text-white" />
                </button>
                <h4 className="text-sm font-black text-white">{activeModuleModal}</h4>
              </div>
              <button 
                onClick={() => setActiveModuleModal(null)}
                className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white font-bold text-[10px] rounded-lg">
                Back
              </button>
            </div>

            {/* Scrollable Module Body */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-3.5 pb-16">
              
              {/* ================= 1. NOTICEBOARD (MATCHING SCREENSHOT 2) ================= */}
              {(activeModuleModal === 'Noticeboard' || activeModuleModal === 'Notice Board') && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-5 h-5 text-purple-600" />
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Noticeboard</h3>
                      <p className="text-[11px] text-slate-500">View official announcements and broadcast messages to your class.</p>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500 pt-1">
                    <button 
                      onClick={() => setNoticeTab('Global Notices')}
                      className={`pb-2 transition ${noticeTab === 'Global Notices' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400 hover:text-slate-700'}`}>
                      Global Notices
                    </button>
                    <button 
                      onClick={() => setNoticeTab('Class Noticeboard')}
                      className={`pb-2 transition ${noticeTab === 'Class Noticeboard' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400 hover:text-slate-700'}`}>
                      Class Noticeboard
                    </button>
                  </div>

                  {/* Added Notices List or Empty State (Screenshot 2) */}
                  {noticesList.length > 0 ? (
                    <div className="space-y-2">
                      {noticesList.map((n, i) => (
                        <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{noticeTab}</span>
                            <span className="text-[9px] text-slate-400">Just now</span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900">{n.title}</h4>
                          <p className="text-[11px] text-slate-600">{n.content}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-4">
                      <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                        <Megaphone className="w-7 h-7 stroke-[1.5]" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">No active notices</h4>
                      <p className="text-xs text-slate-400">You're all caught up!</p>
                    </div>
                  )}

                  <button 
                    onClick={() => setShowBroadcastModal(true)}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition">
                    + Broadcast New Notice
                  </button>
                </div>
              )}

              {/* ================= 2. ACADEMIC CALENDAR (MATCHING SCREENSHOT 3) ================= */}
              {(activeModuleModal === 'Calendar' || activeModuleModal === 'Academic Calendar') && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-black text-slate-900">Academic Calendar</h3>
                    <button onClick={() => showToast('Today selected: Sep 08, 2026')} className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold">Today</button>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 border border-slate-200 rounded-xl px-2 py-1 bg-slate-50">
                        <ChevronLeft className="w-3.5 h-3.5 text-slate-600 cursor-pointer" onClick={() => showToast('Previous month')} />
                        <span className="text-xs font-black text-slate-900">September 2026</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-600 cursor-pointer" onClick={() => showToast('Next month')} />
                      </div>
                      <div className="flex items-center gap-1.5 text-[8px] font-bold text-slate-500">
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-pink-500"></span>EVENT</span>
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>HOLIDAY</span>
                        <span className="flex items-center gap-0.5"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>EXAM</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-7 text-center text-[9px] font-black text-slate-400 border-b border-slate-100 pb-1">
                      <span>SUN</span><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span>
                    </div>

                    <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-700">
                      <div className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] flex flex-col items-center">
                        <span>30</span>
                        <span className="text-[7px] font-bold bg-rose-500 text-white px-0.5 rounded leading-none mt-0.5">Sunday</span>
                      </div>
                      <span className="p-1">31</span><span className="p-1">01</span><span className="p-1">02</span><span className="p-1">03</span><span className="p-1">04</span><span className="p-1">05</span>
                      
                      <div className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] flex flex-col items-center">
                        <span>06</span>
                        <span className="text-[7px] font-bold bg-rose-500 text-white px-0.5 rounded leading-none mt-0.5">Sunday</span>
                      </div>
                      <span className="p-1">07</span>
                      <span className="p-1 bg-blue-100 text-blue-800 rounded-lg font-black">08</span>
                      <span className="p-1">09</span><span className="p-1">10</span><span className="p-1">11</span><span className="p-1">12</span>

                      <div className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] flex flex-col items-center">
                        <span>13</span>
                        <span className="text-[7px] font-bold bg-rose-500 text-white px-0.5 rounded leading-none mt-0.5">Sunday</span>
                      </div>
                      <span className="p-1">14</span><span className="p-1">15</span><span className="p-1">16</span><span className="p-1">17</span><span className="p-1">18</span><span className="p-1">19</span>

                      <div className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] flex flex-col items-center">
                        <span>20</span>
                        <span className="text-[7px] font-bold bg-rose-500 text-white px-0.5 rounded leading-none mt-0.5">Sunday</span>
                      </div>
                      <span className="p-1">21</span><span className="p-1">22</span><span className="p-1">23</span><span className="p-1">24</span><span className="p-1">25</span><span className="p-1">26</span>

                      <div className="p-1 bg-rose-50 text-rose-600 rounded-lg text-[9px] flex flex-col items-center">
                        <span>27</span>
                        <span className="text-[7px] font-bold bg-rose-500 text-white px-0.5 rounded leading-none mt-0.5">Sunday</span>
                      </div>
                      <span className="p-1">28</span><span className="p-1">29</span><span className="p-1">30</span><span className="p-1 text-slate-300">01</span><span className="p-1 text-slate-300">02</span><span className="p-1 text-slate-300">03</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 3. LESSON PLANS (MATCHING SCREENSHOT 4) ================= */}
              {activeModuleModal === 'Lesson Plans' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-purple-600" /> Lesson Plans
                      </h3>
                      <p className="text-[11px] text-slate-500">Create, organize, and track daily lesson plans.</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setShowNewPlanModal(true)} className="px-2 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold">+ New Plan</button>
                      <button onClick={() => showToast('Exported Lesson Plans')} className="px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-[10px] font-bold">Export</button>
                    </div>
                  </div>

                  <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500 pt-1">
                    <button 
                      onClick={() => setLessonTab('Upcoming Lessons')}
                      className={`pb-2 transition ${lessonTab === 'Upcoming Lessons' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400 hover:text-slate-700'}`}>
                      Upcoming Lessons
                    </button>
                    <button 
                      onClick={() => setLessonTab('Past Lessons')}
                      className={`pb-2 transition ${lessonTab === 'Past Lessons' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-slate-400 hover:text-slate-700'}`}>
                      Past Lessons
                    </button>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Search by topic or subject..." className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs" />
                  </div>

                  {lessonPlansList.length > 0 ? (
                    <div className="space-y-2">
                      {lessonPlansList.map((lp, i) => (
                        <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-1">
                          <h4 className="text-xs font-bold text-slate-900">{lp.topic}</h4>
                          <p className="text-[10px] text-slate-500">{lp.grade} • {lp.subject}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                        <BookOpen className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-400">No lesson plans found.</h4>
                    </div>
                  )}
                </div>
              )}

              {/* ================= 4. DIGITAL RESOURCES (MATCHING SCREENSHOT 5) ================= */}
              {activeModuleModal === 'Resources' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <FolderOpen className="w-4 h-4 text-purple-600" /> Digital Resources
                      </h3>
                      <p className="text-[11px] text-slate-500">Upload study materials, notes, and links.</p>
                    </div>
                    <button onClick={() => setShowAddResourceModal(true)} className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold">+ Add Resource</button>
                  </div>

                  <div className="flex gap-1.5 overflow-x-auto text-[10px] font-bold text-slate-500 pb-1">
                    {['All Files', 'Documents', 'Videos', 'Links', 'Images'].map(cat => (
                      <button
                        key={cat}
                        onClick={() => setResourceTab(cat)}
                        className={`px-2.5 py-1 rounded-full border transition ${resourceTab === cat ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-slate-600 border-slate-200'}`}>
                        {cat}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Search resources..." className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs" />
                  </div>

                  {resourcesList.length > 0 ? (
                    <div className="space-y-2">
                      {resourcesList.map((res, i) => (
                        <div key={i} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900">{res.title}</h4>
                            <p className="text-[10px] text-slate-500">{res.category}</p>
                          </div>
                          <button onClick={() => showToast(`Downloaded ${res.title}`)} className="px-2 py-1 bg-purple-100 text-purple-700 text-[10px] font-bold rounded-lg">Download</button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-4">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                        <FolderOpen className="w-6 h-6 stroke-[1.5]" />
                      </div>
                      <h4 className="text-xs font-bold text-slate-400">No resources found.</h4>
                    </div>
                  )}
                </div>
              )}

              {/* ================= 5. PERFORMANCE (MATCHING SCREENSHOT 3) ================= */}
              {(activeModuleModal === 'Performance' || activeModuleModal === 'Reports & Analytics') && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Student Performance</h3>
                      <p className="text-[10px] text-slate-500">Track academic progress and attendance trends dynamically.</p>
                    </div>
                    <button onClick={() => showToast('Exported performance report')} className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold">Export</button>
                  </div>

                  {/* 3 Stat Cards (Screenshot 3) */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <p className="text-[9px] text-slate-500 font-bold">Class Average</p>
                      <p className="text-xs font-black text-slate-400 mt-1">— No data</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <p className="text-[9px] text-slate-500 font-bold">Students at Risk</p>
                      <p className="text-base font-black text-rose-600">0</p>
                    </div>
                    <div className="bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm text-center">
                      <p className="text-[9px] text-slate-500 font-bold">Avg Attendance</p>
                      <p className="text-base font-black text-slate-900">0%</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Search students..." className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs" />
                  </div>

                  {/* Student Performance Roster Table */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm space-y-2">
                    {[
                      { name: 'raja a', adm: 'ADM-2025-003', att: '0%', exam: '—', grade: '—', trend: 'STABLE' },
                      { name: 'Anu K', adm: 'ADM-7', att: '0%', exam: '—', grade: '—', trend: 'STABLE' },
                      { name: 'pavithran a', adm: '002', att: '0%', exam: '—', grade: '—', trend: 'STABLE' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{row.name}</p>
                          <p className="text-[9px] text-slate-400">{row.adm}</p>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                          <span className="text-rose-600 font-bold">{row.att}</span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 font-bold text-[9px] rounded-md">{row.trend}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= 6. PTM SCHEDULER (MATCHING SCREENSHOT 4) ================= */}
              {activeModuleModal === 'PTM Scheduler' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-1">
                        <Users className="w-4 h-4 text-purple-600" /> PTM Scheduler
                      </h3>
                      <p className="text-[10px] text-slate-500">Manage Parent-Teacher Meetings and set availability.</p>
                    </div>
                    <button onClick={() => showToast('Book Meeting Modal')} className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold">+ Book Meeting</button>
                  </div>

                  <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500 pt-1">
                    <button className="pb-2 text-purple-600 border-b-2 border-purple-600">Upcoming Meetings</button>
                    <button className="pb-2 text-slate-400 hover:text-slate-700">Past Meetings</button>
                  </div>

                  {/* Empty State (Screenshot 4) */}
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-4">
                    <h4 className="text-xs font-bold text-slate-400">No meetings found in this category.</h4>
                  </div>
                </div>
              )}

              {/* ================= 7. TRANSPORT (MATCHING SCREENSHOT 5) ================= */}
              {activeModuleModal === 'Transport' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <Bus className="w-4 h-4 text-purple-600" /> Student Transport Details
                    </h3>
                    <p className="text-[10px] text-slate-500 font-bold">PRE KG - Section A</p>
                  </div>

                  {/* 2 Stat Cards (Screenshot 5) */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[9px] text-slate-500 font-bold">Total Class Strength</p>
                      <p className="text-base font-black text-slate-900 mt-0.5">3</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                      <p className="text-[9px] text-slate-500 font-bold">Using School Transport</p>
                      <p className="text-base font-black text-purple-700 mt-0.5">0</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Search by student name, route..." className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-200 rounded-xl text-xs" />
                  </div>

                  {/* Transport Student List */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-2.5 shadow-sm space-y-2">
                    {[
                      { name: 'Anu K', adm: 'ADM-7', route: 'Self Transport' },
                      { name: 'pavithran a', adm: '002', route: 'Self Transport' },
                      { name: 'raja a', adm: 'ADM-2025-003', route: 'Self Transport' },
                    ].map((st, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{st.name}</p>
                          <p className="text-[9px] text-slate-400">{st.adm}</p>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">{st.route}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= 8. GRADES & EXAMS (MATCHING SCREENSHOT 11) ================= */}
              {(activeModuleModal === 'Grades & Exams' || activeModuleModal === 'Grades & Assessments') && (
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-purple-600" /> Grades & Assessments
                      </h3>
                      <p className="text-[10px] text-slate-500">Create exams and log student performance.</p>
                    </div>
                  </div>

                  <div className="flex gap-1 overflow-x-auto text-[9px] font-bold pb-1">
                    <button onClick={() => showToast('Published to Parent Portal')} className="px-2 py-1 border border-emerald-500 text-emerald-700 bg-emerald-50 rounded-lg flex items-center gap-1 flex-shrink-0">
                      <Send className="w-3 h-3 text-emerald-600" /> Publish to Parent Portal
                    </button>
                    <button onClick={() => showToast('Report cards printed')} className="px-2 py-1 border border-pink-400 text-pink-700 bg-pink-50 rounded-lg flex-shrink-0">
                      Print Report Cards
                    </button>
                    <button onClick={() => showToast('New Assessment Modal')} className="px-2 py-1 bg-purple-600 text-white rounded-lg flex-shrink-0">
                      + New Assessment
                    </button>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-2">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                      <FileText className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">Select an Assessment</h4>
                    <p className="text-[10px] text-slate-400">Choose an assessment from the roster or create a new one to start grading.</p>
                  </div>
                </div>
              )}

              {/* ================= 9. PARENT MESSAGING (MATCHING SCREENSHOT 12) ================= */}
              {(activeModuleModal === 'Messages' || activeModuleModal === 'Parent Messaging') && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-purple-600" /> Parent Messaging
                    </h3>
                    <p className="text-[10px] text-slate-500">Communicate directly with parents of your students.</p>
                  </div>

                  <div className="flex border-b border-slate-200 gap-4 text-xs font-bold text-slate-500 pt-1">
                    <button className="pb-2 text-purple-600 border-b-2 border-purple-600">DMs</button>
                    <button className="pb-2 text-slate-400 hover:text-slate-700">Channels</button>
                  </div>

                  <div className="space-y-2">
                    {[
                      { name: 'Anu K', role: 'Parent Chat', avatar: 'AK' },
                      { name: 'pavithran a', role: 'Parent Chat', avatar: 'pa' },
                      { name: 'raja a', role: 'Parent Chat', avatar: 'ra' },
                    ].map((chat, i) => (
                      <div key={i} onClick={() => { setActiveChat({ name: chat.name, lastMsg: 'Parent conversation thread' }); showToast(`Chat opened for ${chat.name}`); }} className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 cursor-pointer hover:border-purple-300">
                        <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                          {chat.avatar}
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-bold text-slate-900">{chat.name}</p>
                          <p className="text-[10px] text-slate-400">{chat.role}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ================= 10. MY SALARY & PAYSLIPS (MATCHING SCREENSHOT 13) ================= */}
              {(activeModuleModal === 'My Salary' || activeModuleModal === 'Salary') && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <DollarSign className="w-4 h-4 text-emerald-600" /> My Salary & Payslips
                    </h3>
                    <p className="text-[10px] text-slate-500">View your monthly salary details, deductions, and download payslips.</p>
                  </div>

                  {/* Empty State / Table (Screenshot 13) */}
                  <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-2 shadow-sm my-4">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                      <DollarSign className="w-6 h-6 stroke-[1.5]" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-900">No Payroll Records</h4>
                    <p className="text-[10px] text-slate-400">Your salary records will appear here once processed by the admin.</p>
                  </div>
                </div>
              )}

              {/* ================= 11. LEAVE REQUESTS (MATCHING SCREENSHOT 14) ================= */}
              {(activeModuleModal === 'Leave Requests' || activeModuleModal === 'Leaves') && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-purple-600" /> Leave Requests
                      </h3>
                      <p className="text-[10px] text-slate-500">Apply for leaves and track your approval status.</p>
                    </div>
                    <button onClick={() => showToast('Request Leave Modal')} className="px-2.5 py-1 bg-purple-600 text-white rounded-lg text-[10px] font-bold">+ Request Leave</button>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-bold text-slate-900">Leave History</h4>
                      <span className="text-[10px] text-slate-400 font-bold">0 Applications</span>
                    </div>

                    {/* Screenshot 14 Empty State */}
                    <div className="py-6 text-center space-y-2">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
                        <Calendar className="w-5 h-5 stroke-[1.5]" />
                      </div>
                      <p className="text-xs text-slate-400 font-bold">No leave requests submitted yet.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* ================= 12. PROFILE SETUP (MATCHING SCREENSHOT 15) ================= */}
              {activeModuleModal === 'Profile' && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <User className="w-4 h-4 text-purple-600" /> Profile Setup
                    </h3>
                    <p className="text-[10px] text-slate-500">Complete your profile to update all professional, banking, and personal details.</p>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <h4 className="text-xs font-black text-purple-600 border-b border-slate-100 pb-1">Personal Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <label className="font-bold text-slate-600">Date of Birth</label>
                        <input type="text" defaultValue="08-09-2026" className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600">Gender</label>
                        <select className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
                          <option>Male</option>
                          <option>Female</option>
                        </select>
                      </div>
                      <div>
                        <label className="font-bold text-slate-600">Blood Group</label>
                        <input type="text" defaultValue="A+" className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600">Mobile Number</label>
                        <input type="text" defaultValue="9876543210" className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm space-y-2">
                    <h4 className="text-xs font-black text-purple-600 border-b border-slate-100 pb-1">Educational & Professional</h4>
                    <div className="space-y-2 text-[10px]">
                      <div>
                        <label className="font-bold text-slate-600">Higher Qualification</label>
                        <input type="text" defaultValue="M.Sc, M.Ed" className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      </div>
                      <div>
                        <label className="font-bold text-slate-600">Subject Specialization</label>
                        <input type="text" defaultValue="Physics / Mathematics" className="w-full mt-1 p-1.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      </div>
                    </div>
                  </div>

                  <button 
                    onClick={() => showToast('Profile details saved successfully!')} 
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow">
                    Save Profile Details
                  </button>
                </div>
              )}

              {/* ================= DEFAULT OTHER MODULES ================= */}
              {!['Noticeboard', 'Notice Board', 'Calendar', 'Academic Calendar', 'Lesson Plans', 'Resources', 'Performance', 'Reports & Analytics', 'PTM Scheduler', 'Transport', 'Grades & Exams', 'Grades & Assessments', 'Messages', 'Parent Messaging', 'My Salary', 'Salary', 'Leave Requests', 'Leaves', 'Profile'].includes(activeModuleModal) && (
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2">
                    <h3 className="text-sm font-black text-slate-900">{activeModuleModal} Module Details</h3>
                    <p className="text-xs text-slate-600">Comprehensive management workflows for {activeModuleModal} synced with ZUNA Web Portal.</p>
                    <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">Synced & Active</span>
                      <button onClick={() => showToast(`Performed action in ${activeModuleModal}`)} className="px-3 py-1 bg-purple-600 text-white text-xs font-bold rounded-lg">
                        Manage {activeModuleModal}
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

      </div>

      {/* Interactive Form Modals */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-slate-900 shadow-2xl space-y-3">
            <h4 className="text-sm font-black text-slate-900">+ Broadcast New Notice</h4>
            <input
              type="text"
              placeholder="Notice Title"
              value={newNoticeTitle}
              onChange={(e) => setNewNoticeTitle(e.target.value)}
              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowBroadcastModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
              <button onClick={() => {
                if (newNoticeTitle.trim()) {
                  setNoticesList(prev => [{ title: newNoticeTitle, content: 'Official staff announcement broadcasted to assigned classes.' }, ...prev]);
                  setShowBroadcastModal(false);
                  setNewNoticeTitle('');
                  showToast(`Notice Broadcasted: ${newNoticeTitle}`);
                }
              }} className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl">Broadcast</button>
            </div>
          </div>
        </div>
      )}

      {showNewPlanModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-slate-900 shadow-2xl space-y-3">
            <h4 className="text-sm font-black text-slate-900">+ Create Lesson Plan</h4>
            <input
              type="text"
              placeholder="Lesson Topic / Chapter"
              value={newPlanTopic}
              onChange={(e) => setNewPlanTopic(e.target.value)}
              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowNewPlanModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
              <button onClick={() => {
                if (newPlanTopic.trim()) {
                  setLessonPlansList(prev => [{ topic: newPlanTopic, grade: 'Class 10A', subject: 'Physics' }, ...prev]);
                  setShowNewPlanModal(false);
                  setNewPlanTopic('');
                  showToast(`Lesson Plan Created: ${newPlanTopic}`);
                }
              }} className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl">Save Plan</button>
            </div>
          </div>
        </div>
      )}

      {showAddResourceModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-slate-900 shadow-2xl space-y-3">
            <h4 className="text-sm font-black text-slate-900">+ Upload Digital Resource</h4>
            <input
              type="text"
              placeholder="Resource Title / File Name"
              value={newResourceTitle}
              onChange={(e) => setNewResourceTitle(e.target.value)}
              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAddResourceModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
              <button onClick={() => {
                if (newResourceTitle.trim()) {
                  setResourcesList(prev => [{ title: newResourceTitle, category: resourceTab }, ...prev]);
                  setShowAddResourceModal(false);
                  setNewResourceTitle('');
                  showToast(`Resource Uploaded: ${newResourceTitle}`);
                }
              }} className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl">Upload</button>
            </div>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-slate-900 shadow-2xl space-y-3">
            <h4 className="text-base font-black text-slate-900">Assign New Homework</h4>
            <input
              type="text"
              placeholder="Assignment Title"
              value={newHw.title}
              onChange={(e) => setNewHw({ ...newHw, title: e.target.value })}
              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Cancel</button>
              <button onClick={() => {
                if (newHw.title.trim()) {
                  setHomeworkList(prev => [{ id: Date.now().toString(), title: newHw.title, grade: 'Class 10A', subject: 'Physics', dueDate: 'Sep 12, 2026', submissions: '0 Submitted' }, ...prev]);
                  setShowAssignModal(false);
                  showToast(`Assigned ${newHw.title}`);
                }
              }} className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl">Assign</button>
            </div>
          </div>
        </div>
      )}

      {activeChat && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex justify-center items-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-xs w-full text-slate-900 shadow-2xl space-y-3">
            <h4 className="text-base font-black text-slate-900">{activeChat.name}</h4>
            <div className="p-3 bg-slate-100 rounded-2xl text-xs text-slate-700">{activeChat.lastMsg}</div>
            <input
              type="text"
              placeholder="Type response..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="w-full p-2 bg-slate-100 border border-slate-200 rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <button onClick={() => setActiveChat(null)} className="flex-1 py-2 bg-slate-200 text-slate-700 font-bold text-xs rounded-xl">Close</button>
              <button onClick={() => { showToast(`Message sent to ${activeChat.name}`); setActiveChat(null); }} className="flex-1 py-2 bg-purple-600 text-white font-bold text-xs rounded-xl">Send</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
