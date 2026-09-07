import React, { useState, useEffect } from 'react';
import {
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Share,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';

// --- Types ---
type Role = 'Admin' | 'Teacher' | 'Student';
type AdminTab = 'Dashboard' | 'Students' | 'Attendance' | 'Fees' | 'All Modules';

interface StudentItem {
  id: string;
  name: string;
  grade: string;
  rollNo: string;
  attendanceStatus: 'Present' | 'Absent' | 'OD';
  feePaid: boolean;
}

interface FacultyItem {
  id: string;
  name: string;
  subject: string;
  role: string;
  email: string;
}

interface LeaveRequest {
  id: string;
  teacherName: string;
  reason: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

interface ModuleItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// Icon Helper Component with Graceful Fallback (Prevents null / missing icons)
const IconComp = ({ name, size = 20, color = '#64748B' }: { name: string; size?: number; color?: string }) => {
  try {
    return <Ionicons name={name || 'square-outline'} size={size} color={color || '#64748B'} />;
  } catch (e) {
    return <Text style={{ fontSize: size * 0.7, color: color || '#64748B' }}>●</Text>;
  }
};

function App() {
  // --- App State ---
  const [isSplashVisible, setIsSplashVisible] = useState<boolean>(true);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // --- Navigation & Role States ---
  const [activeRole, setActiveRole] = useState<Role>('Admin');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('Dashboard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Modals ---
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [showFacultyModal, setShowFacultyModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [activeModuleModal, setActiveModuleModal] = useState<string | null>(null);

  // --- Filters & Search ---
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');
  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'Present' | 'Absent' | 'OD'>('All');

  // --- Student Registration State ---
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Class 10A');
  const [newStudentRollNo, setNewStudentRollNo] = useState('');
  const [newStudentFeePaid, setNewStudentFeePaid] = useState(true);

  // --- Faculty Onboarding State ---
  const [newFacultyName, setNewFacultyName] = useState('');
  const [newFacultySubject, setNewFacultySubject] = useState('');

  const [facultyCount, setFacultyCount] = useState(28);

  // --- Sample Data ---
  const [students, setStudents] = useState<StudentItem[]>([
    { id: '1', name: 'Rahul Kumar', grade: 'Class 10', rollNo: '101', attendanceStatus: 'Present', feePaid: true },
    { id: '2', name: 'Priya Sharma', grade: 'Class 10', rollNo: '102', attendanceStatus: 'Present', feePaid: true },
    { id: '3', name: 'Aarav Singh', grade: 'Class 10', rollNo: '103', attendanceStatus: 'Absent', feePaid: false },
    { id: '4', name: 'Ananya Reddy', grade: 'Class 11', rollNo: '104', attendanceStatus: 'Present', feePaid: true },
    { id: '5', name: 'Vikram Patel', grade: 'Class 11', rollNo: '105', attendanceStatus: 'OD', feePaid: true },
    { id: '6', name: 'Sneha Iyer', grade: 'Class 12', rollNo: '106', attendanceStatus: 'Present', feePaid: true },
    { id: '7', name: 'Karthik S', grade: 'Class 12', rollNo: '107', attendanceStatus: 'Present', feePaid: false },
  ]);

  // --- 21 Admin Modules for "All Modules" Grid ---
  const allModulesList: ModuleItem[] = [
    { id: 'm1', name: 'Canteen Requests', icon: 'fast-food-outline', color: '#0284C7' },
    { id: 'm2', name: 'Environment Setup', icon: 'settings-outline', color: '#059669' },
    { id: 'm3', name: 'Classes & Sections', icon: 'school-outline', color: '#2563EB' },
    { id: 'm4', name: 'HR & Payroll', icon: 'people-circle-outline', color: '#7C3AED' },
    { id: 'm5', name: 'Chat Monitor', icon: 'chatbubbles-outline', color: '#0D9488' },
    { id: 'm6', name: 'Timetables', icon: 'time-outline', color: '#D97706' },
    { id: 'm7', name: 'Calendar', icon: 'calendar-number-outline', color: '#DC2626' },
    { id: 'm8', name: 'Exams & Results', icon: 'ribbon-outline', color: '#059669' },
    { id: 'm9', name: 'Homework', icon: 'book-outline', color: '#2563EB' },
    { id: 'm10', name: 'Transport', icon: 'bus-outline', color: '#4F46E5' },
    { id: 'm11', name: 'Library', icon: 'library-outline', color: '#0284C7' },
    { id: 'm12', name: 'Inventory & Assets', icon: 'cube-outline', color: '#7C3AED' },
    { id: 'm13', name: 'Leave Requests', icon: 'document-text-outline', color: '#D97706' },
    { id: 'm14', name: 'Reports & Analytics', icon: 'stats-chart-outline', color: '#7C3AED' },
    { id: 'm15', name: 'API Integrations', icon: 'code-working-outline', color: '#0284C7' },
    { id: 'm16', name: 'Registration Links', icon: 'link-outline', color: '#2563EB' },
    { id: 'm17', name: 'Leads', icon: 'heart-outline', color: '#EC4899' },
    { id: 'm18', name: 'Billing & Plan', icon: 'receipt-outline', color: '#7C3AED' },
    { id: 'm19', name: 'Custom Modules', icon: 'extension-puzzle-outline', color: '#059669' },
    { id: 'm20', name: 'Staff Directory', icon: 'person-add-outline', color: '#2563EB' },
    { id: 'm21', name: 'Noticeboard', icon: 'megaphone-outline', color: '#D97706' },
  ];

  // --- Session Check ---
  useEffect(() => {
    const checkSavedSession = async () => {
      try {
        const savedSession = await AsyncStorage.getItem('@zuna_user_session');
        if (savedSession) {
          const sessionData = JSON.parse(savedSession);
          if (sessionData && sessionData.loggedIn) {
            setActiveRole(sessionData.role || 'Admin');
            setIsLoggedIn(true);
            setActiveAdminTab('Dashboard');
          }
        }
      } catch (err) {
        // Fallback to login
      } finally {
        setTimeout(() => {
          setIsSplashVisible(false);
        }, 1000);
      }
    };
    checkSavedSession();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg || 'Action completed');
    setTimeout(() => setToastMessage(null), 3000);
  };

  // --- Auth Handlers ---
  const handleLoginSubmit = async () => {
    if (!loginEmail.trim()) {
      Alert.alert('Authentication Error', 'Please enter your email or admission number.');
      return;
    }
    if (!loginPassword) {
      Alert.alert('Authentication Error', 'Please enter your password.');
      return;
    }

    setIsLoggingIn(true);
    setTimeout(async () => {
      setIsLoggingIn(false);
      const emailLower = (loginEmail || '').trim().toLowerCase();

      let detectedRole: Role = activeRole;
      if (emailLower.includes('teacher')) {
        detectedRole = 'Teacher';
      } else if (emailLower.includes('student')) {
        detectedRole = 'Student';
      } else {
        detectedRole = 'Admin';
      }

      setActiveRole(detectedRole);
      setIsLoggedIn(true);
      setActiveAdminTab('Dashboard');

      if (rememberMe) {
        try {
          await AsyncStorage.setItem(
            '@zuna_user_session',
            JSON.stringify({ loggedIn: true, role: detectedRole, email: loginEmail.trim() })
          );
        } catch (e) {}
      }
      showToast(`Welcome back! Authenticated as ${detectedRole}`);
    }, 600);
  };

  const handleDemoQuickLogin = (role: Role) => {
    const demoEmail = role === 'Admin' ? 'admin@zuna.edu' : role === 'Teacher' ? 'teacher@zuna.edu' : 'student@zuna.edu';
    setLoginEmail(demoEmail);
    setLoginPassword('password123');
    setActiveRole(role);
    showToast(`Credentials filled for ${role}. Tap "Log in" to authenticate.`);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@zuna_user_session');
    } catch (e) {}
    setIsLoggedIn(false);
    setLoginEmail('');
    setLoginPassword('');
    showToast('Logged out successfully');
  };

  const handleForgotSubmit = () => {
    if (!forgotEmail.trim()) {
      Alert.alert('Required', 'Please enter your registered email address.');
      return;
    }
    setShowForgotModal(false);
    showToast(`Password recovery link sent to ${forgotEmail.trim()}!`);
    setForgotEmail('');
  };

  // --- Admin Action Handlers ---
  const handleRegisterStudentSubmit = () => {
    if (!newStudentName.trim() || !newStudentRollNo.trim()) {
      Alert.alert('Required', 'Please enter student full name and roll number.');
      return;
    }
    const newStudent: StudentItem = {
      id: Date.now().toString(),
      name: newStudentName.trim(),
      grade: newStudentGrade.trim() || 'Class 10',
      rollNo: newStudentRollNo.trim(),
      attendanceStatus: 'Present',
      feePaid: newStudentFeePaid,
    };
    setStudents(prev => [newStudent, ...prev]);
    setNewStudentName('');
    setNewStudentRollNo('');
    setShowStudentModal(false);
    setActiveAdminTab('Students');
    showToast(`Registered ${newStudent.name} (${newStudent.grade})!`);
  };

  const handleAddFacultySubmit = () => {
    if (!newFacultyName.trim() || !newFacultySubject.trim()) {
      Alert.alert('Required', 'Please fill in faculty name and subject.');
      return;
    }
    setFacultyCount(prev => prev + 1);
    setNewFacultyName('');
    setNewFacultySubject('');
    setShowFacultyModal(false);
    showToast(`Added ${newFacultyName.trim()} to Teaching Staff!`);
  };

  const toggleAttendance = (studentId: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id === studentId) {
          const nextStatus: Record<string, 'Present' | 'Absent' | 'OD'> = {
            Present: 'Absent',
            Absent: 'OD',
            OD: 'Present',
          };
          const newStatus = nextStatus[s.attendanceStatus];
          showToast(`${s.name} marked as ${newStatus}`);
          return { ...s, attendanceStatus: newStatus };
        }
        return s;
      })
    );
  };

  const toggleFeeStatus = (studentId: string) => {
    setStudents(prev =>
      prev.map(s => {
        if (s.id === studentId) {
          const updated = !s.feePaid;
          showToast(`${s.name} fee set to ${updated ? 'PAID' : 'UNPAID'}`);
          return { ...s, feePaid: updated };
        }
        return s;
      })
    );
  };

  const handleShareReport = async () => {
    try {
      const reportText =
        `🏫 ZUNA SCHOOL MANAGEMENT SYSTEM - EXECUTIVE AUDIT REPORT\n` +
        `--------------------------------------------------\n` +
        `Date: ${new Date().toLocaleDateString()}\n` +
        `School ID: ZUNA-ACADEMY-2026\n\n` +
        `📊 EXECUTIVE METRICS:\n` +
        `• Total Enrolled Students: ${students.length + 405}\n` +
        `• Teaching Staff Count: ${facultyCount}\n` +
        `• Active Classes: 18 Sections\n` +
        `• Pending Fee Balance: ₹ 2,48,500\n`;
      await Share.share({ title: 'ZUNA Executive Report', message: reportText });
      showToast('Executive Report shared successfully!');
    } catch (error) {}
  };

  // --- Filtered Lists ---
  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase()) ||
                          (s.rollNo || '').includes(studentSearchQuery) ||
                          (s.grade || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase());
    const matchesGrade = gradeFilter === 'All' || s.grade === gradeFilter;
    const matchesAttendance = attendanceFilter === 'All' || s.attendanceStatus === attendanceFilter;
    return matchesSearch && matchesGrade && matchesAttendance;
  });

  const filteredModules = allModulesList.filter(m =>
    (m.name || '').toLowerCase().includes((moduleSearchQuery || '').toLowerCase())
  );

  // =========================================================================
  // 1. SPLASH SCREEN
  // =========================================================================
  if (isSplashVisible) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.splashContainer} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle="light-content" backgroundColor="#7C3AED" translucent={false} />
          <View style={styles.splashContent}>
            <View style={styles.splashBadge}>
              <IconComp name="school-outline" size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.splashTitle}>ZUNA</Text>
            <Text style={styles.splashSubtitle}>School Management System</Text>
            <Text style={styles.splashVersion}>Mobile Admin Portal v2.0</Text>
            <ActivityIndicator size="large" color="#FFFFFF" style={{ marginTop: 32 }} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // =========================================================================
  // 2. PROFESSIONAL LOGIN SCREEN
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.loginContainer} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" translucent={false} />
          
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={styles.loginScroll} showsVerticalScrollIndicator={false}>
              
              {/* Brand Header */}
              <View style={styles.brandHeaderRow}>
                <View style={styles.brandLogoBadge}>
                  <IconComp name="school-outline" size={24} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.brandTitle}>ZUNA</Text>
                  <Text style={styles.brandSubTitle}>School Management System</Text>
                </View>
              </View>

              {/* Title Block */}
              <View style={styles.loginTitleBlock}>
                <Text style={styles.loginHeading}>Log in to your account</Text>
                <Text style={styles.loginSubHeading}>
                  Access your tasks, notes, and projects anytime, anywhere - and keep everything flowing in one place.
                </Text>
              </View>

              {/* Email or Admission No Input */}
              <Text style={styles.inputLabelText}>Email or Admission No.</Text>
              <View style={styles.inputBoxContainer}>
                <IconComp name="mail-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.inputBoxText}
                  placeholder="Enter your email or admission number"
                  placeholderTextColor="#94A3B8"
                  value={loginEmail}
                  onChangeText={setLoginEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              {/* Password Input */}
              <Text style={styles.inputLabelText}>Password</Text>
              <View style={styles.inputBoxContainer}>
                <IconComp name="lock-closed-outline" size={20} color="#94A3B8" />
                <TextInput
                  style={styles.inputBoxText}
                  placeholder="Enter your password"
                  placeholderTextColor="#94A3B8"
                  secureTextEntry={!showPassword}
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                />
                <TouchableOpacity
                  style={styles.eyeIconButton}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}>
                  <IconComp
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={20}
                    color="#64748B"
                  />
                </TouchableOpacity>
              </View>

              {/* Options Row */}
              <View style={styles.optionsRowBox}>
                <TouchableOpacity
                  style={styles.rememberCheckBoxRow}
                  onPress={() => setRememberMe(!rememberMe)}
                  activeOpacity={0.7}>
                  <View style={[styles.checkBoxSquare, rememberMe && styles.checkBoxSquareChecked]}>
                    {rememberMe && <Text style={styles.checkBoxCheckMark}>✓</Text>}
                  </View>
                  <Text style={styles.rememberLabelText}>Remember me</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setShowForgotModal(true)}>
                  <Text style={styles.forgotPasswordLinkText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>

              {/* Primary Log In Button */}
              <TouchableOpacity
                style={[styles.primaryLoginBtn, isLoggingIn && { opacity: 0.7 }]}
                onPress={handleLoginSubmit}
                disabled={isLoggingIn}
                activeOpacity={0.85}>
                <Text style={styles.primaryLoginBtnText}>
                  {isLoggingIn ? 'Authenticating...' : 'Log in'}
                </Text>
              </TouchableOpacity>

              {/* Sign Up Footer */}
              <View style={styles.signUpFooterRow}>
                <Text style={styles.signUpFooterText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => Alert.alert('Registration', 'Please contact your School Administrator to create a new portal account.')}>
                  <Text style={styles.signUpFooterLink}>Sign up</Text>
                </TouchableOpacity>
              </View>

              {/* Quick Demo Access (Populates credentials without auto-login) */}
              <View style={styles.quickDemoCardSection}>
                <Text style={styles.quickDemoHeaderTitle}>QUICK DEMO ACCESS</Text>
                <View style={styles.quickPillsRowBox}>
                  <TouchableOpacity
                    style={styles.quickRolePillBtn}
                    onPress={() => handleDemoQuickLogin('Admin')}>
                    <Text style={styles.quickRolePillText}>👑 Admin</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickRolePillBtn}
                    onPress={() => handleDemoQuickLogin('Teacher')}>
                    <Text style={styles.quickRolePillText}>👨‍🏫 Teacher</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickRolePillBtn}
                    onPress={() => handleDemoQuickLogin('Student')}>
                    <Text style={styles.quickRolePillText}>🎓 Student</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Toast Notification */}
          {toastMessage && (
            <View style={styles.toastBannerBox}>
              <Text style={styles.toastBannerText}>✨ {toastMessage}</Text>
            </View>
          )}

          {/* Forgot Password Modal */}
          <Modal visible={showForgotModal} transparent animationType="fade">
            <View style={styles.modalOverlayDark}>
              <View style={styles.modalCardContainer}>
                <Text style={styles.modalCardTitle}>🔑 Forgot Password</Text>
                <Text style={styles.modalCardDesc}>
                  Enter your registered school email address below to receive password recovery instructions.
                </Text>
                <Text style={styles.fieldLabelText}>Registered Email</Text>
                <TextInput
                  style={styles.modalInputBox}
                  placeholder="admin@zuna.edu"
                  placeholderTextColor="#94A3B8"
                  value={forgotEmail}
                  onChangeText={setForgotEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                  <TouchableOpacity
                    style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                    onPress={() => setShowForgotModal(false)}>
                    <Text style={styles.modalSmallBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                    onPress={handleForgotSubmit}>
                    <Text style={styles.modalSmallBtnText}>Send Reset Link</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // =========================================================================
  // 3. MAIN ADMIN MOBILE EXPERIENCE (With Floating Bottom Navigation)
  // =========================================================================
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.mainAppContainer} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

        {/* --- Top Header Bar --- */}
        <View style={styles.topHeaderBar}>
          <View style={styles.headerLeftBrand}>
            <TouchableOpacity style={styles.menuIconButton} onPress={() => showToast('ZUNA Admin Menu')}>
              <IconComp name="menu-outline" size={24} color="#0F172A" />
            </TouchableOpacity>
            <View style={styles.headerLogoBadge}>
              <IconComp name="school-outline" size={18} color="#7C3AED" />
            </View>
            <View>
              <Text style={styles.headerBrandTitle}>ZUNA</Text>
              <Text style={styles.headerBrandSub}>Admin Portal</Text>
            </View>
          </View>

          <View style={styles.headerRightProfile}>
            <View style={styles.avatarPill}>
              <Text style={styles.avatarPillText}>AD</Text>
            </View>
            <TouchableOpacity style={styles.roleDropdownBtn} onPress={handleLogout}>
              <Text style={styles.roleDropdownText}>{activeRole}</Text>
              <IconComp name="chevron-down-outline" size={14} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Toast Banner */}
        {toastMessage && (
          <View style={styles.toastBannerBox}>
            <Text style={styles.toastBannerText}>✨ {toastMessage}</Text>
          </View>
        )}

        {/* --- Main Screen Content Area --- */}
        <View style={{ flex: 1 }}>

          {/* ==================== TAB 1: DASHBOARD ==================== */}
          {activeAdminTab === 'Dashboard' && (
            <ScrollView
              contentContainerStyle={styles.tabScrollContentWithFloatingNav}
              showsVerticalScrollIndicator={false}>
              
              {/* Premium Welcome Gradient Banner */}
              <View style={styles.greetingBannerCard}>
                <Text style={styles.greetingTitle}>Good Morning, Admin 👋</Text>
                <Text style={styles.greetingSub}>Here's what's happening at your school today.</Text>
              </View>

              {/* Sub-Header Controls Row (Customize & Date) */}
              <View style={styles.subHeaderFilterRow}>
                <TouchableOpacity style={styles.pillCardBtn} onPress={() => showToast('Dashboard customized')}>
                  <IconComp name="options-outline" size={16} color="#64748B" />
                  <Text style={styles.pillCardText}>Customize</Text>
                </TouchableOpacity>

                <View style={styles.pillCardBtn}>
                  <IconComp name="calendar-outline" size={16} color="#64748B" />
                  <Text style={styles.pillCardText}>07/09/2026</Text>
                </View>
              </View>

              {/* Metric Summary Cards (2x2 Grid with Chevrons) */}
              <View style={styles.metricsGridContainer}>
                
                {/* Metric 1: Total Students */}
                <TouchableOpacity style={styles.metricCard} onPress={() => setActiveAdminTab('Students')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#EFF6FF' }]}>
                      <IconComp name="school-outline" size={20} color="#2563EB" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Total Students</Text>
                  <Text style={styles.metricNumberValue}>412</Text>
                  <Text style={[styles.metricTrendText, { color: '#059669' }]}>↑ +12% from last month</Text>
                </TouchableOpacity>

                {/* Metric 2: Teaching Staff */}
                <TouchableOpacity style={styles.metricCard} onPress={() => showToast('Teaching Staff: 28 Members')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#F3E8FF' }]}>
                      <IconComp name="people-outline" size={20} color="#7C3AED" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Teaching Staff</Text>
                  <Text style={styles.metricNumberValue}>{facultyCount}</Text>
                  <Text style={[styles.metricTrendText, { color: '#059669' }]}>↑ +2 new this month</Text>
                </TouchableOpacity>

                {/* Metric 3: Active Classes */}
                <TouchableOpacity style={styles.metricCard} onPress={() => showToast('Active Classes: 18 Sections')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#ECFDF5' }]}>
                      <IconComp name="book-outline" size={20} color="#059669" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Active Classes</Text>
                  <Text style={styles.metricNumberValue}>18</Text>
                  <Text style={[styles.metricTrendText, { color: '#2563EB' }]}>↑ Across all sections</Text>
                </TouchableOpacity>

                {/* Metric 4: Pending Fees */}
                <TouchableOpacity style={styles.metricCard} onPress={() => setActiveAdminTab('Fees')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#FEF2F2' }]}>
                      <IconComp name="wallet-outline" size={20} color="#DC2626" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Pending Fees</Text>
                  <Text style={styles.metricNumberValue}>₹ 2,48,500</Text>
                  <Text style={[styles.metricTrendText, { color: '#DC2626' }]}>↗ +3 overdue payments</Text>
                </TouchableOpacity>

              </View>

              {/* Middle Section: Recent Notices & System Status */}
              <View style={styles.middleSectionRow}>
                
                {/* Recent Notices Card */}
                <View style={styles.sectionCardBox}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <IconComp name="megaphone-outline" size={18} color="#7C3AED" />
                      <Text style={styles.sectionCardTitle}>Recent Notices</Text>
                    </View>
                    <TouchableOpacity onPress={() => setActiveAdminTab('Students')}>
                      <Text style={styles.viewAllLinkText}>View All</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.activityItemRow}>
                    <View style={[styles.activityIconBox, { backgroundColor: '#EFF6FF' }]}>
                      <IconComp name="school-outline" size={16} color="#2563EB" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitleText}>New student registered</Text>
                      <Text style={styles.activitySubText}>Rahul Kumar • Class 10A</Text>
                    </View>
                    <Text style={styles.activityTimeText}>2 hours ago</Text>
                  </View>

                  <View style={styles.activityItemRow}>
                    <View style={[styles.activityIconBox, { backgroundColor: '#ECFDF5' }]}>
                      <IconComp name="cash-outline" size={16} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitleText}>Fee payment received</Text>
                      <Text style={styles.activitySubText}>Aarav Singh • ₹ 5,000</Text>
                    </View>
                    <Text style={styles.activityTimeText}>3 hours ago</Text>
                  </View>

                  <View style={styles.activityItemRow}>
                    <View style={[styles.activityIconBox, { backgroundColor: '#FFF7ED' }]}>
                      <IconComp name="person-outline" size={16} color="#D97706" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitleText}>Leave request approved</Text>
                      <Text style={styles.activitySubText}>Priya N • 1 day ago</Text>
                    </View>
                    <Text style={styles.activityTimeText}>3 hours ago</Text>
                  </View>
                </View>

                {/* System Status Navy Card */}
                <View style={styles.navyStatusCardBox}>
                  <Text style={styles.navyCardTitle}>System Status</Text>
                  <View style={styles.statusOnlineIndicatorRow}>
                    <View style={styles.greenPulseDot} />
                    <Text style={styles.statusOnlineText}>All modules running smoothly</Text>
                  </View>

                  {/* Fee Collection Sub-box */}
                  <View style={styles.navySubBoxContainer}>
                    <View style={styles.navySubBoxHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconComp name="wallet-outline" size={16} color="#F59E0B" />
                        <Text style={styles.navySubBoxTitle}>Fee Collection</Text>
                      </View>
                      <View style={styles.noInvoicesBadgePill}>
                        <Text style={styles.noInvoicesBadgeText}>No Invoices</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '0%' }]} />
                    </View>
                    <Text style={styles.percentCollectedText}>0% Collected</Text>
                  </View>
                </View>

                {/* Quick Actions Card */}
                <View style={styles.sectionCardBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <IconComp name="flash-outline" size={18} color="#EC4899" />
                    <Text style={styles.sectionCardTitle}>Quick Actions</Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <TouchableOpacity
                      style={[styles.actionGridBtn, { backgroundColor: '#7C3AED' }]}
                      onPress={() => setShowStudentModal(true)}>
                      <Text style={styles.actionGridBtnText}>+ Register Student</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionGridBtn, { backgroundColor: '#059669' }]}
                      onPress={() => setShowFacultyModal(true)}>
                      <Text style={styles.actionGridBtnText}>+ Add Faculty</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={[styles.actionGridBtn, { backgroundColor: '#2563EB', width: '100%' }]}
                    onPress={() => setShowReportModal(true)}>
                    <Text style={styles.actionGridBtnText}>📄 Export Report</Text>
                  </TouchableOpacity>
                </View>

              </View>

            </ScrollView>
          )}

          {/* ==================== TAB 2: STUDENT DIRECTORY ==================== */}
          {activeAdminTab === 'Students' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              <View style={styles.screenHeaderRow}>
                <Text style={styles.screenTitleText}>Student Directory</Text>
                <TouchableOpacity
                  style={styles.headerPrimaryBtn}
                  onPress={() => setShowStudentModal(true)}>
                  <Text style={styles.headerPrimaryBtnText}>+ Add Student</Text>
                </TouchableOpacity>
              </View>

              {/* Search Bar & Filter */}
              <View style={styles.searchFilterBoxContainer}>
                <View style={styles.searchInputWrapper}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Search students..."
                    placeholderTextColor="#94A3B8"
                    value={studentSearchQuery}
                    onChangeText={setStudentSearchQuery}
                  />
                </View>
                <TouchableOpacity style={styles.filterIconBtn}>
                  <IconComp name="funnel-outline" size={18} color="#475569" />
                </TouchableOpacity>
              </View>

              {/* Grade Filter Pills */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScrollContainer}>
                {['All', 'Class 10', 'Class 11', 'Class 12'].map(grade => (
                  <TouchableOpacity
                    key={grade}
                    style={[styles.gradePillBtn, gradeFilter === grade && styles.gradePillBtnActive]}
                    onPress={() => setGradeFilter(grade)}>
                    <Text style={[styles.gradePillText, gradeFilter === grade && styles.gradePillTextActive]}>
                      {grade}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Student Directory List */}
              {filteredStudents.map(s => (
                <View key={s.id} style={styles.studentListCardRow}>
                  <View style={styles.studentAvatarCircle}>
                    <Text style={styles.studentAvatarText}>{(s.name || 'S').split(' ').map(n => n[0]).join('')}</Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.studentNameText}>{s.name || 'Student'}</Text>
                    <Text style={styles.studentDetailsSubText}>{s.grade} • Roll No: {s.rollNo}</Text>
                    <View style={styles.statusBadgeGreenPill}>
                      <Text style={styles.statusBadgeGreenText}>• Active</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.smallFeeActionBtn, s.feePaid ? styles.feePaidStyle : styles.feeUnpaidStyle]}
                    onPress={() => toggleFeeStatus(s.id)}>
                    <Text style={styles.smallFeeActionBtnText}>{s.feePaid ? 'Fee Paid' : 'Fee Unpaid'}</Text>
                  </TouchableOpacity>
                </View>
              ))}

            </ScrollView>
          )}

          {/* ==================== TAB 3: ATTENDANCE ==================== */}
          {activeAdminTab === 'Attendance' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              <Text style={styles.screenTitleText}>Attendance Module</Text>

              {/* Attendance Controls Card */}
              <View style={styles.attendanceFilterCard}>
                <View style={styles.controlDropdownRow}>
                  <View style={[styles.dropdownBox, { flex: 1 }]}>
                    <IconComp name="calendar-outline" size={16} color="#64748B" />
                    <Text style={styles.dropdownTextValue}>07 Sep 2026</Text>
                  </View>
                  <View style={[styles.dropdownBox, { flex: 1 }]}>
                    <Text style={styles.dropdownTextValue}>Class 10</Text>
                  </View>
                  <View style={[styles.dropdownBox, { flex: 1 }]}>
                    <Text style={styles.dropdownTextValue}>Section A</Text>
                  </View>
                </View>

                <View style={[styles.controlDropdownRow, { marginTop: 10 }]}>
                  <View style={[styles.dropdownBox, { flex: 2 }]}>
                    <Text style={styles.dropdownTextValue}>Mathematics</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.loadStudentsBtn}
                    onPress={() => showToast('Attendance roster updated!')}>
                    <Text style={styles.loadStudentsBtnText}>Load Roster</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Status Summary Pills */}
              <View style={styles.attendanceStatusRowBox}>
                {(['All', 'Present', 'Absent', 'OD'] as const).map(status => (
                  <TouchableOpacity
                    key={status}
                    style={[styles.statusSummaryPill, attendanceFilter === status && styles.statusSummaryPillActive]}
                    onPress={() => setAttendanceFilter(status)}>
                    <Text style={[styles.statusSummaryPillText, attendanceFilter === status && styles.statusSummaryPillTextActive]}>
                      {status} ({status === 'All' ? students.length : students.filter(s => s.attendanceStatus === status).length})
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Attendance Table Card */}
              <View style={styles.sectionCardBox}>
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderText, { width: 50 }]}>Roll No</Text>
                  <Text style={[styles.tableHeaderText, { flex: 1 }]}>Student Name</Text>
                  <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Status</Text>
                </View>

                {filteredStudents.map(student => (
                  <View key={student.id} style={styles.tableDataRow}>
                    <Text style={[styles.tableCellText, { width: 50, color: '#64748B' }]}>{student.rollNo}</Text>
                    <Text style={[styles.tableCellText, { flex: 1, fontWeight: '600' }]}>{student.name}</Text>
                    <TouchableOpacity
                      style={[
                        styles.attendanceBadgePill,
                        student.attendanceStatus === 'Present' && styles.attPresentStyle,
                        student.attendanceStatus === 'Absent' && styles.attAbsentStyle,
                        student.attendanceStatus === 'OD' && styles.attOdStyle,
                      ]}
                      onPress={() => toggleAttendance(student.id)}>
                      <Text style={styles.attendanceBadgeText}>{student.attendanceStatus}</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                  <TouchableOpacity
                    style={[styles.attFooterActionBtn, { backgroundColor: '#E2E8F0' }]}
                    onPress={() => {
                      setStudents(prev => prev.map(s => ({ ...s, attendanceStatus: 'Present' })));
                      showToast('Marked all students Present!');
                    }}>
                    <Text style={[styles.attFooterActionBtnText, { color: '#334155' }]}>Mark All Present</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.attFooterActionBtn, { backgroundColor: '#7C3AED' }]}
                    onPress={() => showToast('Attendance saved to school database!')}>
                    <Text style={styles.attFooterActionBtnText}>Save Attendance</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          )}

          {/* ==================== TAB 4: FEES & PAYMENTS ==================== */}
          {activeAdminTab === 'Fees' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              <Text style={styles.screenTitleText}>Fees & Financials</Text>

              {/* Financial Metric Cards */}
              <View style={styles.metricsGridContainer}>
                <View style={[styles.metricCard, { borderLeftWidth: 4, borderLeftColor: '#2563EB' }]}>
                  <Text style={styles.metricLabelTitle}>Total Expected Fees</Text>
                  <Text style={styles.metricNumberValue}>₹ 15,00,000</Text>
                </View>

                <View style={[styles.metricCard, { borderLeftWidth: 4, borderLeftColor: '#059669' }]}>
                  <Text style={styles.metricLabelTitle}>Collected Amount</Text>
                  <Text style={[styles.metricNumberValue, { color: '#059669' }]}>₹ 14,25,000</Text>
                </View>
              </View>

              {/* Student Fee Roster */}
              <View style={styles.sectionCardBox}>
                <Text style={styles.sectionCardTitle}>Student Fee Status</Text>
                {students.map(s => (
                  <View key={s.id} style={styles.activityItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentNameText}>{s.name}</Text>
                      <Text style={styles.studentDetailsSubText}>{s.grade} • Roll No: {s.rollNo}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.smallFeeActionBtn, s.feePaid ? styles.feePaidStyle : styles.feeUnpaidStyle]}
                      onPress={() => toggleFeeStatus(s.id)}>
                      <Text style={styles.smallFeeActionBtnText}>{s.feePaid ? '✅ Paid' : '❌ Unpaid'}</Text>
                    </TouchableOpacity>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.primaryLoginBtn, { marginTop: 16, backgroundColor: '#7C3AED' }]}
                  onPress={() => showToast('Fee Reminders dispatched via SMS & Email!')}>
                  <Text style={styles.primaryLoginBtnText}>📲 Send Payment Reminders</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          )}

          {/* ==================== TAB 5: ALL MODULES (GRID VIEW) ==================== */}
          {activeAdminTab === 'All Modules' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              <View style={styles.screenHeaderRow}>
                <Text style={styles.screenTitleText}>All Modules</Text>
                <Text style={{ color: '#64748B', fontSize: 13 }}>21 Available Modules</Text>
              </View>

              {/* Module Search Bar */}
              <View style={styles.searchFilterBoxContainer}>
                <View style={styles.searchInputWrapper}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchTextInput}
                    placeholder="Search modules..."
                    placeholderTextColor="#94A3B8"
                    value={moduleSearchQuery}
                    onChangeText={setModuleSearchQuery}
                  />
                </View>
              </View>

              {/* 21 Modules Responsive Grid */}
              <View style={styles.modulesGridContainer}>
                {filteredModules.map(mod => (
                  <TouchableOpacity
                    key={mod.id}
                    style={styles.moduleGridCard}
                    onPress={() => {
                      setActiveModuleModal(mod.name);
                      showToast(`Opened ${mod.name} Module`);
                    }}
                    activeOpacity={0.75}>
                    <View style={[styles.moduleIconBoxCircle, { backgroundColor: `${mod.color}15` }]}>
                      <IconComp name={mod.icon} size={22} color={mod.color} />
                    </View>
                    <Text style={styles.moduleGridTitleText} numberOfLines={2}>{mod.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

            </ScrollView>
          )}

        </View>

        {/* ========================================================================= */}
        {/* FLOATING BOTTOM NAVIGATION BAR (EXACTLY 5 TABS AS SPECIFIED IN REFERENCE) */}
        {/* ========================================================================= */}
        <View style={styles.floatingNavWrapper}>
          <View style={styles.floatingNavPillContainer}>
            {(['Dashboard', 'Students', 'Attendance', 'Fees', 'All Modules'] as AdminTab[]).map(tab => {
              const isActive = activeAdminTab === tab;
              const iconMap: Record<AdminTab, string> = {
                'Dashboard': 'grid-outline',
                'Students': 'people-outline',
                'Attendance': 'calendar-outline',
                'Fees': 'card-outline',
                'All Modules': 'apps-outline',
              };

              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.floatingTabItemBtn, isActive && styles.floatingTabItemBtnActive]}
                  onPress={() => setActiveAdminTab(tab)}
                  activeOpacity={0.8}>
                  <IconComp
                    name={iconMap[tab]}
                    size={20}
                    color={isActive ? '#7C3AED' : '#64748B'}
                  />
                  <Text style={[styles.floatingTabLabelText, isActive && styles.floatingTabLabelTextActive]}>
                    {tab}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* --- Shared Modals --- */}
        {/* Register Student Modal */}
        <Modal visible={showStudentModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <Text style={styles.modalCardTitle}>+ Register New Student</Text>
              <Text style={styles.fieldLabelText}>Student Full Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Rahul Kumar"
                placeholderTextColor="#94A3B8"
                value={newStudentName}
                onChangeText={setNewStudentName}
              />
              <Text style={styles.fieldLabelText}>Grade / Class</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Class 10"
                placeholderTextColor="#94A3B8"
                value={newStudentGrade}
                onChangeText={setNewStudentGrade}
              />
              <Text style={styles.fieldLabelText}>Roll Number *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. 108"
                placeholderTextColor="#94A3B8"
                value={newStudentRollNo}
                onChangeText={setNewStudentRollNo}
                keyboardType="numeric"
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowStudentModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleRegisterStudentSubmit}>
                  <Text style={styles.modalSmallBtnText}>Register</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Add Faculty Modal */}
        <Modal visible={showFacultyModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <Text style={styles.modalCardTitle}>+ Onboard Faculty Staff</Text>
              <Text style={styles.fieldLabelText}>Faculty Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Dr. Sarah Connor"
                placeholderTextColor="#94A3B8"
                value={newFacultyName}
                onChangeText={setNewFacultyName}
              />
              <Text style={styles.fieldLabelText}>Subject / Department *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Physics"
                placeholderTextColor="#94A3B8"
                value={newFacultySubject}
                onChangeText={setNewFacultySubject}
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowFacultyModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#059669' }]}
                  onPress={handleAddFacultySubmit}>
                  <Text style={styles.modalSmallBtnText}>Onboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Export Report Modal */}
        <Modal visible={showReportModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <Text style={styles.modalCardTitle}>📄 Executive School Audit Report</Text>
              <Text style={{ color: '#475569', fontSize: 13, marginBottom: 14 }}>
                Generate and share full executive analytics overview for ZUNA School Management.
              </Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowReportModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#2563EB' }]}
                  onPress={async () => {
                    setShowReportModal(false);
                    await handleShareReport();
                  }}>
                  <Text style={styles.modalSmallBtnText}>Export / Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Module Detail Modal */}
        <Modal visible={!!activeModuleModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <Text style={styles.modalCardTitle}>📱 {activeModuleModal} Module</Text>
              <Text style={{ color: '#475569', fontSize: 13, marginBottom: 16 }}>
                Active mobile configuration for {activeModuleModal}. All real-time school data is synced with the main ZUNA Admin web database.
              </Text>
              <TouchableOpacity
                style={[styles.modalSmallBtn, { backgroundColor: '#7C3AED' }]}
                onPress={() => setActiveModuleModal(null)}>
                <Text style={styles.modalSmallBtnText}>Close Module View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </SafeAreaView>
    </SafeAreaProvider>
  );
}

// =========================================================================
// STYLES SYSTEM (Vibrant Modern Mobile Aesthetic matching ZUNA Reference UI)
// =========================================================================
const styles = StyleSheet.create({
  // --- Splash Screen ---
  splashContainer: {
    flex: 1,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
  },
  splashBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  splashTitle: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  splashSubtitle: {
    fontSize: 16,
    color: '#F3E8FF',
    fontWeight: '500',
    marginTop: 4,
  },
  splashVersion: {
    fontSize: 12,
    color: '#DDD6FE',
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // --- Professional Login Screen ---
  loginContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loginScroll: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 24) + 16 : 24,
    paddingBottom: 40,
  },
  brandHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  brandLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  brandSubTitle: {
    fontSize: 12,
    color: '#64748B',
  },
  loginTitleBlock: {
    marginBottom: 24,
  },
  loginHeading: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  loginSubHeading: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  inputLabelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 10,
  },
  inputBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
    marginBottom: 12,
  },
  inputBoxText: {
    flex: 1,
    fontSize: 14,
    color: '#0F172A',
    marginLeft: 10,
  },
  eyeIconButton: {
    padding: 6,
  },
  optionsRowBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  rememberCheckBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkBoxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginRight: 8,
  },
  checkBoxSquareChecked: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkBoxCheckMark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  rememberLabelText: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500',
  },
  forgotPasswordLinkText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '700',
  },
  primaryLoginBtn: {
    backgroundColor: '#7C3AED',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryLoginBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  signUpFooterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signUpFooterText: {
    fontSize: 13,
    color: '#64748B',
  },
  signUpFooterLink: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '700',
  },
  quickDemoCardSection: {
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  quickDemoHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  quickPillsRowBox: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  quickRolePillBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  quickRolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Toast Banner ---
  toastBannerBox: {
    backgroundColor: '#059669',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  toastBannerText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // --- Main App Shell & Top Header ---
  mainAppContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
  },
  headerLeftBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  menuIconButton: {
    padding: 4,
  },
  headerLogoBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBrandTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0F172A',
    lineHeight: 18,
  },
  headerBrandSub: {
    fontSize: 11,
    color: '#64748B',
  },
  headerRightProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPillText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 12,
  },
  roleDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roleDropdownText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Scroll Content (With extra padding for floating nav) ---
  tabScrollContentWithFloatingNav: {
    padding: 16,
    paddingBottom: 110, // Generous padding so content is never obscured by floating nav
  },
  screenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTitleText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },

  // --- Premium Welcome Banner ---
  greetingBannerCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 18,
    padding: 20,
    marginBottom: 14,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  greetingTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  greetingSub: {
    fontSize: 13.5,
    color: '#F3E8FF',
    marginTop: 4,
  },

  // --- Sub-Header Filter Row ---
  subHeaderFilterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pillCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  pillCardText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Metrics Cards (2x2 Grid with Chevrons) ---
  metricsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  metricIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  metricIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabelTitle: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  metricNumberValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 2,
  },
  metricTrendText: {
    fontSize: 10.5,
    fontWeight: '700',
  },

  // --- Middle Section Cards ---
  middleSectionRow: {
    gap: 14,
  },
  sectionCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionCardTitle: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  activityIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  activitySubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  activityTimeText: {
    fontSize: 10,
    color: '#94A3B8',
  },

  // --- Navy System Status Card ---
  navyStatusCardBox: {
    backgroundColor: '#1E1B4B',
    borderRadius: 16,
    padding: 16,
  },
  navyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  statusOnlineIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusOnlineText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  navySubBoxContainer: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 12,
  },
  navySubBoxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navySubBoxTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  noInvoicesBadgePill: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  noInvoicesBadgeText: {
    color: '#CBD5E1',
    fontSize: 10.5,
    fontWeight: '600',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    marginVertical: 4,
  },
  progressBarFill: {
    height: 6,
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
  percentCollectedText: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'right',
    marginTop: 4,
  },
  actionGridBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionGridBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },

  // --- Search & Filter UI ---
  searchFilterBoxContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    marginLeft: 8,
  },
  filterIconBtn: {
    width: 44,
    height: 44,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillsScrollContainer: {
    gap: 8,
    marginBottom: 14,
  },
  gradePillBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  gradePillBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  gradePillText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  gradePillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // --- Student Roster Card ---
  studentListCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  studentAvatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#7C3AED',
  },
  studentNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentDetailsSubText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  statusBadgeGreenPill: {
    marginTop: 2,
  },
  statusBadgeGreenText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  smallFeeActionBtn: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  feePaidStyle: { backgroundColor: '#ECFDF5' },
  feeUnpaidStyle: { backgroundColor: '#FEF2F2' },
  smallFeeActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Attendance View Styles ---
  attendanceFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  controlDropdownRow: {
    flexDirection: 'row',
    gap: 8,
  },
  dropdownBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 38,
    gap: 6,
  },
  dropdownTextValue: {
    fontSize: 11.5,
    color: '#334155',
    fontWeight: '600',
  },
  loadStudentsBtn: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  loadStudentsBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  attendanceStatusRowBox: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  statusSummaryPill: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusSummaryPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  statusSummaryPillText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  statusSummaryPillTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  tableDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  tableCellText: {
    fontSize: 13,
    color: '#0F172A',
  },
  attendanceBadgePill: {
    width: 76,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  attPresentStyle: { backgroundColor: '#DCFCE7' },
  attAbsentStyle: { backgroundColor: '#FEE2E2' },
  attOdStyle: { backgroundColor: '#FEF3C7' },
  attendanceBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
  },
  attFooterActionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attFooterActionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },

  // --- All Modules Grid View ---
  modulesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  moduleGridCard: {
    width: '31.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 96,
    justifyContent: 'center',
  },
  moduleIconBoxCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleGridTitleText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    lineHeight: 14,
  },

  tabScrollContentWithFloatingNav: {
    padding: 16,
    paddingBottom: 110,
  },

  // =========================================================================
  // FLOATING BOTTOM NAVIGATION BAR (PILL CONTAINER FLOATING ABOVE EDGE)
  // =========================================================================
  floatingNavWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 12,
  },
  floatingNavPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    paddingHorizontal: 8,
    paddingVertical: 6,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    width: '100%',
    justifyContent: 'space-around',
  },
  floatingTabItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: 24,
  },
  floatingTabItemBtnActive: {
    backgroundColor: '#F3E8FF',
  },
  floatingTabLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 3,
  },
  floatingTabLabelTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },

  // --- Shared Modals ---
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    elevation: 5,
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  modalCardDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
    lineHeight: 18,
  },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 4,
    marginTop: 6,
  },
  modalInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 8,
  },
  modalSmallBtn: {
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSmallBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  headerPrimaryBtn: {
    backgroundColor: '#7C3AED',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default App;
