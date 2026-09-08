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

interface ModuleItem {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface StaffItem {
  id: string;
  name: string;
  email: string;
  role: string;
  gender: 'Male' | 'Female';
  staffType: 'Teaching' | 'Non-Teaching';
  status: 'Active' | 'Inactive';
  classAssignments: string[];
  subjectAssignments: string[];
}

interface ClassItem {
  id: string;
  name: string;
  section: string;
  category: string;
  studentCount: number;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  assignedTeachers: string[];
}

interface AdmissionAppItem {
  id: string;
  name: string;
  parentName: string;
  classApplied: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
}

// Icon Helper Component with Graceful Fallback (Prevents null / missing icons)
const IconComp = ({ name, size = 20, color = '#64748B', style }: { name: string; size?: number; color?: string; style?: any }) => {
  try {
    return <Ionicons name={name || 'square-outline'} size={size} color={color || '#64748B'} style={style} />;
  } catch (e) {
    return <Text style={[{ fontSize: size * 0.7, color: color || '#64748B' }, style]}>●</Text>;
  }
};

// --- Standardized Unified Module Header Card Component ---
interface HeaderCardAction {
  label: string;
  icon?: string;
  onPress?: () => void;
}

interface ModuleHeaderCardProps {
  icon?: string;
  title: string;
  subtitle?: string;
  badgeText?: string;
  primaryButton?: {
    label: string;
    icon?: string;
    onPress: () => void;
  };
  secondaryActions?: HeaderCardAction[];
  children?: React.ReactNode;
}

const ModuleHeaderCard: React.FC<ModuleHeaderCardProps> = ({
  icon,
  title,
  subtitle,
  badgeText,
  primaryButton,
  secondaryActions,
  children,
}) => {
  return (
    <View style={styles.moduleHeroHeaderCard}>
      {/* Top row: icon/title on the left, badge or primary button on the right */}
      <View style={styles.headerCardTopRow}>
        <View style={styles.headerCardTitleWrapper}>
          {icon ? <IconComp name={icon} size={22} color="#FFFFFF" style={styles.headerCardIcon} /> : null}
          <Text style={styles.moduleHeroTitle} numberOfLines={2}>
            {title}
          </Text>
        </View>

        {primaryButton ? (
          <TouchableOpacity
            style={styles.headerCardPrimaryBtn}
            activeOpacity={0.8}
            onPress={primaryButton.onPress}>
            {primaryButton.icon ? (
              <IconComp name={primaryButton.icon} size={14} color="#4C1D95" style={{ marginRight: 6 }} />
            ) : null}
            <Text style={styles.headerCardPrimaryBtnText}>{primaryButton.label}</Text>
          </TouchableOpacity>
        ) : badgeText ? (
          <View style={styles.headerCardBadge}>
            <Text style={styles.headerCardBadgeText}>{badgeText}</Text>
          </View>
        ) : null}
      </View>

      {/* Subtitle sits on its own line below the top row, 8-10px top margin */}
      {subtitle ? (
        <Text style={styles.moduleHeroSub}>{subtitle}</Text>
      ) : null}

      {/* Secondary button row (e.g. Customize + date), if present, goes below subtitle with 8px gap */}
      {secondaryActions && secondaryActions.length > 0 ? (
        <View style={styles.headerCardSecondaryRow}>
          {secondaryActions.map((action, idx) => {
            if (action.onPress) {
              return (
                <TouchableOpacity
                  key={idx}
                  style={styles.headerCardSecondaryBtn}
                  activeOpacity={0.8}
                  onPress={action.onPress}>
                  {action.icon ? (
                    <IconComp name={action.icon} size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : null}
                  <Text style={styles.headerCardSecondaryBtnText}>{action.label}</Text>
                </TouchableOpacity>
              );
            }
            return (
              <View key={idx} style={styles.headerCardSecondaryBtn}>
                {action.icon ? (
                  <IconComp name={action.icon} size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                ) : null}
                <Text style={styles.headerCardSecondaryBtnText}>{action.label}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {children}
    </View>
  );
};

// --- Reusable Professional Pagination Component ---
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

const getVisiblePages = (current: number, total: number) => {
  if (total <= 5) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 3) {
    return [1, 2, 3, '...', total];
  }
  if (current >= total - 2) {
    return [1, '...', total - 2, total - 1, total];
  }
  return [1, '...', current, '...', total];
};

const PaginationControls = ({ currentPage, totalPages, totalItems, pageSize, onPageChange }: PaginationProps) => {
  if (totalItems === 0 || totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <View style={styles.paginationWrapper}>
      <Text style={styles.paginationInfoText}>
        Showing <Text style={styles.paginationBoldText}>{startItem}–{endItem}</Text> of{' '}
        <Text style={styles.paginationBoldText}>{totalItems}</Text>
      </Text>
      
      <View style={styles.paginationControlsRightRow}>
        <TouchableOpacity
          style={[styles.arrowIconButton, currentPage === 1 && styles.arrowIconButtonDisabled]}
          onPress={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          activeOpacity={0.7}>
          <IconComp name="chevron-back-outline" size={14} color={currentPage === 1 ? '#CBD5E1' : '#334155'} />
        </TouchableOpacity>

        {visiblePages.map((p, idx) => {
          if (p === '...') {
            return (
              <Text key={`dots-${idx}`} style={styles.paginationEllipsisText}>...</Text>
            );
          }
          const pageNum = p as number;
          const isActive = pageNum === currentPage;
          return (
            <TouchableOpacity
              key={pageNum}
              style={[styles.pageSquarePill, isActive && styles.pageSquarePillActive]}
              onPress={() => onPageChange(pageNum)}
              activeOpacity={0.8}>
              <Text style={[styles.pageSquareText, isActive && styles.pageSquareTextActive]}>
                {pageNum}
              </Text>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity
          style={[styles.arrowIconButton, currentPage === totalPages && styles.arrowIconButtonDisabled]}
          onPress={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          activeOpacity={0.7}>
          <IconComp name="chevron-forward-outline" size={14} color={currentPage === totalPages ? '#CBD5E1' : '#334155'} />
        </TouchableOpacity>

        <View style={styles.pageSizePillBox}>
          <Text style={styles.pageSizePillText}>{pageSize} / page</Text>
          <IconComp name="chevron-down-outline" size={12} color="#64748B" />
        </View>
      </View>
    </View>
  );
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
  const [selectedDemoRole, setSelectedDemoRole] = useState<Role>('Admin');
  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('Dashboard');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // --- Shared Modals ---
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [forgotEmail, setForgotEmail] = useState<string>('');
  const [showStudentModal, setShowStudentModal] = useState<boolean>(false);
  const [showFacultyModal, setShowFacultyModal] = useState<boolean>(false);
  const [showReportModal, setShowReportModal] = useState<boolean>(false);
  const [activeModuleModal, setActiveModuleModal] = useState<string | null>(null);

  // --- 1. Staff Directory State (Screenshot 1 matching) ---
  const [staffList, setStaffList] = useState<StaffItem[]>([
    {
      id: 'st1',
      name: 'Jana D',
      email: 'jana@gmail.com',
      role: 'Teachers',
      gender: 'Male',
      staffType: 'Teaching',
      status: 'Active',
      classAssignments: ['PRE KG - A (CLASS)'],
      subjectAssignments: ['PRE KG - A (SUBJ)'],
    },
    {
      id: 'st2',
      name: 'Ragu D',
      email: 'ragu@gmail.com',
      role: 'Teachers',
      gender: 'Male',
      staffType: 'Teaching',
      status: 'Active',
      classAssignments: ['GRADE - 3 - A (CLASS)'],
      subjectAssignments: ['GRADE - 3 - A (SUBJ)'],
    },
  ]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState('All Roles');
  const [staffGenderFilter, setStaffGenderFilter] = useState('All Genders');
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Teachers');
  const [newStaffGender, setNewStaffGender] = useState<'Male' | 'Female'>('Male');

  // --- 2. Classes & Sections State (Screenshot 2 matching) ---
  const [classList, setClassList] = useState<ClassItem[]>([
    { id: 'cl1', name: 'grade - 3', section: 'Section A', category: 'Middle', studentCount: 1 },
    { id: 'cl2', name: 'PRE KG', section: 'Section A', category: 'KG', studentCount: 3 },
  ]);
  const [classCategoryFilter, setClassCategoryFilter] = useState('All Categories');
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSection, setNewClassSection] = useState('Section A');
  const [newClassCategory, setNewClassCategory] = useState('KG');
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoriesList, setCategoriesList] = useState(['KG', 'Middle', 'Higher Secondary']);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // --- 3. Subject Management State (Screenshot 3 matching) ---
  const [subjectList, setSubjectList] = useState<SubjectItem[]>([
    { id: 'sub1', name: 'Tamil', code: 'TAM002', assignedTeachers: ['Ragu D'] },
    { id: 'sub2', name: 'maths', code: 'MATH01', assignedTeachers: ['Jana D'] },
  ]);
  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectCode, setNewSubjectCode] = useState('');
  const [newSubjectTeacher, setNewSubjectTeacher] = useState('Ragu D');

  // --- 4. Student Directory & Admissions State (Screenshot 4 matching) ---
  const [studentDirectoryTab, setStudentDirectoryTab] = useState<'enrolled' | 'applications'>('enrolled');
  const [directoryStudents, setDirectoryStudents] = useState<any[]>([
    { id: 'dir1', name: 'pavithran a', admissionNo: '002', gradeClass: 'PRE KG - A', attachment: 'No attachment', gender: 'Male' },
    { id: 'dir2', name: 'Ahamed Tamzil', admissionNo: 'ADM-005', gradeClass: 'grade - 3 - A', attachment: 'No attachment', gender: 'Male' },
    { id: 'dir3', name: 'Anu K', admissionNo: 'ADM-7', gradeClass: 'PRE KG - A', attachment: 'No attachment', gender: 'Female' },
    { id: 'dir4', name: 'raja a', admissionNo: 'ADM-2026-003', gradeClass: 'PRE KG - A', attachment: 'No attachment', gender: 'Male' },
  ]);
  const [admissionApplicationsList, setAdmissionApplicationsList] = useState<AdmissionAppItem[]>([
    { id: 'app1', name: 'Siddharth V', parentName: 'Vijay V', classApplied: 'GRADE - 3', status: 'Pending', date: '08-09-2026' }
  ]);
  const [showChangeClassModal, setShowChangeClassModal] = useState(false);
  const [selectedStudentForChange, setSelectedStudentForChange] = useState<any>(null);
  const [targetNewClass, setTargetNewClass] = useState('GRADE - 3 - A');

  // --- Interactive Filter & Pagination States for Student Directory ---
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');
  const [studentDirPage, setStudentDirPage] = useState<number>(1);
  const [studentGenderFilter, setStudentGenderFilter] = useState<string>('All Genders');
  const [studentClassFilter, setStudentClassFilter] = useState<string>('All Classes');
  const [showGenderFilterModal, setShowGenderFilterModal] = useState<boolean>(false);
  const [showClassFilterModal, setShowClassFilterModal] = useState<boolean>(false);

  useEffect(() => {
    setStudentDirPage(1);
  }, [studentSearchQuery, studentGenderFilter, studentClassFilter]);

  // --- 5. Attendance Management State (Screenshot 5 matching) ---
  const [attendanceSubTab, setAttendanceSubTab] = useState<'dashboard' | 'marking' | 'analytics'>('dashboard');
  const [attendanceArchiveDate, setAttendanceArchiveDate] = useState('08-09-2026');

  // --- Noticeboard State ---
  const [noticeboardTab, setNoticeboardTab] = useState<'Global' | 'Class'>('Global');
  const [showCreateNoticeModal, setShowCreateNoticeModal] = useState<boolean>(false);
  const [noticeTitleInput, setNoticeTitleInput] = useState<string>('');
  const [noticeAudienceInput, setNoticeAudienceInput] = useState<string>('All Students & Staff');
  const [noticePriorityInput, setNoticePriorityInput] = useState<'Normal' | 'Important' | 'Urgent'>('Normal');
  const [noticeMessageInput, setNoticeMessageInput] = useState<string>('');
  const [globalNoticesList, setGlobalNoticesList] = useState<any[]>([]);

  // --- Canteen Module State ---
  const [canteenDateFilter, setCanteenDateFilter] = useState<'Today' | 'Past' | 'All'>('Today');
  const [canteenSearchQuery, setCanteenSearchQuery] = useState<string>('');

  // --- Environment Setup State ---
  const [setupSchoolName, setSetupSchoolName] = useState<string>('Zuna International Academy');
  const [setupSchoolAddress, setSetupSchoolAddress] = useState<string>('123 Academic Way, Tech City');
  const [setupSchoolPhone, setSetupSchoolPhone] = useState<string>('+91 98765 43210');
  const [setupSchoolWebsite, setSetupSchoolWebsite] = useState<string>('https://zunaacademy.edu');
  const [setupAcademicYear, setSetupAcademicYear] = useState<string>('2026 - 2027');
  const [setupTermType, setSetupTermType] = useState<string>('Semester (2 Terms)');
  const [setupWorkStart, setSetupWorkStart] = useState<string>('09:00');
  const [setupWorkEnd, setSetupWorkEnd] = useState<string>('16:00');
  const [setupGraceTime, setSetupGraceTime] = useState<string>('15');
  const [setupThreshold, setSetupThreshold] = useState<string>('3');

  // --- HR & Payroll Module State ---
  const [hrPayrollList, setHrPayrollList] = useState<any[]>([
    {
      id: 'pr1',
      teacherId: 't1',
      name: 'Jana D',
      role: 'Teacher',
      baseSalary: 25000,
      pfCalculated: 1800,
      esiCalculated: 0,
      deductions: 1800,
      netPay: 23200,
      month: 'September 2026',
      status: 'Pending',
      createdAt: '2026-09-01',
    },
    {
      id: 'pr2',
      teacherId: 't2',
      name: 'Ragu D',
      role: 'Head Teacher',
      baseSalary: 35000,
      pfCalculated: 1800,
      esiCalculated: 0,
      deductions: 1800,
      netPay: 33200,
      month: 'September 2026',
      status: 'Paid',
      createdAt: '2026-09-01',
    },
  ]);
  const [hrSearchQuery, setHrSearchQuery] = useState('');
  const [showAddHrModal, setShowAddHrModal] = useState(false);
  const [showHrSettingsModal, setShowHrSettingsModal] = useState(false);
  const [showPayslipModalItem, setShowPayslipModalItem] = useState<any>(null);
  const [hrStaffName, setHrStaffName] = useState('Jana D');
  const [hrStaffRole, setHrStaffRole] = useState('Teacher');
  const [hrBaseSalary, setHrBaseSalary] = useState('25000');
  const [hrPaymentStatus, setHrPaymentStatus] = useState<'Pending' | 'Paid'>('Pending');

  // --- Chat Monitor Module State ---
  const [chatThreadsList, setChatThreadsList] = useState<any[]>([
    {
      id: 'thread_101',
      studentId: 'dir2',
      studentName: 'Ahamed Tamzil (GRADE - 3 - A)',
      parentId: 'p101',
      parentName: 'Parent of Ahamed',
      teacherId: 't1',
      teacherName: 'Jana D',
      lastMessage: 'Kindly check the homework details updated for today.',
      lastMessageTime: '10:15 AM',
      messages: [
        { id: 'm1', senderRole: 'Parent', senderName: 'Parent of Ahamed', text: 'Good morning teacher, regarding the science assignment due tomorrow?', timestamp: '09:30 AM' },
        { id: 'm2', senderRole: 'Staff', senderName: 'Jana D', text: 'Kindly check the homework details updated for today.', timestamp: '10:15 AM' },
        { id: 'm3', senderRole: 'Parent', senderName: 'Parent of Ahamed', text: 'Thank you! Received the attachment.', timestamp: '10:20 AM', mediaType: 'document', mediaUrl: 'homework_guide.pdf' },
        { id: 'm4', senderRole: 'Staff', senderName: 'Jana D', text: 'Voice note sent for explanation.', timestamp: '10:22 AM', mediaType: 'audio', mediaUrl: 'voice_note.mp3' },
      ],
    },
    {
      id: 'thread_102',
      studentId: 'dir1',
      studentName: 'pavithran a (PRE KG - A)',
      parentId: 'p102',
      parentName: 'Parent of Pavithran',
      teacherId: 't2',
      teacherName: 'Ragu D',
      lastMessage: 'Thank you for updating the attendance.',
      lastMessageTime: 'Yesterday',
      messages: [
        { id: 'm10', senderRole: 'Parent', senderName: 'Parent of Pavithran', text: 'Is Pavithran feeling better today in class?', timestamp: 'Yesterday 02:15 PM' },
        { id: 'm11', senderRole: 'Staff', senderName: 'Ragu D', text: 'Yes, he participated actively in drawing activity.', timestamp: 'Yesterday 02:30 PM' },
        { id: 'm12', senderRole: 'Parent', senderName: 'Parent of Pavithran', text: 'Message deleted by sender', isDeleted: true, timestamp: 'Yesterday 02:40 PM' },
      ],
    },
  ]);
  const [activeChatThread, setActiveChatThread] = useState<any>(null);
  const [chatSearchQuery, setChatSearchQuery] = useState('');

  // --- Timetables Module State ---
  const [timetableClassSelected, setTimetableClassSelected] = useState('grade - 3 - Section A');
  const [timetableMasterDay, setTimetableMasterDay] = useState('Monday');
  const [timetablesData, setTimetablesData] = useState<any>({
    'grade - 3 - Section A': {
      Monday: [
        { id: 'ts1', startTime: '09:00 AM', endTime: '10:00 AM', subject: 'Mathematics', teacher: 'Jana D' },
        { id: 'ts2', startTime: '10:15 AM', endTime: '11:15 AM', subject: 'English', teacher: 'Ragu D' },
      ],
      Tuesday: [
        { id: 'ts3', startTime: '09:00 AM', endTime: '10:00 AM', subject: 'Science', teacher: 'Jana D' },
      ],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    },
    'PRE KG - Section A': {
      Monday: [
        { id: 'ts4', startTime: '09:30 AM', endTime: '10:30 AM', subject: 'Rhymes & Arts', teacher: 'Ragu D' },
      ],
      Tuesday: [],
      Wednesday: [],
      Thursday: [],
      Friday: [],
    },
  });
  const [showAddSlotModal, setShowAddSlotModal] = useState(false);
  const [slotStartTime, setSlotStartTime] = useState('09:00 AM');
  const [slotEndTime, setSlotEndTime] = useState('10:00 AM');
  const [slotSubject, setSlotSubject] = useState('Mathematics');
  const [slotTeacher, setSlotTeacher] = useState('Jana D');

  // --- Calendar Module State ---
  const [calendarEventsList, setCalendarEventsList] = useState<any[]>([
    { id: 'ev1', title: 'Sunday (Holiday)', start: '2026-09-06', end: '2026-09-06', type: 'holiday' },
    { id: 'ev2', title: 'Terminal Assessment - 1', start: '2026-08-28', end: '2026-08-28', type: 'exam' },
    { id: 'ev3', title: 'Annual Sports Meet', start: '2026-09-15', end: '2026-09-16', type: 'event' },
    { id: 'ev4', title: 'Teacher Training Workshop', start: '2026-09-20', end: '2026-09-20', type: 'event' },
    { id: 'ev5', title: 'Mid-Term Examinations', start: '2026-09-25', end: '2026-09-30', type: 'exam' },
  ]);
  const [calendarDate, setCalendarDate] = useState<Date>(new Date(2026, 8, 1)); // September 2026
  const calendarCurrentMonth = calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const [calendarViewMode, setCalendarViewMode] = useState<'Day' | 'Week' | 'Month' | 'Year'>('Month');
  const [calendarSelectedDayNum, setCalendarSelectedDayNum] = useState<number>(30);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [eventTitleInput, setEventTitleInput] = useState('');
  const [eventTypeInput, setEventTypeInput] = useState<'event' | 'holiday' | 'exam'>('event');
  const [eventStartInput, setEventStartInput] = useState('2026-09-15');
  const [eventEndInput, setEventEndInput] = useState('2026-09-15');

  // --- Exams & Results Module State ---
  const [examActiveSubTab, setExamActiveSubTab] = useState<'manage' | 'reports'>('manage');
  const [examsList, setExamsList] = useState<any[]>([
    {
      id: 'ex1',
      name: 'Terminal Assessment - 1',
      examType: 'Custom Exam',
      subject: 'English',
      maxMarks: 50,
      startDate: '28/08/2026',
      endDate: '28/08/2026',
      status: 'ACTIVE',
    },
    {
      id: 'ex2',
      name: 'Mid-Term Mathematics Exam',
      examType: 'Custom Exam',
      subject: 'Mathematics',
      maxMarks: 100,
      startDate: '15/09/2026',
      endDate: '18/09/2026',
      status: 'UPCOMING',
    },
  ]);
  const [showCreateExamModal, setShowCreateExamModal] = useState(false);
  const [newExamName, setNewExamName] = useState('');
  const [newExamType, setNewExamType] = useState('Custom Exam');
  const [newExamSubject, setNewExamSubject] = useState('English');
  const [newExamMaxMarks, setNewExamMaxMarks] = useState('50');
  const [newExamStartDate, setNewExamStartDate] = useState('28/08/2026');
  const [newExamEndDate, setNewExamEndDate] = useState('28/08/2026');

  const [reportSelectedExam, setReportSelectedExam] = useState('Terminal Assessment - 1');
  const [reportSelectedClass, setReportSelectedClass] = useState('grade - 3 - Section A');
  const [generatedReportCards, setGeneratedReportCards] = useState<any[]>([
    { id: 'r1', studentName: 'Ahamed Tamzil', rollNo: 'ADM-005', marksObtained: 42, maxMarks: 50, percentage: 84, grade: 'A' },
    { id: 'r2', studentName: 'pavithran a', rollNo: '002', marksObtained: 45, maxMarks: 50, percentage: 90, grade: 'A+' },
  ]);

  // --- Homework Module State ---
  const [hwClassFilter, setHwClassFilter] = useState<string>('');
  const [hwTrackingModal, setHwTrackingModal] = useState(false);
  const [hwSelected, setHwSelected] = useState<any>(null);
  const homeworkList: any[] = []; // Empty — matches web "No homework found" empty state

  // --- Fee Management (Full) Module State ---
  const [feeInvoiceSearch, setFeeInvoiceSearch] = useState('');
  const [feeStatusFilter, setFeeStatusFilter] = useState<'all'|'paid'|'unpaid'|'overdue'>('all');
  const [showAssignFeeModal, setShowAssignFeeModal] = useState(false);
  const [newFeeForm, setNewFeeForm] = useState({ name: '', amount: '', dueDate: new Date().toISOString().split('T')[0], classId: '', classLabel: '' });
  const feeInvoicesList: any[] = []; // Empty — matches web "No invoices found"
  const feeStats = { expected: 0, collected: 0, outstanding: 0 };

  // --- Transport Module State ---
  const [transportActiveTab, setTransportActiveTab] = useState<'routes'|'vehicles'|'assignments'>('routes');
  const [transportRoutesList, setTransportRoutesList] = useState<any[]>([]);
  const [transportVehiclesList, setTransportVehiclesList] = useState<any[]>([]);
  const [showAddRouteModal, setShowAddRouteModal] = useState(false);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [newRouteForm, setNewRouteForm] = useState({ name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '' });
  const [newVehicleForm, setNewVehicleForm] = useState({ vehicleName: '', registrationNumber: '', seatingCapacity: '', status: 'Active' });
  const [transportRouteSearch, setTransportRouteSearch] = useState('');

  // --- Library Module State ---
  const [libraryActiveTab, setLibraryActiveTab] = useState<'inventory'|'issued'>('inventory');
  const [librarySearch, setLibrarySearch] = useState('');
  const [showAddBookModal, setShowAddBookModal] = useState(false);
  const [showIssueBookModal, setShowIssueBookModal] = useState(false);
  const [newBookForm, setNewBookForm] = useState({ title: '', author: '', isbn: '', category: 'Fiction', totalQuantity: '1' });
  const [issueBookForm, setIssueBookForm] = useState({ bookId: '', studentName: '', dueDate: '' });
  const libraryBooksList: any[] = [
    { id: 'm1', title: 'To Kill a Mockingbird', author: 'Harper Lee', category: 'FICTION', isbn: '978-0060935467', available: 5, total: 5 },
    { id: 'm2', title: '1984', author: 'George Orwell', category: 'FICTION', isbn: '978-0451524935', available: 3, total: 3 },
    { id: 'm3', title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', category: 'FICTION', isbn: '978-0743273565', available: 4, total: 4 },
    { id: 'm4', title: 'A Brief History of Time', author: 'Stephen Hawking', category: 'SCIENCE', isbn: '978-0553380163', available: 2, total: 2 },
    { id: 'm5', title: 'The Catcher in the Rye', author: 'J.D. Salinger', category: 'FICTION', isbn: '978-0316769488', available: 6, total: 6 },
    { id: 'm6', title: 'Pride and Prejudice', author: 'Jane Austen', category: 'FICTION', isbn: '978-0141439518', available: 3, total: 3 },
    { id: 'm7', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', category: 'COMPUTER SCIENCE', isbn: '978-0262033848', available: 2, total: 2 },
    { id: 'm8', title: 'The Hobbit', author: 'J.R.R. Tolkien', category: 'FANTASY', isbn: '978-0547928227', available: 4, total: 4 },
    { id: 'm9', title: 'Principles of Physics', author: 'David Halliday', category: 'SCIENCE', isbn: '978-1118230725', available: 5, total: 5 },
    { id: 'm10', title: 'Sapiens', author: 'Yuval Noah Harari', category: 'HISTORY', isbn: '978-0062316097', available: 3, total: 3 },
  ];
  const [issuedBooksList, setIssuedBooksList] = useState<any[]>([]);

  // --- Inventory & Assets Module State ---
  const [inventoryActiveTab, setInventoryActiveTab] = useState<'items'|'categories'>('items');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategoryFilter, setInventoryCategoryFilter] = useState('All Categories');
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState('All Statuses');
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [newItemForm, setNewItemForm] = useState({ productId: '', name: '', category: '', quantity: '', unit: 'pcs', status: 'In Stock' });
  const inventoryItemsList: any[] = []; // Empty — matches web empty state
  const inventoryCategoriesList: any[] = [];

  // --- Admit New Student Form State (Pic 1 / Student Directory Matching) ---
  const [admitStudentForm, setAdmitStudentForm] = useState({
    firstName: '',
    lastName: '',
    dob: '12-05-2015',
    age: '11',
    gender: 'Male',
    bloodGroup: 'O+',
    nationality: 'Indian',
    religion: 'Hindu',
    motherTongue: 'English',
    aadharNumber: '',
    homeAddress: '',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    parentOccupation: '',
    emergencyContact: '',
    annualIncome: '',
    siblingName: '',
    classId: 'PRE KG - A',
    admissionNumber: 'ADM-006',
    previousSchool: '',
    previousRecords: '',
    subjectsChosen: '',
    busRoute: 'Route A - Main Street',
    tuitionFee: '25000',
    hostelFee: '',
    bookFee: '3500',
    otherFee: '',
  });

  // --- Leave Management Module State (Pic 2 Matching) ---
  const [leaveTab, setLeaveTab] = useState<'pending' | 'history'>('pending');
  const [leaveRoleFilter, setLeaveRoleFilter] = useState<'All' | 'Teachers' | 'Students'>('All');
  const [showCreateLeaveModal, setShowCreateLeaveModal] = useState<boolean>(false);
  const [newLeaveForm, setNewLeaveForm] = useState({
    applicantName: 'Swetha R',
    applicantRole: 'teacher' as 'teacher' | 'student',
    leaveType: 'Casual Leave',
    startDate: '10-09-2026',
    endDate: '12-09-2026',
    reason: 'Family event in hometown',
  });
  const [leaveRequestsList, setLeaveRequestsList] = useState<any[]>([
    {
      id: 'lv1',
      applicantName: 'Swetha R',
      applicantRole: 'teacher',
      submittedAt: '08-09-2026',
      startDate: '10-09-2026',
      endDate: '12-09-2026',
      leaveType: 'Casual Leave',
      reason: 'Family event in hometown and travel.',
      status: 'Pending',
      hasDoc: false,
    },
    {
      id: 'lv2',
      applicantName: 'Rahul Kumar',
      applicantRole: 'student',
      submittedAt: '07-09-2026',
      startDate: '09-09-2026',
      endDate: '09-09-2026',
      leaveType: 'Medical Leave',
      reason: 'Annual medical consultation and dentist checkup.',
      status: 'Pending',
      hasDoc: true,
    },
    {
      id: 'lv3',
      applicantName: 'Priya Sharma',
      applicantRole: 'teacher',
      submittedAt: '01-09-2026',
      startDate: '02-09-2026',
      endDate: '03-09-2026',
      leaveType: 'Sick Leave',
      reason: 'Doctor advised bed rest for viral infection.',
      status: 'Approved',
      hasDoc: true,
    },
  ]);

  // --- Reports & Analytics Module State (Pic 3 Matching) ---
  const [revenueDataList] = useState<any[]>([
    { month: 'Mar', revenue: 0, pct: 15 },
    { month: 'Apr', revenue: 0, pct: 15 },
    { month: 'May', revenue: 0, pct: 15 },
    { month: 'Jun', revenue: 0, pct: 15 },
    { month: 'Jul', revenue: 0, pct: 15 },
    { month: 'Aug', revenue: 0, pct: 15 },
    { month: 'Sep', revenue: 0, pct: 15 },
  ]);
  const [attendanceDataList] = useState<any[]>([
    { day: 'Wed', attendance: 0, pct: 0 },
    { day: 'Thu', attendance: 0, pct: 0 },
    { day: 'Fri', attendance: 0, pct: 0 },
    { day: 'Sat', attendance: 0, pct: 0 },
    { day: 'Sun', attendance: 0, pct: 0 },
    { day: 'Mon', attendance: 0, pct: 0 },
    { day: 'Tue', attendance: 0, pct: 0 },
  ]);

  // --- API Integrations Module State (Pic 4 Matching) ---
  const [whatsappApiConfig, setWhatsappApiConfig] = useState({
    accessToken: 'EAAG9mZBZCx10BO...masked_token',
    phoneNumberId: '',
    businessAccountId: 'raguswetha2111@gmail.com',
    senderNumber: '+91 ...',
    ptmTemplateName: 'school_ptm_scheduled',
    noticeTemplateName: 'school_notice_notification',
    isConnected: false,
  });
  const [showWhatsappToken, setShowWhatsappToken] = useState(false);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState('');
  const [cloudinaryConfig, setCloudinaryConfig] = useState({
    cloudName: '',
    uploadPreset: '',
  });
  const [testingWhatsappConnection, setTestingWhatsappConnection] = useState(false);

  // --- Registration Links Module State (Pic 5 Matching) ---
  const [copiedLinkType, setCopiedLinkType] = useState<string | null>(null);
  const [staffFormSettings, setStaffFormSettings] = useState({
    employeeId: true,
    phone: true,
    department: true,
  });
  const [savingFormConfig, setSavingFormConfig] = useState(false);
  const [formConfigSaved, setFormConfigSaved] = useState(false);

  // --- Leads Management Module State (Pic 1 Matching) ---
  const [leadsTab, setLeadsTab] = useState<'leads' | 'forms'>('leads');
  const [leadsSearchQuery, setLeadsSearchQuery] = useState('');
  const [leadsStatusFilter, setLeadsStatusFilter] = useState('All');
  const [leadsFormFilter, setLeadsFormFilter] = useState('All');
  const [leadsStartDate, setLeadsStartDate] = useState('');
  const [leadsEndDate, setLeadsEndDate] = useState('');
  const [leadsList, setLeadsList] = useState<any[]>([
    {
      id: 'ld1',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      phone: '+91 98450 12345',
      sourceForm: 'General Admissions 2026-27',
      status: 'New',
      submittedAt: '08-09-2026',
      notes: 'Parent looking for Grade 9 admission details and syllabus.',
    },
    {
      id: 'ld2',
      name: 'Pooja Hegde',
      email: 'pooja.h@example.com',
      phone: '+91 97420 98765',
      sourceForm: 'Kindergarten Enquiry',
      status: 'Contacted',
      submittedAt: '06-09-2026',
      notes: 'School tour scheduled for next Monday 10 AM.',
    },
    {
      id: 'ld3',
      name: 'Deepak Patel',
      email: 'deepak.p@example.com',
      phone: '+91 91234 56789',
      sourceForm: 'High School Enquiry',
      status: 'Interested',
      submittedAt: '03-09-2026',
      notes: 'Interested in Science stream with Robotics lab.',
    },
  ]);
  const [leadsFormsList, setLeadsFormsList] = useState<any[]>([
    { id: 'lf1', title: 'General Admissions 2026-27', submissions: 24, status: 'Active', embedCode: '<iframe src="https://sms.zuna.edu/embed/admissions" />' },
    { id: 'lf2', title: 'Kindergarten Enquiry', submissions: 12, status: 'Active', embedCode: '<iframe src="https://sms.zuna.edu/embed/kg" />' },
    { id: 'lf3', title: 'High School Enquiry', submissions: 18, status: 'Active', embedCode: '<iframe src="https://sms.zuna.edu/embed/highschool" />' },
  ]);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    sourceForm: 'General Admissions 2026-27',
    status: 'New',
    notes: '',
  });
  const [selectedLeadDetails, setSelectedLeadDetails] = useState<any | null>(null);

  // --- Billing & Subscriptions State (Pic 2 Matching) ---
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showUpgradePlanModal, setShowUpgradePlanModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);

  // --- Module Customization State (Pic 3 Matching) ---
  const [customModuleTab, setCustomModuleTab] = useState<'schema' | 'manager'>('schema');
  const [selectedCustomModuleTarget, setSelectedCustomModuleTarget] = useState('Staff Directory');
  const [selectedImportModule, setSelectedImportModule] = useState('');
  const [customModuleSections, setCustomModuleSections] = useState<any[]>([]);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [targetSectionIdForField, setTargetSectionIdForField] = useState('');
  const [newFieldData, setNewFieldData] = useState({ label: '', type: 'text', required: false });

  // --- Roles & Permissions State (Pic 4 Matching) ---
  const DEFAULT_ROLES_LIST = [
    'Correspondent',
    'Principal',
    'Vice Principal',
    'Subject Wise Head',
    'Class Incharge',
    'Staff',
    'Administrative Officer',
    'Finance Department',
    'Library',
    'Canteen',
    'Transport',
    'Janitor',
    'Hostel',
    'Inventory',
    'Security',
  ];
  const DEFAULT_ROLE_MODULES = [
    'Classes & Sections',
    'Subject Management',
    'Student Directory',
    'Staff Management',
    'Timetable & Scheduling',
    'Transport Management (GPS/Routes)',
    'Library Management',
    'Examinations & Report Cards',
    'Noticeboard & Announcements',
    'HR & Payroll Management',
    'Attendance Management',
    'Academic Calendar',
    'Fees & Payments',
    'Hostel Management',
    'Inventory & Assets',
    'Health & Medical Records',
    'Complaint Redressal',
    'Alumni Management',
    'Document Management',
    'Multi-Branch Management',
    'Reports & Analytics',
    'Billing & Subscriptions',
    'Leads Management',
  ];
  const [rolesList, setRolesList] = useState<string[]>(DEFAULT_ROLES_LIST);
  const [selectedRole, setSelectedRole] = useState<string>('Correspondent');
  const [targetLoginPanel, setTargetLoginPanel] = useState<'Admin Panel' | 'Teacher Panel'>('Admin Panel');
  const [showAddRoleModal, setShowAddRoleModal] = useState(false);
  const [newRoleNameInput, setNewRoleNameInput] = useState('');
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, Record<string, { read: boolean; create: boolean; edit: boolean; delete: boolean }>>>(() => {
    const initial: Record<string, Record<string, { read: boolean; create: boolean; edit: boolean; delete: boolean }>> = {};
    DEFAULT_ROLES_LIST.forEach(role => {
      initial[role] = {};
      DEFAULT_ROLE_MODULES.forEach(mod => {
        const isSuper = role === 'Correspondent' || role === 'Principal';
        initial[role][mod] = {
          read: isSuper,
          create: isSuper,
          edit: isSuper,
          delete: isSuper,
        };
      });
    });
    return initial;
  });

  const [gradeFilter, setGradeFilter] = useState<string>('All');
  const [moduleSearchQuery, setModuleSearchQuery] = useState<string>('');
  const [attendanceFilter, setAttendanceFilter] = useState<'All' | 'Present' | 'Absent' | 'OD'>('All');

  // --- Pagination States ---
  const [studentPage, setStudentPage] = useState<number>(1);
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [feePage, setFeePage] = useState<number>(1);
  const [modulePage, setModulePage] = useState<number>(1);

  const RECORD_PAGE_SIZE = 4;
  const MODULE_PAGE_SIZE = 12;

  // --- Student Registration State ---
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentGrade, setNewStudentGrade] = useState('Class 10');
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
    { id: '8', name: 'Divya Nair', grade: 'Class 10', rollNo: '108', attendanceStatus: 'Present', feePaid: true },
    { id: '9', name: 'Rohan Gupta', grade: 'Class 11', rollNo: '109', attendanceStatus: 'Absent', feePaid: false },
    { id: '10', name: 'Meera Menon', grade: 'Class 12', rollNo: '110', attendanceStatus: 'Present', feePaid: true },
  ]);

  // --- 22 Admin Modules for "All Modules" Grid ---
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
    { id: 'm22', name: 'Subject Management', icon: 'journal-outline', color: '#7C3AED' },
    { id: 'm23', name: 'Roles & Permissions', icon: 'shield-checkmark-outline', color: '#6366F1' },
  ];

  // --- Reset Pagination when Filters Change ---
  useEffect(() => {
    setStudentPage(1);
  }, [studentSearchQuery, gradeFilter]);

  useEffect(() => {
    setAttendancePage(1);
  }, [attendanceFilter]);

  useEffect(() => {
    setModulePage(1);
  }, [moduleSearchQuery]);

  // --- Session Check ---
  useEffect(() => {
    const checkSavedSession = async () => {
      try {
        const savedSession = await AsyncStorage.getItem('@zuna_user_session');
        if (savedSession) {
          const sessionData = JSON.parse(savedSession);
          if (sessionData && sessionData.loggedIn) {
            const restoredRole = (sessionData.role || 'Admin') as Role;
            setActiveRole(restoredRole);
            setSelectedDemoRole(restoredRole);
            if (sessionData.email) {
              setLoginEmail(sessionData.email);
            }
            setIsLoggedIn(true);
            if (restoredRole === 'Admin') {
              setActiveAdminTab('Dashboard');
            }
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

      // Determine authenticated user role
      let detectedRole: Role = activeRole;
      if (emailLower.includes('teacher')) {
        detectedRole = 'Teacher';
      } else if (emailLower.includes('student')) {
        detectedRole = 'Student';
      } else if (emailLower.includes('admin')) {
        detectedRole = 'Admin';
      } else {
        detectedRole = activeRole || 'Admin';
      }

      setActiveRole(detectedRole);
      setSelectedDemoRole(detectedRole);
      setIsLoggedIn(true);
      if (detectedRole === 'Admin') {
        setActiveAdminTab('Dashboard');
      }

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
    setSelectedDemoRole(role);
    showToast(`Credentials filled for ${role}. Tap "Log in" to authenticate.`);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('@zuna_user_session');
    } catch (e) {}
    setIsLoggedIn(false);
    setActiveRole('Admin');
    setSelectedDemoRole('Admin');
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

  // --- Admin Handlers for Screenshots 1-5 ---
  const handleAddStaffSubmit = () => {
    if (!newStaffName.trim() || !newStaffEmail.trim()) {
      Alert.alert('Required', 'Please enter staff name and email.');
      return;
    }
    const newStaff: StaffItem = {
      id: Date.now().toString(),
      name: newStaffName.trim(),
      email: newStaffEmail.trim(),
      role: newStaffRole,
      gender: newStaffGender,
      staffType: 'Teaching',
      status: 'Active',
      classAssignments: ['GRADE - 1 (CLASS)'],
      subjectAssignments: ['General (SUBJ)'],
    };
    setStaffList(prev => [newStaff, ...prev]);
    setNewStaffName('');
    setNewStaffEmail('');
    setShowAddStaffModal(false);
    showToast(`Added staff member ${newStaff.name}!`);
  };

  const handleAddClassSubmit = () => {
    if (!newClassName.trim()) {
      Alert.alert('Required', 'Please enter class name.');
      return;
    }
    const newClass: ClassItem = {
      id: Date.now().toString(),
      name: newClassName.trim(),
      section: newClassSection,
      category: newClassCategory,
      studentCount: 0,
    };
    setClassList(prev => [...prev, newClass]);
    setNewClassName('');
    setShowAddClassModal(false);
    showToast(`Created class ${newClass.name} - ${newClass.section}!`);
  };

  const handleAddSubjectSubmit = () => {
    if (!newSubjectName.trim() || !newSubjectCode.trim()) {
      Alert.alert('Required', 'Please enter subject name and code.');
      return;
    }
    const newSub: SubjectItem = {
      id: Date.now().toString(),
      name: newSubjectName.trim(),
      code: newSubjectCode.trim(),
      assignedTeachers: [newSubjectTeacher],
    };
    setSubjectList(prev => [...prev, newSub]);
    setNewSubjectName('');
    setNewSubjectCode('');
    setShowAddSubjectModal(false);
    showToast(`Added subject ${newSub.name} (${newSub.code})!`);
  };

  const handleChangeClassSubmit = () => {
    if (!selectedStudentForChange) return;
    setDirectoryStudents(prev =>
      prev.map(s => (s.id === selectedStudentForChange.id ? { ...s, gradeClass: targetNewClass } : s))
    );
    setShowChangeClassModal(false);
    showToast(`Updated class for ${selectedStudentForChange.name} to ${targetNewClass}`);
  };

  const handleAdmitStudentSubmit = () => {
    if (!admitStudentForm.firstName.trim() || !admitStudentForm.lastName.trim()) {
      Alert.alert('Required Information', 'Please enter student First Name and Last Name.');
      return;
    }
    if (!admitStudentForm.admissionNumber.trim()) {
      Alert.alert('Required Information', 'Please enter an Admission Number.');
      return;
    }

    const fullName = `${admitStudentForm.firstName.trim()} ${admitStudentForm.lastName.trim()}`;
    const newDirStudent = {
      id: 'dir_' + Date.now(),
      name: fullName,
      admissionNo: admitStudentForm.admissionNumber.trim(),
      gradeClass: admitStudentForm.classId || 'PRE KG - A',
      attachment: 'No attachment',
      gender: admitStudentForm.gender || 'Male',
      dob: admitStudentForm.dob,
      parentName: admitStudentForm.parentName,
      parentEmail: admitStudentForm.parentEmail,
      parentPhone: admitStudentForm.parentPhone,
    };

    const newStudent: StudentItem = {
      id: Date.now().toString(),
      name: fullName,
      grade: admitStudentForm.classId || 'PRE KG - A',
      rollNo: admitStudentForm.admissionNumber.trim(),
      attendanceStatus: 'Present',
      feePaid: true,
    };

    setDirectoryStudents(prev => [newDirStudent, ...prev]);
    setStudents(prev => [newStudent, ...prev]);
    setShowStudentModal(false);
    showToast(`Admitted ${fullName} to ${admitStudentForm.classId}!`);
    setActiveAdminTab('Students');

    // Reset fields for next entry
    setAdmitStudentForm(prev => ({
      ...prev,
      firstName: '',
      lastName: '',
      homeAddress: '',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      admissionNumber: `ADM-${Math.floor(100 + Math.random() * 900)}`,
    }));
  };

  const handleRegisterStudentSubmit = () => {
    handleAdmitStudentSubmit();
  };

  // --- Leave Management Handlers ---
  const handleApproveLeave = (leaveId: string) => {
    setLeaveRequestsList(prev =>
      prev.map(l => (l.id === leaveId ? { ...l, status: 'Approved' } : l))
    );
    showToast('Leave request approved successfully!');
  };

  const handleRejectLeave = (leaveId: string) => {
    setLeaveRequestsList(prev =>
      prev.map(l => (l.id === leaveId ? { ...l, status: 'Rejected' } : l))
    );
    showToast('Leave request rejected.');
  };

  const handleCreateLeaveSubmit = () => {
    if (!newLeaveForm.applicantName.trim() || !newLeaveForm.reason.trim()) {
      Alert.alert('Required', 'Please fill in applicant name and reason.');
      return;
    }
    const newLeave = {
      id: 'lv_' + Date.now(),
      applicantName: newLeaveForm.applicantName.trim(),
      applicantRole: newLeaveForm.applicantRole,
      submittedAt: '08-09-2026',
      startDate: newLeaveForm.startDate,
      endDate: newLeaveForm.endDate,
      leaveType: newLeaveForm.leaveType,
      reason: newLeaveForm.reason.trim(),
      status: 'Pending',
      hasDoc: false,
    };
    setLeaveRequestsList(prev => [newLeave, ...prev]);
    setShowCreateLeaveModal(false);
    showToast('Leave request submitted successfully!');
  };

  // --- Reports & Analytics Handlers ---
  const handleDownloadFullReport = () => {
    Share.share({
      title: 'ZUNA School Performance Report',
      message: `ZUNA International Academy - School Performance & Analytics Report\nTotal Revenue: ₹0\nTotal Students Enrolled: ${directoryStudents.length}\nAverage Attendance: 95%\nTotal Teaching Staff: ${staffList.filter(s => s.staffType === 'Teaching').length}\nExport Date: 08-09-2026`,
    }).catch(() => {
      showToast('Exported School Performance Report (XLSX/PDF)');
    });
  };

  // --- API Integrations Handlers ---
  const handleTestWhatsappConnection = () => {
    setTestingWhatsappConnection(true);
    setTimeout(() => {
      setTestingWhatsappConnection(false);
      setWhatsappApiConfig(prev => ({ ...prev, isConnected: true }));
      showToast('WhatsApp Cloud API connected successfully!');
    }, 1200);
  };

  const handleSaveApiConfigurations = () => {
    showToast('API Configurations saved successfully!');
  };

  // --- Registration Links Handlers ---
  const handleCopyLink = (id: string, url: string) => {
    setCopiedLinkType(id);
    showToast(`Copied link to clipboard!`);
    setTimeout(() => setCopiedLinkType(null), 2500);
  };

  const handleShareLink = (title: string, url: string) => {
    Share.share({
      title: title,
      message: `Use the following link to access ZUNA International Academy registration:\n${url}`,
    }).catch(() => {
      showToast('Opened link sharing');
    });
  };

  const handleSaveStaffFormConfig = () => {
    setSavingFormConfig(true);
    setTimeout(() => {
      setSavingFormConfig(false);
      setFormConfigSaved(true);
      showToast('Staff form configuration saved successfully!');
      setTimeout(() => setFormConfigSaved(false), 3000);
    }, 600);
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
        `School: ZUNA International Academy\n\n` +
        `📊 EXECUTIVE METRICS:\n` +
        `• Total Enrolled Students: ${students.length + 402}\n` +
        `• Teaching Staff Count: ${staffList.length}\n` +
        `• Active Classes: ${classList.length} Sections\n` +
        `• Pending Fee Balance: ₹ 2,48,500\n`;
      await Share.share({ title: 'ZUNA Executive Report', message: reportText });
      showToast('Executive Report shared successfully!');
    } catch (error) {}
  };

  // --- Leads Management Handlers ---
  const handleCreateLeadSubmit = () => {
    if (!newLeadForm.name.trim()) {
      Alert.alert('Required', 'Please enter lead contact name.');
      return;
    }
    const created = {
      id: `ld_${Date.now()}`,
      name: newLeadForm.name.trim(),
      email: newLeadForm.email.trim() || 'N/A',
      phone: newLeadForm.phone.trim() || 'N/A',
      sourceForm: newLeadForm.sourceForm,
      status: newLeadForm.status || 'New',
      submittedAt: new Date().toLocaleDateString('en-GB').replace(/\//g, '-'),
      notes: newLeadForm.notes.trim() || 'Direct mobile enquiry logged.',
    };
    setLeadsList([created, ...leadsList]);
    setNewLeadForm({
      name: '',
      email: '',
      phone: '',
      sourceForm: 'General Admissions 2026-27',
      status: 'New',
      notes: '',
    });
    setShowAddLeadModal(false);
    showToast(`Lead for ${created.name} added successfully!`);
  };

  const handleExportLeadsReport = async () => {
    try {
      const summary =
        `📋 ZUNA LEADS MANAGEMENT AUDIT REPORT\n` +
        `----------------------------------------\n` +
        `Total Leads Logged: ${leadsList.length}\n` +
        `Active Lead Forms: ${leadsFormsList.length}\n\n` +
        leadsList.map((l, i) => `${i + 1}. ${l.name} | ${l.phone} | ${l.status} | Form: ${l.sourceForm}`).join('\n');
      await Share.share({ title: 'ZUNA Leads Report', message: summary });
      showToast('Leads Report exported successfully!');
    } catch (e) {}
  };

  const handleUpdateLeadStatus = (leadId: string, nextStatus: string) => {
    setLeadsList(prev =>
      prev.map(l => (l.id === leadId ? { ...l, status: nextStatus } : l))
    );
    showToast(`Lead status updated to ${nextStatus}`);
  };

  const handleDeleteLead = (leadId: string) => {
    setLeadsList(prev => prev.filter(l => l.id !== leadId));
    showToast('Lead record removed.');
  };

  // --- Billing & Subscriptions Handlers ---
  const handleUpgradePlanSubmit = () => {
    setShowUpgradePlanModal(false);
    showToast('Enterprise plan upgrade requested. An account executive will contact you!');
  };

  const handleContactBillingSupport = () => {
    showToast('Connecting to billing support: billing@zuna.academy');
  };

  // --- Module Customization Handlers ---
  const handleAddSectionSubmit = () => {
    if (!newSectionTitle.trim()) {
      Alert.alert('Required', 'Please enter section title.');
      return;
    }
    const newSec = {
      id: `sec_${Date.now()}`,
      title: newSectionTitle.trim(),
      fields: [],
    };
    setCustomModuleSections([...customModuleSections, newSec]);
    setNewSectionTitle('');
    setShowAddSectionModal(false);
    showToast(`Section "${newSec.title}" added.`);
  };

  const handleDeleteSection = (secId: string) => {
    setCustomModuleSections(prev => prev.filter(s => s.id !== secId));
    showToast('Section deleted.');
  };

  const handleAddFieldSubmit = () => {
    if (!newFieldData.label.trim()) {
      Alert.alert('Required', 'Please enter field label.');
      return;
    }
    const fieldId = `f_${Date.now()}`;
    setCustomModuleSections(prev =>
      prev.map(sec => {
        if (sec.id === targetSectionIdForField) {
          return {
            ...sec,
            fields: [
              ...sec.fields,
              {
                id: fieldId,
                label: newFieldData.label.trim(),
                type: newFieldData.type,
                required: newFieldData.required,
              },
            ],
          };
        }
        return sec;
      })
    );
    setNewFieldData({ label: '', type: 'text', required: false });
    setShowAddFieldModal(false);
    showToast('Field added to section.');
  };

  const handleDeleteField = (secId: string, fieldId: string) => {
    setCustomModuleSections(prev =>
      prev.map(sec => {
        if (sec.id === secId) {
          return {
            ...sec,
            fields: sec.fields.filter((f: any) => f.id !== fieldId),
          };
        }
        return sec;
      })
    );
    showToast('Field removed.');
  };

  const handleSaveSchema = () => {
    showToast(`Form Schema for "${selectedCustomModuleTarget}" saved successfully!`);
  };

  const handleImportSchema = (source: string) => {
    if (!source || source === '-- Select Module to Import --') return;
    let imported: any[] = [];
    if (source === 'Staff Directory') {
      imported = [
        {
          id: `sec_${Date.now()}_1`,
          title: 'Personal Information',
          fields: [
            { id: `f_${Date.now()}_1`, label: 'Full Name', type: 'text', required: true },
            { id: `f_${Date.now()}_2`, label: 'Official Email', type: 'email', required: true },
            { id: `f_${Date.now()}_3`, label: 'Contact Phone', type: 'text', required: true },
          ],
        },
        {
          id: `sec_${Date.now()}_2`,
          title: 'Designation & Department',
          fields: [
            { id: `f_${Date.now()}_4`, label: 'Department', type: 'select', required: true },
            { id: `f_${Date.now()}_5`, label: 'Employee ID', type: 'text', required: true },
          ],
        },
      ];
    } else {
      imported = [
        {
          id: `sec_${Date.now()}_1`,
          title: `${source} General Info`,
          fields: [
            { id: `f_${Date.now()}_1`, label: 'Title / Name', type: 'text', required: true },
            { id: `f_${Date.now()}_2`, label: 'Category', type: 'select', required: false },
            { id: `f_${Date.now()}_3`, label: 'Reference Code', type: 'text', required: true },
          ],
        },
      ];
    }
    setCustomModuleSections([...customModuleSections, ...imported]);
    setSelectedImportModule('');
    showToast(`Imported sections from ${source}!`);
  };

  // --- Roles & Permissions Handlers ---
  const handleTogglePermission = (
    moduleName: string,
    actionKey: 'read' | 'create' | 'edit' | 'delete'
  ) => {
    setRolePermissionsMap(prev => {
      const currentRolePerms = prev[selectedRole] || {};
      const currentModulePerms = currentRolePerms[moduleName] || {
        read: false,
        create: false,
        edit: false,
        delete: false,
      };
      return {
        ...prev,
        [selectedRole]: {
          ...currentRolePerms,
          [moduleName]: {
            ...currentModulePerms,
            [actionKey]: !currentModulePerms[actionKey],
          },
        },
      };
    });
  };

  const handleQuickSelectAllModule = (moduleName: string) => {
    const current = rolePermissionsMap[selectedRole]?.[moduleName] || {
      read: false,
      create: false,
      edit: false,
      delete: false,
    };
    const allActive = current.read && current.create && current.edit && current.delete;
    const nextVal = !allActive;

    setRolePermissionsMap(prev => ({
      ...prev,
      [selectedRole]: {
        ...(prev[selectedRole] || {}),
        [moduleName]: {
          read: nextVal,
          create: nextVal,
          edit: nextVal,
          delete: nextVal,
        },
      },
    }));
    showToast(`${nextVal ? 'Granted all' : 'Cleared'} permissions for ${moduleName}`);
  };

  const handleSavePermissions = () => {
    showToast(`Permissions successfully saved for ${selectedRole}!`);
  };

  const handleAddRoleSubmit = () => {
    if (!newRoleNameInput.trim()) {
      Alert.alert('Required', 'Please enter a role name.');
      return;
    }
    const roleName = newRoleNameInput.trim();
    if (rolesList.includes(roleName)) {
      Alert.alert('Exists', 'This role already exists.');
      return;
    }
    setRolesList([...rolesList, roleName]);
    setRolePermissionsMap(prev => {
      const perms: Record<string, { read: boolean; create: boolean; edit: boolean; delete: boolean }> = {};
      DEFAULT_ROLE_MODULES.forEach(mod => {
        perms[mod] = { read: true, create: false, edit: false, delete: false };
      });
      return { ...prev, [roleName]: perms };
    });
    setSelectedRole(roleName);
    setNewRoleNameInput('');
    setShowAddRoleModal(false);
    showToast(`Role "${roleName}" added successfully!`);
  };

  // --- Filtered & Paginated Lists ---
  const filteredDirectoryStudents = directoryStudents.filter(s => {
    const matchesSearch =
      (s.name || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase()) ||
      (s.admissionNo || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase());
    const matchesGender =
      studentGenderFilter === 'All Genders' || s.gender === studentGenderFilter;
    const matchesClass =
      studentClassFilter === 'All Classes' || s.gradeClass === studentClassFilter;
    return matchesSearch && matchesGender && matchesClass;
  });

  const directoryPageSize = 10;
  const directoryTotalPages = Math.ceil(filteredDirectoryStudents.length / directoryPageSize) || 1;
  const paginatedDirectoryStudents = filteredDirectoryStudents.slice(
    (studentDirPage - 1) * directoryPageSize,
    studentDirPage * directoryPageSize
  );

  const filteredStudents = students.filter(s => {
    const matchesSearch = (s.name || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase()) ||
                          (s.rollNo || '').includes(studentSearchQuery) ||
                          (s.grade || '').toLowerCase().includes((studentSearchQuery || '').toLowerCase());
    const matchesGrade = gradeFilter === 'All' || s.grade === gradeFilter;
    const matchesAttendance = attendanceFilter === 'All' || s.attendanceStatus === attendanceFilter;
    return matchesSearch && matchesGrade && matchesAttendance;
  });

  const totalStudentPages = Math.ceil(filteredStudents.length / RECORD_PAGE_SIZE) || 1;
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * RECORD_PAGE_SIZE, studentPage * RECORD_PAGE_SIZE);

  const totalAttendancePages = Math.ceil(filteredStudents.length / RECORD_PAGE_SIZE) || 1;
  const paginatedAttendance = filteredStudents.slice((attendancePage - 1) * RECORD_PAGE_SIZE, attendancePage * RECORD_PAGE_SIZE);

  const totalFeePages = Math.ceil(students.length / RECORD_PAGE_SIZE) || 1;
  const paginatedFeeStudents = students.slice((feePage - 1) * RECORD_PAGE_SIZE, feePage * RECORD_PAGE_SIZE);

  const filteredModules = allModulesList.filter(m =>
    (m.name || '').toLowerCase().includes((moduleSearchQuery || '').toLowerCase())
  );
  const totalModulePages = Math.ceil(filteredModules.length / MODULE_PAGE_SIZE) || 1;
  const paginatedModules = filteredModules.slice((modulePage - 1) * MODULE_PAGE_SIZE, modulePage * MODULE_PAGE_SIZE);

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
              <IconComp name="school-outline" size={36} color="#FFFFFF" />
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
                  Access your school management tasks, students, and modules seamlessly in one place.
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
                  onChangeText={text => {
                    setLoginEmail(text);
                    const lower = (text || '').toLowerCase();
                    if (lower.includes('teacher')) {
                      setActiveRole('Teacher');
                      setSelectedDemoRole('Teacher');
                    } else if (lower.includes('student')) {
                      setActiveRole('Student');
                      setSelectedDemoRole('Student');
                    } else if (lower.includes('admin')) {
                      setActiveRole('Admin');
                      setSelectedDemoRole('Admin');
                    }
                  }}
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

              {/* Quick Demo Access */}
              <View style={styles.quickDemoCardSection}>
                <Text style={styles.quickDemoHeaderTitle}>QUICK DEMO ACCESS</Text>
                <View style={styles.quickPillsRowBox}>
                  <TouchableOpacity
                    style={[
                      styles.quickRolePillBtn,
                      selectedDemoRole === 'Admin' && styles.quickRolePillBtnActiveAdmin,
                    ]}
                    onPress={() => handleDemoQuickLogin('Admin')}>
                    <IconComp
                      name="shield-checkmark-outline"
                      size={14}
                      color={selectedDemoRole === 'Admin' ? '#7C3AED' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.quickRolePillText,
                        selectedDemoRole === 'Admin' && styles.quickRolePillTextActiveAdmin,
                      ]}>
                      Admin
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickRolePillBtn,
                      selectedDemoRole === 'Teacher' && styles.quickRolePillBtnActiveTeacher,
                    ]}
                    onPress={() => handleDemoQuickLogin('Teacher')}>
                    <IconComp
                      name="school-outline"
                      size={14}
                      color={selectedDemoRole === 'Teacher' ? '#2563EB' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.quickRolePillText,
                        selectedDemoRole === 'Teacher' && styles.quickRolePillTextActiveTeacher,
                      ]}>
                      Teacher
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.quickRolePillBtn,
                      selectedDemoRole === 'Student' && styles.quickRolePillBtnActiveStudent,
                    ]}
                    onPress={() => handleDemoQuickLogin('Student')}>
                    <IconComp
                      name="person-outline"
                      size={14}
                      color={selectedDemoRole === 'Student' ? '#059669' : '#64748B'}
                    />
                    <Text
                      style={[
                        styles.quickRolePillText,
                        selectedDemoRole === 'Student' && styles.quickRolePillTextActiveStudent,
                      ]}>
                      Student
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>

          {/* Toast Notification */}
          {toastMessage && (
            <View style={styles.toastBannerBox}>
              <IconComp name="sparkles-outline" size={16} color="#FFFFFF" />
              <Text style={styles.toastBannerText}>{toastMessage}</Text>
            </View>
          )}

          {/* Forgot Password Modal */}
          <Modal visible={showForgotModal} transparent animationType="fade">
            <View style={styles.modalOverlayDark}>
              <View style={styles.modalCardContainer}>
                <View style={styles.modalHeaderTitleRow}>
                  <IconComp name="key-outline" size={20} color="#7C3AED" />
                  <Text style={styles.modalCardTitle}>Forgot Password</Text>
                </View>
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
  // 3. ROLE-BASED PORTAL ROUTING
  // =========================================================================

  // --- TEACHER PORTAL DESTINATION (Merge Mount Point) ---
  if (activeRole === 'Teacher') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.mainAppContainer} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

          {/* Top Header Card */}
          <View style={styles.topHeaderBar}>
            <View style={[styles.headerLogoBadge, { backgroundColor: '#2563EB' }]}>
              <IconComp name="school-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={styles.schoolBrandDetails}>
              <Text style={styles.headerBrandTitle} numberOfLines={1} ellipsizeMode="tail">
                Zuna International Academy
              </Text>
              <View style={styles.schoolSubRow}>
                <View style={[styles.officialBadgeInline, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <IconComp name="checkmark-circle-outline" size={13} color="#2563EB" />
                  <Text style={[styles.officialBadgeText, { color: '#2563EB' }]}>Teacher</Text>
                </View>
                <Text style={styles.dotSeparator}>·</Text>
                <Text style={styles.headerBrandSub}>Teacher portal</Text>
              </View>
            </View>

            <View style={styles.headerRightProfile}>
              <View style={[styles.avatarPill, { backgroundColor: '#EFF6FF' }]}>
                <Text style={[styles.avatarPillText, { color: '#2563EB' }]}>TC</Text>
              </View>
              <TouchableOpacity
                style={styles.logoutCircleBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
                accessibilityLabel="Logout">
                <IconComp name="log-out-outline" size={18} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast Banner */}
          {toastMessage && (
            <View style={styles.toastBannerBox}>
              <IconComp name="sparkles-outline" size={16} color="#FFFFFF" />
              <Text style={styles.toastBannerText}>{toastMessage}</Text>
            </View>
          )}

          {/* =========================================================================
              TEACHER PORTAL MOUNT POINT
              The incoming Teacher Portal component should mount here upon branch merge:
              <TeacherPortal userEmail={loginEmail} onLogout={handleLogout} />
             ========================================================================= */}
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <ModuleHeaderCard
              icon="school-outline"
              title="Teacher Portal"
              subtitle="Teacher workspace for attendance marking, grading, daily timetable & parent communications."
              badgeText="Merge Ready"
            />

            <View style={styles.mergePendingCard}>
              <View style={styles.mergePendingIconCircle}>
                <IconComp name="git-pull-request-outline" size={32} color="#2563EB" />
              </View>
              <Text style={styles.mergePendingTitle}>Teacher Portal Branch Merge Pending</Text>
              <Text style={styles.mergePendingDesc}>
                This destination is reserved for the Teacher Mobile Portal currently being developed on a separate branch.
              </Text>

              <View style={styles.mergeStatusDetailsBox}>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Authenticated Role:</Text>
                  <Text style={[styles.mergeStatusVal, { color: '#2563EB' }]}>Teacher</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>User Email:</Text>
                  <Text style={styles.mergeStatusVal}>{loginEmail || 'teacher@zuna.edu'}</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Navigation State:</Text>
                  <Text style={styles.mergeStatusVal}>Connected to Teacher Portal Route</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Incoming Merge Target:</Text>
                  <Text style={styles.mergeStatusVal}>TeacherPortal.tsx</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryLoginBtn, { backgroundColor: '#2563EB', marginTop: 16, flexDirection: 'row', gap: 8, paddingHorizontal: 20 }]}
                onPress={handleLogout}>
                <IconComp name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryLoginBtnText}>Log Out & Switch Portal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // --- STUDENT PORTAL DESTINATION (Merge Mount Point) ---
  if (activeRole === 'Student') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.mainAppContainer} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

          {/* Top Header Card */}
          <View style={styles.topHeaderBar}>
            <View style={[styles.headerLogoBadge, { backgroundColor: '#059669' }]}>
              <IconComp name="person-outline" size={22} color="#FFFFFF" />
            </View>

            <View style={styles.schoolBrandDetails}>
              <Text style={styles.headerBrandTitle} numberOfLines={1} ellipsizeMode="tail">
                Zuna International Academy
              </Text>
              <View style={styles.schoolSubRow}>
                <View style={[styles.officialBadgeInline, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <IconComp name="checkmark-circle-outline" size={13} color="#059669" />
                  <Text style={[styles.officialBadgeText, { color: '#059669' }]}>Student</Text>
                </View>
                <Text style={styles.dotSeparator}>·</Text>
                <Text style={styles.headerBrandSub}>Student portal</Text>
              </View>
            </View>

            <View style={styles.headerRightProfile}>
              <View style={[styles.avatarPill, { backgroundColor: '#ECFDF5' }]}>
                <Text style={[styles.avatarPillText, { color: '#059669' }]}>ST</Text>
              </View>
              <TouchableOpacity
                style={styles.logoutCircleBtn}
                onPress={handleLogout}
                activeOpacity={0.7}
                accessibilityLabel="Logout">
                <IconComp name="log-out-outline" size={18} color="#475569" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Toast Banner */}
          {toastMessage && (
            <View style={styles.toastBannerBox}>
              <IconComp name="sparkles-outline" size={16} color="#FFFFFF" />
              <Text style={styles.toastBannerText}>{toastMessage}</Text>
            </View>
          )}

          {/* =========================================================================
              STUDENT PORTAL MOUNT POINT
              The incoming Student Portal component should mount here upon branch merge:
              <StudentPortal userEmail={loginEmail} onLogout={handleLogout} />
             ========================================================================= */}
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            <ModuleHeaderCard
              icon="person-outline"
              title="Student Portal"
              subtitle="Access your academic schedules, syllabus, homework, exam marks & attendance records."
              badgeText="Merge Ready"
            />

            <View style={styles.mergePendingCard}>
              <View style={[styles.mergePendingIconCircle, { backgroundColor: '#ECFDF5' }]}>
                <IconComp name="git-pull-request-outline" size={32} color="#059669" />
              </View>
              <Text style={styles.mergePendingTitle}>Student Portal Branch Merge Pending</Text>
              <Text style={styles.mergePendingDesc}>
                This destination is reserved for the Student Mobile Portal currently being developed on a separate branch.
              </Text>

              <View style={styles.mergeStatusDetailsBox}>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Authenticated Role:</Text>
                  <Text style={[styles.mergeStatusVal, { color: '#059669' }]}>Student</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>User Email:</Text>
                  <Text style={styles.mergeStatusVal}>{loginEmail || 'student@zuna.edu'}</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Navigation State:</Text>
                  <Text style={styles.mergeStatusVal}>Connected to Student Portal Route</Text>
                </View>
                <View style={styles.mergeStatusRow}>
                  <Text style={styles.mergeStatusLabel}>Incoming Merge Target:</Text>
                  <Text style={styles.mergeStatusVal}>StudentPortal.tsx</Text>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.primaryLoginBtn, { backgroundColor: '#059669', marginTop: 16, flexDirection: 'row', gap: 8, paddingHorizontal: 20 }]}
                onPress={handleLogout}>
                <IconComp name="log-out-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryLoginBtnText}>Log Out & Switch Portal</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // =========================================================================
  // 4. MAIN ADMIN MOBILE EXPERIENCE (activeRole === 'Admin')
  // =========================================================================
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.mainAppContainer} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />

        {/* --- Top Header Card (Compact Single Row Design) --- */}
        <View style={styles.topHeaderBar}>
          <View style={styles.headerLogoBadge}>
            <IconComp name="school-outline" size={22} color="#FFFFFF" />
          </View>

          <View style={styles.schoolBrandDetails}>
            <Text style={styles.headerBrandTitle} numberOfLines={1} ellipsizeMode="tail">
              Zuna International Academy
            </Text>
            <View style={styles.schoolSubRow}>
              <View style={styles.officialBadgeInline}>
                <IconComp name="checkmark-circle-outline" size={13} color="#16A34A" />
                <Text style={styles.officialBadgeText}>Official</Text>
              </View>
              <Text style={styles.dotSeparator}>·</Text>
              <Text style={styles.headerBrandSub}>Admin portal</Text>
            </View>
          </View>

          <View style={styles.headerRightProfile}>
            <View style={styles.avatarPill}>
              <Text style={styles.avatarPillText}>AD</Text>
            </View>
            <TouchableOpacity
              style={styles.logoutCircleBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityLabel="Logout">
              <IconComp name="log-out-outline" size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Toast Banner */}
        {toastMessage && (
          <View style={styles.toastBannerBox}>
            <IconComp name="sparkles-outline" size={16} color="#FFFFFF" />
            <Text style={styles.toastBannerText}>{toastMessage}</Text>
          </View>
        )}

        {/* --- Main Screen Content Area --- */}
        <View style={{ flex: 1 }}>

          {/* ==================== TAB 1: DASHBOARD ==================== */}
          {activeAdminTab === 'Dashboard' && (
            <ScrollView
              contentContainerStyle={styles.tabScrollContentWithFloatingNav}
              showsVerticalScrollIndicator={false}>

              {/* Greeting & Header Title Card */}
              <ModuleHeaderCard
                title="Dashboard Overview"
                subtitle="Welcome back, here's what's happening at your school today."
                primaryButton={{
                  label: "Generate Invite Links",
                  icon: "link-outline",
                  onPress: () => showToast('Invite links copied to clipboard'),
                }}
                secondaryActions={[
                  {
                    label: "Customize",
                    icon: "options-outline",
                    onPress: () => showToast('Dashboard customized'),
                  },
                  {
                    label: "08/09/2026",
                    icon: "calendar-outline",
                  },
                ]}
              />

              {/* 4 Metric Summary Cards Grid (2x2) */}
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
                  <Text style={styles.metricNumberValue}>4</Text>
                  <Text style={[styles.metricTrendText, { color: '#059669' }]}>+12% from last month</Text>
                </TouchableOpacity>

                {/* Metric 2: Teaching Staff */}
                <TouchableOpacity style={styles.metricCard} onPress={() => setActiveModuleModal('Staff Directory')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#F3E8FF' }]}>
                      <IconComp name="people-outline" size={20} color="#7C3AED" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Teaching Staff</Text>
                  <Text style={styles.metricNumberValue}>{staffList.length}</Text>
                  <Text style={[styles.metricTrendText, { color: '#059669' }]}>+2 new this month</Text>
                </TouchableOpacity>

                {/* Metric 3: Active Classes */}
                <TouchableOpacity style={styles.metricCard} onPress={() => setActiveModuleModal('Classes & Sections')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#ECFDF5' }]}>
                      <IconComp name="book-outline" size={20} color="#059669" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>Active Classes</Text>
                  <Text style={styles.metricNumberValue}>{classList.length}</Text>
                  <Text style={[styles.metricTrendText, { color: '#2563EB' }]}>Across all sections</Text>
                </TouchableOpacity>

                {/* Metric 4: School Notices */}
                <TouchableOpacity style={styles.metricCard} onPress={() => setActiveModuleModal('Noticeboard')}>
                  <View style={styles.metricIconRow}>
                    <View style={[styles.metricIconCircle, { backgroundColor: '#FFF7ED' }]}>
                      <IconComp name="notifications-outline" size={20} color="#D97706" />
                    </View>
                    <IconComp name="chevron-forward-outline" size={16} color="#94A3B8" />
                  </View>
                  <Text style={styles.metricLabelTitle}>School Notices</Text>
                  <Text style={styles.metricNumberValue}>{globalNoticesList.length}</Text>
                  <Text style={[styles.metricTrendText, { color: '#64748B' }]}>Broadcasts active</Text>
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
                    <TouchableOpacity onPress={() => setActiveModuleModal('Noticeboard')}>
                      <Text style={styles.viewAllLinkText}>View All</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.emptyNoticeStateBox}>
                    <IconComp name="notifications-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyNoticeTitle}>No notices yet</Text>
                    <Text style={styles.emptyNoticeSub}>Create a notice to keep everyone informed.</Text>
                    <TouchableOpacity
                      style={styles.createNoticeOutlineBtn}
                      onPress={() => setActiveModuleModal('Noticeboard')}>
                      <IconComp name="add-outline" size={14} color="#7C3AED" />
                      <Text style={styles.createNoticeBtnText}>Create Notice</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* System Status Dark Card */}
                <View style={styles.navyStatusCardBox}>
                  <Text style={styles.navyCardTitle}>System Status</Text>
                  <View style={styles.statusOnlineIndicatorRow}>
                    <View style={styles.greenPulseDot} />
                    <Text style={styles.statusOnlineText}>All modules running smoothly</Text>
                  </View>

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
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '0%' }]} />
                    </View>
                    <Text style={styles.percentCollectedText}>0% Collected</Text>
                  </View>

                  <View style={styles.navySubBoxContainer}>
                    <View style={styles.navySubBoxHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconComp name="calendar-outline" size={16} color="#38BDF8" />
                        <Text style={styles.navySubBoxTitle}>Academic Calendar</Text>
                      </View>
                      <Text style={styles.navySubBoxBadgeText}>Events</Text>
                    </View>
                    <Text style={styles.percentCollectedText}>0 Upcoming Events</Text>
                  </View>

                  <View style={styles.navySubBoxContainer}>
                    <View style={styles.navySubBoxHeaderRow}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconComp name="people-outline" size={16} color="#A78BFA" />
                        <Text style={styles.navySubBoxTitle}>HR & Payroll</Text>
                      </View>
                      <View style={styles.pendingBadgePill}>
                        <Text style={styles.pendingBadgeText}>Pending</Text>
                      </View>
                    </View>
                    <Text style={styles.percentCollectedText}>Payroll Pending</Text>
                  </View>

                  <TouchableOpacity
                    style={styles.configureEnvBtn}
                    onPress={() => setActiveModuleModal('Environment Setup')}>
                    <Text style={styles.configureEnvBtnText}>Configure Environment</Text>
                  </TouchableOpacity>
                </View>

                {/* Quick Actions Grid */}
                <View style={styles.sectionCardBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <IconComp name="flash-outline" size={18} color="#EC4899" />
                    <Text style={styles.sectionCardTitle}>Quick Actions</Text>
                  </View>

                  <View style={styles.quickActionsGridBox}>
                    <TouchableOpacity
                      style={styles.actionGridCardItem}
                      onPress={() => setShowStudentModal(true)}>
                      <View style={[styles.actionCardIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <IconComp name="person-add-outline" size={20} color="#2563EB" />
                      </View>
                      <Text style={styles.actionCardLabel}>Add Student</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionGridCardItem}
                      onPress={() => setShowAddStaffModal(true)}>
                      <View style={[styles.actionCardIconBox, { backgroundColor: '#F3E8FF' }]}>
                        <IconComp name="person-circle-outline" size={20} color="#7C3AED" />
                      </View>
                      <Text style={styles.actionCardLabel}>Add Staff</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionGridCardItem}
                      onPress={() => setActiveAdminTab('Attendance')}>
                      <View style={[styles.actionCardIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <IconComp name="checkbox-outline" size={20} color="#059669" />
                      </View>
                      <Text style={styles.actionCardLabel}>Mark Attendance</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionGridCardItem}
                      onPress={() => setActiveModuleModal('Noticeboard')}>
                      <View style={[styles.actionCardIconBox, { backgroundColor: '#FFF7ED' }]}>
                        <IconComp name="create-outline" size={20} color="#D97706" />
                      </View>
                      <Text style={styles.actionCardLabel}>Create Notice</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.actionGridCardItem}
                      onPress={() => showToast('Database space optimized & cleaned')}>
                      <View style={[styles.actionCardIconBox, { backgroundColor: '#FEF2F2' }]}>
                        <IconComp name="trash-outline" size={20} color="#DC2626" />
                      </View>
                      <Text style={styles.actionCardLabel}>Cleanup DB Space</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Today's Attendance Card */}
                <View style={styles.sectionCardBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                    <IconComp name="stats-chart-outline" size={18} color="#059669" />
                    <Text style={styles.sectionCardTitle}>Today's Attendance</Text>
                  </View>

                  <View style={styles.attendanceSummaryHeaderRow}>
                    <Text style={styles.attendanceBigPercent}>85%</Text>
                    <Text style={styles.attendanceAverageSubText}>SCHOOL AVERAGE</Text>
                  </View>

                  <View style={styles.attendanceBarItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barCategoryTitle}>Students</Text>
                      <Text style={styles.barPercentValue}>82% Present</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '82%', backgroundColor: '#059669' }]} />
                    </View>
                  </View>

                  <View style={styles.attendanceBarItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barCategoryTitle}>Teaching Staff</Text>
                      <Text style={styles.barPercentValue}>95% Present</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '95%', backgroundColor: '#059669' }]} />
                    </View>
                  </View>

                  <View style={styles.attendanceBarItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barCategoryTitle}>Non-Teaching Staff</Text>
                      <Text style={styles.barPercentValue}>50% Present</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '50%', backgroundColor: '#059669' }]} />
                    </View>
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          {/* ==================== TAB 2: STUDENT DIRECTORY & ADMISSIONS (Screenshot 4 Matching) ==================== */}
          {activeAdminTab === 'Students' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              {/* Purple Hero Header Card */}
              <ModuleHeaderCard
                icon="people-outline"
                title="Student Directory & Admissions"
                badgeText={`SEATS: ${students.length} / 500`}
                subtitle="Review public admission applications, admit verified students, and manage enrollment directory."
              />

              {/* Action Buttons Top Bar */}
              <View style={styles.actionButtonsTopRow}>
                <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Exported student list to Excel/PDF')}>
                  <IconComp name="download-outline" size={14} color="#475569" />
                  <Text style={styles.outlineActionBtnText}>Export</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.greenOutlineActionBtn} onPress={() => showToast('Bulk Import modal opened')}>
                  <IconComp name="cloud-upload-outline" size={14} color="#059669" />
                  <Text style={styles.greenOutlineBtnText}>Bulk Import</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowStudentModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.purplePrimaryBtnText}>New Admission</Text>
                </TouchableOpacity>
              </View>

              {/* Directory Sub-Tabs: Enrolled Students vs Admission Applications */}
              <View style={styles.moduleTabRow}>
                <TouchableOpacity
                  style={[styles.moduleTabBtn, studentDirectoryTab === 'enrolled' && styles.moduleTabBtnActive]}
                  onPress={() => setStudentDirectoryTab('enrolled')}>
                  <Text style={[styles.moduleTabText, studentDirectoryTab === 'enrolled' && styles.moduleTabTextActive]}>
                    Enrolled Students ({directoryStudents.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.moduleTabBtn, studentDirectoryTab === 'applications' && styles.moduleTabBtnActive]}
                  onPress={() => setStudentDirectoryTab('applications')}>
                  <Text style={[styles.moduleTabText, studentDirectoryTab === 'applications' && styles.moduleTabTextActive]}>
                    Admission Applications ({admissionApplicationsList.length})
                  </Text>
                </TouchableOpacity>
              </View>

              {/* 4 Stat Summary Cards Grid (Screenshot 4 Matching) */}
              <View style={styles.metricsGridContainer}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabelTitle}>SEATS ENROLLED</Text>
                  <Text style={styles.metricNumberValue}>4 <Text style={{ fontSize: 13, color: '#64748B' }}>/ 500</Text></Text>
                  <View style={[styles.progressBarTrack, { marginTop: 6 }]}>
                    <View style={[styles.progressBarFill, { width: '1%', backgroundColor: '#7C3AED' }]} />
                  </View>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIconRow}>
                    <Text style={styles.metricLabelTitle}>ACTIVE</Text>
                    <IconComp name="checkmark-circle-outline" size={16} color="#059669" />
                  </View>
                  <Text style={styles.metricNumberValue}>4</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIconRow}>
                    <Text style={styles.metricLabelTitle}>BOYS</Text>
                    <IconComp name="man-outline" size={16} color="#2563EB" />
                  </View>
                  <Text style={styles.metricNumberValue}>3</Text>
                </View>

                <View style={styles.metricCard}>
                  <View style={styles.metricIconRow}>
                    <Text style={styles.metricLabelTitle}>GIRLS</Text>
                    <IconComp name="woman-outline" size={16} color="#EC4899" />
                  </View>
                  <Text style={styles.metricNumberValue}>1</Text>
                </View>
              </View>

              {/* Search Bar (Full Width Row) */}
              <View style={styles.searchInputWrapperFullWidth}>
                <IconComp name="search-outline" size={18} color="#94A3B8" />
                <TextInput
                  style={styles.searchTextInput}
                  placeholder="Search by student name or admission number..."
                  placeholderTextColor="#94A3B8"
                  value={studentSearchQuery}
                  onChangeText={setStudentSearchQuery}
                />
                {studentSearchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setStudentSearchQuery('')}>
                    <IconComp name="close-circle-outline" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Interactive Filter Pills Row with Generous Spacing */}
              <View style={styles.filterPillsRowContainer}>
                <TouchableOpacity
                  style={[
                    styles.interactiveFilterPillBtn,
                    studentGenderFilter !== 'All Genders' && styles.interactiveFilterPillActive,
                  ]}
                  onPress={() => setShowGenderFilterModal(true)}
                  activeOpacity={0.7}>
                  <IconComp
                    name="man-outline"
                    size={14}
                    color={studentGenderFilter !== 'All Genders' ? '#7C3AED' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.interactiveFilterPillText,
                      studentGenderFilter !== 'All Genders' && styles.interactiveFilterPillTextActive,
                    ]}>
                    {studentGenderFilter}
                  </Text>
                  <IconComp
                    name="chevron-down-outline"
                    size={12}
                    color={studentGenderFilter !== 'All Genders' ? '#7C3AED' : '#64748B'}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.interactiveFilterPillBtn,
                    studentClassFilter !== 'All Classes' && styles.interactiveFilterPillActive,
                  ]}
                  onPress={() => setShowClassFilterModal(true)}
                  activeOpacity={0.7}>
                  <IconComp
                    name="school-outline"
                    size={14}
                    color={studentClassFilter !== 'All Classes' ? '#7C3AED' : '#475569'}
                  />
                  <Text
                    style={[
                      styles.interactiveFilterPillText,
                      studentClassFilter !== 'All Classes' && styles.interactiveFilterPillTextActive,
                    ]}>
                    {studentClassFilter}
                  </Text>
                  <IconComp
                    name="chevron-down-outline"
                    size={12}
                    color={studentClassFilter !== 'All Classes' ? '#7C3AED' : '#64748B'}
                  />
                </TouchableOpacity>

                {(studentGenderFilter !== 'All Genders' || studentClassFilter !== 'All Classes') && (
                  <TouchableOpacity
                    style={styles.resetFilterBtn}
                    onPress={() => {
                      setStudentGenderFilter('All Genders');
                      setStudentClassFilter('All Classes');
                      showToast('Student filters reset');
                    }}>
                    <Text style={styles.resetFilterBtnText}>Reset</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Enrolled Students Card List */}
              {studentDirectoryTab === 'enrolled' ? (
                <View style={{ gap: 10 }}>
                  {paginatedDirectoryStudents.map(st => (
                    <View key={st.id} style={styles.studentCardContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={styles.avatarCircleInitial}>
                          <Text style={styles.avatarInitialText}>{(st.name || 'S').slice(0, 2)}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentNameTitle}>{st.name}</Text>
                          <Text style={styles.studentSubText}>Admission No: <Text style={{ fontWeight: '700', color: '#334155' }}>{st.admissionNo}</Text></Text>
                          <View style={styles.classBadgePill}>
                            <Text style={styles.classBadgeText}>{st.gradeClass}</Text>
                          </View>
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={() => showToast(`Viewing details for ${st.name}`)}>
                              <IconComp name="eye-outline" size={18} color="#64748B" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => showToast(`Deleted student ${st.name}`)}>
                              <IconComp name="trash-outline" size={18} color="#DC2626" />
                            </TouchableOpacity>
                          </View>

                          <TouchableOpacity
                            style={styles.changeClassBtn}
                            onPress={() => {
                              setSelectedStudentForChange(st);
                              setShowChangeClassModal(true);
                            }}>
                            <Text style={styles.changeClassBtnText}>Change Class</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}

                  {paginatedDirectoryStudents.length === 0 && (
                    <View style={styles.emptyNoticeStateBox}>
                      <IconComp name="search-outline" size={32} color="#CBD5E1" />
                      <Text style={styles.emptyNoticeTitle}>No matching students found</Text>
                      <Text style={styles.emptyNoticeSub}>Try adjusting your search query or gender/class filters.</Text>
                    </View>
                  )}
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {admissionApplicationsList.map(app => (
                    <View key={app.id} style={styles.studentCardContainer}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={styles.studentNameTitle}>{app.name}</Text>
                          <Text style={styles.studentSubText}>Parent: {app.parentName} • Applied: {app.classApplied}</Text>
                          <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Submitted on: {app.date}</Text>
                        </View>
                        <View style={styles.pendingBadgePill}>
                          <Text style={styles.pendingBadgeText}>{app.status}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              {/* Pagination Controls - ONLY shown when filtered students > 10 */}
              {filteredDirectoryStudents.length > directoryPageSize && (
                <PaginationControls
                  currentPage={studentDirPage}
                  totalPages={directoryTotalPages}
                  totalItems={filteredDirectoryStudents.length}
                  pageSize={directoryPageSize}
                  onPageChange={setStudentDirPage}
                />
              )}

            </ScrollView>
          )}

          {/* ==================== TAB 3: ATTENDANCE MANAGEMENT (Screenshot 5 Matching) ==================== */}
          {activeAdminTab === 'Attendance' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              {/* Purple Hero Header Card */}
              <ModuleHeaderCard
                icon="clipboard-outline"
                title="Attendance Management"
                subtitle="View analytics, run cutoff audits, and log student attendance records."
              />

              {/* Header Navigation Pills: Dashboard | Daily Marking | Analytics (Screenshot 5 Matching) */}
              <View style={styles.subHeaderPillsContainer}>
                <TouchableOpacity
                  style={[styles.subHeaderPillBtn, attendanceSubTab === 'dashboard' && styles.subHeaderPillBtnActive]}
                  onPress={() => setAttendanceSubTab('dashboard')}>
                  <IconComp name="grid-outline" size={16} color={attendanceSubTab === 'dashboard' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.subHeaderPillText, attendanceSubTab === 'dashboard' && styles.subHeaderPillTextActive]}>
                    Dashboard
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subHeaderPillBtn, attendanceSubTab === 'marking' && styles.subHeaderPillBtnActive]}
                  onPress={() => setAttendanceSubTab('marking')}>
                  <IconComp name="clipboard-outline" size={16} color={attendanceSubTab === 'marking' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.subHeaderPillText, attendanceSubTab === 'marking' && styles.subHeaderPillTextActive]}>
                    Daily Marking
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subHeaderPillBtn, attendanceSubTab === 'analytics' && styles.subHeaderPillBtnActive]}
                  onPress={() => setAttendanceSubTab('analytics')}>
                  <IconComp name="stats-chart-outline" size={16} color={attendanceSubTab === 'analytics' ? '#7C3AED' : '#64748B'} />
                  <Text style={[styles.subHeaderPillText, attendanceSubTab === 'analytics' && styles.subHeaderPillTextActive]}>
                    Analytics
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Content Mode 1: Dashboard View (Screenshot 5 Exact Matching) */}
              {attendanceSubTab === 'dashboard' && (
                <View style={{ gap: 14 }}>
                  {/* Historical Archives Date Card */}
                  <View style={styles.historicalArchivesCard}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <IconComp name="calendar-outline" size={20} color="#7C3AED" />
                      <View>
                        <Text style={styles.archivesTitleText}>Historical Archives</Text>
                        <Text style={styles.archivesSubText}>Select a calendar date to view the daily attendance snapshot.</Text>
                      </View>
                    </View>
                    <View style={styles.datePickerInputBox}>
                      <Text style={styles.datePickerText}>{attendanceArchiveDate}</Text>
                      <IconComp name="calendar-sharp" size={14} color="#64748B" />
                    </View>
                  </View>

                  {/* Empty / No Statistics Calculated Card (Screenshot 5 Matching) */}
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="clipboard-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No Statistics Calculated</Text>
                    <Text style={styles.emptyModuleSub}>
                      There are no dashboard records compiled for {attendanceArchiveDate}. Marks must be saved to compile stats.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionPurpleBtn}
                      onPress={() => setAttendanceSubTab('marking')}>
                      <IconComp name="create-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyActionBtnText}>Go to Daily Marking</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Content Mode 2: Daily Marking View */}
              {attendanceSubTab === 'marking' && (
                <View style={{ gap: 14 }}>
                  <View style={styles.attendanceFilterCard}>
                    <View style={styles.controlDropdownRow}>
                      <View style={[styles.dropdownBox, { flex: 1 }]}>
                        <IconComp name="calendar-outline" size={16} color="#64748B" />
                        <Text style={styles.dropdownTextValue}>08-09-2026</Text>
                      </View>
                      <View style={[styles.dropdownBox, { flex: 1 }]}>
                        <Text style={styles.dropdownTextValue}>Class 10</Text>
                      </View>
                      <View style={[styles.dropdownBox, { flex: 1 }]}>
                        <Text style={styles.dropdownTextValue}>Section A</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.sectionCardBox}>
                    <View style={styles.tableHeaderRow}>
                      <Text style={[styles.tableHeaderText, { width: 50 }]}>Roll No</Text>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>Student Name</Text>
                      <Text style={[styles.tableHeaderText, { width: 80, textAlign: 'right' }]}>Status</Text>
                    </View>

                    {paginatedAttendance.map(student => (
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
                </View>
              )}

              {/* Content Mode 3: Analytics View */}
              {attendanceSubTab === 'analytics' && (
                <View style={styles.sectionCardBox}>
                  <Text style={styles.sectionCardTitle}>Monthly Attendance Analytics</Text>
                  <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 12 }}>
                    Overall school attendance rating is currently at 85%.
                  </Text>
                  <View style={styles.attendanceBarItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barCategoryTitle}>Grade 3</Text>
                      <Text style={styles.barPercentValue}>92% Average</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '92%', backgroundColor: '#059669' }]} />
                    </View>
                  </View>
                  <View style={styles.attendanceBarItem}>
                    <View style={styles.barLabelRow}>
                      <Text style={styles.barCategoryTitle}>PRE KG</Text>
                      <Text style={styles.barPercentValue}>78% Average</Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: '78%', backgroundColor: '#059669' }]} />
                    </View>
                  </View>
                </View>
              )}

            </ScrollView>
          )}

          {/* ==================== TAB 4: FEES & PAYMENTS ==================== */}
          {activeAdminTab === 'Fees' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              {/* Purple Hero Header Card */}
              <ModuleHeaderCard
                icon="card-outline"
                title="Fees & Financials"
                subtitle="Track fee collections, monitor payment status, and send reminders."
              />

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

              {/* Student Fee Roster (Paginated) */}
              <View style={styles.sectionCardBox}>
                <Text style={styles.sectionCardTitle}>Student Fee Status</Text>
                {paginatedFeeStudents.map(s => (
                  <View key={s.id} style={styles.activityItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.studentNameText}>{s.name}</Text>
                      <Text style={styles.studentDetailsSubText}>{s.grade} • Roll No: {s.rollNo}</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.smallFeeActionBtn, s.feePaid ? styles.feePaidStyle : styles.feeUnpaidStyle]}
                      onPress={() => toggleFeeStatus(s.id)}>
                      <IconComp
                        name={s.feePaid ? 'checkmark-circle-outline' : 'close-circle-outline'}
                        size={14}
                        color={s.feePaid ? '#059669' : '#DC2626'}
                      />
                      <Text style={[styles.smallFeeActionBtnText, { marginLeft: 4 }]}>
                        {s.feePaid ? 'Paid' : 'Unpaid'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Pagination Controls for Fee Roster */}
                <PaginationControls
                  currentPage={feePage}
                  totalPages={totalFeePages}
                  totalItems={students.length}
                  pageSize={RECORD_PAGE_SIZE}
                  onPageChange={setFeePage}
                />

                <TouchableOpacity
                  style={[styles.primaryLoginBtn, { marginTop: 16, backgroundColor: '#7C3AED', flexDirection: 'row', gap: 8 }]}
                  onPress={() => showToast('Fee Reminders dispatched via SMS & Email!')}>
                  <IconComp name="send-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.primaryLoginBtnText}>Send Payment Reminders</Text>
                </TouchableOpacity>
              </View>

            </ScrollView>
          )}

          {/* ==================== TAB 5: ALL MODULES (GRID VIEW PAGINATED) ==================== */}
          {activeAdminTab === 'All Modules' && (
            <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
              
              <ModuleHeaderCard
                icon="apps-outline"
                title="All Modules"
                badgeText={`${allModulesList.length} Available`}
                subtitle="Browse and access all academic, administrative, and operations modules."
              />

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

              {/* 22 Modules Responsive Grid (Paginated 12 per page) */}
              <View style={styles.modulesGridContainer}>
                {paginatedModules.map(mod => (
                  <TouchableOpacity
                    key={mod.id}
                    style={styles.moduleGridCard}
                    onPress={() => {
                      setActiveModuleModal(mod.name);
                      showToast(`Opened ${mod.name} Module`);
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.moduleCardTopRow}>
                      <View style={[styles.moduleIconBoxCircle, { backgroundColor: `${mod.color}15` }]}>
                        <IconComp name={mod.icon} size={20} color={mod.color} />
                      </View>
                      <IconComp name="chevron-forward-outline" size={14} color="#CBD5E1" />
                    </View>
                    <Text style={styles.moduleGridTitleText} numberOfLines={2}>{mod.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Pagination Controls for All Modules Grid */}
              <PaginationControls
                currentPage={modulePage}
                totalPages={totalModulePages}
                totalItems={filteredModules.length}
                pageSize={MODULE_PAGE_SIZE}
                onPageChange={setModulePage}
              />

            </ScrollView>
          )}

        </View>

        {/* ========================================================================= */}
        {/* FLOATING BOTTOM NAVIGATION BAR */}
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

        {/* --- FULL-SCREEN MODULE DETAIL MODAL --- */}
        <Modal visible={!!activeModuleModal} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Top Navigation Bar */}
            <View style={styles.moduleModalTopNav}>
              <TouchableOpacity
                style={styles.moduleBackBtn}
                onPress={() => setActiveModuleModal(null)}>
                <IconComp name="arrow-back-outline" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.moduleNavTitleText} numberOfLines={1}>{activeModuleModal}</Text>
                <Text style={styles.moduleNavSubText}>ZUNA Admin Mobile Portal</Text>
              </View>
              
              {activeModuleModal === 'Staff Directory' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowAddStaffModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Add Staff</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'Classes & Sections' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowAddClassModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Create Class</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'Subject Management' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowAddSubjectModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Add Subject</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'HR & Payroll' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowAddHrModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Add Record</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'Timetables' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => showToast('Timetable changes saved successfully')}>
                  <IconComp name="checkmark-done-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Save Changes</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'Calendar' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowAddEventModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Add Event</Text>
                </TouchableOpacity>
              )}

              {activeModuleModal === 'Exams & Results' && (
                <TouchableOpacity
                  style={styles.moduleHeaderPrimaryBtn}
                  onPress={() => setShowCreateExamModal(true)}>
                  <IconComp name="add-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.moduleHeaderBtnText}>Create Exam</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* --- SCREENSHOT 1: STAFF DIRECTORY & ATTACHMENTS --- */}
            {activeModuleModal === 'Staff Directory' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="person-add-outline"
                  title="Staff Directory & Attachments"
                  badgeText={`${staffList.length} Staff`}
                  subtitle="Manage your teachers, upload documents, and assign classes."
                />

                {/* Top Action Buttons */}
                <View style={styles.actionButtonsTopRow}>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Exported staff directory')}>
                    <IconComp name="download-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowAddStaffModal(true)}>
                    <IconComp name="add-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>+ Add Staff</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => showToast('Bulk Import staff modal opened')}>
                    <IconComp name="cloud-upload-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>Bulk Import</Text>
                  </TouchableOpacity>
                </View>

                {/* 6 Metric Cards Row (Screenshot 1 Matching) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginVertical: 12 }}>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>TOTAL STAFF</Text>
                    <Text style={styles.smallStatValue}>{staffList.length}</Text>
                  </View>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>ACTIVE</Text>
                    <Text style={[styles.smallStatValue, { color: '#059669' }]}>{staffList.length}</Text>
                  </View>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>MALE STAFF</Text>
                    <Text style={styles.smallStatValue}>{staffList.filter(s => s.gender === 'Male').length}</Text>
                  </View>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>FEMALE STAFF</Text>
                    <Text style={styles.smallStatValue}>{staffList.filter(s => s.gender === 'Female').length}</Text>
                  </View>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>TEACHERS</Text>
                    <Text style={styles.smallStatValue}>{staffList.length}</Text>
                  </View>
                  <View style={styles.smallStatBoxItem}>
                    <Text style={styles.smallStatLabel}>NON-TEACHING</Text>
                    <Text style={styles.smallStatValue}>0</Text>
                  </View>
                </ScrollView>

                {/* Staff Cards List */}
                <View style={{ gap: 10 }}>
                  {staffList.map(st => (
                    <View key={st.id} style={styles.studentCardContainer}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <View style={[styles.avatarCircleInitial, { backgroundColor: '#EDE9FE' }]}>
                          <Text style={[styles.avatarInitialText, { color: '#7C3AED' }]}>{(st.name || 'S')[0]}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentNameTitle}>{st.name}</Text>
                          <Text style={styles.studentSubText}>📧 {st.email}</Text>

                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                            {st.classAssignments.map((ca, idx) => (
                              <View key={idx} style={[styles.classBadgePill, { backgroundColor: '#F3E8FF' }]}>
                                <Text style={[styles.classBadgeText, { color: '#7C3AED' }]}>{ca}</Text>
                              </View>
                            ))}
                            {st.subjectAssignments.map((sa, idx) => (
                              <View key={idx} style={[styles.classBadgePill, { backgroundColor: '#EFF6FF' }]}>
                                <Text style={[styles.classBadgeText, { color: '#2563EB' }]}>{sa}</Text>
                              </View>
                            ))}
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                          <TouchableOpacity onPress={() => showToast(`Viewing staff profile: ${st.name}`)}>
                            <IconComp name="eye-outline" size={18} color="#64748B" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => showToast(`Removed staff member: ${st.name}`)}>
                            <IconComp name="trash-outline" size={18} color="#DC2626" />
                          </TouchableOpacity>
                          <TouchableOpacity style={styles.editOutlineBtn} onPress={() => showToast(`Editing staff: ${st.name}`)}>
                            <Text style={styles.editOutlineBtnText}>Edit</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* --- SCREENSHOT 2: CLASSES & SECTIONS MANAGEMENT --- */}
            {activeModuleModal === 'Classes & Sections' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="school-outline"
                  title="Class & Section Management"
                  subtitle="Define the academic structure and categories of your institution."
                />

                {/* Top Action Buttons */}
                <View style={styles.actionButtonsTopRow}>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => setShowCategoryModal(true)}>
                    <IconComp name="tags-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Manage Categories</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Bulk import classes modal opened')}>
                    <IconComp name="cloud-upload-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Bulk Import</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowAddClassModal(true)}>
                    <IconComp name="add-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>+ Create New Class</Text>
                  </TouchableOpacity>
                </View>

                {/* Filter Row */}
                <View style={styles.searchFilterBoxContainer}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569' }}>Filters:</Text>
                  <View style={styles.pageSizePillBox}>
                    <Text style={styles.pageSizePillText}>All Categories</Text>
                    <IconComp name="chevron-down-outline" size={12} color="#64748B" />
                  </View>
                  <View style={styles.pageSizePillBox}>
                    <Text style={styles.pageSizePillText}>All Classes</Text>
                    <IconComp name="chevron-down-outline" size={12} color="#64748B" />
                  </View>
                </View>

                {/* Class Cards Grid / Stacked Cards (Screenshot 2 Matching) */}
                <View style={{ gap: 12 }}>
                  {classList.map(cl => (
                    <View key={cl.id} style={styles.classCardBoxItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <IconComp name="book-outline" size={20} color="#7C3AED" />
                        <Text style={styles.classCardTitle}>{cl.name}</Text>
                        <View style={[styles.classBadgePill, { backgroundColor: '#F3E8FF' }]}>
                          <Text style={[styles.classBadgeText, { color: '#7C3AED' }]}>{cl.section}</Text>
                        </View>
                        <View style={[styles.classBadgePill, { backgroundColor: '#FCE7F3' }]}>
                          <Text style={[styles.classBadgeText, { color: '#BE185D' }]}>{cl.category}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconComp name="people-outline" size={14} color="#64748B" />
                        <Text style={styles.classCardSubText}>{cl.studentCount} Students currently assigned</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* --- SCREENSHOT 3: SUBJECT MANAGEMENT --- */}
            {activeModuleModal === 'Subject Management' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="journal-outline"
                  title="Subject Management"
                  subtitle="Create subjects and assign them to teaching staff."
                />

                <View style={[styles.actionButtonsTopRow, { justifyContent: 'flex-end' }]}>
                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowAddSubjectModal(true)}>
                    <IconComp name="add-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>+ Add Subject</Text>
                  </TouchableOpacity>
                </View>

                {/* Subject Cards Grid (Screenshot 3 Matching) */}
                <View style={{ gap: 12, marginTop: 12 }}>
                  {subjectList.map(sub => (
                    <View key={sub.id} style={styles.classCardBoxItem}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconComp name="book-outline" size={20} color="#7C3AED" />
                          <View>
                            <Text style={styles.classCardTitle}>{sub.name}</Text>
                            <Text style={{ fontSize: 12, color: '#64748B' }}>{sub.code}</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={() => showToast(`Edit subject ${sub.name}`)}>
                            <IconComp name="pencil-outline" size={16} color="#64748B" />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => showToast(`Delete subject ${sub.name}`)}>
                            <IconComp name="trash-outline" size={16} color="#DC2626" />
                          </TouchableOpacity>
                        </View>
                      </View>

                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', marginBottom: 4 }}>
                        ASSIGNED TEACHERS
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {sub.assignedTeachers.map((t, idx) => (
                          <View key={idx} style={[styles.classBadgePill, { backgroundColor: '#F3E8FF' }]}>
                            <Text style={[styles.classBadgeText, { color: '#7C3AED' }]}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* --- MODULE: NOTICEBOARD --- */}
            {activeModuleModal === 'Noticeboard' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="megaphone-outline"
                  title="Noticeboard"
                  subtitle="Broadcast global announcements and oversee class notices."
                />

                <View style={styles.moduleTabRow}>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, noticeboardTab === 'Global' && styles.moduleTabBtnActive]}
                    onPress={() => setNoticeboardTab('Global')}>
                    <Text style={[styles.moduleTabText, noticeboardTab === 'Global' && styles.moduleTabTextActive]}>
                      Global Notices ({globalNoticesList.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, noticeboardTab === 'Class' && styles.moduleTabBtnActive]}
                    onPress={() => setNoticeboardTab('Class')}>
                    <Text style={[styles.moduleTabText, noticeboardTab === 'Class' && styles.moduleTabTextActive]}>
                      Class Notices
                    </Text>
                  </TouchableOpacity>
                </View>

                {noticeboardTab === 'Global' && globalNoticesList.length === 0 ? (
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="notifications-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No active notices</Text>
                    <Text style={styles.emptyModuleSub}>
                      Click 'Create Global Notice' to broadcast an announcement.
                    </Text>
                    <TouchableOpacity
                      style={styles.emptyActionPurpleBtn}
                      onPress={() => setShowCreateNoticeModal(true)}>
                      <IconComp name="add-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyActionBtnText}>Create Global Notice</Text>
                    </TouchableOpacity>
                  </View>
                ) : noticeboardTab === 'Global' ? (
                  <View style={{ gap: 12 }}>
                    {globalNoticesList.map((notice, idx) => (
                      <View key={idx} style={styles.noticeCardItem}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View style={[styles.priorityPill, { backgroundColor: '#FFF7ED' }]}>
                            <Text style={styles.priorityPillText}>{notice.priority || 'Normal'}</Text>
                          </View>
                          <Text style={styles.noticeDateText}>{notice.date}</Text>
                        </View>
                        <Text style={styles.noticeItemTitle}>{notice.title}</Text>
                        <Text style={styles.noticeItemAudience}>Target: {notice.audience}</Text>
                        <Text style={styles.noticeItemMsg}>{notice.message}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="school-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No class notices posted yet</Text>
                    <Text style={styles.emptyModuleSub}>
                      Teacher-submitted class notices will appear here automatically.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* --- MODULE 1: HR & PAYROLL --- */}
            {activeModuleModal === 'HR & Payroll' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="cash-outline"
                  title="HR & Payroll"
                  subtitle="Manage staff salaries, deductions, and payslips."
                  secondaryActions={[
                    {
                      label: "Settings",
                      icon: "settings-outline",
                      onPress: () => setShowHrSettingsModal(true),
                    },
                    {
                      label: "Bulk Export",
                      icon: "download-outline",
                      onPress: () => showToast('Exporting Payroll Report Excel...'),
                    },
                  ]}
                />

                {/* Metric Cards Row */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' }}>
                        <IconComp name="cash-outline" size={20} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857', letterSpacing: 0.5 }}>TOTAL PAYROLL</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#064E3B', marginTop: 2 }}>
                          ₹{hrPayrollList.reduce((acc, curr) => acc + (curr.netPay || 0), 0)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#F3E8FF', borderColor: '#DDD6FE' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#8B5CF6', justifyContent: 'center', alignItems: 'center' }}>
                        <IconComp name="briefcase-outline" size={20} color="#FFFFFF" />
                      </View>
                      <View>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#6D28D9', letterSpacing: 0.5 }}>STAFF COUNT</Text>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#4C1D95', marginTop: 2 }}>
                          {hrPayrollList.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Search Bar */}
                <View style={styles.searchBarWrapperFull}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputField}
                    placeholder="Search by name or role..."
                    placeholderTextColor="#94A3B8"
                    value={hrSearchQuery}
                    onChangeText={setHrSearchQuery}
                  />
                </View>

                {/* Payroll Records List */}
                <View style={{ gap: 12 }}>
                  {hrPayrollList
                    .filter(
                      item =>
                        item.name.toLowerCase().includes(hrSearchQuery.toLowerCase()) ||
                        item.role.toLowerCase().includes(hrSearchQuery.toLowerCase())
                    )
                    .map(item => (
                      <View key={item.id} style={styles.studentCardContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#E2E8F0', justifyContent: 'center', alignItems: 'center' }}>
                              <Text style={{ fontWeight: '700', color: '#334155' }}>{item.name.charAt(0)}</Text>
                            </View>
                            <View>
                              <Text style={styles.studentCardNameText}>{item.name}</Text>
                              <Text style={{ fontSize: 12, color: '#64748B' }}>{item.role} • {item.month}</Text>
                            </View>
                          </View>
                          <View
                            style={[
                              styles.statusPillBadge,
                              { backgroundColor: item.status === 'Paid' ? '#DCFCE7' : '#FEF3C7' },
                            ]}>
                            <Text style={[styles.statusPillText, { color: item.status === 'Paid' ? '#15803D' : '#D97706' }]}>
                              {item.status}
                            </Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 10, gap: 12, marginBottom: 10 }}>
                          <View style={{ flex: 1, minWidth: 100 }}>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>Base Salary</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>₹{item.baseSalary}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 100 }}>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>Deductions (PF/ESI)</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#DC2626' }}>-₹{item.deductions}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 100 }}>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>Net Payable</Text>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#059669' }}>₹{item.netPay}</Text>
                          </View>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
                          <TouchableOpacity
                            style={[styles.smallWhiteOutlineBtn, { borderColor: '#7C3AED' }]}
                            onPress={() => setShowPayslipModalItem(item)}>
                            <IconComp name="document-text-outline" size={14} color="#7C3AED" />
                            <Text style={[styles.smallWhiteOutlineBtnText, { color: '#7C3AED' }]}>View Payslip</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.smallWhiteOutlineBtn, { borderColor: '#EF4444' }]}
                            onPress={() => {
                              setHrPayrollList(prev => prev.filter(p => p.id !== item.id));
                              showToast('Payroll record deleted');
                            }}>
                            <IconComp name="trash-outline" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                </View>
              </ScrollView>
            )}

            {/* --- MODULE 2: CHAT MONITOR --- */}
            {activeModuleModal === 'Chat Monitor' && (
              <View style={{ flex: 1 }}>
                {!activeChatThread ? (
                  <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                    <ModuleHeaderCard
                      icon="shield-checkmark-outline"
                      title="Chat Monitor"
                      subtitle="Audit and monitor all communications between parents and staff."
                    />

                    <View style={styles.searchBarWrapperFull}>
                      <IconComp name="search-outline" size={18} color="#94A3B8" />
                      <TextInput
                        style={styles.searchInputField}
                        placeholder="Search threads..."
                        placeholderTextColor="#94A3B8"
                        value={chatSearchQuery}
                        onChangeText={setChatSearchQuery}
                      />
                    </View>

                    <View style={{ gap: 10 }}>
                      {chatThreadsList.map(thread => (
                        <TouchableOpacity
                          key={thread.id}
                          style={styles.studentCardContainer}
                          onPress={() => setActiveChatThread(thread)}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center' }}>
                              <IconComp name="chatbubbles-outline" size={22} color="#DC2626" />
                            </View>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={styles.studentCardNameText}>{thread.studentName}</Text>
                                <Text style={{ fontSize: 11, color: '#94A3B8' }}>{thread.lastMessageTime}</Text>
                              </View>
                              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                                Parent: {thread.parentName} • Staff: {thread.teacherName}
                              </Text>
                              <Text style={{ fontSize: 13, color: '#334155', marginTop: 4 }} numberOfLines={1}>
                                {thread.lastMessage}
                              </Text>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                ) : (
                  <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    {/* Active Thread Audit Header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: '#FEF2F2', borderBottomWidth: 1, borderBottomColor: '#FCA5A5', gap: 10 }}>
                      <TouchableOpacity onPress={() => setActiveChatThread(null)} style={{ padding: 4 }}>
                        <IconComp name="arrow-back-outline" size={20} color="#991B1B" />
                      </TouchableOpacity>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#991B1B' }}>
                          Monitoring: {activeChatThread.studentName}
                        </Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', textTransform: 'uppercase' }}>
                          Read-Only Audit Mode
                        </Text>
                      </View>
                    </View>

                    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
                      {activeChatThread.messages.map((msg: any) => (
                        <View
                          key={msg.id}
                          style={{
                            alignSelf: msg.senderRole === 'Staff' ? 'flex-end' : 'flex-start',
                            maxWidth: '82%',
                            backgroundColor: msg.senderRole === 'Staff' ? '#7C3AED' : '#FFFFFF',
                            padding: 12,
                            borderRadius: 16,
                            borderWidth: msg.senderRole === 'Staff' ? 0 : 1,
                            borderColor: '#E2E8F0',
                          }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: msg.senderRole === 'Staff' ? '#E9D5FF' : '#64748B', marginBottom: 2 }}>
                            {msg.senderName} ({msg.senderRole})
                          </Text>
                          {msg.isDeleted ? (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEE2E2', padding: 4, borderRadius: 6, marginTop: 4 }}>
                              <IconComp name="ban-outline" size={12} color="#DC2626" />
                              <Text style={{ fontSize: 11, color: '#B91C1C', fontStyle: 'italic', fontWeight: '600' }}>
                                Deleted by Sender
                              </Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 14, color: msg.senderRole === 'Staff' ? '#FFFFFF' : '#0F172A' }}>
                              {msg.text}
                            </Text>
                          )}
                          {msg.mediaType === 'document' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8 }}>
                              <IconComp name="document-text-outline" size={16} color={msg.senderRole === 'Staff' ? '#FFFFFF' : '#334155'} />
                              <Text style={{ fontSize: 12, textDecorationLine: 'underline', color: msg.senderRole === 'Staff' ? '#FFFFFF' : '#334155' }}>
                                View Document ({msg.mediaUrl})
                              </Text>
                            </View>
                          )}
                          {msg.mediaType === 'audio' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, padding: 8, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8 }}>
                              <IconComp name="play-circle-outline" size={18} color={msg.senderRole === 'Staff' ? '#FFFFFF' : '#334155'} />
                              <Text style={{ fontSize: 12, color: msg.senderRole === 'Staff' ? '#FFFFFF' : '#334155' }}>
                                Voice Note Attachment
                              </Text>
                            </View>
                          )}
                          <Text style={{ fontSize: 10, color: msg.senderRole === 'Staff' ? '#D8B4FE' : '#94A3B8', textAlign: 'right', marginTop: 4 }}>
                            {msg.timestamp}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Disabled Bottom Input Bar */}
                    <View style={{ padding: 12, backgroundColor: '#F1F5F9', borderTopWidth: 1, borderTopColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <IconComp name="lock-closed-outline" size={16} color="#64748B" />
                      <Text style={{ fontSize: 12, color: '#64748B', flex: 1, fontStyle: 'italic' }}>
                        Audit mode: Read-only monitoring enabled for security and compliance.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* --- MODULE 3: TIMETABLES --- */}
            {activeModuleModal === 'Timetables' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="calendar-outline"
                  title="Timetable Management"
                  subtitle="Structure the weekly schedule for each class."
                />

                {/* Class Selector Pills */}
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 }}>SELECT CLASS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                  {['grade - 3 - Section A', 'PRE KG - Section A'].map(cName => (
                    <TouchableOpacity
                      key={cName}
                      style={[
                        styles.filterChipItem,
                        timetableClassSelected === cName && styles.filterChipItemActive,
                      ]}
                      onPress={() => setTimetableClassSelected(cName)}>
                      <Text style={[styles.filterChipText, timetableClassSelected === cName && styles.filterChipTextActive]}>
                        {cName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Day Navigation Tabs */}
                <View style={styles.moduleTabRow}>
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'].map(day => (
                    <TouchableOpacity
                      key={day}
                      style={[styles.moduleTabBtn, timetableMasterDay === day && styles.moduleTabBtnActive]}
                      onPress={() => setTimetableMasterDay(day)}>
                      <Text style={[styles.moduleTabText, timetableMasterDay === day && styles.moduleTabTextActive]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Master Timetable Section */}
                <View style={styles.studentCardContainer}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <View>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Master Timetable</Text>
                      <Text style={{ fontSize: 12, color: '#64748B' }}>
                        Overview for {timetableClassSelected} ({timetableMasterDay})
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.emptyActionPurpleBtn}
                      onPress={() => setShowAddSlotModal(true)}>
                      <IconComp name="add-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.emptyActionBtnText}>Add Period</Text>
                    </TouchableOpacity>
                  </View>

                  {(!timetablesData[timetableClassSelected] ||
                    !timetablesData[timetableClassSelected][timetableMasterDay] ||
                    timetablesData[timetableClassSelected][timetableMasterDay].length === 0) ? (
                    <View style={{ padding: 24, alignItems: 'center' }}>
                      <IconComp name="time-outline" size={32} color="#CBD5E1" />
                      <Text style={{ fontSize: 14, color: '#64748B', marginTop: 8 }}>
                        No periods scheduled for {timetableMasterDay}.
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {timetablesData[timetableClassSelected][timetableMasterDay].map((slot: any) => (
                        <View key={slot.id} style={{ padding: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <IconComp name="time-outline" size={16} color="#7C3AED" />
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>
                                {slot.startTime} - {slot.endTime}
                              </Text>
                            </View>
                            <TouchableOpacity
                              onPress={() => {
                                setTimetablesData((prev: any) => {
                                  const updatedDay = prev[timetableClassSelected][timetableMasterDay].filter((s: any) => s.id !== slot.id);
                                  return {
                                    ...prev,
                                    [timetableClassSelected]: {
                                      ...prev[timetableClassSelected],
                                      [timetableMasterDay]: updatedDay,
                                    },
                                  };
                                });
                                showToast('Period removed');
                              }}>
                              <IconComp name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                          <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A', marginTop: 4 }}>
                            {slot.subject}
                          </Text>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Teacher: {slot.teacher}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </ScrollView>
            )}

            {/* --- MODULE 4: ACADEMIC CALENDAR --- */}
            {activeModuleModal === 'Calendar' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="calendar-outline"
                  title="Academic Calendar"
                  subtitle="Manage academic events, holidays, and examination dates."
                />

                {/* Month Navigator Header Bar */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <TouchableOpacity style={styles.arrowIconButton} onPress={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() - 1);
                      setCalendarDate(d);
                      setCalendarSelectedDayNum(1);
                    }}>
                      <IconComp name="chevron-back-outline" size={16} color="#334155" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{calendarCurrentMonth}</Text>
                    <TouchableOpacity style={styles.arrowIconButton} onPress={() => {
                      const d = new Date(calendarDate);
                      d.setMonth(d.getMonth() + 1);
                      setCalendarDate(d);
                      setCalendarSelectedDayNum(1);
                    }}>
                      <IconComp name="chevron-forward-outline" size={16} color="#334155" />
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.smallWhiteOutlineBtn, { borderColor: '#7C3AED' }]}
                    onPress={() => {
                      setCalendarDate(new Date(2026, 8, 1));
                      setCalendarSelectedDayNum(new Date().getDate());
                    }}>
                    <Text style={[styles.smallWhiteOutlineBtnText, { color: '#7C3AED' }]}>Today</Text>
                  </TouchableOpacity>
                </View>

                {/* View Mode Selector Tabs: Day | Week | Month | Year */}
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 16, marginBottom: 14, gap: 4 }}>
                  {(['Day', 'Week', 'Month', 'Year'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 12,
                        alignItems: 'center',
                        backgroundColor: calendarViewMode === mode ? '#7C3AED' : 'transparent',
                      }}
                      onPress={() => setCalendarViewMode(mode)}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: calendarViewMode === mode ? '#FFFFFF' : '#64748B' }}>
                        {mode}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* 7-Column Calendar Month Grid Container */}
                <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                  {/* Days Initials Row: S M T W T F S */}
                  <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8, marginBottom: 10 }}>
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, idx) => (
                      <Text key={idx} style={{ flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#94A3B8' }}>
                        {d}
                      </Text>
                    ))}
                  </View>

                  {/* Date Grid Cells — dynamic for current calendarDate month */}
                  {(() => {
                    const year = calendarDate.getFullYear();
                    const month = calendarDate.getMonth();
                    const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysInPrevMonth = new Date(year, month, 0).getDate();
                    const cells: React.ReactElement[] = [];
                    // Offset cells from previous month
                    for (let i = firstDay - 1; i >= 0; i--) {
                      const prevD = daysInPrevMonth - i;
                      cells.push(
                        <View key={`prev-${prevD}`} style={{ width: '14.28%', height: 44, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 13, color: '#CBD5E1', fontWeight: '500' }}>{prevD}</Text>
                        </View>
                      );
                    }
                    // Current month days
                    for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
                      const isSelected = calendarSelectedDayNum === dayNum;
                      const dayOfWeek = new Date(year, month, dayNum).getDay();
                      const isSunday = dayOfWeek === 0;
                      cells.push(
                        <TouchableOpacity
                          key={dayNum}
                          style={{ width: '14.28%', height: 44, justifyContent: 'center', alignItems: 'center' }}
                          onPress={() => setCalendarSelectedDayNum(dayNum)}>
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              backgroundColor: isSelected ? '#7C3AED' : 'transparent',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: isSelected ? '800' : '600',
                                color: isSelected ? '#FFFFFF' : isSunday ? '#DC2626' : '#1E293B',
                              }}>
                              {dayNum}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }
                    return <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells}</View>;
                  })()}
                </View>

                {/* Selected Date Activities / Events Details Bar */}
                <View style={{ backgroundColor: '#7C3AED', borderRadius: 16, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF' }}>
                    Activities for {calendarSelectedDayNum} {calendarCurrentMonth}
                  </Text>
                  <TouchableOpacity
                    style={[styles.smallWhiteOutlineBtn, { backgroundColor: '#FFFFFF', borderColor: '#FFFFFF' }]}
                    onPress={() => setShowAddEventModal(true)}>
                    <IconComp name="add-outline" size={14} color="#7C3AED" />
                    <Text style={[styles.smallWhiteOutlineBtnText, { color: '#7C3AED' }]}>Add Event</Text>
                  </TouchableOpacity>
                </View>

                {/* Events list for selected date or month agenda */}
                <View style={{ gap: 10 }}>
                  {calendarEventsList.map(ev => (
                    <View key={ev.id} style={styles.noticeCardItem}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View
                          style={[
                            styles.priorityPill,
                            {
                              backgroundColor:
                                ev.type === 'holiday' ? '#FEE2E2' : ev.type === 'exam' ? '#FFEDD5' : '#F3E8FF',
                            },
                          ]}>
                          <Text
                            style={[
                              styles.priorityPillText,
                              {
                                color:
                                  ev.type === 'holiday' ? '#DC2626' : ev.type === 'exam' ? '#D97706' : '#7C3AED',
                              },
                            ]}>
                            {ev.type.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>{ev.start}</Text>
                      </View>
                      <Text style={styles.noticeItemTitle}>{ev.title}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            {/* --- MODULE 5: EXAMS & RESULTS --- */}
            {activeModuleModal === 'Exams & Results' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="document-text-outline"
                  title="Examinations & Results"
                  subtitle="Manage school-wide exams and generate report cards."
                />

                {/* Sub-Tabs Row */}
                <View style={styles.moduleTabRow}>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, examActiveSubTab === 'manage' && styles.moduleTabBtnActive]}
                    onPress={() => setExamActiveSubTab('manage')}>
                    <Text style={[styles.moduleTabText, examActiveSubTab === 'manage' && styles.moduleTabTextActive]}>
                      Manage Exams
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, examActiveSubTab === 'reports' && styles.moduleTabBtnActive]}
                    onPress={() => setExamActiveSubTab('reports')}>
                    <Text style={[styles.moduleTabText, examActiveSubTab === 'reports' && styles.moduleTabTextActive]}>
                      Report Cards
                    </Text>
                  </TouchableOpacity>
                </View>

                {examActiveSubTab === 'manage' ? (
                  <View style={{ gap: 12 }}>
                    {examsList.map(exam => (
                      <View key={exam.id} style={styles.studentCardContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={[styles.priorityPill, { backgroundColor: '#DCFCE7' }]}>
                            <Text style={[styles.priorityPillText, { color: '#15803D' }]}>{exam.status}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>📅 {exam.startDate}</Text>
                        </View>
                        <Text style={styles.studentCardNameText}>{exam.name}</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                          Subject: {exam.subject} • Max Marks: {exam.maxMarks}
                        </Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
                          <TouchableOpacity
                            style={[styles.smallWhiteOutlineBtn, { borderColor: '#EF4444' }]}
                            onPress={() => {
                              setExamsList(prev => prev.filter(e => e.id !== exam.id));
                              showToast('Exam deleted');
                            }}>
                            <IconComp name="trash-outline" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.studentCardContainer}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 10 }}>
                      Generate Report Cards
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 12 }}>
                      Select an exam and class to view marks and publish report cards to the parent portal.
                    </Text>
                    <View style={{ gap: 10, marginBottom: 16 }}>
                      {generatedReportCards.map(rc => (
                        <View key={rc.id} style={{ padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '700', color: '#0F172A' }}>{rc.studentName}</Text>
                            <View style={[styles.priorityPill, { backgroundColor: '#F3E8FF' }]}>
                              <Text style={[styles.priorityPillText, { color: '#7C3AED' }]}>Grade {rc.grade}</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                            Marks: {rc.marksObtained} / {rc.maxMarks} ({rc.percentage}%)
                          </Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={styles.emptyActionPurpleBtn}
                      onPress={() => showToast('Report cards published successfully to Parent Portal!')}>
                      <IconComp name="cloud-upload-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyActionBtnText}>Publish Report Cards</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </ScrollView>
            )}


            {/* --- MODULE: HOMEWORK --- */}
            {activeModuleModal === 'Homework' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="book-outline"
                  title="Homework Overview"
                  subtitle="View class-wise homework and student submissions."
                />

                {/* Class Filter Row */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  {['', 'Grade 3', 'Grade 4', 'PRE KG'].map(cls => (
                    <TouchableOpacity
                      key={cls}
                      style={[styles.filterChipItem, hwClassFilter === cls && styles.filterChipItemActive]}
                      onPress={() => setHwClassFilter(cls)}>
                      <Text style={[styles.filterChipText, hwClassFilter === cls && styles.filterChipTextActive]}>
                        {cls === '' ? 'All Classes' : cls}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Homework Cards or Empty State */}
                {homeworkList.length === 0 ? (
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="book-open-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No homework found</Text>
                    <Text style={styles.emptyModuleSub}>
                      {hwClassFilter ? 'No homework has been assigned to this class yet.' : 'No homework has been assigned in the school.'}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 12 }}>
                    {homeworkList.map((hw: any) => (
                      <TouchableOpacity
                        key={hw.id}
                        style={styles.noticeCardItem}
                        onPress={() => { setHwSelected(hw); setHwTrackingModal(true); }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                          <View style={[styles.priorityPill, { backgroundColor: '#F3E8FF' }]}>
                            <Text style={[styles.priorityPillText, { color: '#7C3AED' }]}>{hw.className} • {hw.subject}</Text>
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '600' }}>Due: {hw.dueDate}</Text>
                        </View>
                        <Text style={styles.noticeItemTitle}>{hw.title}</Text>
                        <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{hw.description}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                          <Text style={{ fontSize: 12, color: '#059669', fontWeight: '700' }}>✓ Active</Text>
                          <Text style={{ fontSize: 12, color: '#7C3AED', fontWeight: '700' }}>View Tracking →</Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* --- MODULE: FEE MANAGEMENT (Full) --- */}
            {activeModuleModal === 'Fee Management' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="card-outline"
                  title="Fee Management"
                  subtitle="Track revenue, manage student payments, and monitor fee due alerts."
                  primaryButton={{
                    label: "Assign New Fee",
                    icon: "add-outline",
                    onPress: () => setShowAssignFeeModal(true),
                  }}
                />

                {/* Stats Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <IconComp name="card-outline" size={18} color="#2563EB" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#1D4ED8', marginTop: 4 }}>TOTAL EXPECTED</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#1E40AF' }}>₹{feeStats.expected}</Text>
                  </View>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                    <IconComp name="trending-up-outline" size={18} color="#059669" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#047857', marginTop: 4 }}>COLLECTED</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#064E3B' }}>₹{feeStats.collected}</Text>
                  </View>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <IconComp name="alert-circle-outline" size={18} color="#D97706" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309', marginTop: 4 }}>OUTSTANDING</Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: '#92400E' }}>₹{feeStats.outstanding}</Text>
                  </View>
                </View>

                {/* Search + Status Filter */}
                <View style={[styles.searchBarWrapperFull, { marginBottom: 8 }]}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputField}
                    placeholder="Search by student, admission no. or fee name..."
                    placeholderTextColor="#94A3B8"
                    value={feeInvoiceSearch}
                    onChangeText={setFeeInvoiceSearch}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
                  {(['all', 'paid', 'unpaid', 'overdue'] as const).map(s => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.filterChipItem, feeStatusFilter === s && styles.filterChipItemActive]}
                      onPress={() => setFeeStatusFilter(s)}>
                      <Text style={[styles.filterChipText, feeStatusFilter === s && styles.filterChipTextActive]}>
                        {s === 'all' ? 'All Invoices' : s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Invoices list or Empty State */}
                {feeInvoicesList.length === 0 ? (
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="receipt-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No invoices found</Text>
                    <Text style={styles.emptyModuleSub}>Assign a fee to a class to generate invoices.</Text>
                  </View>
                ) : (
                  <View style={{ gap: 10 }}>
                    {feeInvoicesList.map((inv: any) => (
                      <View key={inv.id} style={styles.noticeCardItem}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.noticeItemTitle}>{inv.studentName}</Text>
                          <View style={[styles.priorityPill, { backgroundColor: inv.status === 'Paid' ? '#ECFDF5' : '#FEE2E2' }]}>
                            <Text style={[styles.priorityPillText, { color: inv.status === 'Paid' ? '#059669' : '#DC2626' }]}>{inv.status}</Text>
                          </View>
                        </View>
                        <Text style={{ fontSize: 12, color: '#64748B' }}>{inv.feeName} • {inv.collectionPeriod}</Text>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 4 }}>₹{inv.amount}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* --- MODULE: TRANSPORT MANAGEMENT --- */}
            {activeModuleModal === 'Transport' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="bus-outline"
                  title="Transport Management"
                  subtitle="Manage bus routes, drivers, school vehicles, and student assignments."
                  primaryButton={{
                    label: transportActiveTab === 'vehicles' ? '+ Add Vehicle' : '+ Add Route',
                    icon: "add-outline",
                    onPress: () => transportActiveTab === 'routes' ? setShowAddRouteModal(true) : setShowAddVehicleModal(true),
                  }}
                />

                {/* Sub-Tabs */}
                <View style={styles.moduleTabRow}>
                  {(['routes', 'vehicles', 'assignments'] as const).map(tab => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.moduleTabBtn, transportActiveTab === tab && styles.moduleTabBtnActive]}
                      onPress={() => setTransportActiveTab(tab)}>
                      <Text style={[styles.moduleTabText, transportActiveTab === tab && styles.moduleTabTextActive]}>
                        {tab === 'routes' ? 'Transport Routes' : tab === 'vehicles' ? 'Vehicle Management' : 'Student Assignments'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Routes Tab */}
                {transportActiveTab === 'routes' && (
                  transportRoutesList.length === 0 ? (
                    <View style={styles.emptyModuleCardContainer}>
                      <View style={styles.emptyIconCircleLarge}>
                        <IconComp name="bus-outline" size={40} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyModuleTitle}>No Routes Found</Text>
                      <Text style={styles.emptyModuleSub}>Create your first transport route to begin assigning students.</Text>
                      <TouchableOpacity style={styles.emptyActionPurpleBtn} onPress={() => setShowAddRouteModal(true)}>
                        <IconComp name="add-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Create Route</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {transportRoutesList.map((route: any) => (
                        <View key={route.id} style={styles.noticeCardItem}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                            <Text style={styles.noticeItemTitle}>{route.name}</Text>
                            <View style={[styles.priorityPill, { backgroundColor: '#ECFDF5' }]}>
                              <Text style={[styles.priorityPillText, { color: '#059669' }]}>Active</Text>
                            </View>
                          </View>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Vehicle: {route.vehicleNumber}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Driver: {route.driverName} • {route.driverPhone}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Capacity: {route.capacity} seats</Text>
                        </View>
                      ))}
                    </View>
                  )
                )}

                {/* Vehicles Tab */}
                {transportActiveTab === 'vehicles' && (
                  transportVehiclesList.length === 0 ? (
                    <View style={styles.emptyModuleCardContainer}>
                      <View style={styles.emptyIconCircleLarge}>
                        <IconComp name="car-outline" size={40} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyModuleTitle}>No Vehicles Added</Text>
                      <Text style={styles.emptyModuleSub}>Add school vehicles to manage fleet and compliance.</Text>
                      <TouchableOpacity style={styles.emptyActionPurpleBtn} onPress={() => setShowAddVehicleModal(true)}>
                        <IconComp name="add-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Add Vehicle</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ gap: 12 }}>
                      {transportVehiclesList.map((v: any) => (
                        <View key={v.id} style={styles.noticeCardItem}>
                          <Text style={styles.noticeItemTitle}>{v.vehicleName}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Reg: {v.registrationNumber} • {v.seatingCapacity} seats</Text>
                          <View style={[styles.priorityPill, { backgroundColor: '#ECFDF5', alignSelf: 'flex-start', marginTop: 6 }]}>
                            <Text style={[styles.priorityPillText, { color: '#059669' }]}>{v.status}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                )}

                {/* Assignments Tab */}
                {transportActiveTab === 'assignments' && (
                  <View style={styles.emptyModuleCardContainer}>
                    <View style={styles.emptyIconCircleLarge}>
                      <IconComp name="people-outline" size={40} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyModuleTitle}>No Student Assignments</Text>
                    <Text style={styles.emptyModuleSub}>Create routes first, then assign students to routes.</Text>
                  </View>
                )}
              </ScrollView>
            )}

            {/* --- MODULE: LIBRARY MANAGEMENT --- */}
            {activeModuleModal === 'Library' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="library-outline"
                  title="Library Management"
                  subtitle="Manage book inventory, issuing, and returns."
                />

                {/* Action Buttons Row */}
                <View style={[styles.actionButtonsTopRow, { justifyContent: 'flex-end', marginBottom: 14 }]}>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => setShowIssueBookModal(true)}>
                    <IconComp name="share-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Issue Book</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowAddBookModal(true)}>
                    <IconComp name="add-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>+ Add New Book</Text>
                  </TouchableOpacity>
                </View>

                {/* Sub-Tabs */}
                <View style={styles.moduleTabRow}>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, libraryActiveTab === 'inventory' && styles.moduleTabBtnActive]}
                    onPress={() => setLibraryActiveTab('inventory')}>
                    <Text style={[styles.moduleTabText, libraryActiveTab === 'inventory' && styles.moduleTabTextActive]}>
                      Book Inventory ({libraryBooksList.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, libraryActiveTab === 'issued' && styles.moduleTabBtnActive]}
                    onPress={() => setLibraryActiveTab('issued')}>
                    <Text style={[styles.moduleTabText, libraryActiveTab === 'issued' && styles.moduleTabTextActive]}>
                      Issued Logs ({issuedBooksList.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Search Bar */}
                <View style={[styles.searchBarWrapperFull, { marginBottom: 14 }]}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputField}
                    placeholder="Search books or students..."
                    placeholderTextColor="#94A3B8"
                    value={librarySearch}
                    onChangeText={setLibrarySearch}
                  />
                </View>

                {/* Book Inventory Tab */}
                {libraryActiveTab === 'inventory' && (
                  <View style={styles.sectionCardBox}>
                    {/* Table Header */}
                    <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 8 }}>
                      <Text style={[styles.tableHeaderText, { flex: 1 }]}>Book Details</Text>
                      <Text style={[styles.tableHeaderText, { width: 80 }]}>Category</Text>
                      <Text style={[styles.tableHeaderText, { width: 60, textAlign: 'right' }]}>Avail.</Text>
                    </View>
                    {libraryBooksList
                      .filter(b => !librarySearch || b.title.toLowerCase().includes(librarySearch.toLowerCase()) || b.author.toLowerCase().includes(librarySearch.toLowerCase()))
                      .map(book => (
                        <View key={book.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }} numberOfLines={1}>{book.title}</Text>
                              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>by {book.author}</Text>
                            </View>
                            <View style={{ width: 80 }}>
                              <View style={[styles.priorityPill, { backgroundColor: '#F3E8FF' }]}>
                                <Text style={[styles.priorityPillText, { color: '#7C3AED', fontSize: 9 }]}>{book.category}</Text>
                              </View>
                            </View>
                            <View style={{ width: 60, alignItems: 'flex-end' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <View style={{ width: 32, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                                  <View style={{ width: `${(book.available / book.total) * 100}%`, height: '100%', backgroundColor: '#D97706', borderRadius: 2 }} />
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>{book.available}/{book.total}</Text>
                              </View>
                            </View>
                          </View>
                        </View>
                    ))}
                  </View>
                )}

                {/* Issued Logs Tab */}
                {libraryActiveTab === 'issued' && (
                  issuedBooksList.length === 0 ? (
                    <View style={styles.emptyModuleCardContainer}>
                      <View style={styles.emptyIconCircleLarge}>
                        <IconComp name="book-outline" size={40} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyModuleTitle}>No Issued Books</Text>
                      <Text style={styles.emptyModuleSub}>Issue books to students to track the lending history here.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {issuedBooksList.map((ib: any) => (
                        <View key={ib.id} style={styles.noticeCardItem}>
                          <Text style={styles.noticeItemTitle}>{ib.bookTitle}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Issued to: {ib.studentName}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>Due: {ib.dueDate}</Text>
                          <TouchableOpacity
                            style={[styles.smallWhiteOutlineBtn, { alignSelf: 'flex-end', marginTop: 8 }]}
                            onPress={() => showToast(`Book "${ib.bookTitle}" returned!`)}>
                            <IconComp name="arrow-undo-outline" size={14} color="#334155" />
                            <Text style={styles.smallWhiteOutlineBtnText}>Return</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )
                )}
              </ScrollView>
            )}

            {/* --- MODULE: INVENTORY & ASSETS --- */}
            {activeModuleModal === 'Inventory & Assets' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="cube-outline"
                  title="Inventory & Assets"
                  subtitle="Track school assets, stock, and inventory."
                />

                {/* Action Buttons Row */}
                <View style={[styles.actionButtonsTopRow, { marginBottom: 14 }]}>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Opening Audit Logs...')}>
                    <IconComp name="list-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Audit Logs</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Bulk import modal opened')}>
                    <IconComp name="cloud-upload-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Bulk Import</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.outlineActionBtn} onPress={() => showToast('Exporting inventory...')}>
                    <IconComp name="download-outline" size={14} color="#475569" />
                    <Text style={styles.outlineActionBtnText}>Export</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.purplePrimaryActionBtn} onPress={() => setShowAddItemModal(true)}>
                    <IconComp name="add-outline" size={14} color="#FFFFFF" />
                    <Text style={styles.purplePrimaryBtnText}>Add Item</Text>
                  </TouchableOpacity>
                </View>

                {/* Sub-Tabs */}
                <View style={styles.moduleTabRow}>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, inventoryActiveTab === 'items' && styles.moduleTabBtnActive]}
                    onPress={() => setInventoryActiveTab('items')}>
                    <Text style={[styles.moduleTabText, inventoryActiveTab === 'items' && styles.moduleTabTextActive]}>
                      Inventory Items ({inventoryItemsList.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, inventoryActiveTab === 'categories' && styles.moduleTabBtnActive]}
                    onPress={() => setInventoryActiveTab('categories')}>
                    <Text style={[styles.moduleTabText, inventoryActiveTab === 'categories' && styles.moduleTabTextActive]}>
                      Categories ({inventoryCategoriesList.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Stats Row */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                  <View style={[styles.statBoxCard, { flex: 1 }]}>
                    <IconComp name="cube-outline" size={18} color="#7C3AED" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4 }}>TOTAL ITEMS</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#0F172A' }}>{inventoryItemsList.length}</Text>
                  </View>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                    <IconComp name="alert-circle-outline" size={18} color="#D97706" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#B45309', marginTop: 4 }}>LOW STOCK</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#92400E' }}>0</Text>
                  </View>
                  <View style={[styles.statBoxCard, { flex: 1, backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                    <IconComp name="close-circle-outline" size={18} color="#DC2626" />
                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#B91C1C', marginTop: 4 }}>OUT OF STOCK</Text>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#991B1B' }}>0</Text>
                  </View>
                </View>

                {/* Search + Filters */}
                <View style={[styles.searchBarWrapperFull, { marginBottom: 8 }]}>
                  <IconComp name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputField}
                    placeholder="Search by name, product ID or category..."
                    placeholderTextColor="#94A3B8"
                    value={inventorySearch}
                    onChangeText={setInventorySearch}
                  />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {['All Categories', 'Electronics', 'Furniture', 'Stationery'].map(cat => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.filterChipItem, inventoryCategoryFilter === cat && styles.filterChipItemActive]}
                      onPress={() => setInventoryCategoryFilter(cat)}>
                      <Text style={[styles.filterChipText, inventoryCategoryFilter === cat && styles.filterChipTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Items List or Empty */}
                {inventoryActiveTab === 'items' && (
                  inventoryItemsList.length === 0 ? (
                    <View style={styles.emptyModuleCardContainer}>
                      <View style={styles.emptyIconCircleLarge}>
                        <IconComp name="cube-outline" size={40} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyModuleTitle}>No inventory products found</Text>
                      <Text style={styles.emptyModuleSub}>Add your first item to start tracking school assets and inventory.</Text>
                      <TouchableOpacity style={styles.emptyActionPurpleBtn} onPress={() => setShowAddItemModal(true)}>
                        <IconComp name="add-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.emptyActionBtnText}>Add Item</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.sectionCardBox}>
                      <View style={{ flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 8 }}>
                        <Text style={[styles.tableHeaderText, { width: 70 }]}>Product ID</Text>
                        <Text style={[styles.tableHeaderText, { flex: 1 }]}>Product Name</Text>
                        <Text style={[styles.tableHeaderText, { width: 60 }]}>Stock</Text>
                        <Text style={[styles.tableHeaderText, { width: 50, textAlign: 'right' }]}>Status</Text>
                      </View>
                      {inventoryItemsList.map((item: any) => (
                        <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                          <Text style={[styles.tableCellText, { width: 70, color: '#64748B' }]}>{item.productId}</Text>
                          <Text style={[styles.tableCellText, { flex: 1, fontWeight: '600' }]}>{item.name}</Text>
                          <Text style={[styles.tableCellText, { width: 60 }]}>{item.quantity} {item.unit}</Text>
                          <View style={{ width: 50, alignItems: 'flex-end' }}>
                            <View style={[styles.priorityPill, { backgroundColor: item.status === 'In Stock' ? '#ECFDF5' : '#FEE2E2' }]}>
                              <Text style={[styles.priorityPillText, { color: item.status === 'In Stock' ? '#059669' : '#DC2626', fontSize: 9 }]}>{item.status}</Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  )
                )}

                {/* Categories Tab */}
                {inventoryActiveTab === 'categories' && (
                  inventoryCategoriesList.length === 0 ? (
                    <View style={styles.emptyModuleCardContainer}>
                      <View style={styles.emptyIconCircleLarge}>
                        <IconComp name="pricetag-outline" size={40} color="#94A3B8" />
                      </View>
                      <Text style={styles.emptyModuleTitle}>No Categories</Text>
                      <Text style={styles.emptyModuleSub}>Add categories to organize your inventory items.</Text>
                    </View>
                  ) : (
                    <View style={{ gap: 10 }}>
                      {inventoryCategoriesList.map((cat: any) => (
                        <View key={cat.id} style={styles.noticeCardItem}>
                          <Text style={styles.noticeItemTitle}>{cat.name}</Text>
                          <Text style={{ fontSize: 12, color: '#64748B' }}>{cat.description}</Text>
                        </View>
                      ))}
                    </View>
                  )
                )}
              </ScrollView>
            )}

            {/* --- PIC 2: LEAVE MANAGEMENT MODULE --- */}
            {(activeModuleModal === 'Leave Requests' || activeModuleModal === 'Leave Management') && (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="calendar-outline"
                  title="Leave Management"
                  subtitle="Review, approve, or reject leave requests from teachers and students."
                  badgeText={`${leaveRequestsList.filter(l => l.status === 'Pending').length} Pending`}
                  primaryButton={{
                    label: "+ Request Leave",
                    icon: "add-outline",
                    onPress: () => setShowCreateLeaveModal(true),
                  }}
                />

                {/* Sub-Tabs: Pending Requests vs History */}
                <View style={[styles.moduleTabRow, { marginTop: 12, marginBottom: 12 }]}>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, leaveTab === 'pending' && styles.moduleTabBtnActive]}
                    onPress={() => setLeaveTab('pending')}>
                    <IconComp name="time-outline" size={15} color={leaveTab === 'pending' ? '#7C3AED' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[styles.moduleTabText, leaveTab === 'pending' && styles.moduleTabTextActive]}>
                      Pending Requests ({leaveRequestsList.filter(l => l.status === 'Pending').length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.moduleTabBtn, leaveTab === 'history' && styles.moduleTabBtnActive]}
                    onPress={() => setLeaveTab('history')}>
                    <IconComp name="document-text-outline" size={15} color={leaveTab === 'history' ? '#7C3AED' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={[styles.moduleTabText, leaveTab === 'history' && styles.moduleTabTextActive]}>
                      History ({leaveRequestsList.filter(l => l.status !== 'Pending').length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Role Filter Chips */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                  {['All', 'Teachers', 'Students'].map((rf) => (
                    <TouchableOpacity
                      key={rf}
                      style={[
                        styles.interactiveFilterPillBtn,
                        leaveRoleFilter === rf && styles.interactiveFilterPillActive,
                      ]}
                      onPress={() => setLeaveRoleFilter(rf as any)}>
                      <Text style={[
                        styles.interactiveFilterPillText,
                        leaveRoleFilter === rf && styles.interactiveFilterPillTextActive,
                      ]}>
                        {rf}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Leaves List */}
                {(() => {
                  const filtered = leaveRequestsList
                    .filter(l => (leaveTab === 'pending' ? l.status === 'Pending' : l.status !== 'Pending'))
                    .filter(l => {
                      if (leaveRoleFilter === 'Teachers') return l.applicantRole === 'teacher';
                      if (leaveRoleFilter === 'Students') return l.applicantRole === 'student';
                      return true;
                    });

                  if (filtered.length === 0) {
                    return (
                      <View style={styles.emptyModuleCardContainer}>
                        <View style={styles.emptyIconCircleLarge}>
                          <IconComp name="mail-unread-outline" size={42} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyModuleTitle}>
                          {leaveTab === 'pending' ? 'No pending leave requests.' : 'No past leave requests recorded.'}
                        </Text>
                        <Text style={styles.emptyModuleSub}>
                          {leaveTab === 'pending'
                            ? 'All leave applications from staff and students have been processed.'
                            : 'Approved and rejected requests will appear here.'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.purplePrimaryActionBtn, { alignSelf: 'center', marginTop: 14 }]}
                          onPress={() => setShowCreateLeaveModal(true)}>
                          <IconComp name="add-outline" size={16} color="#FFFFFF" />
                          <Text style={styles.purplePrimaryBtnText}>Submit New Leave Request</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  return (
                    <View style={{ gap: 12 }}>
                      {filtered.map(leave => (
                        <View key={leave.id} style={styles.leaveCardContainer}>
                          {/* Card Top: Applicant & Role */}
                          <View style={styles.leaveCardHeaderRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                              <View style={styles.leaveUserAvatarBox}>
                                <IconComp name="person-outline" size={16} color="#475569" />
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.leaveApplicantName}>{leave.applicantName}</Text>
                                <Text style={styles.leaveSubmittedDate}>Submitted: {leave.submittedAt}</Text>
                              </View>
                            </View>

                            <View style={[
                              styles.leaveRoleBadge,
                              { backgroundColor: leave.applicantRole === 'teacher' ? '#EFF6FF' : '#FAF5FF' }
                            ]}>
                              <Text style={[
                                styles.leaveRoleBadgeText,
                                { color: leave.applicantRole === 'teacher' ? '#2563EB' : '#7C3AED' }
                              ]}>
                                {leave.applicantRole.toUpperCase()}
                              </Text>
                            </View>
                          </View>

                          {/* Date Range & Leave Type */}
                          <View style={styles.leaveDateRangePill}>
                            <IconComp name="calendar-outline" size={14} color="#64748B" />
                            <Text style={styles.leaveDateRangeText}>{leave.startDate} — {leave.endDate}</Text>
                          </View>

                          <Text style={styles.leaveTypeTag}>{leave.leaveType}</Text>
                          <Text style={styles.leaveReasonQuote}>"{leave.reason}"</Text>

                          {/* Action Footer */}
                          {leave.status === 'Pending' ? (
                            <View style={styles.leaveActionBtnsRow}>
                              <TouchableOpacity
                                style={styles.leaveRejectBtn}
                                onPress={() => handleRejectLeave(leave.id)}>
                                <IconComp name="close-circle-outline" size={16} color="#DC2626" />
                                <Text style={styles.leaveRejectBtnText}>Reject</Text>
                              </TouchableOpacity>

                              <TouchableOpacity
                                style={styles.leaveApproveBtn}
                                onPress={() => handleApproveLeave(leave.id)}>
                                <IconComp name="checkmark-circle-outline" size={16} color="#FFFFFF" />
                                <Text style={styles.leaveApproveBtnText}>Approve</Text>
                              </TouchableOpacity>
                            </View>
                          ) : (
                            <View style={styles.leaveStatusFooter}>
                              <View style={[
                                styles.leaveStatusPill,
                                { backgroundColor: leave.status === 'Approved' ? '#ECFDF5' : '#FEF2F2' }
                              ]}>
                                <IconComp
                                  name={leave.status === 'Approved' ? 'checkmark-circle-outline' : 'close-circle-outline'}
                                  size={14}
                                  color={leave.status === 'Approved' ? '#059669' : '#DC2626'}
                                />
                                <Text style={[
                                  styles.leaveStatusPillText,
                                  { color: leave.status === 'Approved' ? '#059669' : '#DC2626' }
                                ]}>
                                  {leave.status}
                                </Text>
                              </View>
                              <Text style={styles.leaveProcessedText}>Processed by Admin</Text>
                            </View>
                          )}
                        </View>
                      ))}
                    </View>
                  );
                })()}
              </ScrollView>
            )}

            {/* --- PIC 3: REPORTS & ANALYTICS MODULE --- */}
            {activeModuleModal === 'Reports & Analytics' && (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="stats-chart-outline"
                  title="Reports & Analytics"
                  subtitle="Key performance metrics and school insights."
                  primaryButton={{
                    label: "Download Full Report",
                    icon: "download-outline",
                    onPress: handleDownloadFullReport,
                  }}
                />

                {/* 4 KPI Metric Cards in 2x2 Grid */}
                <View style={styles.reportsKpiGrid}>
                  {/* Metric 1: Total Revenue */}
                  <View style={styles.reportsKpiCard}>
                    <View style={[styles.reportsKpiIconBox, { backgroundColor: '#10B981' }]}>
                      <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 16 }}>₹</Text>
                    </View>
                    <Text style={styles.reportsKpiLabel}>TOTAL REVENUE (YTD)</Text>
                    <Text style={styles.reportsKpiValue}>₹0</Text>
                  </View>

                  {/* Metric 2: Student Enrollment */}
                  <View style={styles.reportsKpiCard}>
                    <View style={[styles.reportsKpiIconBox, { backgroundColor: '#3B82F6' }]}>
                      <IconComp name="people" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.reportsKpiLabel}>STUDENT ENROLLMENT</Text>
                    <Text style={styles.reportsKpiValue}>{directoryStudents.length}</Text>
                  </View>

                  {/* Metric 3: Average Attendance */}
                  <View style={styles.reportsKpiCard}>
                    <View style={[styles.reportsKpiIconBox, { backgroundColor: '#6366F1' }]}>
                      <IconComp name="trending-up" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.reportsKpiLabel}>AVERAGE ATTENDANCE</Text>
                    <Text style={styles.reportsKpiValue}>0%</Text>
                  </View>

                  {/* Metric 4: Total Teachers */}
                  <View style={styles.reportsKpiCard}>
                    <View style={[styles.reportsKpiIconBox, { backgroundColor: '#8B5CF6' }]}>
                      <IconComp name="book" size={18} color="#FFFFFF" />
                    </View>
                    <Text style={styles.reportsKpiLabel}>TOTAL TEACHERS</Text>
                    <Text style={styles.reportsKpiValue}>{staffList.filter(s => s.staffType === 'Teaching').length || 2}</Text>
                  </View>
                </View>

                {/* Visual Chart Card 1: Revenue Overview */}
                <View style={styles.chartSectionCard}>
                  <Text style={styles.chartSectionTitle}>Revenue Overview</Text>
                  <Text style={styles.chartSectionSub}>Monthly fee collection across all classes</Text>

                  <View style={styles.barChartContainer}>
                    {revenueDataList.map((item, idx) => (
                      <View key={idx} style={styles.barChartCol}>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFillMint, { height: `${item.pct}%` }]} />
                        </View>
                        <Text style={styles.barChartLabel}>{item.month}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Visual Chart Card 2: Attendance Trends */}
                <View style={styles.chartSectionCard}>
                  <Text style={styles.chartSectionTitle}>Attendance Trends (Last 7 Days)</Text>
                  <Text style={styles.chartSectionSub}>Daily school-wide student attendance</Text>

                  <View style={styles.barChartContainer}>
                    {attendanceDataList.map((item, idx) => (
                      <View key={idx} style={styles.barChartCol}>
                        <View style={styles.barTrack}>
                          <View style={[styles.barFillPurple, { height: `${Math.max(item.pct, 4)}%` }]} />
                        </View>
                        <Text style={styles.barChartLabel}>{item.day}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.purplePrimaryActionBtn, { width: '100%', justifyContent: 'center', paddingVertical: 14, marginTop: 6 }]}
                  onPress={handleDownloadFullReport}>
                  <IconComp name="download-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.purplePrimaryBtnText, { fontSize: 14 }]}>Download Full Report (XLSX)</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* --- PIC 4: API INTEGRATIONS MODULE --- */}
            {activeModuleModal === 'API Integrations' && (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="code-working-outline"
                  title="API Integrations"
                  subtitle="Configure third-party API keys required for specific modules."
                  primaryButton={{
                    label: "Save Configurations",
                    icon: "save-outline",
                    onPress: handleSaveApiConfigurations,
                  }}
                />

                {/* Card 1: WhatsApp Cloud API */}
                <View style={styles.apiIntegrationCard}>
                  <View style={styles.apiCardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <View style={[styles.apiServiceIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <IconComp name="logo-whatsapp" size={20} color="#059669" />
                      </View>
                      <Text style={styles.apiServiceTitle}>WhatsApp Cloud API</Text>
                    </View>

                    <View style={[
                      styles.apiStatusBadge,
                      { backgroundColor: whatsappApiConfig.isConnected ? '#ECFDF5' : '#F1F5F9' }
                    ]}>
                      <Text style={[
                        styles.apiStatusBadgeText,
                        { color: whatsappApiConfig.isConnected ? '#059669' : '#64748B' }
                      ]}>
                        {whatsappApiConfig.isConnected ? 'Connected' : 'Not Connected'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.apiServiceDescription}>
                    Connect your school's WhatsApp Business account to send notifications to parents. Powered by Meta WhatsApp Cloud API.
                  </Text>

                  {/* Form fields */}
                  <View style={{ gap: 10, marginTop: 12 }}>
                    <View>
                      <Text style={styles.formFieldLabelText}>Access Token</Text>
                      <View style={styles.apiTokenInputWrapper}>
                        <TextInput
                          style={styles.apiTokenTextInput}
                          secureTextEntry={!showWhatsappToken}
                          value={whatsappApiConfig.accessToken}
                          onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, accessToken: txt }))}
                          placeholder="Enter Access Token"
                          placeholderTextColor="#94A3B8"
                        />
                        <TouchableOpacity
                          style={{ padding: 6 }}
                          onPress={() => setShowWhatsappToken(!showWhatsappToken)}>
                          <IconComp name={showWhatsappToken ? 'eye-off-outline' : 'eye-outline'} size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>Phone Number ID</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={whatsappApiConfig.phoneNumberId}
                        onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, phoneNumberId: txt }))}
                        placeholder="e.g. 109283746501928"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>WhatsApp Business Account ID</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={whatsappApiConfig.businessAccountId}
                        onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, businessAccountId: txt }))}
                        placeholder="e.g. raguswetha2111@gmail.com"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>Sender/Business Phone Number</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={whatsappApiConfig.senderNumber}
                        onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, senderNumber: txt }))}
                        placeholder="+91 ..."
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>PTM Template Name</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={whatsappApiConfig.ptmTemplateName}
                        onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, ptmTemplateName: txt }))}
                        placeholder="school_ptm_scheduled"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>Notice Template Name</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={whatsappApiConfig.noticeTemplateName}
                        onChangeText={(txt) => setWhatsappApiConfig(prev => ({ ...prev, noticeTemplateName: txt }))}
                        placeholder="school_notice_notification"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.apiTestConnectionBtn}
                    onPress={handleTestWhatsappConnection}
                    disabled={testingWhatsappConnection}>
                    {testingWhatsappConnection ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <IconComp name="flash-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.apiTestBtnText}>Test Connection</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                {/* Card 2: Google Maps API (Transport Module) */}
                <View style={styles.apiIntegrationCard}>
                  <View style={styles.apiCardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.apiServiceIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <IconComp name="map-outline" size={20} color="#2563EB" />
                      </View>
                      <Text style={styles.apiServiceTitle}>Google Maps API (Transport Module)</Text>
                    </View>
                  </View>

                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.formFieldLabelText}>API Key</Text>
                    <TextInput
                      style={styles.apiStandardInput}
                      value={googleMapsApiKey}
                      onChangeText={setGoogleMapsApiKey}
                      placeholder="AIzaSy..."
                      placeholderTextColor="#94A3B8"
                    />
                    <Text style={styles.apiHelperNoticeText}>
                      Required for live GPS tracking and route optimizations. Must have Maps JavaScript API and Directions API enabled.
                    </Text>
                  </View>
                </View>

                {/* Card 3: Cloudinary (Media Module) */}
                <View style={styles.apiIntegrationCard}>
                  <View style={styles.apiCardHeaderRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={[styles.apiServiceIconBox, { backgroundColor: '#FAF5FF' }]}>
                        <IconComp name="cloud-upload-outline" size={20} color="#7C3AED" />
                      </View>
                      <Text style={styles.apiServiceTitle}>Cloudinary (Media Module)</Text>
                    </View>
                  </View>

                  <View style={{ gap: 10, marginTop: 12 }}>
                    <View>
                      <Text style={styles.formFieldLabelText}>Cloud Name</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={cloudinaryConfig.cloudName}
                        onChangeText={(txt) => setCloudinaryConfig(prev => ({ ...prev, cloudName: txt }))}
                        placeholder="e.g. dxyz125"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <View>
                      <Text style={styles.formFieldLabelText}>Unsigned Upload Preset</Text>
                      <TextInput
                        style={styles.apiStandardInput}
                        value={cloudinaryConfig.uploadPreset}
                        onChangeText={(txt) => setCloudinaryConfig(prev => ({ ...prev, uploadPreset: txt }))}
                        placeholder="e.g. preset_name"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <Text style={styles.apiHelperNoticeText}>
                      Required for uploading student profile photos, library book covers, and noticeboard attachments. Ensure the preset is set to 'Unsigned' in your Cloudinary settings.
                    </Text>
                  </View>
                </View>

                {/* Save Configurations Bottom Button */}
                <TouchableOpacity
                  style={[styles.purplePrimaryActionBtn, { width: '100%', justifyContent: 'center', paddingVertical: 14, marginTop: 4 }]}
                  onPress={handleSaveApiConfigurations}>
                  <IconComp name="save-outline" size={18} color="#FFFFFF" />
                  <Text style={[styles.purplePrimaryBtnText, { fontSize: 14 }]}>Save Configurations</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* --- PIC 5: REGISTRATION LINKS MODULE --- */}
            {activeModuleModal === 'Registration Links' && (
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="link-outline"
                  title="Generate Access Links"
                  subtitle="Easily onboard your teachers and parents by sharing these unique registration links."
                  primaryButton={{
                    label: "Share All",
                    icon: "share-social-outline",
                    onPress: () => handleShareLink('ZUNA Access Links', 'https://sms-teamcarrezza.vercel.app'),
                  }}
                />

                <View style={{ gap: 14, marginTop: 12 }}>
                  {/* Link 1: Online Admission */}
                  <View style={styles.regLinkCard}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <View style={[styles.regLinkIconBox, { backgroundColor: '#ECFDF5' }]}>
                        <IconComp name="person-add-outline" size={24} color="#059669" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.regLinkTitle}>Online Admission Application Form Link</Text>
                        <Text style={styles.regLinkDesc}>
                          Share this public link with prospective students and parents. Submitted applications arrive in your Student Directory under "Admission Applications" for approval and admission.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.regLinkUrlBox}>
                      <IconComp name="link-outline" size={15} color="#94A3B8" />
                      <Text style={styles.regLinkUrlText} numberOfLines={1}>
                        https://sms-teamcarrezza.vercel.app/admission/school-123
                      </Text>
                    </View>

                    <View style={styles.regLinkBtnsRow}>
                      <TouchableOpacity
                        style={[
                          styles.regLinkCopyBtn,
                          copiedLinkType === 'admission' && { backgroundColor: '#10B981' }
                        ]}
                        onPress={() => handleCopyLink('admission', 'https://sms-teamcarrezza.vercel.app/admission/school-123')}>
                        <IconComp name={copiedLinkType === 'admission' ? 'checkmark-circle-outline' : 'copy-outline'} size={15} color="#FFFFFF" />
                        <Text style={styles.regLinkCopyBtnText}>
                          {copiedLinkType === 'admission' ? 'Copied!' : 'Copy Link'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.regLinkShareBtn}
                        onPress={() => handleShareLink('Admission Application Form', 'https://sms-teamcarrezza.vercel.app/admission/school-123')}>
                        <IconComp name="share-social-outline" size={16} color="#475569" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Link 2: Teacher Registration */}
                  <View style={styles.regLinkCard}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <View style={[styles.regLinkIconBox, { backgroundColor: '#EFF6FF' }]}>
                        <IconComp name="people-outline" size={24} color="#2563EB" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.regLinkTitle}>Teacher Registration Link</Text>
                        <Text style={styles.regLinkDesc}>
                          Send this link to your faculty. They will be able to create an account and join your school workspace as a teacher.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.regLinkUrlBox}>
                      <IconComp name="link-outline" size={15} color="#94A3B8" />
                      <Text style={styles.regLinkUrlText} numberOfLines={1}>
                        https://sms-teamcarrezza.vercel.app/register/teacher/school-123
                      </Text>
                    </View>

                    <View style={styles.regLinkBtnsRow}>
                      <TouchableOpacity
                        style={[
                          styles.regLinkCopyBtn,
                          copiedLinkType === 'teacher' && { backgroundColor: '#10B981' }
                        ]}
                        onPress={() => handleCopyLink('teacher', 'https://sms-teamcarrezza.vercel.app/register/teacher/school-123')}>
                        <IconComp name={copiedLinkType === 'teacher' ? 'checkmark-circle-outline' : 'copy-outline'} size={15} color="#FFFFFF" />
                        <Text style={styles.regLinkCopyBtnText}>
                          {copiedLinkType === 'teacher' ? 'Copied!' : 'Copy Link'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.regLinkShareBtn}
                        onPress={() => handleShareLink('Teacher Registration', 'https://sms-teamcarrezza.vercel.app/register/teacher/school-123')}>
                        <IconComp name="share-social-outline" size={16} color="#475569" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Link 3: Parent Portal Link */}
                  <View style={styles.regLinkCard}>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                      <View style={[styles.regLinkIconBox, { backgroundColor: '#FFFBEB' }]}>
                        <IconComp name="school-outline" size={24} color="#D97706" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.regLinkTitle}>Parent Portal Link</Text>
                        <Text style={styles.regLinkDesc}>
                          Send this link to parents. They will need their child's Admission Number to successfully link their account.
                        </Text>
                      </View>
                    </View>

                    <View style={styles.regLinkUrlBox}>
                      <IconComp name="link-outline" size={15} color="#94A3B8" />
                      <Text style={styles.regLinkUrlText} numberOfLines={1}>
                        https://sms-teamcarrezza.vercel.app/register/parent/school-123
                      </Text>
                    </View>

                    <View style={styles.regLinkBtnsRow}>
                      <TouchableOpacity
                        style={[
                          styles.regLinkCopyBtn,
                          copiedLinkType === 'parent' && { backgroundColor: '#10B981' }
                        ]}
                        onPress={() => handleCopyLink('parent', 'https://sms-teamcarrezza.vercel.app/register/parent/school-123')}>
                        <IconComp name={copiedLinkType === 'parent' ? 'checkmark-circle-outline' : 'copy-outline'} size={15} color="#FFFFFF" />
                        <Text style={styles.regLinkCopyBtnText}>
                          {copiedLinkType === 'parent' ? 'Copied!' : 'Copy Link'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.regLinkShareBtn}
                        onPress={() => handleShareLink('Parent Portal Registration', 'https://sms-teamcarrezza.vercel.app/register/parent/school-123')}>
                        <IconComp name="share-social-outline" size={16} color="#475569" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Card 4: Customize Staff Registration Form */}
                  <View style={styles.staffConfigCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <View style={[styles.regLinkIconBox, { backgroundColor: '#F3E8FF', width: 36, height: 36 }]}>
                        <IconComp name="settings-outline" size={18} color="#7C3AED" />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.staffConfigTitle}>Customize Staff Registration Form</Text>
                        <Text style={styles.staffConfigSub}>Select which additional fields should appear on the teacher registration form.</Text>
                      </View>
                    </View>

                    {/* Toggle 1: Employee ID */}
                    <View style={styles.toggleRowItem}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.toggleItemLabel}>Employee ID</Text>
                        <Text style={styles.toggleItemDesc}>Require teachers to provide their employee ID during registration.</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.switchTrack, staffFormSettings.employeeId && styles.switchTrackActive]}
                        onPress={() => setStaffFormSettings(p => ({ ...p, employeeId: !p.employeeId }))}>
                        <View style={[styles.switchThumb, staffFormSettings.employeeId && styles.switchThumbActive]} />
                      </TouchableOpacity>
                    </View>

                    {/* Toggle 2: Phone Number */}
                    <View style={styles.toggleRowItem}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.toggleItemLabel}>Phone Number</Text>
                        <Text style={styles.toggleItemDesc}>Require teachers to provide their phone number during registration.</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.switchTrack, staffFormSettings.phone && styles.switchTrackActive]}
                        onPress={() => setStaffFormSettings(p => ({ ...p, phone: !p.phone }))}>
                        <View style={[styles.switchThumb, staffFormSettings.phone && styles.switchThumbActive]} />
                      </TouchableOpacity>
                    </View>

                    {/* Toggle 3: Department */}
                    <View style={styles.toggleRowItem}>
                      <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={styles.toggleItemLabel}>Department</Text>
                        <Text style={styles.toggleItemDesc}>Require teachers to provide their department during registration.</Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.switchTrack, staffFormSettings.department && styles.switchTrackActive]}
                        onPress={() => setStaffFormSettings(p => ({ ...p, department: !p.department }))}>
                        <View style={[styles.switchThumb, staffFormSettings.department && styles.switchThumbActive]} />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={styles.saveConfigBtnDark}
                      onPress={handleSaveStaffFormConfig}
                      disabled={savingFormConfig}>
                      {savingFormConfig ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <>
                          <IconComp name={formConfigSaved ? 'checkmark-circle-outline' : 'save-outline'} size={16} color="#FFFFFF" />
                          <Text style={styles.saveConfigBtnText}>
                            {formConfigSaved ? 'Saved successfully!' : 'Save Form Configuration'}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Security Notice Box */}
                  <View style={styles.securityNoticeCard}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <IconComp name="shield-checkmark-outline" size={16} color="#475569" />
                      <Text style={styles.securityNoticeTitle}>Security Notice</Text>
                    </View>
                    <Text style={styles.securityNoticeBody}>
                      These links are specific to your school environment. Anyone with these links can attempt to register. Teacher accounts will automatically be added to your Staff Directory, while Parent accounts require a valid Admission Number to link to student records. All forms are protected by Captcha verification.
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}

            {/* =====================================================================
                MODULE 1: LEADS MANAGEMENT (Pic 1 Matching)
               ===================================================================== */}
            {(activeModuleModal === 'Leads' || activeModuleModal === 'Leads Management') && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="heart-outline"
                  title="Leads Management"
                  subtitle="Design lead forms, embed links, and track enquiries."
                  primaryButton={{
                    label: "+ Add Lead",
                    icon: "person-add-outline",
                    onPress: () => setShowAddLeadModal(true),
                  }}
                />

                {/* Top Tab Switcher: Leads Directory vs Form Builder */}
                <View style={styles.leadsTabContainer}>
                  <TouchableOpacity
                    style={[styles.leadsTabBtn, leadsTab === 'leads' && styles.leadsTabBtnActive]}
                    onPress={() => setLeadsTab('leads')}>
                    <IconComp name="people-outline" size={16} color={leadsTab === 'leads' ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.leadsTabBtnText, leadsTab === 'leads' && styles.leadsTabBtnTextActive]}>
                      Leads Directory
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.leadsTabBtn, leadsTab === 'forms' && styles.leadsTabBtnActive]}
                    onPress={() => setLeadsTab('forms')}>
                    <IconComp name="construct-outline" size={16} color={leadsTab === 'forms' ? '#FFFFFF' : '#64748B'} />
                    <Text style={[styles.leadsTabBtnText, leadsTab === 'forms' && styles.leadsTabBtnTextActive]}>
                      Form Builder
                    </Text>
                  </TouchableOpacity>
                </View>

                {leadsTab === 'leads' ? (
                  <>
                    {/* Filter & Search Bar */}
                    <View style={styles.leadsFilterCard}>
                      {/* Search input */}
                      <View style={styles.leadsSearchInputWrapper}>
                        <IconComp name="search-outline" size={16} color="#94A3B8" />
                        <TextInput
                          style={styles.leadsSearchInput}
                          placeholder="Search leads by name, email, or content..."
                          placeholderTextColor="#94A3B8"
                          value={leadsSearchQuery}
                          onChangeText={setLeadsSearchQuery}
                        />
                        {leadsSearchQuery.length > 0 && (
                          <TouchableOpacity onPress={() => setLeadsSearchQuery('')}>
                            <IconComp name="close-circle" size={16} color="#94A3B8" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Filter Chips: Statuses */}
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 8 }}>
                        {['All', 'New', 'Contacted', 'Interested', 'Converted', 'Closed'].map(st => (
                          <TouchableOpacity
                            key={st}
                            style={[
                              styles.leadsFilterChip,
                              leadsStatusFilter === st && styles.leadsFilterChipActive
                            ]}
                            onPress={() => setLeadsStatusFilter(st)}>
                            <Text style={[
                              styles.leadsFilterChipText,
                              leadsStatusFilter === st && styles.leadsFilterChipTextActive
                            ]}>
                              {st === 'All' ? 'All Statuses' : st}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      {/* Date Range & Export Report Row */}
                      <View style={styles.leadsDateExportRow}>
                        <View style={styles.leadsDateBox}>
                          <Text style={styles.leadsDateLabel}>FROM:</Text>
                          <Text style={styles.leadsDateValue}>{leadsStartDate || 'dd-mm-yyyy'}</Text>
                          <IconComp name="calendar-outline" size={14} color="#64748B" />
                        </View>

                        <View style={styles.leadsDateBox}>
                          <Text style={styles.leadsDateLabel}>TO:</Text>
                          <Text style={styles.leadsDateValue}>{leadsEndDate || 'dd-mm-yyyy'}</Text>
                          <IconComp name="calendar-outline" size={14} color="#64748B" />
                        </View>

                        <TouchableOpacity
                          style={styles.leadsExportBtn}
                          onPress={handleExportLeadsReport}>
                          <IconComp name="download-outline" size={14} color="#7C3AED" />
                          <Text style={styles.leadsExportBtnText}>Export Report</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Leads Records or Empty State */}
                    {(() => {
                      const filtered = leadsList.filter(l => {
                        const q = leadsSearchQuery.toLowerCase();
                        const matchQ =
                          !q ||
                          l.name.toLowerCase().includes(q) ||
                          l.email.toLowerCase().includes(q) ||
                          l.phone.includes(q) ||
                          l.notes.toLowerCase().includes(q);
                        const matchSt = leadsStatusFilter === 'All' || l.status === leadsStatusFilter;
                        return matchQ && matchSt;
                      });

                      if (filtered.length === 0) {
                        return (
                          <View style={styles.leadsEmptyStateCard}>
                            <View style={styles.leadsEmptyIconBox}>
                              <IconComp name="search-outline" size={32} color="#94A3B8" />
                            </View>
                            <Text style={styles.leadsEmptyTitle}>No matching leads found.</Text>
                            <Text style={styles.leadsEmptySubtitle}>
                              Adjust your search filters or record a new prospective admission enquiry.
                            </Text>
                            <TouchableOpacity
                              style={styles.leadsEmptyActionBtn}
                              onPress={() => setShowAddLeadModal(true)}>
                              <IconComp name="add-outline" size={16} color="#FFFFFF" />
                              <Text style={styles.leadsEmptyActionBtnText}>Log New Lead</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return (
                        <View style={{ gap: 12, marginTop: 4 }}>
                          {filtered.map(ld => {
                            const getStatusColor = (status: string) => {
                              switch (status) {
                                case 'New': return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
                                case 'Contacted': return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
                                case 'Interested': return { bg: '#F3E8FF', text: '#7C3AED', border: '#DDD6FE' };
                                case 'Converted': return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
                                case 'Closed': return { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1' };
                                default: return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
                              }
                            };
                            const stCol = getStatusColor(ld.status);

                            return (
                              <View key={ld.id} style={styles.leadRecordCard}>
                                <View style={styles.leadRecordHeaderRow}>
                                  <View style={{ flex: 1 }}>
                                    <Text style={styles.leadRecordName}>{ld.name}</Text>
                                    <Text style={styles.leadRecordSource}>Source: {ld.sourceForm}</Text>
                                  </View>

                                  <View style={[styles.leadStatusBadge, { backgroundColor: stCol.bg, borderColor: stCol.border }]}>
                                    <Text style={[styles.leadStatusBadgeText, { color: stCol.text }]}>{ld.status}</Text>
                                  </View>
                                </View>

                                <View style={styles.leadRecordDetailsRow}>
                                  <View style={styles.leadRecordDetailItem}>
                                    <IconComp name="call-outline" size={13} color="#64748B" />
                                    <Text style={styles.leadRecordDetailText}>{ld.phone}</Text>
                                  </View>
                                  <View style={styles.leadRecordDetailItem}>
                                    <IconComp name="mail-outline" size={13} color="#64748B" />
                                    <Text style={styles.leadRecordDetailText}>{ld.email}</Text>
                                  </View>
                                  <View style={styles.leadRecordDetailItem}>
                                    <IconComp name="calendar-outline" size={13} color="#64748B" />
                                    <Text style={styles.leadRecordDetailText}>{ld.submittedAt}</Text>
                                  </View>
                                </View>

                                {ld.notes ? (
                                  <View style={styles.leadRecordNotesBox}>
                                    <Text style={styles.leadRecordNotesText}>{ld.notes}</Text>
                                  </View>
                                ) : null}

                                <View style={styles.leadRecordActionsRow}>
                                  {/* Quick Status Toggles */}
                                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                                    {(['New', 'Contacted', 'Interested', 'Converted', 'Closed'] as const).map(s => (
                                      <TouchableOpacity
                                        key={s}
                                        style={[
                                          styles.leadActionStatusChip,
                                          ld.status === s && styles.leadActionStatusChipActive
                                        ]}
                                        onPress={() => handleUpdateLeadStatus(ld.id, s)}>
                                        <Text style={[
                                          styles.leadActionStatusChipText,
                                          ld.status === s && styles.leadActionStatusChipTextActive
                                        ]}>{s}</Text>
                                      </TouchableOpacity>
                                    ))}
                                  </ScrollView>

                                  <TouchableOpacity
                                    style={styles.leadDeleteBtn}
                                    onPress={() => handleDeleteLead(ld.id)}>
                                    <IconComp name="trash-outline" size={14} color="#EF4444" />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          })}
                        </View>
                      );
                    })()}
                  </>
                ) : (
                  /* Form Builder Tab */
                  <View style={{ gap: 14 }}>
                    <View style={styles.leadsFormsNoticeCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <IconComp name="link-outline" size={18} color="#7C3AED" />
                        <Text style={styles.leadsFormsNoticeTitle}>Public Enquiry Forms</Text>
                      </View>
                      <Text style={styles.leadsFormsNoticeSub}>
                        Embed these responsive lead capture forms directly into your school website or share them via WhatsApp campaigns.
                      </Text>
                    </View>

                    {leadsFormsList.map(form => (
                      <View key={form.id} style={styles.leadFormCard}>
                        <View style={styles.leadFormCardHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.leadFormTitle}>{form.title}</Text>
                            <Text style={styles.leadFormSubsCount}>{form.submissions} Submissions Received</Text>
                          </View>
                          <View style={styles.leadFormActiveBadge}>
                            <Text style={styles.leadFormActiveBadgeText}>{form.status}</Text>
                          </View>
                        </View>

                        <View style={styles.leadFormEmbedBox}>
                          <Text style={styles.leadFormEmbedCode} numberOfLines={1}>{form.embedCode}</Text>
                        </View>

                        <View style={styles.leadFormActionsRow}>
                          <TouchableOpacity
                            style={styles.leadFormCopyBtn}
                            onPress={() => {
                              showToast(`Embed code for "${form.title}" copied!`);
                            }}>
                            <IconComp name="copy-outline" size={14} color="#FFFFFF" />
                            <Text style={styles.leadFormCopyBtnText}>Copy Embed Code</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.leadFormShareBtn}
                            onPress={async () => {
                              await Share.share({
                                title: form.title,
                                message: `Apply to ZUNA International Academy: https://sms.zuna.edu/apply/${form.id}`,
                              });
                            }}>
                            <IconComp name="share-social-outline" size={16} color="#7C3AED" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </ScrollView>
            )}

            {/* =====================================================================
                MODULE 2: BILLING & SUBSCRIPTIONS (Pic 2 Matching)
               ===================================================================== */}
            {(activeModuleModal === 'Billing & Plan' || activeModuleModal === 'Billing & Subscriptions') && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="receipt-outline"
                  title="Billing & Subscriptions"
                  subtitle="Manage your plan, limits, and billing history."
                  primaryButton={{
                    label: "Upgrade Plan",
                    icon: "flash-outline",
                    onPress: () => setShowUpgradePlanModal(true),
                  }}
                />

                {/* Main Plan Card */}
                <View style={styles.billingPlanCard}>
                  <View style={styles.billingPlanTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.billingPlanBadge}>CURRENT PLAN</Text>
                      <Text style={styles.billingPlanTitle}>Enterprise Plan</Text>
                      <Text style={styles.billingPlanCycleText}>
                        Billing cycle: <Text style={{ fontWeight: '700', color: '#334155' }}>Monthly</Text> • Next charge: <Text style={{ fontWeight: '700', color: '#334155' }}>Next cycle</Text>
                      </Text>
                    </View>

                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.billingPlanPriceText}>
                        ₹2600<Text style={styles.billingPlanPricePer}>/mo</Text>
                      </Text>
                      <TouchableOpacity
                        style={styles.billingPlanUpgradeBtn}
                        onPress={() => setShowUpgradePlanModal(true)}>
                        <IconComp name="flash" size={14} color="#FFFFFF" />
                        <Text style={styles.billingPlanUpgradeBtnText}>Upgrade Plan</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Divider */}
                  <View style={styles.billingCardDivider} />

                  {/* Current Usage Section */}
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.billingUsageHeaderTitle}>Current Usage</Text>

                    <View style={styles.billingTrialNoticeBox}>
                      <Text style={styles.billingTrialNoticeText}>
                        You are currently on a free trial with limited capacity. Upgrade to a paid plan to unlock features.
                      </Text>
                    </View>

                    {/* Progress bars */}
                    <View style={{ gap: 12, marginTop: 12 }}>
                      {/* Metric 1: Students */}
                      <View>
                        <View style={styles.billingMetricHeaderRow}>
                          <Text style={styles.billingMetricLabel}>Students Enrolled</Text>
                          <Text style={styles.billingMetricValues}>
                            <Text style={{ fontWeight: '800', color: '#0F172A' }}>320</Text> / Unlimited
                          </Text>
                        </View>
                        <View style={styles.billingProgressTrack}>
                          <View style={[styles.billingProgressFill, { width: '35%', backgroundColor: '#7C3AED' }]} />
                        </View>
                      </View>

                      {/* Metric 2: Staff Accounts */}
                      <View>
                        <View style={styles.billingMetricHeaderRow}>
                          <Text style={styles.billingMetricLabel}>Staff Accounts</Text>
                          <Text style={styles.billingMetricValues}>
                            <Text style={{ fontWeight: '800', color: '#0F172A' }}>24</Text> / Unlimited
                          </Text>
                        </View>
                        <View style={styles.billingProgressTrack}>
                          <View style={[styles.billingProgressFill, { width: '25%', backgroundColor: '#2563EB' }]} />
                        </View>
                      </View>

                      {/* Metric 3: Storage */}
                      <View>
                        <View style={styles.billingMetricHeaderRow}>
                          <Text style={styles.billingMetricLabel}>Cloud Storage</Text>
                          <Text style={styles.billingMetricValues}>
                            <Text style={{ fontWeight: '800', color: '#0F172A' }}>12.5 GB</Text> / 50 GB
                          </Text>
                        </View>
                        <View style={styles.billingProgressTrack}>
                          <View style={[styles.billingProgressFill, { width: '25%', backgroundColor: '#059669' }]} />
                        </View>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Payment Method Card */}
                <View style={styles.billingPaymentCard}>
                  <View style={styles.billingPaymentHeaderRow}>
                    <Text style={styles.billingSectionTitle}>Payment Method</Text>
                    <TouchableOpacity
                      style={styles.billingEditBtn}
                      onPress={() => setShowEditPaymentModal(true)}>
                      <Text style={styles.billingEditBtnText}>Edit</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Card Visual Box */}
                  <View style={styles.billingCardChipBox}>
                    <View style={styles.billingCardVisaBadge}>
                      <Text style={styles.billingCardVisaText}>VISA</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.billingCardNumber}>•••• •••• •••• 4242</Text>
                      <Text style={styles.billingCardExpiry}>Expires 12/28</Text>
                    </View>
                    <IconComp name="checkmark-circle" size={18} color="#059669" />
                  </View>

                  <Text style={styles.billingAutoChargeNote}>
                    This card will be automatically charged ₹2600 on the 1st of every month.
                  </Text>
                </View>

                {/* Billing History Card */}
                <View style={styles.billingHistoryCard}>
                  <View style={styles.billingHistoryHeaderRow}>
                    <Text style={styles.billingSectionTitle}>Billing History</Text>
                  </View>

                  {/* Table Headers */}
                  <View style={styles.billingHistoryTableHeader}>
                    <Text style={[styles.billingHistoryCol, { flex: 1.2 }]}>INVOICE</Text>
                    <Text style={[styles.billingHistoryCol, { flex: 1 }]}>DATE</Text>
                    <Text style={[styles.billingHistoryCol, { flex: 1 }]}>AMOUNT</Text>
                    <Text style={[styles.billingHistoryCol, { flex: 1 }]}>STATUS</Text>
                    <Text style={[styles.billingHistoryCol, { flex: 1, textAlign: 'right' }]}>DOWNLOAD</Text>
                  </View>

                  {/* Empty state matching Pic 2 */}
                  <View style={styles.billingHistoryEmptyBox}>
                    <Text style={styles.billingHistoryEmptyText}>No invoices available.</Text>
                  </View>
                </View>

                {/* Need Help Card */}
                <View style={styles.billingHelpCard}>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                    <View style={styles.billingHelpIconBox}>
                      <IconComp name="help-circle-outline" size={20} color="#D97706" />
                    </View>
                    <Text style={styles.billingHelpTitle}>Need Help?</Text>
                  </View>

                  <Text style={styles.billingHelpSub}>
                    If you have questions about your billing or need a custom enterprise plan, please contact our support team.
                  </Text>

                  <TouchableOpacity
                    style={styles.billingContactSupportBtn}
                    onPress={handleContactBillingSupport}>
                    <Text style={styles.billingContactSupportBtnText}>Contact Support</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* =====================================================================
                MODULE 3: MODULE CUSTOMIZATION (Pic 3 Matching)
               ===================================================================== */}
            {(activeModuleModal === 'Custom Modules' || activeModuleModal === 'Module Customization') && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="extension-puzzle-outline"
                  title="Module Customization"
                  subtitle="Manage custom modules and define dynamic form schemas."
                  primaryButton={{
                    label: "Save Schema",
                    icon: "save-outline",
                    onPress: handleSaveSchema,
                  }}
                />

                {/* Segmented Top Tabs */}
                <View style={styles.customModTabsRow}>
                  <TouchableOpacity
                    style={[styles.customModTabBtn, customModuleTab === 'schema' && styles.customModTabBtnActive]}
                    onPress={() => setCustomModuleTab('schema')}>
                    <Text style={[styles.customModTabBtnText, customModuleTab === 'schema' && styles.customModTabBtnTextActive]}>
                      Form Schema Builder
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.customModTabBtn, customModuleTab === 'manager' && styles.customModTabBtnActive]}
                    onPress={() => setCustomModuleTab('manager')}>
                    <Text style={[styles.customModTabBtnText, customModuleTab === 'manager' && styles.customModTabBtnTextActive]}>
                      Sidebar & Modules Manager
                    </Text>
                  </TouchableOpacity>
                </View>

                {customModuleTab === 'schema' ? (
                  <>
                    {/* Controls Row: Target Module Picker + Import Selector */}
                    <View style={styles.customModControlsCard}>
                      <Text style={styles.customModFieldLabel}>Target Module</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                        {['Staff Directory', 'Student Directory', 'Inventory Management', 'HR & Payroll', 'Transport'].map(tm => (
                          <TouchableOpacity
                            key={tm}
                            style={[
                              styles.customModPill,
                              selectedCustomModuleTarget === tm && styles.customModPillActive
                            ]}
                            onPress={() => setSelectedCustomModuleTarget(tm)}>
                            <Text style={[
                              styles.customModPillText,
                              selectedCustomModuleTarget === tm && styles.customModPillTextActive
                            ]}>{tm}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>

                      <View style={styles.customModImportRow}>
                        <View style={styles.customModImportSelectBox}>
                          <Text style={styles.customModImportSelectText}>
                            {selectedImportModule || '-- Select Module to Import --'}
                          </Text>
                        </View>

                        <TouchableOpacity
                          style={styles.customModImportBtn}
                          onPress={() => {
                            handleImportSchema(selectedCustomModuleTarget);
                          }}>
                          <IconComp name="add-outline" size={15} color="#FFFFFF" />
                          <Text style={styles.customModImportBtnText}>Import</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.customModSaveBtn}
                          onPress={handleSaveSchema}>
                          <IconComp name="save-outline" size={15} color="#FFFFFF" />
                          <Text style={styles.customModSaveBtnText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Module Structure Card */}
                    <View style={styles.customModStructureCard}>
                      <View style={styles.customModStructureHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <IconComp name="folder-outline" size={18} color="#D97706" />
                          <Text style={styles.customModStructureTitle}>Module Structure</Text>
                        </View>

                        <TouchableOpacity
                          style={styles.customModAddSectionBtn}
                          onPress={() => setShowAddSectionModal(true)}>
                          <IconComp name="add-outline" size={14} color="#7C3AED" />
                          <Text style={styles.customModAddSectionBtnText}>+ Add Section</Text>
                        </TouchableOpacity>
                      </View>

                      {/* Empty State Matching Pic 3 */}
                      {customModuleSections.length === 0 ? (
                        <View style={styles.customModEmptyContainer}>
                          <View style={styles.customModEmptyIconBox}>
                            <IconComp name="folder-open-outline" size={44} color="#CBD5E1" />
                          </View>
                          <Text style={styles.customModEmptyTitle}>No sections defined yet</Text>
                          <Text style={styles.customModEmptySub}>
                            Start building this module by adding a section.
                          </Text>
                          <TouchableOpacity
                            style={styles.customModFirstSectionBtn}
                            onPress={() => setShowAddSectionModal(true)}>
                            <IconComp name="add" size={16} color="#FFFFFF" />
                            <Text style={styles.customModFirstSectionBtnText}>+ Add Your First Section</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        /* Render Sections and Fields */
                        <View style={{ gap: 12, marginTop: 12 }}>
                          {customModuleSections.map(sec => (
                            <View key={sec.id} style={styles.customModSectionItemCard}>
                              <View style={styles.customModSectionItemHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                  <IconComp name="reorder-two-outline" size={16} color="#64748B" />
                                  <Text style={styles.customModSectionItemTitle}>{sec.title}</Text>
                                  <View style={styles.customModFieldCountBadge}>
                                    <Text style={styles.customModFieldCountText}>{sec.fields?.length || 0} fields</Text>
                                  </View>
                                </View>

                                <TouchableOpacity
                                  style={{ padding: 4 }}
                                  onPress={() => handleDeleteSection(sec.id)}>
                                  <IconComp name="trash-outline" size={16} color="#EF4444" />
                                </TouchableOpacity>
                              </View>

                              {/* Fields inside section */}
                              <View style={{ gap: 6, marginVertical: 6 }}>
                                {sec.fields?.map((f: any) => (
                                  <View key={f.id} style={styles.customModFieldRowItem}>
                                    <Text style={styles.customModFieldRowLabel}>
                                      {f.label} {f.required && <Text style={{ color: '#EF4444' }}>*</Text>}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                      <View style={styles.customModFieldTypeBadge}>
                                        <Text style={styles.customModFieldTypeBadgeText}>{f.type}</Text>
                                      </View>
                                      <TouchableOpacity
                                        style={{ padding: 4 }}
                                        onPress={() => handleDeleteField(sec.id, f.id)}>
                                        <IconComp name="close-circle" size={14} color="#94A3B8" />
                                      </TouchableOpacity>
                                    </View>
                                  </View>
                                ))}
                              </View>

                              <TouchableOpacity
                                style={styles.customModAddFieldBtn}
                                onPress={() => {
                                  setTargetSectionIdForField(sec.id);
                                  setShowAddFieldModal(true);
                                }}>
                                <IconComp name="add-circle-outline" size={14} color="#7C3AED" />
                                <Text style={styles.customModAddFieldBtnText}>Add Field</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                ) : (
                  /* Sidebar & Modules Manager View */
                  <View style={styles.customModManagerCard}>
                    <Text style={styles.customModSectionTitle}>Sidebar & Modules Navigation</Text>
                    <Text style={styles.customModSectionSub}>
                      Reorder, show, or hide core and custom modules across your mobile school application.
                    </Text>

                    <View style={{ gap: 8, marginTop: 12 }}>
                      {allModulesList.slice(0, 10).map((m, idx) => (
                        <View key={m.id} style={styles.customModManagerRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                            <Text style={styles.customModManagerIndex}>#{idx + 1}</Text>
                            <IconComp name={m.icon} size={18} color={m.color} />
                            <Text style={styles.customModManagerName}>{m.name}</Text>
                          </View>
                          <IconComp name="checkmark-circle" size={18} color="#059669" />
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}

            {/* =====================================================================
                MODULE 4: ROLES & PERMISSIONS (Pic 4 Matching)
               ===================================================================== */}
            {activeModuleModal === 'Roles & Permissions' && (
              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="shield-checkmark-outline"
                  title="Roles & Permissions"
                  subtitle="Configure fine-grained access control for your staff members."
                  primaryButton={{
                    label: "Save Permissions",
                    icon: "save-outline",
                    onPress: handleSavePermissions,
                  }}
                />

                {/* Role Selector Header & Horizontal Pills */}
                <View style={styles.rolesSelectorCard}>
                  <View style={styles.rolesSelectorHeaderRow}>
                    <Text style={styles.rolesSelectorHeaderTitle}>SELECT ROLE</Text>
                    <TouchableOpacity
                      style={styles.rolesAddRoleBtn}
                      onPress={() => setShowAddRoleModal(true)}>
                      <IconComp name="add-outline" size={14} color="#7C3AED" />
                      <Text style={styles.rolesAddRoleBtnText}>+ Add Role</Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {rolesList.map(r => (
                      <TouchableOpacity
                        key={r}
                        style={[
                          styles.roleSelectPill,
                          selectedRole === r && styles.roleSelectPillActive
                        ]}
                        onPress={() => setSelectedRole(r)}>
                        <Text style={[
                          styles.roleSelectPillText,
                          selectedRole === r && styles.roleSelectPillTextActive
                        ]}>
                          {r}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Permissions Matrix Card */}
                <View style={styles.permissionsMatrixCard}>
                  {/* Card Title & Target Login Panel */}
                  <View style={styles.permissionsCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.permissionsCardTitle}>{selectedRole} Permissions</Text>
                      <Text style={styles.permissionsCardSub}>
                        Select the modules and actions this role can access.
                      </Text>
                    </View>

                    <View style={styles.permissionsTargetPanelBox}>
                      <Text style={styles.permissionsTargetPanelLabel}>Target Login Panel</Text>
                      <View style={styles.permissionsPanelBadge}>
                        <Text style={styles.permissionsPanelBadgeText}>{targetLoginPanel}</Text>
                        <IconComp name="chevron-down" size={12} color="#475569" />
                      </View>
                    </View>
                  </View>

                  {/* Horizontal Scrollable Permissions Matrix Table */}
                  <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: 12 }}>
                    <View>
                      {/* Table Header */}
                      <View style={styles.permsTableHeaderRow}>
                        <Text style={[styles.permsTableColHead, { width: 170 }]}>MODULE NAME</Text>
                        <Text style={[styles.permsTableColHead, { width: 85, textAlign: 'center' }]}>READ / VIEW</Text>
                        <Text style={[styles.permsTableColHead, { width: 95, textAlign: 'center' }]}>CREATE / ADD</Text>
                        <Text style={[styles.permsTableColHead, { width: 95, textAlign: 'center' }]}>EDIT / UPDATE</Text>
                        <Text style={[styles.permsTableColHead, { width: 80, textAlign: 'center' }]}>DELETE</Text>
                        <Text style={[styles.permsTableColHead, { width: 90, textAlign: 'center' }]}>QUICK SELECT</Text>
                      </View>

                      {/* Rows for all core modules */}
                      {DEFAULT_ROLE_MODULES.map((modName, idx) => {
                        const currentPerms = rolePermissionsMap[selectedRole]?.[modName] || {
                          read: false,
                          create: false,
                          edit: false,
                          delete: false,
                        };

                        return (
                          <View
                            key={modName}
                            style={[
                              styles.permsTableRow,
                              idx % 2 === 1 && { backgroundColor: '#F8FAFC' }
                            ]}>
                            {/* Module Name */}
                            <Text style={[styles.permsRowModuleName, { width: 170 }]} numberOfLines={2}>
                              {modName}
                            </Text>

                            {/* Read Checkbox */}
                            <TouchableOpacity
                              style={[styles.permsCheckboxCell, { width: 85 }]}
                              onPress={() => handleTogglePermission(modName, 'read')}>
                              <View style={[styles.permsCheckboxBox, currentPerms.read && styles.permsCheckboxBoxChecked]}>
                                {currentPerms.read && <IconComp name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                            </TouchableOpacity>

                            {/* Create Checkbox */}
                            <TouchableOpacity
                              style={[styles.permsCheckboxCell, { width: 95 }]}
                              onPress={() => handleTogglePermission(modName, 'create')}>
                              <View style={[styles.permsCheckboxBox, currentPerms.create && styles.permsCheckboxBoxChecked]}>
                                {currentPerms.create && <IconComp name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                            </TouchableOpacity>

                            {/* Edit Checkbox */}
                            <TouchableOpacity
                              style={[styles.permsCheckboxCell, { width: 95 }]}
                              onPress={() => handleTogglePermission(modName, 'edit')}>
                              <View style={[styles.permsCheckboxBox, currentPerms.edit && styles.permsCheckboxBoxChecked]}>
                                {currentPerms.edit && <IconComp name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                            </TouchableOpacity>

                            {/* Delete Checkbox */}
                            <TouchableOpacity
                              style={[styles.permsCheckboxCell, { width: 80 }]}
                              onPress={() => handleTogglePermission(modName, 'delete')}>
                              <View style={[styles.permsCheckboxBox, currentPerms.delete && styles.permsCheckboxBoxChecked]}>
                                {currentPerms.delete && <IconComp name="checkmark" size={12} color="#FFFFFF" />}
                              </View>
                            </TouchableOpacity>

                            {/* Quick Select All Button */}
                            <View style={[styles.permsCheckboxCell, { width: 90 }]}>
                              <TouchableOpacity
                                style={styles.permsQuickSelectBtn}
                                onPress={() => handleQuickSelectAllModule(modName)}>
                                <Text style={styles.permsQuickSelectBtnText}>
                                  {currentPerms.read && currentPerms.create && currentPerms.edit && currentPerms.delete
                                    ? 'Clear'
                                    : 'Select All'}
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              </ScrollView>
            )}

            {/* --- GENERIC MODULE VIEW --- */}
            {activeModuleModal !== 'Staff Directory' &&
             activeModuleModal !== 'Classes & Sections' &&
             activeModuleModal !== 'Subject Management' &&
             activeModuleModal !== 'Noticeboard' &&
             activeModuleModal !== 'HR & Payroll' &&
             activeModuleModal !== 'Chat Monitor' &&
             activeModuleModal !== 'Timetables' &&
             activeModuleModal !== 'Calendar' &&
             activeModuleModal !== 'Exams & Results' &&
             activeModuleModal !== 'Homework' &&
             activeModuleModal !== 'Fee Management' &&
             activeModuleModal !== 'Transport' &&
             activeModuleModal !== 'Library' &&
             activeModuleModal !== 'Inventory & Assets' &&
             activeModuleModal !== 'Leave Requests' &&
             activeModuleModal !== 'Leave Management' &&
             activeModuleModal !== 'Reports & Analytics' &&
             activeModuleModal !== 'API Integrations' &&
             activeModuleModal !== 'Registration Links' &&
             activeModuleModal !== 'Leads' &&
             activeModuleModal !== 'Leads Management' &&
             activeModuleModal !== 'Billing & Plan' &&
             activeModuleModal !== 'Billing & Subscriptions' &&
             activeModuleModal !== 'Custom Modules' &&
             activeModuleModal !== 'Module Customization' &&
             activeModuleModal !== 'Roles & Permissions' && (

              <ScrollView contentContainerStyle={{ padding: 16 }} showsVerticalScrollIndicator={false}>
                <ModuleHeaderCard
                  icon="apps-outline"
                  title={activeModuleModal}
                  subtitle={`Manage and configure ${activeModuleModal} for ZUNA International Academy.`}
                />

                <View style={styles.emptyModuleCardContainer}>
                  <View style={styles.emptyIconCircleLarge}>
                    <IconComp name="construct-outline" size={40} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyModuleTitle}>{activeModuleModal} Management</Text>
                  <Text style={styles.emptyModuleSub}>
                    All real-time data is synced with the main ZUNA Admin web database.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyActionPurpleBtn}
                    onPress={() => showToast(`${activeModuleModal} data refreshed`)}>
                    <IconComp name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.emptyActionBtnText}>Sync Module Data</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

          </SafeAreaView>
        </Modal>

        {/* --- MODAL 1: ADD STAFF MODAL --- */}
        <Modal visible={showAddStaffModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="person-add-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add New Staff Member</Text>
              </View>
              <Text style={styles.fieldLabelText}>Full Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Dr. Sarah Connor"
                placeholderTextColor="#94A3B8"
                value={newStaffName}
                onChangeText={setNewStaffName}
              />
              <Text style={styles.fieldLabelText}>Email Address *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="sarah@zuna.edu"
                placeholderTextColor="#94A3B8"
                value={newStaffEmail}
                onChangeText={setNewStaffEmail}
                keyboardType="email-address"
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddStaffModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleAddStaffSubmit}>
                  <Text style={styles.modalSmallBtnText}>Add Staff</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL 2: CREATE CLASS MODAL --- */}
        <Modal visible={showAddClassModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="school-outline" size={20} color="#2563EB" />
                <Text style={styles.modalCardTitle}>Create New Class</Text>
              </View>
              <Text style={styles.fieldLabelText}>Class Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. GRADE - 4"
                placeholderTextColor="#94A3B8"
                value={newClassName}
                onChangeText={setNewClassName}
              />
              <Text style={styles.fieldLabelText}>Section</Text>
              <TextInput
                style={styles.modalInputBox}
                value={newClassSection}
                onChangeText={setNewClassSection}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddClassModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#2563EB' }]}
                  onPress={handleAddClassSubmit}>
                  <Text style={styles.modalSmallBtnText}>Create Class</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL 3: ADD SUBJECT MODAL --- */}
        <Modal visible={showAddSubjectModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="journal-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add New Subject</Text>
              </View>
              <Text style={styles.fieldLabelText}>Subject Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Science"
                placeholderTextColor="#94A3B8"
                value={newSubjectName}
                onChangeText={setNewSubjectName}
              />
              <Text style={styles.fieldLabelText}>Subject Code *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. SCI01"
                placeholderTextColor="#94A3B8"
                value={newSubjectCode}
                onChangeText={setNewSubjectCode}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddSubjectModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleAddSubjectSubmit}>
                  <Text style={styles.modalSmallBtnText}>Save Subject</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL 4: CHANGE CLASS MODAL --- */}
        <Modal visible={showChangeClassModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="swap-horizontal-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Change Student Class</Text>
              </View>
              <Text style={styles.modalCardDesc}>
                Reassign <Text style={{ fontWeight: '700' }}>{selectedStudentForChange?.name}</Text> to a new section.
              </Text>
              <Text style={styles.fieldLabelText}>New Target Class</Text>
              <TextInput
                style={styles.modalInputBox}
                value={targetNewClass}
                onChangeText={setTargetNewClass}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowChangeClassModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleChangeClassSubmit}>
                  <Text style={styles.modalSmallBtnText}>Update Class</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Create Global Notice Modal */}
        <Modal visible={showCreateNoticeModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="megaphone-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Create Global Notice</Text>
              </View>

              <Text style={styles.fieldLabelText}>Notice Title *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Annual Sports Day Announcement"
                placeholderTextColor="#94A3B8"
                value={noticeTitleInput}
                onChangeText={setNoticeTitleInput}
              />

              <Text style={styles.fieldLabelText}>Target Audience</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. All Students & Staff"
                placeholderTextColor="#94A3B8"
                value={noticeAudienceInput}
                onChangeText={setNoticeAudienceInput}
              />

              <Text style={styles.fieldLabelText}>Message Content *</Text>
              <TextInput
                style={[styles.modalInputBox, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Write the full notice broadcast message here..."
                placeholderTextColor="#94A3B8"
                multiline
                value={noticeMessageInput}
                onChangeText={setNoticeMessageInput}
              />

              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowCreateNoticeModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!noticeTitleInput.trim()) {
                      Alert.alert('Error', 'Please enter a notice title');
                      return;
                    }
                    const newNotice = {
                      title: noticeTitleInput,
                      audience: noticeAudienceInput || 'All Students & Staff',
                      priority: noticePriorityInput,
                      message: noticeMessageInput || 'Notice published for all members.',
                      date: 'Today, 10:00 AM'
                    };
                    setGlobalNoticesList([newNotice, ...globalNoticesList]);
                    setShowCreateNoticeModal(false);
                    setNoticeTitleInput('');
                    setNoticeMessageInput('');
                    showToast('Global Notice published successfully!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Publish Notice</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: ADD HR PAYROLL RECORD --- */}
        <Modal visible={showAddHrModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="cash-outline" size={20} color="#059669" />
                <Text style={styles.modalCardTitle}>Add Payroll Record</Text>
              </View>
              <Text style={styles.fieldLabelText}>Staff Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Dr. Sarah Connor"
                placeholderTextColor="#94A3B8"
                value={hrStaffName}
                onChangeText={setHrStaffName}
              />
              <Text style={styles.fieldLabelText}>Role / Designation</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Teacher"
                placeholderTextColor="#94A3B8"
                value={hrStaffRole}
                onChangeText={setHrStaffRole}
              />
              <Text style={styles.fieldLabelText}>Base Salary (₹) *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="25000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={hrBaseSalary}
                onChangeText={setHrBaseSalary}
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddHrModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#059669' }]}
                  onPress={() => {
                    const sal = parseFloat(hrBaseSalary) || 0;
                    const pf = Math.round(Math.min(sal, 15000) * 0.12);
                    const net = sal - pf;
                    const newRecord = {
                      id: `pr_${Date.now()}`,
                      teacherId: `t_${Date.now()}`,
                      name: hrStaffName || 'Staff Member',
                      role: hrStaffRole || 'Teacher',
                      baseSalary: sal,
                      pfCalculated: pf,
                      esiCalculated: 0,
                      deductions: pf,
                      netPay: net,
                      month: 'September 2026',
                      status: hrPaymentStatus,
                      createdAt: new Date().toISOString(),
                    };
                    setHrPayrollList([newRecord, ...hrPayrollList]);
                    setShowAddHrModal(false);
                    showToast('Payroll record added successfully!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Save Record</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: PAYSLIP PREVIEW --- */}
        <Modal visible={!!showPayslipModalItem} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={[styles.modalCardContainer, { maxWidth: 360 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconComp name="document-text-outline" size={20} color="#7C3AED" />
                  <Text style={styles.modalCardTitle}>Salary Payslip</Text>
                </View>
                <TouchableOpacity onPress={() => setShowPayslipModalItem(null)}>
                  <IconComp name="close-outline" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              {showPayslipModalItem && (
                <View style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', gap: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#7C3AED', textAlign: 'center' }}>
                    ZUNA INTERNATIONAL ACADEMY
                  </Text>
                  <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>
                    Official Salary Slip • {showPayslipModalItem.month}
                  </Text>
                  <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 4 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                    Staff Name: {showPayslipModalItem.name}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>
                    Role: {showPayslipModalItem.role}
                  </Text>
                  <View style={{ height: 1, backgroundColor: '#E2E8F0', marginVertical: 2 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Base Salary:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>₹{showPayslipModalItem.baseSalary}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>PF Deduction (12%):</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>-₹{showPayslipModalItem.pfCalculated}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>Total Deductions:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#DC2626' }}>-₹{showPayslipModalItem.deductions}</Text>
                  </View>
                  <View style={{ height: 1, backgroundColor: '#CBD5E1', marginVertical: 4 }} />
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Net Salary Paid:</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#059669' }}>₹{showPayslipModalItem.netPay}</Text>
                  </View>
                </View>
              )}

              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    setShowPayslipModalItem(null);
                    showToast('Payslip PDF downloaded successfully!');
                  }}>
                  <IconComp name="download-outline" size={16} color="#FFFFFF" />
                  <Text style={styles.modalSmallBtnText}>Download PDF</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: ADD TIMETABLE PERIOD --- */}
        <Modal visible={showAddSlotModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="time-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add Timetable Period</Text>
              </View>
              <Text style={styles.fieldLabelText}>Start Time</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="09:00 AM"
                placeholderTextColor="#94A3B8"
                value={slotStartTime}
                onChangeText={setSlotStartTime}
              />
              <Text style={styles.fieldLabelText}>End Time</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="10:00 AM"
                placeholderTextColor="#94A3B8"
                value={slotEndTime}
                onChangeText={setSlotEndTime}
              />
              <Text style={styles.fieldLabelText}>Subject *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Mathematics"
                placeholderTextColor="#94A3B8"
                value={slotSubject}
                onChangeText={setSlotSubject}
              />
              <Text style={styles.fieldLabelText}>Assigned Teacher</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Jana D"
                placeholderTextColor="#94A3B8"
                value={slotTeacher}
                onChangeText={setSlotTeacher}
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddSlotModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!slotSubject.trim()) {
                      Alert.alert('Error', 'Please enter a subject name');
                      return;
                    }
                    const newSlotObj = {
                      id: `slot_${Date.now()}`,
                      startTime: slotStartTime || '09:00 AM',
                      endTime: slotEndTime || '10:00 AM',
                      subject: slotSubject,
                      teacher: slotTeacher || 'Unassigned',
                    };
                    setTimetablesData((prev: any) => {
                      const currentClass = prev[timetableClassSelected] || {};
                      const currentDaySlots = currentClass[timetableMasterDay] || [];
                      return {
                        ...prev,
                        [timetableClassSelected]: {
                          ...currentClass,
                          [timetableMasterDay]: [...currentDaySlots, newSlotObj],
                        },
                      };
                    });
                    setShowAddSlotModal(false);
                    showToast('Period added to timetable!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Add Period</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: ADD CALENDAR EVENT --- */}
        <Modal visible={showAddEventModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="calendar-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add Calendar Event</Text>
              </View>
              <Text style={styles.fieldLabelText}>Event Title *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Science Exhibition"
                placeholderTextColor="#94A3B8"
                value={eventTitleInput}
                onChangeText={setEventTitleInput}
              />
              <Text style={styles.fieldLabelText}>Category Type</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
                {(['event', 'holiday', 'exam'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.filterChipItem,
                      eventTypeInput === t && styles.filterChipItemActive,
                    ]}
                    onPress={() => setEventTypeInput(t)}>
                    <Text style={[styles.filterChipText, eventTypeInput === t && styles.filterChipTextActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.fieldLabelText}>Start Date</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="2026-09-15"
                placeholderTextColor="#94A3B8"
                value={eventStartInput}
                onChangeText={setEventStartInput}
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddEventModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!eventTitleInput.trim()) {
                      Alert.alert('Error', 'Please enter event title');
                      return;
                    }
                    const newEv = {
                      id: `ev_${Date.now()}`,
                      title: eventTitleInput,
                      start: eventStartInput || '2026-09-15',
                      end: eventEndInput || '2026-09-15',
                      type: eventTypeInput,
                    };
                    setCalendarEventsList([newEv, ...calendarEventsList]);
                    setShowAddEventModal(false);
                    setEventTitleInput('');
                    showToast('Event added to calendar!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Save Event</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- MODAL: CREATE EXAM --- */}
        <Modal visible={showCreateExamModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="document-text-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Create New Examination</Text>
              </View>
              <Text style={styles.fieldLabelText}>Exam Title *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Unit Test - 2"
                placeholderTextColor="#94A3B8"
                value={newExamName}
                onChangeText={setNewExamName}
              />
              <Text style={styles.fieldLabelText}>Subject *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Mathematics"
                placeholderTextColor="#94A3B8"
                value={newExamSubject}
                onChangeText={setNewExamSubject}
              />
              <Text style={styles.fieldLabelText}>Max Marks</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="50"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={newExamMaxMarks}
                onChangeText={setNewExamMaxMarks}
              />
              <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowCreateExamModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!newExamName.trim()) {
                      Alert.alert('Error', 'Please enter exam title');
                      return;
                    }
                    const newEx = {
                      id: `ex_${Date.now()}`,
                      name: newExamName,
                      examType: newExamType,
                      subject: newExamSubject || 'General',
                      maxMarks: parseInt(newExamMaxMarks, 10) || 50,
                      startDate: newExamStartDate || '15/09/2026',
                      endDate: newExamEndDate || '15/09/2026',
                      status: 'ACTIVE',
                    };
                    setExamsList([newEx, ...examsList]);
                    setShowCreateExamModal(false);
                    setNewExamName('');
                    showToast('Examination created successfully!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Create Exam</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* --- Gender Filter Modal --- */}
        <Modal visible={showGenderFilterModal} transparent animationType="fade">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="man-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Filter by Gender</Text>
              </View>
              {(['All Genders', 'Male', 'Female'] as const).map(g => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.filterOptionItemRow,
                    studentGenderFilter === g && styles.filterOptionItemActive,
                  ]}
                  onPress={() => {
                    setStudentGenderFilter(g);
                    setShowGenderFilterModal(false);
                    showToast(`Filtered by ${g}`);
                  }}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      studentGenderFilter === g && styles.filterOptionTextActive,
                    ]}>
                    {g}
                  </Text>
                  {studentGenderFilter === g && (
                    <IconComp name="checkmark-sharp" size={16} color="#7C3AED" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalSmallBtn, { backgroundColor: '#64748B', marginTop: 12 }]}
                onPress={() => setShowGenderFilterModal(false)}>
                <Text style={styles.modalSmallBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* --- Class Filter Modal --- */}
        <Modal visible={showClassFilterModal} transparent animationType="fade">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="school-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Filter by Class</Text>
              </View>
              {(['All Classes', 'PRE KG - A', 'grade - 3 - A'] as const).map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.filterOptionItemRow,
                    studentClassFilter === c && styles.filterOptionItemActive,
                  ]}
                  onPress={() => {
                    setStudentClassFilter(c);
                    setShowClassFilterModal(false);
                    showToast(`Filtered by ${c}`);
                  }}>
                  <Text
                    style={[
                      styles.filterOptionText,
                      studentClassFilter === c && styles.filterOptionTextActive,
                    ]}>
                    {c}
                  </Text>
                  {studentClassFilter === c && (
                    <IconComp name="checkmark-sharp" size={16} color="#7C3AED" />
                  )}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.modalSmallBtn, { backgroundColor: '#64748B', marginTop: 12 }]}
                onPress={() => setShowClassFilterModal(false)}>
                <Text style={styles.modalSmallBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ASSIGN NEW FEE ===== */}
        <Modal visible={showAssignFeeModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="card-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Assign New Fee</Text>
              </View>
              <Text style={styles.fieldLabelText}>Fee / Period Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Term 1 Fee"
                placeholderTextColor="#94A3B8"
                value={newFeeForm.name}
                onChangeText={v => setNewFeeForm(p => ({ ...p, name: v }))}
              />
              <Text style={styles.fieldLabelText}>Class</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Grade 3"
                placeholderTextColor="#94A3B8"
                value={newFeeForm.classLabel}
                onChangeText={v => setNewFeeForm(p => ({ ...p, classLabel: v }))}
              />
              <Text style={styles.fieldLabelText}>Amount (₹) *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. 5000"
                placeholderTextColor="#94A3B8"
                keyboardType="numeric"
                value={newFeeForm.amount}
                onChangeText={v => setNewFeeForm(p => ({ ...p, amount: v }))}
              />
              <Text style={styles.fieldLabelText}>Due Date</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#94A3B8"
                value={newFeeForm.dueDate}
                onChangeText={v => setNewFeeForm(p => ({ ...p, dueDate: v }))}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowAssignFeeModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!newFeeForm.name || !newFeeForm.amount) { Alert.alert('Error', 'Fee name and amount are required'); return; }
                    setShowAssignFeeModal(false);
                    showToast(`Fee "${newFeeForm.name}" assigned successfully!`);
                    setNewFeeForm({ name: '', amount: '', dueDate: new Date().toISOString().split('T')[0], classId: '', classLabel: '' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Assign Fee</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD TRANSPORT ROUTE ===== */}
        <Modal visible={showAddRouteModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="bus-outline" size={20} color="#4F46E5" />
                <Text style={styles.modalCardTitle}>Add New Route</Text>
              </View>
              <Text style={styles.fieldLabelText}>Route Name *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Route 1 - North Zone" placeholderTextColor="#94A3B8" value={newRouteForm.name} onChangeText={v => setNewRouteForm(p => ({ ...p, name: v }))} />
              <Text style={styles.fieldLabelText}>Vehicle Number</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. TN 01 AB 1234" placeholderTextColor="#94A3B8" value={newRouteForm.vehicleNumber} onChangeText={v => setNewRouteForm(p => ({ ...p, vehicleNumber: v }))} />
              <Text style={styles.fieldLabelText}>Driver Name</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Rajan Kumar" placeholderTextColor="#94A3B8" value={newRouteForm.driverName} onChangeText={v => setNewRouteForm(p => ({ ...p, driverName: v }))} />
              <Text style={styles.fieldLabelText}>Driver Phone</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. 9876543210" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={newRouteForm.driverPhone} onChangeText={v => setNewRouteForm(p => ({ ...p, driverPhone: v }))} />
              <Text style={styles.fieldLabelText}>Capacity (Seats)</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. 40" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newRouteForm.capacity} onChangeText={v => setNewRouteForm(p => ({ ...p, capacity: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowAddRouteModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#4F46E5' }]}
                  onPress={() => {
                    if (!newRouteForm.name.trim()) { Alert.alert('Error', 'Route name is required'); return; }
                    const route = { id: `r_${Date.now()}`, ...newRouteForm };
                    setTransportRoutesList([...transportRoutesList, route]);
                    setShowAddRouteModal(false);
                    showToast('Route created successfully!');
                    setNewRouteForm({ name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Create Route</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD VEHICLE ===== */}
        <Modal visible={showAddVehicleModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="car-outline" size={20} color="#4F46E5" />
                <Text style={styles.modalCardTitle}>Add Vehicle</Text>
              </View>
              <Text style={styles.fieldLabelText}>Vehicle Name *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. School Bus 1" placeholderTextColor="#94A3B8" value={newVehicleForm.vehicleName} onChangeText={v => setNewVehicleForm(p => ({ ...p, vehicleName: v }))} />
              <Text style={styles.fieldLabelText}>Registration Number *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. TN 01 AB 1234" placeholderTextColor="#94A3B8" value={newVehicleForm.registrationNumber} onChangeText={v => setNewVehicleForm(p => ({ ...p, registrationNumber: v }))} />
              <Text style={styles.fieldLabelText}>Seating Capacity</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. 40" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newVehicleForm.seatingCapacity} onChangeText={v => setNewVehicleForm(p => ({ ...p, seatingCapacity: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowAddVehicleModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#4F46E5' }]}
                  onPress={() => {
                    if (!newVehicleForm.vehicleName.trim() || !newVehicleForm.registrationNumber.trim()) { Alert.alert('Error', 'Vehicle name and registration are required'); return; }
                    setTransportVehiclesList([...transportVehiclesList, { id: `v_${Date.now()}`, ...newVehicleForm }]);
                    setShowAddVehicleModal(false);
                    showToast('Vehicle added successfully!');
                    setNewVehicleForm({ vehicleName: '', registrationNumber: '', seatingCapacity: '', status: 'Active' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD NEW BOOK ===== */}
        <Modal visible={showAddBookModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="book-outline" size={20} color="#0284C7" />
                <Text style={styles.modalCardTitle}>Add New Book</Text>
              </View>
              <Text style={styles.fieldLabelText}>Title *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. To Kill a Mockingbird" placeholderTextColor="#94A3B8" value={newBookForm.title} onChangeText={v => setNewBookForm(p => ({ ...p, title: v }))} />
              <Text style={styles.fieldLabelText}>Author *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Harper Lee" placeholderTextColor="#94A3B8" value={newBookForm.author} onChangeText={v => setNewBookForm(p => ({ ...p, author: v }))} />
              <Text style={styles.fieldLabelText}>ISBN</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. 978-0060935467" placeholderTextColor="#94A3B8" value={newBookForm.isbn} onChangeText={v => setNewBookForm(p => ({ ...p, isbn: v }))} />
              <Text style={styles.fieldLabelText}>Category</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Fiction" placeholderTextColor="#94A3B8" value={newBookForm.category} onChangeText={v => setNewBookForm(p => ({ ...p, category: v }))} />
              <Text style={styles.fieldLabelText}>Quantity</Text>
              <TextInput style={styles.modalInputBox} placeholder="1" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newBookForm.totalQuantity} onChangeText={v => setNewBookForm(p => ({ ...p, totalQuantity: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowAddBookModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#0284C7' }]}
                  onPress={() => {
                    if (!newBookForm.title.trim()) { Alert.alert('Error', 'Book title is required'); return; }
                    setShowAddBookModal(false);
                    showToast(`Book "${newBookForm.title}" added to library!`);
                    setNewBookForm({ title: '', author: '', isbn: '', category: 'Fiction', totalQuantity: '1' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Add Book</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ISSUE BOOK ===== */}
        <Modal visible={showIssueBookModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="share-outline" size={20} color="#0284C7" />
                <Text style={styles.modalCardTitle}>Issue Book</Text>
              </View>
              <Text style={styles.fieldLabelText}>Book Title / ID *</Text>
              <TextInput style={styles.modalInputBox} placeholder="Search or enter book title..." placeholderTextColor="#94A3B8" value={issueBookForm.bookId} onChangeText={v => setIssueBookForm(p => ({ ...p, bookId: v }))} />
              <Text style={styles.fieldLabelText}>Student Name *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Rahul Kumar" placeholderTextColor="#94A3B8" value={issueBookForm.studentName} onChangeText={v => setIssueBookForm(p => ({ ...p, studentName: v }))} />
              <Text style={styles.fieldLabelText}>Due Date *</Text>
              <TextInput style={styles.modalInputBox} placeholder="YYYY-MM-DD" placeholderTextColor="#94A3B8" value={issueBookForm.dueDate} onChangeText={v => setIssueBookForm(p => ({ ...p, dueDate: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowIssueBookModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#0284C7' }]}
                  onPress={() => {
                    if (!issueBookForm.bookId.trim() || !issueBookForm.studentName.trim()) { Alert.alert('Error', 'Book and student are required'); return; }
                    const issued = { id: `ib_${Date.now()}`, bookTitle: issueBookForm.bookId, studentName: issueBookForm.studentName, dueDate: issueBookForm.dueDate || 'No date set', issuedDate: new Date().toLocaleDateString('en-GB') };
                    setIssuedBooksList([...issuedBooksList, issued]);
                    setShowIssueBookModal(false);
                    showToast(`Book issued to ${issueBookForm.studentName}!`);
                    setIssueBookForm({ bookId: '', studentName: '', dueDate: '' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Issue Book</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD INVENTORY ITEM ===== */}
        <Modal visible={showAddItemModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="cube-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add Inventory Item</Text>
              </View>
              <Text style={styles.fieldLabelText}>Product Name *</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Whiteboard Marker" placeholderTextColor="#94A3B8" value={newItemForm.name} onChangeText={v => setNewItemForm(p => ({ ...p, name: v }))} />
              <Text style={styles.fieldLabelText}>Product ID</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. WBM-001" placeholderTextColor="#94A3B8" value={newItemForm.productId} onChangeText={v => setNewItemForm(p => ({ ...p, productId: v }))} />
              <Text style={styles.fieldLabelText}>Category</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. Stationery" placeholderTextColor="#94A3B8" value={newItemForm.category} onChangeText={v => setNewItemForm(p => ({ ...p, category: v }))} />
              <Text style={styles.fieldLabelText}>Quantity</Text>
              <TextInput style={styles.modalInputBox} placeholder="e.g. 100" placeholderTextColor="#94A3B8" keyboardType="numeric" value={newItemForm.quantity} onChangeText={v => setNewItemForm(p => ({ ...p, quantity: v }))} />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]} onPress={() => setShowAddItemModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    if (!newItemForm.name.trim()) { Alert.alert('Error', 'Product name is required'); return; }
                    setShowAddItemModal(false);
                    showToast(`Item "${newItemForm.name}" added to inventory!`);
                    setNewItemForm({ productId: '', name: '', category: '', quantity: '', unit: 'pcs', status: 'In Stock' });
                  }}>
                  <Text style={styles.modalSmallBtnText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADMIT NEW STUDENT (Pic 1 / Web Student Directory Matching) ===== */}
        <Modal visible={showStudentModal} animationType="slide">
          <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Modal Top Nav Bar */}
            <View style={styles.moduleModalTopNav}>
              <TouchableOpacity
                style={styles.moduleBackBtn}
                onPress={() => setShowStudentModal(false)}>
                <IconComp name="arrow-back-outline" size={20} color="#0F172A" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.moduleNavTitleText} numberOfLines={1}>Admit New Student</Text>
                <Text style={styles.moduleNavSubText}>Student Directory & Admissions</Text>
              </View>
              <TouchableOpacity
                style={styles.smallWhiteOutlineBtn}
                onPress={() => setShowStudentModal(false)}>
                <Text style={styles.smallWhiteOutlineBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
              {/* Header Hero Card */}
              <ModuleHeaderCard
                icon="person-add-outline"
                title="Admit New Student"
                subtitle="Review details, configure academic assignments, and enroll student into school directory."
              />

              {/* Form Section 1: Personal Information */}
              <View style={styles.admitSectionCard}>
                <Text style={styles.admitSectionTitle}>Personal Information</Text>

                {/* Profile Photo Mock Picker */}
                <Text style={styles.formInputLabel}>Profile Photo (JPG/PNG)</Text>
                <TouchableOpacity
                  style={styles.photoUploadBox}
                  onPress={() => showToast('Selected student profile photo')}>
                  <IconComp name="camera-outline" size={28} color="#64748B" />
                  <Text style={styles.photoUploadText}>Choose file  No file chosen</Text>
                  <Text style={styles.photoUploadSub}>Supported formats: JPG, PNG (Max 5MB)</Text>
                </TouchableOpacity>

                {/* First Name & Last Name */}
                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>First Name *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Rahul"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.firstName}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, firstName: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Last Name *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Kumar"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.lastName}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, lastName: v }))}
                    />
                  </View>
                </View>

                {/* Date of Birth & Age */}
                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Date of Birth *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="DD-MM-YYYY"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.dob}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, dob: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Age</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. 11"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={admitStudentForm.age}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, age: v }))}
                    />
                  </View>
                </View>

                {/* Gender Selector */}
                <Text style={styles.formInputLabel}>Gender *</Text>
                <View style={styles.segmentedPillsRow}>
                  {['Male', 'Female', 'Other'].map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[
                        styles.segmentedPillBtn,
                        admitStudentForm.gender === g && styles.segmentedPillBtnActive,
                      ]}
                      onPress={() => setAdmitStudentForm(p => ({ ...p, gender: g }))}>
                      <Text style={[
                        styles.segmentedPillText,
                        admitStudentForm.gender === g && styles.segmentedPillTextActive,
                      ]}>
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Blood Group & Nationality */}
                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Blood Group</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. O+"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.bloodGroup}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, bloodGroup: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Nationality</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Indian"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.nationality}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, nationality: v }))}
                    />
                  </View>
                </View>

                {/* Religion & Mother Tongue */}
                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Religion</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Hindu"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.religion}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, religion: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Mother Tongue</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. English"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.motherTongue}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, motherTongue: v }))}
                    />
                  </View>
                </View>

                {/* Aadhar Number */}
                <Text style={styles.formInputLabel}>Aadhar Number</Text>
                <TextInput
                  style={styles.formTextInput}
                  placeholder="12 digit number"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={admitStudentForm.aadharNumber}
                  onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, aadharNumber: v }))}
                />
              </View>

              {/* Form Section 2: Contact Information */}
              <View style={styles.admitSectionCard}>
                <Text style={styles.admitSectionTitle}>Contact Information</Text>

                <Text style={styles.formInputLabel}>Home Address</Text>
                <TextInput
                  style={styles.formTextArea}
                  placeholder="Full residential street address, city, pin code"
                  placeholderTextColor="#94A3B8"
                  multiline
                  value={admitStudentForm.homeAddress}
                  onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, homeAddress: v }))}
                />

                <View style={[styles.inputTwoColRow, { marginTop: 10 }]}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Parent/Guardian Name *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="Full Name"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.parentName}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, parentName: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Parent Email *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="parent@gmail.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      value={admitStudentForm.parentEmail}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, parentEmail: v }))}
                    />
                  </View>
                </View>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Parent Phone Number</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="+91 9876543210"
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={admitStudentForm.parentPhone}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, parentPhone: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Parent Occupation</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Engineer"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.parentOccupation}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, parentOccupation: v }))}
                    />
                  </View>
                </View>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Emergency Contact Number</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="+91 ..."
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={admitStudentForm.emergencyContact}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, emergencyContact: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Annual Income</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. 5,00,000"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.annualIncome}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, annualIncome: v }))}
                    />
                  </View>
                </View>

                <Text style={styles.formInputLabel}>Sibling Name (Same School)</Text>
                <TextInput
                  style={styles.formTextInput}
                  placeholder="Sibling's full name if enrolled"
                  placeholderTextColor="#94A3B8"
                  value={admitStudentForm.siblingName}
                  onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, siblingName: v }))}
                />
              </View>

              {/* Form Section 3: Academic Information */}
              <View style={styles.admitSectionCard}>
                <Text style={styles.admitSectionTitle}>Academic Information</Text>

                <Text style={styles.formInputLabel}>Assign to Class *</Text>
                <View style={styles.segmentedPillsRow}>
                  {['PRE KG - A', 'GRADE - 3 - A', 'Grade 1 - A', 'Class 10'].map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[
                        styles.segmentedPillBtn,
                        admitStudentForm.classId === c && styles.segmentedPillBtnActive,
                      ]}
                      onPress={() => setAdmitStudentForm(p => ({ ...p, classId: c }))}>
                      <Text style={[
                        styles.segmentedPillText,
                        admitStudentForm.classId === c && styles.segmentedPillTextActive,
                        { fontSize: 11 }
                      ]}>
                        {c}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Admission Number *</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. ADM-006"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.admissionNumber}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, admissionNumber: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Previous School Name</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="School name"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.previousSchool}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, previousSchool: v }))}
                    />
                  </View>
                </View>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Previous Records (Last Form)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Grade A"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.previousRecords}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, previousRecords: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Subjects Chosen (Higher Sec)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="e.g. Science, Maths"
                      placeholderTextColor="#94A3B8"
                      value={admitStudentForm.subjectsChosen}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, subjectsChosen: v }))}
                    />
                  </View>
                </View>
              </View>

              {/* Form Section 4: Transportation Details */}
              <View style={styles.admitSectionCard}>
                <Text style={styles.admitSectionTitle}>Transportation Details</Text>

                <Text style={styles.formInputLabel}>School Bus Route/Stop</Text>
                <TextInput
                  style={styles.formTextInput}
                  placeholder="e.g. Route A - Main Street"
                  placeholderTextColor="#94A3B8"
                  value={admitStudentForm.busRoute}
                  onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, busRoute: v }))}
                />
              </View>

              {/* Form Section 5: Fee Configuration */}
              <View style={styles.admitSectionCard}>
                <Text style={styles.admitSectionTitle}>Fee Configuration</Text>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Tuition Fee (₹)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="25000"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={admitStudentForm.tuitionFee}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, tuitionFee: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Hostel Fee (if Any)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={admitStudentForm.hostelFee}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, hostelFee: v }))}
                    />
                  </View>
                </View>

                <View style={styles.inputTwoColRow}>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Book Fee (₹)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="3500"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={admitStudentForm.bookFee}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, bookFee: v }))}
                    />
                  </View>
                  <View style={styles.inputCol}>
                    <Text style={styles.formInputLabel}>Other Fee (₹)</Text>
                    <TextInput
                      style={styles.formTextInput}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={admitStudentForm.otherFee}
                      onChangeText={(v) => setAdmitStudentForm(p => ({ ...p, otherFee: v }))}
                    />
                  </View>
                </View>

                {/* Live Total Calculated Fee */}
                <View style={styles.feeSummaryCard}>
                  <Text style={styles.feeSummaryLabel}>Total Calculated Fee</Text>
                  <Text style={styles.feeSummaryValue}>
                    ₹{(
                      (Number(admitStudentForm.tuitionFee) || 0) +
                      (Number(admitStudentForm.hostelFee) || 0) +
                      (Number(admitStudentForm.bookFee) || 0) +
                      (Number(admitStudentForm.otherFee) || 0)
                    ).toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Form Bottom Action Buttons */}
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <TouchableOpacity
                  style={styles.admitCancelBtn}
                  onPress={() => setShowStudentModal(false)}>
                  <Text style={styles.admitCancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.admitSubmitBtn}
                  onPress={handleAdmitStudentSubmit}>
                  <Text style={styles.admitSubmitBtnText}>Admit Student</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        {/* ===== MODAL: CREATE LEAVE REQUEST ===== */}
        <Modal visible={showCreateLeaveModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="calendar-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Submit Leave Request</Text>
              </View>

              <Text style={styles.fieldLabelText}>Applicant Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="Full Name"
                placeholderTextColor="#94A3B8"
                value={newLeaveForm.applicantName}
                onChangeText={v => setNewLeaveForm(p => ({ ...p, applicantName: v }))}
              />

              <Text style={styles.fieldLabelText}>Applicant Role</Text>
              <View style={styles.segmentedPillsRow}>
                {(['teacher', 'student'] as const).map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.segmentedPillBtn, newLeaveForm.applicantRole === r && styles.segmentedPillBtnActive]}
                    onPress={() => setNewLeaveForm(p => ({ ...p, applicantRole: r }))}>
                    <Text style={[styles.segmentedPillText, newLeaveForm.applicantRole === r && styles.segmentedPillTextActive]}>
                      {r.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabelText}>Leave Type</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="Casual Leave / Sick Leave / Medical Leave"
                placeholderTextColor="#94A3B8"
                value={newLeaveForm.leaveType}
                onChangeText={v => setNewLeaveForm(p => ({ ...p, leaveType: v }))}
              />

              <View style={styles.inputTwoColRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>Start Date</Text>
                  <TextInput
                    style={styles.modalInputBox}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="#94A3B8"
                    value={newLeaveForm.startDate}
                    onChangeText={v => setNewLeaveForm(p => ({ ...p, startDate: v }))}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>End Date</Text>
                  <TextInput
                    style={styles.modalInputBox}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="#94A3B8"
                    value={newLeaveForm.endDate}
                    onChangeText={v => setNewLeaveForm(p => ({ ...p, endDate: v }))}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabelText}>Reason *</Text>
              <TextInput
                style={[styles.modalInputBox, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="Explain the reason for leave..."
                placeholderTextColor="#94A3B8"
                multiline
                value={newLeaveForm.reason}
                onChangeText={v => setNewLeaveForm(p => ({ ...p, reason: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowCreateLeaveModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleCreateLeaveSubmit}>
                  <Text style={styles.modalSmallBtnText}>Submit Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD NEW LEAD (Pic 1 Matching) ===== */}
        <Modal visible={showAddLeadModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="heart-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Log Admission Enquiry / Lead</Text>
              </View>

              <Text style={styles.fieldLabelText}>Parent / Student Name *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Anand Mahindra"
                placeholderTextColor="#94A3B8"
                value={newLeadForm.name}
                onChangeText={v => setNewLeadForm(p => ({ ...p, name: v }))}
              />

              <View style={styles.inputTwoColRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>Phone Number</Text>
                  <TextInput
                    style={styles.modalInputBox}
                    placeholder="+91 98765 43210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={newLeadForm.phone}
                    onChangeText={v => setNewLeadForm(p => ({ ...p, phone: v }))}
                  />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>Email Address</Text>
                  <TextInput
                    style={styles.modalInputBox}
                    placeholder="parent@gmail.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    value={newLeadForm.email}
                    onChangeText={v => setNewLeadForm(p => ({ ...p, email: v }))}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabelText}>Lead Source Form</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. General Admissions 2026-27"
                placeholderTextColor="#94A3B8"
                value={newLeadForm.sourceForm}
                onChangeText={v => setNewLeadForm(p => ({ ...p, sourceForm: v }))}
              />

              <Text style={styles.fieldLabelText}>Enquiry Notes</Text>
              <TextInput
                style={[styles.modalInputBox, { minHeight: 60, textAlignVertical: 'top' }]}
                placeholder="Enquiry details, class requested, discussion notes..."
                placeholderTextColor="#94A3B8"
                multiline
                value={newLeadForm.notes}
                onChangeText={v => setNewLeadForm(p => ({ ...p, notes: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddLeadModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleCreateLeadSubmit}>
                  <Text style={styles.modalSmallBtnText}>Save Lead</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: UPGRADE PLAN (Pic 2 Matching) ===== */}
        <Modal visible={showUpgradePlanModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="flash-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Upgrade School Subscription</Text>
              </View>

              <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 14, lineHeight: 18 }}>
                Select your preferred enterprise tier. Upgrading grants unlimited students, advanced AI analytics, and multi-branch management.
              </Text>

              <View style={{ gap: 10 }}>
                <TouchableOpacity
                  style={[styles.planSelectCard, { borderColor: '#7C3AED', backgroundColor: '#F5F3FF' }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#7C3AED' }}>Enterprise Plan (Active)</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>₹2600 / mo</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Unlimited students, automated WhatsApp alerts, full custom modules.
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.planSelectCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Enterprise Annual</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#059669' }}>₹26,000 / yr (Save 17%)</Text>
                  </View>
                  <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>
                    Annual billing with 2 months free and priority telephone support.
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowUpgradePlanModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleUpgradePlanSubmit}>
                  <Text style={styles.modalSmallBtnText}>Confirm Upgrade</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: EDIT PAYMENT METHOD ===== */}
        <Modal visible={showEditPaymentModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="card-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Update Payment Method</Text>
              </View>

              <Text style={styles.fieldLabelText}>Cardholder Name</Text>
              <TextInput style={styles.modalInputBox} placeholder="Swetha Admin" placeholderTextColor="#94A3B8" />

              <Text style={styles.fieldLabelText}>Card Number</Text>
              <TextInput style={styles.modalInputBox} placeholder="•••• •••• •••• 4242" placeholderTextColor="#94A3B8" keyboardType="numeric" />

              <View style={styles.inputTwoColRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>Expiry Date</Text>
                  <TextInput style={styles.modalInputBox} placeholder="MM/YY" placeholderTextColor="#94A3B8" />
                </View>
                <View style={styles.inputCol}>
                  <Text style={styles.fieldLabelText}>CVV</Text>
                  <TextInput style={styles.modalInputBox} placeholder="•••" secureTextEntry placeholderTextColor="#94A3B8" keyboardType="numeric" />
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowEditPaymentModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={() => {
                    setShowEditPaymentModal(false);
                    showToast('Payment method updated successfully!');
                  }}>
                  <Text style={styles.modalSmallBtnText}>Save Card</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD CUSTOM MODULE SECTION (Pic 3 Matching) ===== */}
        <Modal visible={showAddSectionModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="folder-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add Section to Form Schema</Text>
              </View>

              <Text style={styles.fieldLabelText}>Section Title *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Guardian & Emergency Contacts"
                placeholderTextColor="#94A3B8"
                value={newSectionTitle}
                onChangeText={setNewSectionTitle}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddSectionModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleAddSectionSubmit}>
                  <Text style={styles.modalSmallBtnText}>Add Section</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD CUSTOM FIELD TO SECTION ===== */}
        <Modal visible={showAddFieldModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="add-circle-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Add Field</Text>
              </View>

              <Text style={styles.fieldLabelText}>Field Label *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Emergency Alternate Phone"
                placeholderTextColor="#94A3B8"
                value={newFieldData.label}
                onChangeText={v => setNewFieldData(p => ({ ...p, label: v }))}
              />

              <Text style={styles.fieldLabelText}>Field Input Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                {(['text', 'number', 'email', 'date', 'select'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.fieldTypePickerBtn,
                      newFieldData.type === t && styles.fieldTypePickerBtnActive
                    ]}
                    onPress={() => setNewFieldData(p => ({ ...p, type: t }))}>
                    <Text style={[
                      styles.fieldTypePickerBtnText,
                      newFieldData.type === t && styles.fieldTypePickerBtnTextActive
                    ]}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Required toggle */}
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}
                onPress={() => setNewFieldData(p => ({ ...p, required: !p.required }))}>
                <IconComp
                  name={newFieldData.required ? 'checkbox-outline' : 'square-outline'}
                  size={20}
                  color={newFieldData.required ? '#7C3AED' : '#94A3B8'}
                />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1E293B' }}>Mandatory / Required Field</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddFieldModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleAddFieldSubmit}>
                  <Text style={styles.modalSmallBtnText}>Add Field</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ===== MODAL: ADD CUSTOM ROLE (Pic 4 Matching) ===== */}
        <Modal visible={showAddRoleModal} transparent animationType="slide">
          <View style={styles.modalOverlayDark}>
            <View style={styles.modalCardContainer}>
              <View style={styles.modalHeaderTitleRow}>
                <IconComp name="shield-outline" size={20} color="#7C3AED" />
                <Text style={styles.modalCardTitle}>Create Custom Role</Text>
              </View>

              <Text style={styles.fieldLabelText}>Role Title *</Text>
              <TextInput
                style={styles.modalInputBox}
                placeholder="e.g. Lab Technician"
                placeholderTextColor="#94A3B8"
                value={newRoleNameInput}
                onChangeText={setNewRoleNameInput}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#64748B' }]}
                  onPress={() => setShowAddRoleModal(false)}>
                  <Text style={styles.modalSmallBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalSmallBtn, { flex: 1, backgroundColor: '#7C3AED' }]}
                  onPress={handleAddRoleSubmit}>
                  <Text style={styles.modalSmallBtnText}>Create Role</Text>
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
// STYLES SYSTEM
// =========================================================================
const styles = StyleSheet.create({
  // --- Student Directory Interactive Filters & Search ---
  searchInputWrapperFullWidth: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 10,
  },
  filterPillsRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  interactiveFilterPillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
  },
  interactiveFilterPillActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  interactiveFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  interactiveFilterPillTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  resetFilterBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  resetFilterBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  filterOptionItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  filterOptionItemActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  filterOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
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
    marginVertical: 12,
  },
  rememberCheckBoxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkBoxSquare: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkBoxSquareChecked: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  checkBoxCheckMark: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  rememberLabelText: {
    fontSize: 13,
    color: '#475569',
  },
  forgotPasswordLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  primaryLoginBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
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
    fontSize: 14,
    color: '#64748B',
  },
  signUpFooterLink: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },
  quickDemoCardSection: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickDemoHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginBottom: 12,
  },
  quickPillsRowBox: {
    flexDirection: 'row',
    gap: 8,
  },
  quickRolePillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickRolePillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  quickRolePillBtnActiveAdmin: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
    borderWidth: 1.5,
  },
  quickRolePillTextActiveAdmin: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  quickRolePillBtnActiveTeacher: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
    borderWidth: 1.5,
  },
  quickRolePillTextActiveTeacher: {
    color: '#2563EB',
    fontWeight: '800',
  },
  quickRolePillBtnActiveStudent: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
    borderWidth: 1.5,
  },
  quickRolePillTextActiveStudent: {
    color: '#059669',
    fontWeight: '800',
  },
  mergePendingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
    elevation: 2,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  mergePendingIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  mergePendingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  mergePendingDesc: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  mergeStatusDetailsBox: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    gap: 10,
  },
  mergeStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mergeStatusLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  mergeStatusVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // --- Main Layout ---
  mainAppContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeaderBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  schoolBrandDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  headerBrandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.2,
  },
  schoolSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  officialBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  officialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  dotSeparator: {
    fontSize: 11,
    color: '#94A3B8',
    marginHorizontal: 6,
  },
  headerBrandSub: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
  },
  headerRightProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPillText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  logoutCircleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabScrollContentWithFloatingNav: {
    padding: 16,
    paddingBottom: 96,
  },

  // --- Header Cards & Metrics ---
  greetingBannerCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  headerCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  headerCardTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 160,
  },
  headerCardIcon: {
    marginRight: 8,
  },
  moduleHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  dashboardSectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  moduleHeroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 9,
    lineHeight: 18,
  },
  greetingSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 9,
    lineHeight: 18,
  },
  headerCardBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  headerCardBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  headerCardPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignSelf: 'flex-start',
  },
  headerCardPrimaryBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4C1D95',
  },
  headerCardSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  headerCardSecondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerCardSecondaryBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inviteLinkPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  inviteLinkBtnText: {
    color: '#4C1D95',
    fontSize: 13,
    fontWeight: '700',
  },
  subHeaderFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pillCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillCardText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  metricsGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricIconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  metricIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricLabelTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  metricNumberValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    marginVertical: 2,
  },
  metricTrendText: {
    fontSize: 11,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllLinkText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  emptyNoticeStateBox: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyNoticeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
  },
  emptyNoticeSub: {
    fontSize: 12,
    color: '#64748B',
    marginVertical: 4,
  },
  createNoticeOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#7C3AED',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 10,
  },
  createNoticeBtnText: {
    color: '#7C3AED',
    fontSize: 13,
    fontWeight: '700',
  },

  // --- System Status Dark Card ---
  navyStatusCardBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
  },
  navyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statusOnlineIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 14,
  },
  greenPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  statusOnlineText: {
    fontSize: 12,
    color: '#94A3B8',
  },
  navySubBoxContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  navySubBoxHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  navySubBoxTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  noInvoicesBadgePill: {
    backgroundColor: 'rgba(245,158,11,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  noInvoicesBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  pendingBadgePill: {
    backgroundColor: 'rgba(167,139,250,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#A78BFA',
  },
  navySubBoxBadgeText: {
    fontSize: 11,
    color: '#38BDF8',
  },
  percentCollectedText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
  },
  configureEnvBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  configureEnvBtnText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },

  // --- Quick Actions ---
  quickActionsGridBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionGridCardItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionCardIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },

  // --- Attendance ---
  attendanceSummaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 14,
  },
  attendanceBigPercent: {
    fontSize: 32,
    fontWeight: '900',
    color: '#059669',
  },
  attendanceAverageSubText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
  attendanceBarItem: {
    marginBottom: 12,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  barCategoryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  barPercentValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },

  // --- Student & Module Screens ---
  screenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  screenTitleText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  screenSubTitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  seatBadgePill: {
    backgroundColor: '#FCE7F3',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  seatBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#BE185D',
  },
  headerPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  headerPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // --- Action Buttons Bar ---
  actionButtonsTopRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  outlineActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  greenOutlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  greenOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#059669',
  },
  purplePrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  purplePrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // --- Search & Filters ---
  searchFilterBoxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillsScrollContainer: {
    gap: 8,
    marginBottom: 14,
  },
  gradePillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
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
    fontWeight: '600',
    color: '#64748B',
  },
  gradePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // --- Student Directory Cards ---
  studentCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  avatarCircleInitial: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitialText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
  },
  studentNameTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentSubText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  classBadgePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  changeClassBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  changeClassBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Attendance Sub-Header Pills ---
  subHeaderPillsContainer: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 4,
    marginBottom: 14,
  },
  subHeaderPillBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  subHeaderPillBtnActive: {
    backgroundColor: '#FFFFFF',
  },
  subHeaderPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  subHeaderPillTextActive: {
    fontWeight: '800',
    color: '#7C3AED',
  },
  historicalArchivesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  archivesTitleText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  archivesSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  datePickerInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  datePickerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Module Cards Grid ---
  modulesGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  moduleGridCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moduleCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  moduleIconBoxCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleGridTitleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },

  // --- Staff & Class Specific Cards ---
  smallStatBoxItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  smallStatLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
  },
  smallStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  editOutlineBtn: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
  },
  editOutlineBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  classCardBoxItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  classCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  classCardSubText: {
    fontSize: 12,
    color: '#64748B',
  },

  // --- Pagination ---
  paginationWrapper: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingVertical: 8,
  },
  paginationInfoText: {
    fontSize: 12,
    color: '#64748B',
  },
  paginationBoldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  paginationControlsRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  arrowIconButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIconButtonDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  pageSquarePill: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageSquarePillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  pageSquareText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  pageSquareTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  paginationEllipsisText: {
    fontSize: 12,
    color: '#94A3B8',
    marginHorizontal: 2,
  },
  pageSizePillBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 6,
    marginLeft: 4,
  },
  pageSizePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },

  // --- Floating Nav ---
  floatingNavWrapper: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
  },
  floatingNavPillContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 6,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  floatingTabItemBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: 20,
  },
  floatingTabItemBtnActive: {
    backgroundColor: '#F3E8FF',
  },
  floatingTabLabelText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  floatingTabLabelTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },

  // --- Module Modal ---
  moduleModalTopNav: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  moduleBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  moduleNavTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
  },
  moduleNavSubText: {
    fontSize: 11,
    color: '#64748B',
  },
  moduleHeaderPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  moduleHeaderBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  moduleHeroHeaderCard: {
    backgroundColor: '#7C3AED',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },
  moduleHeroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flexShrink: 1,
  },
  moduleHeroSub: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 9,
    lineHeight: 18,
  },
  emptyModuleCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginVertical: 12,
  },
  emptyIconCircleLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyModuleTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptyModuleSub: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  emptyActionPurpleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  emptyActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  moduleTabRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  moduleTabBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  moduleTabBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  moduleTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  moduleTabTextActive: {
    color: '#FFFFFF',
  },
  noticeCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  priorityPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  noticeDateText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  noticeItemTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  noticeItemAudience: {
    fontSize: 12,
    color: '#7C3AED',
    fontWeight: '600',
    marginBottom: 4,
  },
  noticeItemMsg: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 18,
  },

  // --- Modals ---
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCardContainer: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCardDesc: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  fieldLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  modalInputBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    fontSize: 13,
    color: '#0F172A',
  },
  modalSmallBtn: {
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalSmallBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // --- Toast ---
  toastBannerBox: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  studentListCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  studentAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  studentNameText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  studentDetailsSubText: {
    fontSize: 12,
    color: '#64748B',
  },
  statusBadgeGreenPill: {
    marginTop: 2,
  },
  statusBadgeGreenText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  smallFeeActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  feePaidStyle: {
    backgroundColor: '#DCFCE7',
  },
  feeUnpaidStyle: {
    backgroundColor: '#FEE2E2',
  },
  smallFeeActionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },

  // --- Attendance Table ---
  attendanceFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
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
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  dropdownTextValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
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
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    width: 80,
    alignItems: 'center',
  },
  attPresentStyle: {
    backgroundColor: '#DCFCE7',
  },
  attAbsentStyle: {
    backgroundColor: '#FEE2E2',
  },
  attOdStyle: {
    backgroundColor: '#FEF3C7',
  },
  attendanceBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#059669',
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
    fontSize: 13,
    fontWeight: '700',
  },
  activityItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  // --- New Module Shared Styles ---
  statBoxCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipItem: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipItemActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  searchBarWrapperFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  searchInputField: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  smallWhiteOutlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  smallWhiteOutlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },

  // --- Admit New Student Modal Styles (Pic 1) ---
  admitSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  admitSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  photoUploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: 14,
  },
  photoUploadText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
    marginTop: 6,
  },
  photoUploadSub: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  inputTwoColRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  inputCol: {
    flex: 1,
  },
  formInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  formTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  formTextArea: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 64,
    textAlignVertical: 'top',
  },
  segmentedPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
    marginBottom: 10,
  },
  segmentedPillBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  segmentedPillBtnActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#F3E8FF',
  },
  segmentedPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  segmentedPillTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  feeSummaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  feeSummaryLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  feeSummaryValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#7C3AED',
  },
  admitCancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  admitCancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  admitSubmitBtn: {
    flex: 2,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  admitSubmitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // --- Leave Management Styles (Pic 2) ---
  leaveCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  leaveCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  leaveUserAvatarBox: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveApplicantName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  leaveSubmittedDate: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  leaveRoleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leaveRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  leaveDateRangePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  leaveDateRangeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  leaveTypeTag: {
    fontSize: 11,
    fontWeight: '800',
    color: '#7C3AED',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  leaveReasonQuote: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#334155',
    lineHeight: 18,
    marginBottom: 12,
  },
  leaveActionBtnsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  leaveRejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  leaveRejectBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
  },
  leaveApproveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#059669',
  },
  leaveApproveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leaveStatusFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  leaveStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  leaveStatusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  leaveProcessedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // --- Reports & Analytics Styles (Pic 3) ---
  reportsKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  reportsKpiCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  reportsKpiIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  reportsKpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  reportsKpiValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  chartSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 14,
  },
  chartSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  chartSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 14,
  },
  barChartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 10,
  },
  barChartCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barTrack: {
    width: 22,
    height: 90,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillMint: {
    width: '100%',
    backgroundColor: '#A7F3D0',
    borderRadius: 6,
  },
  barFillPurple: {
    width: '100%',
    backgroundColor: '#C4B5FD',
    borderRadius: 6,
  },
  barChartLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 6,
  },

  // --- API Integrations Styles (Pic 4) ---
  apiIntegrationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginTop: 12,
  },
  apiCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  apiServiceIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  apiServiceTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  apiStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  apiStatusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  apiServiceDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  formFieldLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  apiTokenInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  apiTokenTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 9,
  },
  apiStandardInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
  },
  apiHelperNoticeText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    lineHeight: 15,
  },
  apiTestConnectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  apiTestBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // --- Registration Links Styles (Pic 5) ---
  regLinkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  regLinkIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regLinkTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  regLinkDesc: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 17,
  },
  regLinkUrlBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginVertical: 12,
  },
  regLinkUrlText: {
    flex: 1,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#334155',
  },
  regLinkBtnsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  regLinkCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 10,
    borderRadius: 10,
  },
  regLinkCopyBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  regLinkShareBtn: {
    width: 42,
    height: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  staffConfigCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  staffConfigTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  staffConfigSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  toggleRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  toggleItemLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  toggleItemDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  switchTrackActive: {
    backgroundColor: '#7C3AED',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  switchThumbActive: {
    alignSelf: 'flex-end',
  },
  saveConfigBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  saveConfigBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  securityNoticeCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  securityNoticeTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  securityNoticeBody: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },

  // =========================================================================
  // LEADS MANAGEMENT STYLES (Pic 1 Matching)
  // =========================================================================
  leadsTabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  leadsTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 9,
  },
  leadsTabBtnActive: {
    backgroundColor: '#7C3AED',
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  leadsTabBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  leadsTabBtnTextActive: {
    color: '#FFFFFF',
  },
  leadsFilterCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  leadsSearchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  leadsSearchInput: {
    flex: 1,
    fontSize: 12,
    color: '#0F172A',
    paddingVertical: 0,
  },
  leadsFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  leadsFilterChipActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  leadsFilterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  leadsFilterChipTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  leadsDateExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  leadsDateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  leadsDateLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
  },
  leadsDateValue: {
    flex: 1,
    fontSize: 10,
    color: '#94A3B8',
  },
  leadsExportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  leadsExportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  leadsEmptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 36,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  leadsEmptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  leadsEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  leadsEmptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  leadsEmptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  leadsEmptyActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leadRecordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 2,
  },
  leadRecordHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadRecordName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  leadRecordSource: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  leadStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  leadStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  leadRecordDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  leadRecordDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  leadRecordDetailText: {
    fontSize: 11,
    color: '#475569',
  },
  leadRecordNotesBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#7C3AED',
  },
  leadRecordNotesText: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
  },
  leadRecordActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  leadActionStatusChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 4,
  },
  leadActionStatusChipActive: {
    backgroundColor: '#7C3AED',
  },
  leadActionStatusChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  leadActionStatusChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  leadDeleteBtn: {
    padding: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  leadsFormsNoticeCard: {
    backgroundColor: '#F5F3FF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  leadsFormsNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#7C3AED',
  },
  leadsFormsNoticeSub: {
    fontSize: 11,
    color: '#6B21A8',
    lineHeight: 16,
  },
  leadFormCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  leadFormCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leadFormTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  leadFormSubsCount: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  leadFormActiveBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  leadFormActiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  leadFormEmbedBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  leadFormEmbedCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#475569',
  },
  leadFormActionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  leadFormCopyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingVertical: 8,
    borderRadius: 8,
  },
  leadFormCopyBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  leadFormShareBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // =========================================================================
  // BILLING & SUBSCRIPTIONS STYLES (Pic 2 Matching)
  // =========================================================================
  billingPlanCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  billingPlanTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  billingPlanBadge: {
    fontSize: 11,
    fontWeight: '900',
    color: '#D97706',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  billingPlanTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
  },
  billingPlanCycleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  billingPlanPriceText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  billingPlanPricePer: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  billingPlanUpgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  billingPlanUpgradeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  billingCardDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  billingUsageHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
  },
  billingTrialNoticeBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  billingTrialNoticeText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 16,
  },
  billingMetricHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  billingMetricLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  billingMetricValues: {
    fontSize: 11,
    color: '#64748B',
  },
  billingProgressTrack: {
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: 4,
    overflow: 'hidden',
  },
  billingProgressFill: {
    height: '100%',
    borderRadius: 4,
  },
  billingPaymentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  billingPaymentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  billingSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  billingEditBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  billingEditBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
  },
  billingCardChipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  billingCardVisaBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  billingCardVisaText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  billingCardNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  billingCardExpiry: {
    fontSize: 11,
    color: '#64748B',
  },
  billingAutoChargeNote: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 16,
  },
  billingHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  billingHistoryHeaderRow: {
    marginBottom: 12,
  },
  billingHistoryTableHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  billingHistoryCol: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  billingHistoryEmptyBox: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  billingHistoryEmptyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  billingHelpCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
    gap: 8,
  },
  billingHelpIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FEF3C7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  billingHelpTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#92400E',
  },
  billingHelpSub: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16,
  },
  billingContactSupportBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  billingContactSupportBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  planSelectCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  // =========================================================================
  // MODULE CUSTOMIZATION STYLES (Pic 3 Matching)
  // =========================================================================
  customModTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 14,
    gap: 6,
  },
  customModTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 9,
  },
  customModTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  customModTabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  customModTabBtnTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  customModControlsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  customModFieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 6,
  },
  customModPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  customModPillActive: {
    backgroundColor: '#F3E8FF',
    borderColor: '#7C3AED',
  },
  customModPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  customModPillTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  customModImportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  customModImportSelectBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  customModImportSelectText: {
    fontSize: 11,
    color: '#64748B',
  },
  customModImportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#475569',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  customModImportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customModSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  customModSaveBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customModStructureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  customModStructureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  customModStructureTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  customModAddSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  customModAddSectionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  customModEmptyContainer: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 14,
    padding: 28,
    alignItems: 'center',
    marginTop: 14,
  },
  customModEmptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  customModEmptyTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 4,
  },
  customModEmptySub: {
    fontSize: 11,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 14,
  },
  customModFirstSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F172A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  customModFirstSectionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customModSectionItemCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
  },
  customModSectionItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  customModSectionItemTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
  },
  customModFieldCountBadge: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customModFieldCountText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
  },
  customModFieldRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customModFieldRowLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  customModFieldTypeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  customModFieldTypeBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  customModAddFieldBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  customModAddFieldBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  customModManagerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customModSectionSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  customModManagerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  customModManagerIndex: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    width: 24,
  },
  customModManagerName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  fieldTypePickerBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  fieldTypePickerBtnActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  fieldTypePickerBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  fieldTypePickerBtnTextActive: {
    color: '#FFFFFF',
  },

  // =========================================================================
  // ROLES & PERMISSIONS STYLES (Pic 4 Matching)
  // =========================================================================
  rolesSelectorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  rolesSelectorHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rolesSelectorHeaderTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  rolesAddRoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  rolesAddRoleBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7C3AED',
  },
  roleSelectPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginRight: 6,
  },
  roleSelectPillActive: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  roleSelectPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  roleSelectPillTextActive: {
    color: '#FFFFFF',
  },
  permissionsMatrixCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  permissionsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  permissionsCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  permissionsCardSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  permissionsTargetPanelBox: {
    alignItems: 'flex-end',
  },
  permissionsTargetPanelLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginBottom: 2,
  },
  permissionsPanelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permissionsPanelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  permsTableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  permsTableColHead: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  permsTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  permsRowModuleName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
  },
  permsCheckboxCell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  permsCheckboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  permsCheckboxBoxChecked: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },
  permsQuickSelectBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  permsQuickSelectBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
});

export default App;
