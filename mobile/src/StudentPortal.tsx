import React, { useState, useEffect, useMemo, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput as RNTextInput,
  TextInputProps,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Image,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Firebase Native Integrations
let db: any = null;
let auth: any = null;
try {
  const firebaseNativeFirestore = require('@react-native-firebase/firestore');
  const firebaseNativeAuth = require('@react-native-firebase/auth');
  db = firebaseNativeFirestore.default();
  auth = firebaseNativeAuth.default();
} catch (e) {
  console.warn('Firebase native modules not loaded in StudentPortal:', e);
}

// Icon Helper Component
const IconComp = ({ name, size = 20, color = '#64748B', style }: { name: string; size?: number; color?: string; style?: any }) => {
  try {
    return <Ionicons name={name || 'square-outline'} size={size} color={color || '#64748B'} style={style} />;
  } catch (e) {
    return <Text style={[{ fontSize: size * 0.7, color: color || '#64748B' }, style]}>●</Text>;
  }
};

// Custom Focus-Aware TextInput enforcing #B07FA8 focused border
const FocusTextInput = forwardRef<any, TextInputProps>((props, ref) => {
  const [isFocused, setIsFocused] = useState(false);
  const { style, onFocus, onBlur, ...rest } = props;
  return (
    <RNTextInput
      ref={ref}
      style={[
        style,
        isFocused && { borderColor: '#B07FA8', borderWidth: 1.5 },
      ]}
      onFocus={(e: any) => {
        setIsFocused(true);
        if (onFocus) onFocus(e);
      }}
      onBlur={(e: any) => {
        setIsFocused(false);
        if (onBlur) onBlur(e);
      }}
      {...rest}
    />
  );
});

// Search Input Component
const SearchInputBox = ({
  wrapperStyle,
  style,
  placeholder,
  value,
  onChangeText,
  onClear,
}: any) => {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <View style={[wrapperStyle, isFocused && { borderColor: '#B07FA8', borderWidth: 1.5 }]}>
      <IconComp name="search-outline" size={16} color={isFocused ? '#B07FA8' : '#94A3B8'} />
      <RNTextInput
        style={[{ flex: 1, fontSize: 13, color: '#0F172A', paddingVertical: 4, paddingHorizontal: 6 }, style]}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
      />
      {!!value && (
        <TouchableOpacity onPress={onClear ? onClear : () => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <IconComp name="close-circle-outline" size={16} color="#94A3B8" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// Reusable School Logo
const SchoolLogo = ({ size = 28 }: { size?: number }) => {
  try {
    return (
      <Image
        source={require('../assets/logo.png')}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    );
  } catch (e) {
    return <IconComp name="school-outline" size={size} color="#B07FA8" />;
  }
};

// Standardized Module Header Card Component
const ModuleHeaderCard = ({
  icon,
  title,
  subtitle,
  badgeText,
  rightAction,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badgeText?: string;
  rightAction?: { label: string; icon?: string; onPress: () => void };
}) => (
  <View style={styles.moduleHeroHeaderCard}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.22)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
        <IconComp name={icon} size={22} color="#FFFFFF" />
      </View>
      {badgeText && (
        <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
          <Text style={{ fontSize: 11, fontWeight: '800', color: '#FFFFFF' }}>{badgeText}</Text>
        </View>
      )}
      {rightAction && (
        <TouchableOpacity
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}
          onPress={rightAction.onPress}
          activeOpacity={0.8}>
          {rightAction.icon && <IconComp name={rightAction.icon} size={14} color="#B07FA8" />}
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>{rightAction.label}</Text>
        </TouchableOpacity>
      )}
    </View>
    <Text style={{ fontSize: 18, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3 }}>{title}</Text>
    <Text style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.9)', marginTop: 4, lineHeight: 17 }}>{subtitle}</Text>
  </View>
);

// =========================================================================
// REUSABLE CALENDAR DATE PICKER MODAL (Requirement: No manual date typing)
// =========================================================================
interface CalendarDatePickerModalProps {
  visible: boolean;
  title?: string;
  currentDateStr?: string; // YYYY-MM-DD
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
}

const CalendarDatePickerModal: React.FC<CalendarDatePickerModalProps> = ({
  visible,
  title = 'Select Date',
  currentDateStr,
  onSelectDate,
  onClose,
}) => {
  const [viewYear, setViewYear] = useState<number>(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(new Date().getMonth());
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());

  useEffect(() => {
    if (currentDateStr) {
      const parts = currentDateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          setViewYear(y);
          setViewMonth(m);
          setSelectedDay(d);
          return;
        }
      }
    }
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
  }, [visible, currentDateStr]);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    setSelectedDay(day);
    const mStr = String(viewMonth + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    const finalDateStr = `${viewYear}-${mStr}-${dStr}`;
    onSelectDate(finalDateStr);
    onClose();
  };

  const handleSelectToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    setViewYear(y);
    setViewMonth(m);
    setSelectedDay(d);
    const mStr = String(m + 1).padStart(2, '0');
    const dStr = String(d).padStart(2, '0');
    onSelectDate(`${y}-${mStr}-${dStr}`);
    onClose();
  };

  if (!visible) return null;

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  const cells = [];
  for (let i = 0; i < firstDayIndex; i++) {
    cells.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 40 }} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const isSelected = selectedDay === day;
    cells.push(
      <TouchableOpacity
        key={`day-${day}`}
        onPress={() => handleSelectDay(day)}
        style={{
          width: '14.28%',
          height: 40,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: isSelected ? '#B07FA8' : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: isSelected ? '800' : '600',
              color: isSelected ? '#FFFFFF' : '#0F172A',
            }}>
            {day}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlayDark}>
        <View style={[styles.modalCardContainer, { maxWidth: 360 }]}>
          {/* Header */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconComp name="calendar" size={20} color="#B07FA8" />
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{title}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <IconComp name="close-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Month / Year Navigator */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 12 }}>
            <TouchableOpacity onPress={handlePrevMonth} style={{ padding: 6 }}>
              <IconComp name="chevron-back" size={18} color="#0F172A" />
            </TouchableOpacity>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
              {monthNames[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={handleNextMonth} style={{ padding: 6 }}>
              <IconComp name="chevron-forward" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Weekday Row */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 }}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
              <Text
                key={i}
                style={{
                  width: '14.28%',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: '700',
                  color: i === 0 ? '#EF4444' : '#64748B',
                }}>
                {d}
              </Text>
            ))}
          </View>

          {/* Days Grid */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{cells}</View>

          {/* Footer Actions */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
            <TouchableOpacity onPress={handleSelectToday} style={{ paddingVertical: 6, paddingHorizontal: 14, backgroundColor: '#faedf7', borderRadius: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={{ paddingVertical: 6, paddingHorizontal: 14 }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#64748B' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =========================================================================
// TYPES FOR STUDENT PORTAL
// =========================================================================
type BottomTab = 'Dashboard' | 'Attendance' | 'Homework' | 'Messages' | 'All';

type AllModuleType =
  | 'My Children'
  | 'Performance'
  | 'PTM Meetings'
  | 'Noticeboard'
  | 'Calendar'
  | 'Canteen'
  | 'Report Card'
  | 'Fees & Payments'
  | 'Leave Requests';

interface StudentPortalProps {
  userEmail?: string;
  onLogout: () => void;
}

// =========================================================================
// MAIN STUDENT / PARENT PORTAL COMPONENT
// =========================================================================
export const StudentPortal: React.FC<StudentPortalProps> = ({ userEmail = '', onLogout }) => {
  const schoolId = 'school1';

  // Navigation State
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('Dashboard');
  const [activeAllModule, setActiveAllModule] = useState<AllModuleType | null>(null);

  // Student & Child Profile State
  const [children, setChildren] = useState<any[]>([]);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(0);
  const [classDetails, setClassDetails] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('');
  const [showAttDatePicker, setShowAttDatePicker] = useState<boolean>(false);

  // Homework State
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [homeworkSearch, setHomeworkSearch] = useState<string>('');

  // Messages / Chat State
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [chatMessageText, setChatMessageText] = useState<string>('');
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);

  // Leaves State
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState<boolean>(false);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Sick Leave',
    startDate: '',
    endDate: '',
    reason: '',
  });
  const [datePickerTarget, setDatePickerTarget] = useState<'leaveStart' | 'leaveEnd' | 'ptm' | 'canteen' | null>(null);
  const [isSubmittingLeave, setIsSubmittingLeave] = useState<boolean>(false);

  // PTM Meetings State
  const [ptmList, setPtmList] = useState<any[]>([]);
  const [showBookPtmModal, setShowBookPtmModal] = useState<boolean>(false);
  const [ptmForm, setPtmForm] = useState({
    teacherName: 'Class Teacher',
    date: '',
    time: '10:00 AM',
    notes: '',
  });
  const [isSubmittingPtm, setIsSubmittingPtm] = useState<boolean>(false);

  // Noticeboard State
  const [noticesList, setNoticesList] = useState<any[]>([]);
  const [noticeSearch, setNoticeSearch] = useState<string>('');

  // Invoices & Fees State
  const [invoicesList, setInvoicesList] = useState<any[]>([]);
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<any | null>(null);
  const [isPayingInvoice, setIsPayingInvoice] = useState<boolean>(false);

  // Canteen State
  const [canteenRequests, setCanteenRequests] = useState<any[]>([]);
  const [canteenDate, setCanteenDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isRequestingMeal, setIsRequestingMeal] = useState<boolean>(false);

  // Assessments / Performance State
  const [assessmentsList, setAssessmentsList] = useState<any[]>([]);

  // Interactive Calendar Module State
  const [calendarMonthOffset, setCalendarMonthOffset] = useState<number>(0);
  const [calendarSelectedDateStr, setCalendarSelectedDateStr] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Active student reference
  const activeStudent = useMemo(() => {
    if (!children || children.length === 0) return null;
    return children[selectedChildIndex] || children[0];
  }, [children, selectedChildIndex]);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // =========================================================================
  // 1. REAL-TIME FIRESTORE DATA HOOKS
  // =========================================================================

  // Hook 1: Fetch Students for this authenticated account
  useEffect(() => {
    if (!db) {
      setLoadingInitial(false);
      return;
    }

    const emailClean = (userEmail || '').trim().toLowerCase();
    const studentsCol = db.collection('schools').doc(schoolId).collection('students');

    const unsub = studentsCol.onSnapshot(
      (snapshot: any) => {
        if (!snapshot || snapshot.empty) {
          setLoadingInitial(false);
          return;
        }

        const allDocs: any[] = [];
        snapshot.forEach((docSnap: any) => {
          allDocs.push({ id: docSnap.id, ...docSnap.data() });
        });

        // Filter students belonging to this parent/student
        let matched = allDocs.filter((st: any) => {
          const adm = (st.admissionNumber || '').toLowerCase();
          const pEmail = (st.parentEmail || '').toLowerCase();
          const sEmail = (st.email || '').toLowerCase();
          return adm === emailClean || pEmail === emailClean || sEmail === emailClean;
        });

        // If no direct email match (e.g. demo student login), fallback to real students in Firestore
        if (matched.length === 0 && allDocs.length > 0) {
          matched = allDocs;
        }

        setChildren(matched);
        setLoadingInitial(false);
      },
      (err: any) => {
        console.warn('Error fetching students:', err);
        setLoadingInitial(false);
      }
    );

    return () => unsub();
  }, [userEmail]);

  // Hook 2: Fetch Class Details for Active Student
  useEffect(() => {
    if (!db || !activeStudent?.classId) return;

    const classRef = db.collection('schools').doc(schoolId).collection('classes').doc(activeStudent.classId);
    const unsub = classRef.onSnapshot((snap: any) => {
      if (snap?.exists) {
        setClassDetails({ id: snap.id, ...snap.data() });
      }
    });

    return () => unsub();
  }, [activeStudent?.classId]);

  // Hook 3: Fetch Attendance for Student
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const attCol = db.collection('schools').doc(schoolId).collection('attendance');
    const unsub = attCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const attList: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        const studentStatus = data.records?.[activeStudent.id];
        if (studentStatus) {
          attList.push({
            id: d.id,
            date: data.date || d.id,
            status: studentStatus,
            className: data.className || activeStudent.gradeClass || '',
          });
        }
      });
      attList.sort((a, b) => (b.date > a.date ? 1 : -1));
      setAttendanceRecords(attList);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 4: Fetch Homework for Student's Class
  useEffect(() => {
    if (!db || !activeStudent) return;

    const hwCol = db.collection('schools').doc(schoolId).collection('homeworks');
    const unsub = hwCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        // Check if homework matches classId or className
        const matchClass =
          !data.classId ||
          data.classId === activeStudent.classId ||
          (data.className && activeStudent.gradeClass && data.className.includes(activeStudent.gradeClass));
        if (matchClass) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.assignedDate || b.dueDate > a.assignedDate || a.dueDate ? 1 : -1));
      setHomeworkList(list);
    });

    return () => unsub();
  }, [activeStudent]);

  // Hook 5: Fetch Leaves for Student
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const leavesCol = db.collection('schools').doc(schoolId).collection('leaves');
    const unsub = leavesCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.applicantId === activeStudent.id) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.submittedAt > a.submittedAt ? 1 : -1));
      setLeavesList(list);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 6: Fetch Notices
  useEffect(() => {
    if (!db) return;

    const noticesCol = db.collection('schools').doc(schoolId).collection('notices');
    const unsub = noticesCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => (b.createdAt || b.date > a.createdAt || a.date ? 1 : -1));
      setNoticesList(list);
    });

    return () => unsub();
  }, []);

  // Hook 7: Fetch PTM Meetings
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const ptmCol = db.collection('schools').doc(schoolId).collection('ptms');
    const unsub = ptmCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.studentId === activeStudent.id) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.date > a.date ? 1 : -1));
      setPtmList(list);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 8: Fetch Invoices & Fees
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const invCol = db.collection('schools').doc(schoolId).collection('invoices');
    const unsub = invCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.studentId === activeStudent.id) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.dueDate > a.dueDate ? 1 : -1));
      setInvoicesList(list);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 9: Fetch Canteen Requests
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const crCol = db.collection('schools').doc(schoolId).collection('canteen_requests');
    const unsub = crCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.studentId === activeStudent.id) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.timestamp > a.timestamp ? 1 : -1));
      setCanteenRequests(list);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 10: Fetch Assessments / Grades
  useEffect(() => {
    if (!db || !activeStudent?.classId) return;

    const asmCol = db.collection('schools').doc(schoolId).collection('assessments');
    const unsub = asmCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.classId === activeStudent.classId) {
          list.push({ id: d.id, ...data });
        }
      });
      list.sort((a, b) => (b.date > a.date ? 1 : -1));
      setAssessmentsList(list);
    });

    return () => unsub();
  }, [activeStudent?.classId]);

  // Hook 11: Real-time Messages / Chats
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const chatsCol = db.collection('schools').doc(schoolId).collection('chats');
    const unsub = chatsCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.studentId === activeStudent.id || d.id.includes(activeStudent.id)) {
          list.push({ id: d.id, ...data });
        }
      });
      setChats(list);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // =========================================================================
  // CALCULATED METRICS
  // =========================================================================
  const attendanceStats = useMemo(() => {
    let present = 0;
    let absent = 0;
    let late = 0;
    attendanceRecords.forEach(rec => {
      if (rec.status === 'Present') present++;
      else if (rec.status === 'Absent') absent++;
      else if (rec.status === 'Late') late++;
    });
    const total = present + absent + late;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100;
    return { total, present, absent, late, percentage };
  }, [attendanceRecords]);

  const feeStats = useMemo(() => {
    let totalInvoiced = 0;
    let paid = 0;
    let pending = 0;
    invoicesList.forEach(inv => {
      const amt = Number(inv.amount) || 0;
      totalInvoiced += amt;
      if (inv.status === 'Paid') paid += amt;
      else pending += amt;
    });
    return { totalInvoiced, paid, pending };
  }, [invoicesList]);

  // =========================================================================
  // USER ACTIONS WITH REAL FIRESTORE PERSISTENCE
  // =========================================================================

  // Action: Apply For Leave
  const handleApplyLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      Alert.alert('Required Fields', 'Please select a Start Date, End Date, and provide a Reason.');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      if (db && activeStudent) {
        const leaveData = {
          applicantId: activeStudent.id,
          applicantName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
          applicantRole: 'student',
          classId: activeStudent.classId || '',
          className: activeStudent.gradeClass || '',
          leaveType: leaveForm.leaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason.trim(),
          status: 'pending',
          submittedAt: new Date().toISOString(),
        };

        await db.collection('schools').doc(schoolId).collection('leaves').add(leaveData);
        showToast('Leave request submitted successfully!');
        setShowApplyLeaveModal(false);
        setLeaveForm({
          leaveType: 'Sick Leave',
          startDate: '',
          endDate: '',
          reason: '',
        });
      }
    } catch (e: any) {
      Alert.alert('Submission Error', e?.message || 'Could not save leave request.');
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  // Action: Request Canteen Meal
  const handleRequestMealSubmit = async (mealType: 'Breakfast' | 'Lunch' | 'Snacks') => {
    if (!activeStudent) return;
    setIsRequestingMeal(true);
    try {
      if (db) {
        const mealData = {
          studentId: activeStudent.id,
          studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
          mealType,
          date: canteenDate,
          timestamp: new Date().toISOString(),
          status: 'Pending',
        };
        await db.collection('schools').doc(schoolId).collection('canteen_requests').add(mealData);
        showToast(`${mealType} requested for ${canteenDate}!`);
      }
    } catch (e: any) {
      Alert.alert('Request Error', 'Failed to request meal.');
    } finally {
      setIsRequestingMeal(false);
    }
  };

  // Action: Book / Schedule PTM
  const handleBookPtmSubmit = async () => {
    if (!ptmForm.date || !ptmForm.notes.trim()) {
      Alert.alert('Required Fields', 'Please pick a Meeting Date and write a Topic/Note.');
      return;
    }
    setIsSubmittingPtm(true);
    try {
      if (db && activeStudent) {
        const ptmData = {
          studentId: activeStudent.id,
          studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
          teacherName: ptmForm.teacherName,
          date: ptmForm.date,
          time: ptmForm.time,
          notes: ptmForm.notes.trim(),
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        await db.collection('schools').doc(schoolId).collection('ptms').add(ptmData);
        showToast('PTM meeting requested!');
        setShowBookPtmModal(false);
        setPtmForm({
          teacherName: 'Class Teacher',
          date: '',
          time: '10:00 AM',
          notes: '',
        });
      }
    } catch (e: any) {
      Alert.alert('Booking Error', 'Could not schedule meeting.');
    } finally {
      setIsSubmittingPtm(false);
    }
  };

  // Action: Mark Homework Completed
  const handleToggleHomeworkStatus = async (hw: any) => {
    if (!db || !activeStudent) return;
    try {
      const isCompleted = hw.submissions?.[activeStudent.id]?.status === 'completed';
      const newStatus = isCompleted ? 'pending' : 'completed';
      const hwRef = db.collection('schools').doc(schoolId).collection('homeworks').doc(hw.id);

      await hwRef.set(
        {
          submissions: {
            [activeStudent.id]: {
              status: newStatus,
              updatedAt: new Date().toISOString(),
              studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
            },
          },
        },
        { merge: true }
      );
      showToast(newStatus === 'completed' ? 'Homework marked as completed!' : 'Homework status reset to pending.');
    } catch (e: any) {
      Alert.alert('Update Error', 'Could not update homework status.');
    }
  };

  // Action: Pay Invoice Fee
  const handlePayInvoice = async () => {
    if (!selectedInvoiceToPay || !db) return;
    setIsPayingInvoice(true);
    try {
      const invRef = db.collection('schools').doc(schoolId).collection('invoices').doc(selectedInvoiceToPay.id);
      await invRef.set(
        {
          status: 'Paid',
          paidAmount: selectedInvoiceToPay.amount,
          paidDate: new Date().toISOString().split('T')[0],
        },
        { merge: true }
      );
      showToast(`Payment of ₹${selectedInvoiceToPay.amount} recorded!`);
      setSelectedInvoiceToPay(null);
    } catch (e: any) {
      Alert.alert('Payment Error', 'Could not process fee payment.');
    } finally {
      setIsPayingInvoice(false);
    }
  };

  // Action: Send Message in Chat
  const handleSendMessage = async () => {
    if (!chatMessageText.trim() || !activeStudent || !db) return;
    setSendingMsg(true);
    try {
      const chatId = activeChat ? activeChat.id : `${activeStudent.id}_teacher`;
      const chatRef = db.collection('schools').doc(schoolId).collection('chats').doc(chatId);

      const newMsg = {
        sender: 'Parent',
        senderName: activeStudent.parentName || 'Parent',
        studentId: activeStudent.id,
        text: chatMessageText.trim(),
        timestamp: new Date().toISOString(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      const existingMessages = activeChat?.messages || [];
      await chatRef.set(
        {
          studentId: activeStudent.id,
          studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
          lastMessage: chatMessageText.trim(),
          lastUpdated: new Date().toISOString(),
          messages: [...existingMessages, newMsg],
        },
        { merge: true }
      );

      setChatMessageText('');
      showToast('Message sent!');
    } catch (e: any) {
      Alert.alert('Message Error', 'Could not send message.');
    } finally {
      setSendingMsg(false);
    }
  };

  // =========================================================================
  // RENDER: LOADING STATE
  // =========================================================================
  if (loadingInitial) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#B07FA8" />
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B', marginTop: 14 }}>
          Loading Student Portal...
        </Text>
      </View>
    );
  }

  // =========================================================================
  // RENDER: TOP HEADER BAR
  // =========================================================================
  const renderTopHeader = () => (
    <View style={styles.topHeaderBar}>
      <View style={styles.headerLogoBadge}>
        <SchoolLogo size={28} />
      </View>

      <View style={styles.schoolBrandDetails}>
        <Text style={styles.headerBrandTitle} numberOfLines={1}>
          Zuna International Academy
        </Text>
        <View style={styles.schoolSubRow}>
          <View style={[styles.officialBadgeInline, { backgroundColor: '#faedf7', borderColor: '#eec9db' }]}>
            <IconComp name="checkmark-circle-outline" size={13} color="#B07FA8" />
            <Text style={[styles.officialBadgeText, { color: '#B07FA8' }]}>Student/Parent</Text>
          </View>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.headerBrandSub}>Academic Portal</Text>
        </View>
      </View>

      <View style={styles.headerRightProfile}>
        <TouchableOpacity
          style={[styles.avatarPill, { backgroundColor: '#faedf7' }]}
          onPress={() => {
            setActiveBottomTab('All');
            setActiveAllModule('My Children');
          }}
          activeOpacity={0.75}>
          <Text style={[styles.avatarPillText, { color: '#B07FA8' }]}>
            {activeStudent?.firstName ? activeStudent.firstName.slice(0, 2).toUpperCase() : 'ST'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.logoutCircleBtn}
          onPress={onLogout}
          activeOpacity={0.7}
          accessibilityLabel="Logout">
          <IconComp name="log-out-outline" size={18} color="#475569" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // =========================================================================
  // RENDER: TAB 1 — DASHBOARD
  // =========================================================================
  const renderDashboard = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      {/* 1. Student Summary Card */}
      <View style={styles.studentSummaryCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={styles.studentAvatarCircle}>
            <Text style={styles.studentAvatarText}>
              {activeStudent?.firstName
                ? `${activeStudent.firstName[0]}${activeStudent.lastName ? activeStudent.lastName[0] : ''}`
                : 'ST'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.studentCardName} numberOfLines={1}>
                {`${activeStudent?.firstName || ''} ${activeStudent?.lastName || activeStudent?.name || 'Student'}`.trim()}
              </Text>
              <View style={styles.activeStatusPill}>
                <Text style={styles.activeStatusText}>Active</Text>
              </View>
            </View>
            <Text style={styles.studentCardSub}>
              Class: {activeStudent?.gradeClass || classDetails?.name || 'Assigned Class'} • Sec:{' '}
              {activeStudent?.section || classDetails?.section || 'A'}
            </Text>
            <Text style={styles.studentCardAdmNo}>
              Admission No: {activeStudent?.admissionNumber || activeStudent?.rollNo || 'ADM-001'}
            </Text>
          </View>
        </View>

        {/* Multi-Child Selector Banner (if more than 1 child exists) */}
        {children.length > 1 && (
          <View style={styles.multiChildSelectorRow}>
            <Text style={styles.multiChildLabel}>Select Child:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {children.map((child, idx) => (
                <TouchableOpacity
                  key={child.id || idx}
                  style={[
                    styles.childPillBtn,
                    selectedChildIndex === idx && styles.childPillBtnActive,
                  ]}
                  onPress={() => {
                    setSelectedChildIndex(idx);
                    showToast(`Switched profile to ${child.firstName || child.name}`);
                  }}>
                  <Text
                    style={[
                      styles.childPillText,
                      selectedChildIndex === idx && styles.childPillTextActive,
                    ]}>
                    {child.firstName || child.name} ({child.gradeClass || 'Student'})
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* 2. Attendance Summary Card */}
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => setActiveBottomTab('Attendance')}
        activeOpacity={0.85}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#ECFDF5' }]}>
              <IconComp name="calendar-outline" size={16} color="#059669" />
            </View>
            <Text style={styles.cardTitle}>Attendance Summary</Text>
          </View>
          <View style={[styles.percentageBadge, { backgroundColor: '#ECFDF5' }]}>
            <Text style={[styles.percentageBadgeText, { color: '#059669' }]}>
              {attendanceStats.percentage}% Present
            </Text>
          </View>
        </View>

        <View style={styles.metricsTripleRow}>
          <View style={styles.metricColumn}>
            <Text style={styles.metricValNumber}>{attendanceStats.present}</Text>
            <Text style={styles.metricValLabel}>Present</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <Text style={[styles.metricValNumber, { color: '#DC2626' }]}>{attendanceStats.absent}</Text>
            <Text style={styles.metricValLabel}>Absent</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <Text style={[styles.metricValNumber, { color: '#D97706' }]}>{attendanceStats.late}</Text>
            <Text style={styles.metricValLabel}>Late</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* 3. Homework Summary Card */}
      <TouchableOpacity
        style={styles.cardContainer}
        onPress={() => setActiveBottomTab('Homework')}
        activeOpacity={0.85}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#faedf7' }]}>
              <IconComp name="book-outline" size={16} color="#B07FA8" />
            </View>
            <Text style={styles.cardTitle}>Assigned Homework</Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>View All →</Text>
        </View>

        {homeworkList.length === 0 ? (
          <View style={styles.emptyCardSubBox}>
            <IconComp name="checkmark-done-circle-outline" size={24} color="#10B981" />
            <Text style={styles.emptyCardSubText}>No pending homework assignments!</Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 4 }}>
            {homeworkList.slice(0, 2).map(hw => {
              const isDone = hw.submissions?.[activeStudent?.id]?.status === 'completed';
              return (
                <View key={hw.id} style={styles.homeworkMiniItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.hwMiniTitle} numberOfLines={1}>{hw.title}</Text>
                    <Text style={styles.hwMiniSub}>{hw.subject} • Due: {hw.dueDate || 'Soon'}</Text>
                  </View>
                  <View style={[styles.hwMiniStatusPill, isDone ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' }]}>
                    <Text style={[styles.hwMiniStatusText, isDone ? { color: '#15803D' } : { color: '#B45309' }]}>
                      {isDone ? 'Completed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </TouchableOpacity>

      {/* 4. Academic Performance & Fee Overview Cards */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {/* Performance Box */}
        <TouchableOpacity
          style={[styles.cardContainer, { flex: 1 }]}
          onPress={() => {
            setActiveBottomTab('All');
            setActiveAllModule('Performance');
          }}
          activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#EEF2FF' }]}>
              <IconComp name="trending-up-outline" size={16} color="#4F46E5" />
            </View>
            <Text style={[styles.cardTitle, { fontSize: 13 }]}>Performance</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>
            {assessmentsList.length > 0 ? `${assessmentsList.length} Tests` : 'Graded'}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Subject Assessments</Text>
        </TouchableOpacity>

        {/* Fees Box */}
        <TouchableOpacity
          style={[styles.cardContainer, { flex: 1 }]}
          onPress={() => {
            setActiveBottomTab('All');
            setActiveAllModule('Fees & Payments');
          }}
          activeOpacity={0.85}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <View style={[styles.iconCircleSmall, { backgroundColor: feeStats.pending > 0 ? '#FEE2E2' : '#DCFCE7' }]}>
              <IconComp
                name="card-outline"
                size={16}
                color={feeStats.pending > 0 ? '#DC2626' : '#16A34A'}
              />
            </View>
            <Text style={[styles.cardTitle, { fontSize: 13 }]}>Fee Status</Text>
          </View>
          <Text style={{ fontSize: 20, fontWeight: '900', color: feeStats.pending > 0 ? '#DC2626' : '#16A34A' }}>
            {feeStats.pending > 0 ? `₹${feeStats.pending}` : 'Cleared'}
          </Text>
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
            {feeStats.pending > 0 ? 'Pending Payment' : 'All Dues Paid'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 5. School Notices & Upcoming Events */}
      <View style={styles.cardContainer}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[styles.iconCircleSmall, { backgroundColor: '#FEF3C7' }]}>
              <IconComp name="notifications-outline" size={16} color="#D97706" />
            </View>
            <Text style={styles.cardTitle}>Latest School Notice</Text>
          </View>
          <TouchableOpacity onPress={() => { setActiveBottomTab('All'); setActiveAllModule('Noticeboard'); }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>Noticeboard →</Text>
          </TouchableOpacity>
        </View>

        {noticesList.length === 0 ? (
          <View style={styles.emptyCardSubBox}>
            <Text style={styles.emptyCardSubText}>No active notices posted today.</Text>
          </View>
        ) : (
          <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', flex: 1 }}>
                {noticesList[0].title}
              </Text>
              <View style={{ backgroundColor: '#FDE68A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400E' }}>
                  {noticesList[0].priority || 'Notice'}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: '#475569', marginTop: 4, lineHeight: 16 }} numberOfLines={2}>
              {noticesList[0].content}
            </Text>
            <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 6 }}>
              {noticesList[0].date || noticesList[0].createdAt ? String(noticesList[0].date || noticesList[0].createdAt).slice(0, 10) : ''}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: TAB 2 — ATTENDANCE
  // =========================================================================
  const renderAttendance = () => {
    const filteredRecords = attendanceDateFilter
      ? attendanceRecords.filter(r => r.date.includes(attendanceDateFilter))
      : attendanceRecords;

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        <ModuleHeaderCard
          icon="calendar-outline"
          title="Attendance Record"
          subtitle="Track verified daily presence, absences, and monthly punctuality records."
          badgeText={`${attendanceStats.percentage}% Rate`}
        />

        {/* Metrics Grid */}
        <View style={styles.attendanceMetricsContainer}>
          <View style={styles.attMetricTile}>
            <Text style={[styles.attMetricTileVal, { color: '#059669' }]}>{attendanceStats.present}</Text>
            <Text style={styles.attMetricTileLabel}>Present</Text>
          </View>
          <View style={styles.attMetricTile}>
            <Text style={[styles.attMetricTileVal, { color: '#DC2626' }]}>{attendanceStats.absent}</Text>
            <Text style={styles.attMetricTileLabel}>Absent</Text>
          </View>
          <View style={styles.attMetricTile}>
            <Text style={[styles.attMetricTileVal, { color: '#D97706' }]}>{attendanceStats.late}</Text>
            <Text style={styles.attMetricTileLabel}>Late</Text>
          </View>
          <View style={styles.attMetricTile}>
            <Text style={[styles.attMetricTileVal, { color: '#B07FA8' }]}>{attendanceStats.total}</Text>
            <Text style={styles.attMetricTileLabel}>Sessions</Text>
          </View>
        </View>

        {/* Date Filter Bar with Calendar Picker (Requirement: No plain text date input) */}
        <View style={styles.filterCardContainer}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
            Filter by Date
          </Text>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.calendarPickerTriggerBox}
              onPress={() => setShowAttDatePicker(true)}
              activeOpacity={0.8}>
              <IconComp name="calendar" size={16} color="#B07FA8" />
              <Text style={{ fontSize: 13, color: attendanceDateFilter ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>
                {attendanceDateFilter || 'Pick a date to filter'}
              </Text>
            </TouchableOpacity>
            {!!attendanceDateFilter && (
              <TouchableOpacity
                style={styles.clearFilterBtn}
                onPress={() => setAttendanceDateFilter('')}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Attendance Log Items */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>
            Daily Attendance History ({filteredRecords.length})
          </Text>

          {filteredRecords.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <IconComp name="calendar-outline" size={36} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>No attendance records found</Text>
              <Text style={styles.emptyStateSub}>No records logged for the selected date criteria.</Text>
            </View>
          ) : (
            filteredRecords.map(rec => {
              const isPresent = rec.status === 'Present';
              const isAbsent = rec.status === 'Absent';
              return (
                <View key={rec.id} style={styles.attendanceLogItem}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View
                      style={[
                        styles.attStatusIconCircle,
                        isPresent && { backgroundColor: '#DCFCE7' },
                        isAbsent && { backgroundColor: '#FEE2E2' },
                        !isPresent && !isAbsent && { backgroundColor: '#FEF3C7' },
                      ]}>
                      <IconComp
                        name={isPresent ? 'checkmark' : isAbsent ? 'close' : 'time'}
                        size={16}
                        color={isPresent ? '#15803D' : isAbsent ? '#B91C1C' : '#B45309'}
                      />
                    </View>
                    <View>
                      <Text style={styles.attLogDate}>{rec.date}</Text>
                      <Text style={styles.attLogClass}>{rec.className || 'Class Record'}</Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.attStatusBadge,
                      isPresent && { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
                      isAbsent && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
                      !isPresent && !isAbsent && { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                    ]}>
                    <Text
                      style={[
                        styles.attStatusBadgeText,
                        isPresent && { color: '#15803D' },
                        isAbsent && { color: '#B91C1C' },
                        !isPresent && !isAbsent && { color: '#B45309' },
                      ]}>
                      {rec.status}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: TAB 3 — HOMEWORK
  // =========================================================================
  const renderHomework = () => {
    const filtered = homeworkList.filter(hw => {
      const matchSearch =
        !homeworkSearch ||
        hw.title?.toLowerCase().includes(homeworkSearch.toLowerCase()) ||
        hw.subject?.toLowerCase().includes(homeworkSearch.toLowerCase());
      const isDone = hw.submissions?.[activeStudent?.id]?.status === 'completed';
      if (homeworkFilter === 'pending') return matchSearch && !isDone;
      if (homeworkFilter === 'completed') return matchSearch && isDone;
      return matchSearch;
    });

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        <ModuleHeaderCard
          icon="book-outline"
          title="Assigned Homework"
          subtitle="View coursework, instructions, submission deadlines & mark assignments complete."
          badgeText={`${homeworkList.length} Tasks`}
        />

        {/* Search & Filter Pills */}
        <View style={styles.filterCardContainer}>
          <SearchInputBox
            wrapperStyle={styles.searchInputWrapper}
            placeholder="Search homework by subject or title..."
            value={homeworkSearch}
            onChangeText={setHomeworkSearch}
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {(['all', 'pending', 'completed'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.filterChipBtn, homeworkFilter === tab && styles.filterChipBtnActive]}
                onPress={() => setHomeworkFilter(tab)}>
                <Text style={[styles.filterChipText, homeworkFilter === tab && styles.filterChipTextActive]}>
                  {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : 'Completed'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Homework List */}
        <View style={{ marginTop: 8 }}>
          {filtered.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <IconComp name="checkmark-done-circle-outline" size={38} color="#CBD5E1" />
              <Text style={styles.emptyStateTitle}>No homework found</Text>
              <Text style={styles.emptyStateSub}>All coursework assignments are up to date.</Text>
            </View>
          ) : (
            filtered.map(hw => {
              const isDone = hw.submissions?.[activeStudent?.id]?.status === 'completed';
              return (
                <View key={hw.id} style={styles.homeworkCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <View style={styles.subjectTagBox}>
                          <Text style={styles.subjectTagText}>{hw.subject || 'General'}</Text>
                        </View>
                        {hw.teacherName && (
                          <Text style={{ fontSize: 11, color: '#64748B' }}>by {hw.teacherName}</Text>
                        )}
                      </View>
                      <Text style={styles.homeworkTitleText}>{hw.title}</Text>
                    </View>
                    <View
                      style={[
                        styles.hwStatusPill,
                        isDone ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' },
                      ]}>
                      <Text style={[styles.hwStatusPillText, isDone ? { color: '#15803D' } : { color: '#B45309' }]}>
                        {isDone ? '✓ Completed' : '● Pending'}
                      </Text>
                    </View>
                  </View>

                  {!!hw.description && (
                    <Text style={styles.homeworkDescText} numberOfLines={3}>
                      {hw.description}
                    </Text>
                  )}

                  <View style={styles.homeworkMetaRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <IconComp name="calendar-outline" size={13} color="#94A3B8" />
                      <Text style={styles.hwDateLabel}>Assigned: {hw.assignedDate || 'Today'}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <IconComp name="time-outline" size={13} color="#DC2626" />
                      <Text style={[styles.hwDateLabel, { color: '#DC2626', fontWeight: '700' }]}>
                        Due: {hw.dueDate || 'No date'}
                      </Text>
                    </View>
                  </View>

                  {/* Complete / Undo Complete Action */}
                  <TouchableOpacity
                    style={[styles.hwActionBtn, isDone && styles.hwActionBtnUndo]}
                    onPress={() => handleToggleHomeworkStatus(hw)}
                    activeOpacity={0.8}>
                    <IconComp
                      name={isDone ? 'refresh-outline' : 'checkmark-circle-outline'}
                      size={15}
                      color={isDone ? '#475569' : '#FFFFFF'}
                    />
                    <Text style={[styles.hwActionBtnText, isDone && { color: '#475569' }]}>
                      {isDone ? 'Reset to Pending' : 'Mark as Completed'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: TAB 4 — MESSAGES
  // =========================================================================
  const renderMessages = () => (
    <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        <ModuleHeaderCard
          icon="chatbubbles-outline"
          title="Parent Communications"
          subtitle="Direct messaging channel with teachers, faculty members, and academy administration."
        />

        {/* Conversation / Channel Selection */}
        <View style={styles.chatRoomCard}>
          <View style={styles.chatRoomHeader}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#faedf7', justifyContent: 'center', alignItems: 'center' }}>
              <IconComp name="school" size={18} color="#B07FA8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Class Faculty Channel</Text>
              <Text style={{ fontSize: 11, color: '#16A34A', fontWeight: '600' }}>● Faculty Online</Text>
            </View>
          </View>

          {/* Messages Stream */}
          <View style={styles.chatMessagesStream}>
            {chats.length === 0 || !chats[0]?.messages || chats[0].messages.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <IconComp name="chatbubble-ellipses-outline" size={32} color="#CBD5E1" />
                <Text style={{ fontSize: 13, color: '#94A3B8', marginTop: 8 }}>
                  No messages yet. Send a note to the teacher below.
                </Text>
              </View>
            ) : (
              chats[0].messages.map((msg: any, idx: number) => {
                const isMe = msg.sender === 'Parent';
                return (
                  <View
                    key={idx}
                    style={[
                      styles.chatBubbleRow,
                      isMe ? { justifyContent: 'flex-end' } : { justifyContent: 'flex-start' },
                    ]}>
                    <View
                      style={[
                        styles.chatBubble,
                        isMe ? styles.chatBubbleMe : styles.chatBubbleTeacher,
                      ]}>
                      <Text style={[styles.chatBubbleAuthor, isMe && { color: '#faedf7' }]}>
                        {msg.senderName || msg.sender}
                      </Text>
                      <Text style={[styles.chatBubbleText, isMe && { color: '#FFFFFF' }]}>
                        {msg.text}
                      </Text>
                      <Text style={[styles.chatBubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                        {msg.time || ''}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Message Composer */}
          <View style={styles.chatComposerRow}>
            <FocusTextInput
              style={styles.chatComposerInput}
              placeholder="Type message to teacher..."
              placeholderTextColor="#94A3B8"
              value={chatMessageText}
              onChangeText={setChatMessageText}
            />
            <TouchableOpacity
              style={[styles.chatSendBtn, (!chatMessageText.trim() || sendingMsg) && { opacity: 0.6 }]}
              onPress={handleSendMessage}
              disabled={!chatMessageText.trim() || sendingMsg}>
              {sendingMsg ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <IconComp name="send" size={16} color="#FFFFFF" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );

  // =========================================================================
  // RENDER: TAB 5 — ALL MODULES (EXACTLY 9 Modules, NO bottom tab duplicates)
  // =========================================================================
  const allModulesList: { name: AllModuleType; icon: string; color: string; desc: string }[] = [
    { name: 'My Children', icon: 'people-outline', color: '#3B82F6', desc: 'Child profile, ID & switch child' },
    { name: 'Performance', icon: 'trending-up-outline', color: '#8B5CF6', desc: 'Marks breakdown & class rank' },
    { name: 'PTM Meetings', icon: 'calendar-number-outline', color: '#EC4899', desc: 'Parent-Teacher conference schedule' },
    { name: 'Noticeboard', icon: 'notifications-outline', color: '#F59E0B', desc: 'Official school broadcasts' },
    { name: 'Calendar', icon: 'today-outline', color: '#10B981', desc: 'Interactive academic calendar' },
    { name: 'Canteen', icon: 'fast-food-outline', color: '#F97316', desc: 'Meal requests & canteen orders' },
    { name: 'Report Card', icon: 'document-text-outline', color: '#6366F1', desc: 'Official term report cards' },
    { name: 'Fees & Payments', icon: 'card-outline', color: '#14B8A6', desc: 'Invoices, receipts & pay online' },
    { name: 'Leave Requests', icon: 'time-outline', color: '#EF4444', desc: 'Apply student leave & track status' },
  ];

  const renderAllModules = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <View style={styles.screenHeaderRow}>
        <View>
          <Text style={styles.screenTitleText}>All Modules</Text>
          <Text style={{ color: '#64748B', fontSize: 12 }}>9 Specialized Student/Parent Services</Text>
        </View>
      </View>

      {/* 2-Column Grid */}
      <View style={styles.allModulesGrid}>
        {allModulesList.map(mod => (
          <TouchableOpacity
            key={mod.name}
            style={styles.allModuleGridCard}
            onPress={() => {
              setActiveAllModule(mod.name);
              showToast(`Opened ${mod.name}`);
            }}
            activeOpacity={0.75}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={[styles.allModuleIconBox, { backgroundColor: `${mod.color}15` }]}>
                <IconComp name={mod.icon} size={22} color={mod.color} />
              </View>
              <IconComp name="chevron-forward-outline" size={16} color="#CBD5E1" />
            </View>
            <Text style={styles.allModuleNameText}>{mod.name}</Text>
            <Text style={styles.allModuleDescText} numberOfLines={2}>{mod.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 1 — MY CHILDREN
  // =========================================================================
  const renderMyChildrenModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="people-outline"
        title="My Children"
        subtitle="Manage authenticated student records, guardian details & switch active student."
        badgeText={`${children.length} Enrolled`}
      />

      <View style={{ gap: 12 }}>
        {children.map((child, idx) => {
          const isSelected = selectedChildIndex === idx;
          return (
            <View
              key={child.id || idx}
              style={[
                styles.childDetailCard,
                isSelected && { borderColor: '#B07FA8', borderWidth: 1.5 },
              ]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={[styles.studentAvatarCircle, { width: 44, height: 44, borderRadius: 22 }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#B07FA8' }}>
                      {child.firstName ? child.firstName.slice(0, 2).toUpperCase() : 'ST'}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      {`${child.firstName || ''} ${child.lastName || child.name || ''}`.trim()}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B' }}>
                      Class: {child.gradeClass || 'Assigned'} • Adm No: {child.admissionNumber || 'ADM-001'}
                    </Text>
                  </View>
                </View>
                {isSelected ? (
                  <View style={{ backgroundColor: '#faedf7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#B07FA8' }}>Active Profile</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                    onPress={() => {
                      setSelectedChildIndex(idx);
                      showToast(`Switched profile to ${child.firstName || child.name}`);
                    }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>Select</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Student Metadata */}
              <View style={styles.childInfoGrid}>
                <View style={styles.childInfoItem}>
                  <Text style={styles.childInfoLabel}>Date of Birth</Text>
                  <Text style={styles.childInfoVal}>{child.dob || 'Not Provided'}</Text>
                </View>
                <View style={styles.childInfoItem}>
                  <Text style={styles.childInfoLabel}>Gender</Text>
                  <Text style={styles.childInfoVal}>{child.gender || 'Not Provided'}</Text>
                </View>
                <View style={styles.childInfoItem}>
                  <Text style={styles.childInfoLabel}>Parent Name</Text>
                  <Text style={styles.childInfoVal}>{child.parentName || 'Parent / Guardian'}</Text>
                </View>
                <View style={styles.childInfoItem}>
                  <Text style={styles.childInfoLabel}>Contact</Text>
                  <Text style={styles.childInfoVal}>{child.parentPhone || child.phone || 'Verified'}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 2 — PERFORMANCE
  // =========================================================================
  const renderPerformanceModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="trending-up-outline"
        title="Academic Performance"
        subtitle="Subject-wise test scores, assessment analytics & classroom performance trends."
      />

      {assessmentsList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <IconComp name="ribbon-outline" size={36} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>No assessment results yet</Text>
          <Text style={styles.emptyStateSub}>Classroom scores will appear as teachers complete grading.</Text>
        </View>
      ) : (
        assessmentsList.map(asm => {
          const studentGrade = asm.grades?.[activeStudent?.id] || asm.marks?.[activeStudent?.id] || 'Pending';
          return (
            <View key={asm.id} style={styles.cardContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>{asm.title || asm.name}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Subject: {asm.subject} • Date: {asm.date || 'Term 1'}
                  </Text>
                </View>
                <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#4F46E5' }}>{studentGrade}</Text>
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 3 — PTM MEETINGS
  // =========================================================================
  const renderPtmModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="calendar-number-outline"
        title="PTM Meetings"
        subtitle="Schedule and track Parent-Teacher Conferences with faculty advisors."
        rightAction={{
          label: 'Book PTM',
          icon: 'add',
          onPress: () => setShowBookPtmModal(true),
        }}
      />

      {ptmList.length === 0 ? (
        <View style={styles.emptyStateCard}>
          <IconComp name="calendar-outline" size={36} color="#CBD5E1" />
          <Text style={styles.emptyStateTitle}>No PTM meetings scheduled</Text>
          <Text style={styles.emptyStateSub}>Tap "Book PTM" above to request a conference.</Text>
        </View>
      ) : (
        ptmList.map(ptm => (
          <View key={ptm.id} style={styles.cardContainer}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                  Meeting with {ptm.teacherName || 'Faculty'}
                </Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  {ptm.date} at {ptm.time || '10:00 AM'}
                </Text>
                {!!ptm.notes && (
                  <Text style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                    Topic: {ptm.notes}
                  </Text>
                )}
              </View>
              <View style={[styles.hwStatusPill, ptm.status === 'confirmed' ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEF3C7' }]}>
                <Text style={[styles.hwStatusPillText, ptm.status === 'confirmed' ? { color: '#15803D' } : { color: '#B45309' }]}>
                  {ptm.status || 'Pending'}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 4 — NOTICEBOARD
  // =========================================================================
  const renderNoticeboardModule = () => {
    const filteredNotices = noticesList.filter(n => {
      if (!noticeSearch) return true;
      return (
        n.title?.toLowerCase().includes(noticeSearch.toLowerCase()) ||
        n.content?.toLowerCase().includes(noticeSearch.toLowerCase())
      );
    });

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        <ModuleHeaderCard
          icon="notifications-outline"
          title="School Noticeboard"
          subtitle="Official school-wide circulars, event announcements and calendar notices."
          badgeText={`${noticesList.length} Total`}
        />

        <View style={styles.filterCardContainer}>
          <SearchInputBox
            wrapperStyle={styles.searchInputWrapper}
            placeholder="Search circulars and announcements..."
            value={noticeSearch}
            onChangeText={setNoticeSearch}
          />
        </View>

        {filteredNotices.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <IconComp name="notifications-off-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No notices found</Text>
            <Text style={styles.emptyStateSub}>Check back later for newly published announcements.</Text>
          </View>
        ) : (
          filteredNotices.map(notice => (
            <View key={notice.id} style={styles.cardContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1, paddingRight: 8 }}>
                  {notice.title}
                </Text>
                <View style={{ backgroundColor: notice.priority === 'High' ? '#FEE2E2' : '#faedf7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: notice.priority === 'High' ? '#DC2626' : '#B07FA8' }}>
                    {notice.priority || 'General'}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 12, color: '#475569', marginTop: 6, lineHeight: 18 }}>
                {notice.content}
              </Text>
              <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 10 }}>
                Published: {notice.date || (notice.createdAt ? String(notice.createdAt).slice(0, 10) : 'Recent')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 5 — INTERACTIVE CALENDAR
  // =========================================================================
  const renderCalendarModule = () => {
    const today = new Date();
    const currentMonthDate = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const calendarCells = [];
    for (let i = 0; i < firstDay; i++) {
      calendarCells.push(<View key={`empty-${i}`} style={{ width: '14.28%', height: 44 }} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = calendarSelectedDateStr === dStr;
      calendarCells.push(
        <TouchableOpacity
          key={`day-${day}`}
          onPress={() => setCalendarSelectedDateStr(dStr)}
          style={{ width: '14.28%', height: 44, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isSelected ? '#B07FA8' : 'transparent',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 13,
                fontWeight: isSelected ? '800' : '600',
                color: isSelected ? '#FFFFFF' : '#0F172A',
              }}>
              {day}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // Filter events matching selected calendar date
    const dayEvents = noticesList.filter(n => n.date?.includes(calendarSelectedDateStr));

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        <ModuleHeaderCard
          icon="today-outline"
          title="Academic Calendar"
          subtitle="Interactive month view of scheduled events, examinations, holidays & terms."
        />

        {/* Month Navigator Header Bar */}
        <View style={styles.calendarNavHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => setCalendarMonthOffset(prev => prev - 1)}
              style={styles.calendarNavBtn}>
              <IconComp name="chevron-back" size={18} color="#0F172A" />
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', minWidth: 140, textAlign: 'center' }}>
              {monthNames[month]} {year}
            </Text>
            <TouchableOpacity
              onPress={() => setCalendarMonthOffset(prev => prev + 1)}
              style={styles.calendarNavBtn}>
              <IconComp name="chevron-forward" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.calendarTodayBtn}
            onPress={() => {
              setCalendarMonthOffset(0);
              setCalendarSelectedDateStr(new Date().toISOString().split('T')[0]);
            }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>Today</Text>
          </TouchableOpacity>
        </View>

        {/* 7-Column Calendar Month Grid Container */}
        <View style={styles.calendarGridBox}>
          <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 8, marginBottom: 8 }}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
              <Text key={i} style={{ width: '14.28%', textAlign: 'center', fontSize: 12, fontWeight: '700', color: i === 0 ? '#EF4444' : '#94A3B8' }}>
                {d}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{calendarCells}</View>
        </View>

        {/* Selected Day Details */}
        <View style={styles.cardContainer}>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 6 }}>
            Events for {calendarSelectedDateStr}
          </Text>
          {dayEvents.length === 0 ? (
            <Text style={{ fontSize: 12, color: '#94A3B8' }}>No special events or exams scheduled for this date.</Text>
          ) : (
            dayEvents.map(ev => (
              <View key={ev.id} style={{ backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginTop: 4 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{ev.title}</Text>
                <Text style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{ev.content}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 6 — CANTEEN
  // =========================================================================
  const renderCanteenModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="fast-food-outline"
        title="Emergency Canteen"
        subtitle="Request breakfast or lunch from the school canteen if your child forgot their meal."
      />

      {/* Date selection for meal using Date Picker (Requirement: No manual date typing) */}
      <View style={styles.filterCardContainer}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
          Meal Order Date
        </Text>
        <TouchableOpacity
          style={styles.calendarPickerTriggerBox}
          onPress={() => setDatePickerTarget('canteen')}
          activeOpacity={0.8}>
          <IconComp name="calendar" size={16} color="#B07FA8" />
          <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '700' }}>
            {canteenDate}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Meal Options */}
      <View style={{ gap: 12 }}>
        {/* Breakfast Card */}
        <View style={styles.cardContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.allModuleIconBox, { backgroundColor: '#FEF3C7' }]}>
              <IconComp name="cafe-outline" size={24} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>Morning Breakfast</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Served fresh during the morning recess break.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { marginTop: 14 }]}
            onPress={() => handleRequestMealSubmit('Breakfast')}
            disabled={isRequestingMeal}>
            <IconComp name="add-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Request Breakfast</Text>
          </TouchableOpacity>
        </View>

        {/* Lunch Card */}
        <View style={styles.cardContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={[styles.allModuleIconBox, { backgroundColor: '#FEE2E2' }]}>
              <IconComp name="restaurant-outline" size={24} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>Afternoon Lunch</Text>
              <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>
                Hot nutritional meal served during lunch period.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={[styles.primaryActionBtn, { marginTop: 14, backgroundColor: '#0F172A' }]}
            onPress={() => handleRequestMealSubmit('Lunch')}
            disabled={isRequestingMeal}>
            <IconComp name="add-circle-outline" size={16} color="#FFFFFF" />
            <Text style={styles.primaryActionBtnText}>Request Lunch</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Past Canteen Requests */}
      <View style={{ marginTop: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>
          Recent Canteen Requests ({canteenRequests.length})
        </Text>
        {canteenRequests.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <Text style={styles.emptyStateSub}>No previous canteen meal requests logged.</Text>
          </View>
        ) : (
          canteenRequests.map(req => (
            <View key={req.id} style={styles.attendanceLogItem}>
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{req.mealType} Request</Text>
                <Text style={{ fontSize: 11, color: '#64748B' }}>Date: {req.date}</Text>
              </View>
              <View style={[styles.hwStatusPill, { backgroundColor: '#DCFCE7' }]}>
                <Text style={[styles.hwStatusPillText, { color: '#15803D' }]}>{req.status || 'Active'}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 7 — REPORT CARD
  // =========================================================================
  const renderReportCardModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="document-text-outline"
        title="Official Report Card"
        subtitle="Term examination transcripts, verified GPA, letter grades & academic remarks."
        badgeText="Passed"
      />

      <View style={styles.cardContainer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <View>
            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>Academic Year 2025-26</Text>
            <Text style={{ fontSize: 11, color: '#64748B' }}>Term 1 Comprehensive Assessment</Text>
          </View>
          <View style={[styles.percentageBadge, { backgroundColor: '#DCFCE7' }]}>
            <Text style={[styles.percentageBadgeText, { color: '#15803D' }]}>Status: Passed</Text>
          </View>
        </View>

        {/* Subjects Table */}
        <View style={{ borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
          {[
            { subject: 'Mathematics', marks: '92 / 100', grade: 'A+' },
            { subject: 'English Literature', marks: '88 / 100', grade: 'A' },
            { subject: 'Science & Physics', marks: '95 / 100', grade: 'A+' },
            { subject: 'Social Studies', marks: '84 / 100', grade: 'B+' },
            { subject: 'Computer Science', marks: '98 / 100', grade: 'O' },
          ].map((sub, idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>{sub.subject}</Text>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>{sub.marks}</Text>
                <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, minWidth: 28, alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#4F46E5' }}>{sub.grade}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>Total Cumulative Score</Text>
          <Text style={{ fontSize: 16, fontWeight: '900', color: '#B07FA8' }}>457 / 500 (91.4%)</Text>
        </View>
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 8 — FEES & PAYMENTS
  // =========================================================================
  const renderFeesModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="card-outline"
        title="Fees & Payments"
        subtitle="Manage academic tuition, transport dues, pending invoices & instant payment records."
      />

      {/* Fee Metrics Card */}
      <View style={styles.cardContainer}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 10 }}>FEE BALANCE SUMMARY</Text>
        <View style={styles.metricsTripleRow}>
          <View style={styles.metricColumn}>
            <Text style={[styles.metricValNumber, { color: '#0F172A' }]}>₹{feeStats.totalInvoiced}</Text>
            <Text style={styles.metricValLabel}>Total Billed</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <Text style={[styles.metricValNumber, { color: '#16A34A' }]}>₹{feeStats.paid}</Text>
            <Text style={styles.metricValLabel}>Paid</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricColumn}>
            <Text style={[styles.metricValNumber, { color: '#DC2626' }]}>₹{feeStats.pending}</Text>
            <Text style={styles.metricValLabel}>Pending</Text>
          </View>
        </View>
      </View>

      {/* Invoices List */}
      <View style={{ marginTop: 10 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>
          Invoices & Term Fees ({invoicesList.length})
        </Text>

        {invoicesList.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <IconComp name="receipt-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No invoices found</Text>
            <Text style={styles.emptyStateSub}>All term school fees and dues are cleared.</Text>
          </View>
        ) : (
          invoicesList.map(inv => {
            const isPaid = inv.status === 'Paid';
            return (
              <View key={inv.id} style={styles.cardContainer}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>
                      {inv.name || 'Term Tuition Fee'}
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                      Due Date: {inv.dueDate || 'Immediate'}
                    </Text>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 6 }}>
                      ₹{inv.amount}
                    </Text>
                  </View>
                  <View style={[styles.hwStatusPill, isPaid ? { backgroundColor: '#DCFCE7' } : { backgroundColor: '#FEE2E2' }]}>
                    <Text style={[styles.hwStatusPillText, isPaid ? { color: '#15803D' } : { color: '#DC2626' }]}>
                      {isPaid ? '✓ Paid' : '● Due'}
                    </Text>
                  </View>
                </View>

                {!isPaid && (
                  <TouchableOpacity
                    style={[styles.primaryActionBtn, { marginTop: 12 }]}
                    onPress={() => setSelectedInvoiceToPay(inv)}
                    activeOpacity={0.8}>
                    <IconComp name="card" size={15} color="#FFFFFF" />
                    <Text style={styles.primaryActionBtnText}>Pay Online (₹{inv.amount})</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 9 — LEAVE REQUESTS
  // =========================================================================
  const renderLeaveRequestsModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <ModuleHeaderCard
        icon="time-outline"
        title="Leave Requests"
        subtitle="Submit formal leave notices, view past applications & verify teacher approval status."
        rightAction={{
          label: 'Apply Leave',
          icon: 'add',
          onPress: () => setShowApplyLeaveModal(true),
        }}
      />

      <View style={{ marginTop: 8 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 10 }}>
          Submitted Leave Applications ({leavesList.length})
        </Text>

        {leavesList.length === 0 ? (
          <View style={styles.emptyStateCard}>
            <IconComp name="calendar-clear-outline" size={36} color="#CBD5E1" />
            <Text style={styles.emptyStateTitle}>No leave applications</Text>
            <Text style={styles.emptyStateSub}>Tap "Apply Leave" above to request planned student absences.</Text>
          </View>
        ) : (
          leavesList.map(leave => (
            <View key={leave.id} style={styles.cardContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                    {leave.leaveType || 'Student Leave'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    From: {leave.startDate} → To: {leave.endDate}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                    Reason: {leave.reason}
                  </Text>
                </View>
                <View
                  style={[
                    styles.hwStatusPill,
                    leave.status === 'approved'
                      ? { backgroundColor: '#DCFCE7' }
                      : leave.status === 'rejected'
                      ? { backgroundColor: '#FEE2E2' }
                      : { backgroundColor: '#FEF3C7' },
                  ]}>
                  <Text
                    style={[
                      styles.hwStatusPillText,
                      leave.status === 'approved'
                        ? { color: '#15803D' }
                        : leave.status === 'rejected'
                        ? { color: '#DC2626' }
                        : { color: '#B45309' },
                    ]}>
                    {leave.status || 'Pending'}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: ACTIVE VIEW ROUTER
  // =========================================================================
  const renderActiveContent = () => {
    // If a sub-module from "All" is active, render that with a Top Bar back button
    if (activeBottomTab === 'All' && activeAllModule) {
      return (
        <View style={{ flex: 1 }}>
          {/* Sub-module Header Bar with Back Button */}
          <View style={styles.subModuleNavHeader}>
            <TouchableOpacity
              style={styles.subModuleBackBtn}
              onPress={() => setActiveAllModule(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <IconComp name="chevron-back" size={20} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.subModuleNavTitle}>{activeAllModule}</Text>
          </View>

          {activeAllModule === 'My Children' && renderMyChildrenModule()}
          {activeAllModule === 'Performance' && renderPerformanceModule()}
          {activeAllModule === 'PTM Meetings' && renderPtmModule()}
          {activeAllModule === 'Noticeboard' && renderNoticeboardModule()}
          {activeAllModule === 'Calendar' && renderCalendarModule()}
          {activeAllModule === 'Canteen' && renderCanteenModule()}
          {activeAllModule === 'Report Card' && renderReportCardModule()}
          {activeAllModule === 'Fees & Payments' && renderFeesModule()}
          {activeAllModule === 'Leave Requests' && renderLeaveRequestsModule()}
        </View>
      );
    }

    switch (activeBottomTab) {
      case 'Dashboard':
        return renderDashboard();
      case 'Attendance':
        return renderAttendance();
      case 'Homework':
        return renderHomework();
      case 'Messages':
        return renderMessages();
      case 'All':
        return renderAllModules();
      default:
        return renderDashboard();
    }
  };

  // =========================================================================
  // MAIN RETURN
  // =========================================================================
  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      {renderTopHeader()}

      {/* Toast Notification Banner */}
      {toastMessage && (
        <View style={styles.toastBannerBox}>
          <IconComp name="sparkles-outline" size={16} color="#FFFFFF" />
          <Text style={styles.toastBannerText}>{toastMessage}</Text>
        </View>
      )}

      {/* Main Screen Content */}
      <View style={{ flex: 1 }}>{renderActiveContent()}</View>

      {/* =========================================================================
          PERSISTENT FLOATING BOTTOM NAVIGATION (EXACTLY 5 TABS)
          1. Dashboard, 2. Attendance, 3. Homework, 4. Messages, 5. All
          Active state styled with #B07FA8
         ========================================================================= */}
      <View style={styles.floatingNavWrapper}>
        <View style={styles.floatingNavPillContainer}>
          {(['Dashboard', 'Attendance', 'Homework', 'Messages', 'All'] as BottomTab[]).map(tab => {
            const isActive = activeBottomTab === tab && (!activeAllModule || tab === 'All');
            const iconMap: Record<BottomTab, string> = {
              'Dashboard': 'grid-outline',
              'Attendance': 'calendar-outline',
              'Homework': 'book-outline',
              'Messages': 'chatbubbles-outline',
              'All': 'apps-outline',
            };

            return (
              <TouchableOpacity
                key={tab}
                style={[styles.floatingTabItemBtn, isActive && styles.floatingTabItemBtnActive]}
                onPress={() => {
                  setActiveBottomTab(tab);
                  if (tab !== 'All') {
                    setActiveAllModule(null);
                  }
                }}
                activeOpacity={0.8}>
                <IconComp
                  name={iconMap[tab]}
                  size={18}
                  color={isActive ? '#B07FA8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.floatingTabLabelText,
                    isActive && styles.floatingTabLabelTextActive,
                  ]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* =========================================================================
          MODALS WITH CALENDAR DATE PICKERS
         ========================================================================= */}

      {/* Date Picker Modal for Attendance */}
      <CalendarDatePickerModal
        visible={showAttDatePicker}
        title="Select Attendance Date"
        currentDateStr={attendanceDateFilter}
        onSelectDate={dStr => setAttendanceDateFilter(dStr)}
        onClose={() => setShowAttDatePicker(false)}
      />

      {/* Date Picker Modal for Canteen */}
      <CalendarDatePickerModal
        visible={datePickerTarget === 'canteen'}
        title="Select Meal Date"
        currentDateStr={canteenDate}
        onSelectDate={dStr => setCanteenDate(dStr)}
        onClose={() => setDatePickerTarget(null)}
      />

      {/* Date Picker Modal for Leave Start */}
      <CalendarDatePickerModal
        visible={datePickerTarget === 'leaveStart'}
        title="Select Leave Start Date"
        currentDateStr={leaveForm.startDate}
        onSelectDate={dStr => {
          setLeaveForm(prev => ({ ...prev, startDate: dStr }));
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />

      {/* Date Picker Modal for Leave End */}
      <CalendarDatePickerModal
        visible={datePickerTarget === 'leaveEnd'}
        title="Select Leave End Date"
        currentDateStr={leaveForm.endDate}
        onSelectDate={dStr => {
          setLeaveForm(prev => ({ ...prev, endDate: dStr }));
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />

      {/* Date Picker Modal for PTM */}
      <CalendarDatePickerModal
        visible={datePickerTarget === 'ptm'}
        title="Select PTM Date"
        currentDateStr={ptmForm.date}
        onSelectDate={dStr => {
          setPtmForm(prev => ({ ...prev, date: dStr }));
          setDatePickerTarget(null);
        }}
        onClose={() => setDatePickerTarget(null)}
      />

      {/* Apply Leave Modal */}
      <Modal visible={showApplyLeaveModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxHeight: '90%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Apply for Student Leave</Text>
              <TouchableOpacity onPress={() => setShowApplyLeaveModal(false)}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Leave Type */}
              <Text style={styles.inputLabelText}>Leave Type</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {['Sick Leave', 'Casual Leave', 'Family Emergency', 'Medical'].map(tp => (
                  <TouchableOpacity
                    key={tp}
                    style={[styles.filterChipBtn, leaveForm.leaveType === tp && styles.filterChipBtnActive]}
                    onPress={() => setLeaveForm(prev => ({ ...prev, leaveType: tp }))}>
                    <Text style={[styles.filterChipText, leaveForm.leaveType === tp && styles.filterChipTextActive]}>
                      {tp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Start Date Picker Button (Requirement: No manual typing) */}
              <Text style={styles.inputLabelText}>Start Date</Text>
              <TouchableOpacity
                style={styles.calendarPickerTriggerBox}
                onPress={() => setDatePickerTarget('leaveStart')}>
                <IconComp name="calendar" size={16} color="#B07FA8" />
                <Text style={{ fontSize: 13, color: leaveForm.startDate ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>
                  {leaveForm.startDate || 'Select start date'}
                </Text>
              </TouchableOpacity>

              {/* End Date Picker Button (Requirement: No manual typing) */}
              <Text style={[styles.inputLabelText, { marginTop: 10 }]}>End Date</Text>
              <TouchableOpacity
                style={styles.calendarPickerTriggerBox}
                onPress={() => setDatePickerTarget('leaveEnd')}>
                <IconComp name="calendar" size={16} color="#B07FA8" />
                <Text style={{ fontSize: 13, color: leaveForm.endDate ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>
                  {leaveForm.endDate || 'Select end date'}
                </Text>
              </TouchableOpacity>

              {/* Reason Input */}
              <Text style={[styles.inputLabelText, { marginTop: 10 }]}>Reason</Text>
              <FocusTextInput
                style={[styles.formTextInput, { minHeight: 80, textAlignVertical: 'top' }]}
                placeholder="Explain the reason for student's absence..."
                placeholderTextColor="#94A3B8"
                multiline
                value={leaveForm.reason}
                onChangeText={txt => setLeaveForm(prev => ({ ...prev, reason: txt }))}
              />

              {/* Submit Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                <TouchableOpacity
                  style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                  onPress={() => setShowApplyLeaveModal(false)}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryActionBtn, isSubmittingLeave && { opacity: 0.7 }]}
                  onPress={handleApplyLeaveSubmit}
                  disabled={isSubmittingLeave}>
                  {isSubmittingLeave ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryActionBtnText}>Submit Leave</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Book PTM Modal */}
      <Modal visible={showBookPtmModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 380 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Schedule PTM Conference</Text>
              <TouchableOpacity onPress={() => setShowBookPtmModal(false)}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabelText}>Meeting Date</Text>
            <TouchableOpacity
              style={styles.calendarPickerTriggerBox}
              onPress={() => setDatePickerTarget('ptm')}>
              <IconComp name="calendar" size={16} color="#B07FA8" />
              <Text style={{ fontSize: 13, color: ptmForm.date ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>
                {ptmForm.date || 'Select meeting date'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.inputLabelText, { marginTop: 10 }]}>Meeting Time</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              {['09:00 AM', '10:00 AM', '11:30 AM', '02:00 PM'].map(t => (
                <TouchableOpacity
                  key={t}
                  style={[styles.filterChipBtn, ptmForm.time === t && styles.filterChipBtnActive]}
                  onPress={() => setPtmForm(prev => ({ ...prev, time: t }))}>
                  <Text style={[styles.filterChipText, ptmForm.time === t && styles.filterChipTextActive]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabelText}>Topic / Discussion Notes</Text>
            <FocusTextInput
              style={[styles.formTextInput, { minHeight: 70, textAlignVertical: 'top' }]}
              placeholder="What would you like to discuss with the teacher?"
              placeholderTextColor="#94A3B8"
              multiline
              value={ptmForm.notes}
              onChangeText={txt => setPtmForm(prev => ({ ...prev, notes: txt }))}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                onPress={() => setShowBookPtmModal(false)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryActionBtn}
                onPress={handleBookPtmSubmit}
                disabled={isSubmittingPtm}>
                {isSubmittingPtm ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Confirm Meeting</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Pay Invoice Fee Modal */}
      <Modal visible={!!selectedInvoiceToPay} transparent animationType="fade">
        <View style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 360 }]}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#faedf7', justifyContent: 'center', alignItems: 'center', marginBottom: 12 }}>
              <IconComp name="card-outline" size={24} color="#B07FA8" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Confirm Fee Payment</Text>
            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 }}>
              You are paying ₹{selectedInvoiceToPay?.amount} for "{selectedInvoiceToPay?.name}" for{' '}
              {activeStudent?.firstName || 'Student'}.
            </Text>

            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginVertical: 14 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Invoice ID:</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>{selectedInvoiceToPay?.id?.slice(0, 10)}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Amount Due:</Text>
                <Text style={{ fontSize: 14, fontWeight: '900', color: '#B07FA8' }}>₹{selectedInvoiceToPay?.amount}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>Due Date:</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>{selectedInvoiceToPay?.dueDate || 'Immediate'}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
                onPress={() => setSelectedInvoiceToPay(null)}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryActionBtn, isPayingInvoice && { opacity: 0.7 }]}
                onPress={handlePayInvoice}
                disabled={isPayingInvoice}>
                {isPayingInvoice ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryActionBtnText}>Confirm & Pay</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// =========================================================================
// STYLES (MATCHING TEACHER PORTAL DESIGN LANGUAGE & #B07FA8 THEME)
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  tabScrollContentWithFloatingNav: {
    padding: 16,
    paddingBottom: 100, // Extra space so floating nav never blocks content
  },

  // Top Header Bar
  topHeaderBar: {
    height: 56,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerLogoBadge: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  schoolBrandDetails: {
    flex: 1,
    marginLeft: 10,
  },
  headerBrandTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  schoolSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: 4,
  },
  officialBadgeInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  officialBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dotSeparator: {
    color: '#94A3B8',
    fontSize: 10,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  logoutCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Module Hero Header Card
  moduleHeroHeaderCard: {
    backgroundColor: '#B07FA8',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 14,
    shadowColor: '#B07FA8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },

  // Student Summary Card (Dashboard)
  studentSummaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  studentAvatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#faedf7',
    borderWidth: 2,
    borderColor: '#eec9db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  studentAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#B07FA8',
  },
  studentCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  activeStatusPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeStatusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D',
  },
  studentCardSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  studentCardAdmNo: {
    fontSize: 11,
    color: '#94A3B8',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 2,
  },
  multiChildSelectorRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  multiChildLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
  },
  childPillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childPillBtnActive: {
    backgroundColor: '#faedf7',
    borderColor: '#B07FA8',
  },
  childPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  childPillTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },

  // Card Containers
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
  },
  iconCircleSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  percentageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  percentageBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Triple Metrics
  metricsTripleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: 4,
  },
  metricColumn: {
    alignItems: 'center',
    flex: 1,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#E2E8F0',
  },
  metricValNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
  },
  metricValLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  // Homework Mini & Regular
  homeworkMiniItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
  },
  hwMiniTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  hwMiniSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  hwMiniStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hwMiniStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  emptyCardSubBox: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  emptyCardSubText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },

  // Floating Bottom Navigation (EXACTLY 5 TABS)
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
    backgroundColor: '#faedf7',
  },
  floatingTabLabelText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  floatingTabLabelTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },

  // Attendance Metrics 4-tile
  attendanceMetricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 12,
  },
  attMetricTile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
  },
  attMetricTileVal: {
    fontSize: 18,
    fontWeight: '900',
  },
  attMetricTileLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },

  // Date Filter Box
  filterCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  calendarPickerTriggerBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  clearFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#faedf7',
    borderRadius: 10,
  },

  // Attendance Log Item
  attendanceLogItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  attStatusIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attLogDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  attLogClass: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  attStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  attStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Homework Cards
  homeworkCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  subjectTagBox: {
    backgroundColor: '#faedf7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  subjectTagText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B07FA8',
  },
  homeworkTitleText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  homeworkDescText: {
    fontSize: 12,
    color: '#475569',
    marginTop: 6,
    lineHeight: 18,
  },
  homeworkMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hwDateLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  hwStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  hwStatusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  hwActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#B07FA8',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 12,
  },
  hwActionBtnUndo: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  hwActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Filter Chips & Search
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterChipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipBtnActive: {
    backgroundColor: '#faedf7',
    borderColor: '#B07FA8',
  },
  filterChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },

  // Empty State Card
  emptyStateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#334155',
    marginTop: 8,
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },

  // Chat / Messages
  chatRoomCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  chatRoomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  chatMessagesStream: {
    padding: 14,
    minHeight: 280,
  },
  chatBubbleRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  chatBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    padding: 12,
  },
  chatBubbleMe: {
    backgroundColor: '#B07FA8',
    borderBottomRightRadius: 4,
  },
  chatBubbleTeacher: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  chatBubbleAuthor: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 2,
  },
  chatBubbleText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  chatBubbleTime: {
    fontSize: 9,
    color: '#94A3B8',
    alignSelf: 'flex-end',
    marginTop: 4,
  },
  chatComposerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    gap: 8,
  },
  chatComposerInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
  },
  chatSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#B07FA8',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // All Modules Screen
  screenHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  screenTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  allModulesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  allModuleGridCard: {
    width: '48.5%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    padding: 14,
    marginBottom: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  allModuleIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  allModuleNameText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 12,
  },
  allModuleDescText: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 3,
    lineHeight: 14,
  },

  // Sub-module Navigation Bar
  subModuleNavHeader: {
    height: 50,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 10,
  },
  subModuleBackBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModuleNavTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Child Detail Cards
  childDetailCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  childInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 12,
  },
  childInfoItem: {
    width: '45%',
  },
  childInfoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  childInfoVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 2,
  },

  // Calendar Module Nav & Grid
  calendarNavHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  calendarNavBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  calendarTodayBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#faedf7',
    borderWidth: 1,
    borderColor: '#B07FA8',
  },
  calendarGridBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },

  // Primary Action Button
  primaryActionBtn: {
    backgroundColor: '#B07FA8',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#B07FA8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Modals & Inputs
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 440,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  inputLabelText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  formTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },

  // Toast
  toastBannerBox: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  toastBannerText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default StudentPortal;
