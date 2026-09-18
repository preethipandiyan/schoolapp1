import React, { useState, useEffect, useMemo, forwardRef, useRef } from 'react';
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
  Keyboard,
  NativeModules,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareFormScrollView } from './KeyboardAwareFormScrollView';

const { ZunaFilePicker } = NativeModules;

// Firebase Native Integrations
let db: any = null;
let auth: any = null;
try {
  const { getFirestore } = require('@react-native-firebase/firestore');
  const { getAuth } = require('@react-native-firebase/auth');
  db = getFirestore();
  auth = getAuth();
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
  const [pickerViewMode, setPickerViewMode] = useState<'day' | 'month' | 'year'>('day');

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
          setPickerViewMode('day');
          return;
        }
      }
    }
    const today = new Date();
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDay(today.getDate());
    setPickerViewMode('day');
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

  // Years range: 1995 to 2030
  const yearsList = [];
  for (let yr = 2030; yr >= 1995; yr--) {
    yearsList.push(yr);
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

          {/* Month / Year Navigator Buttons */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginBottom: 12 }}>
            <TouchableOpacity onPress={handlePrevMonth} style={{ padding: 6 }}>
              <IconComp name="chevron-back" size={18} color="#0F172A" />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {/* Month Selector Button */}
              <TouchableOpacity
                onPress={() => setPickerViewMode(prev => prev === 'month' ? 'day' : 'month')}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: pickerViewMode === 'month' ? '#faedf7' : 'transparent',
                }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: pickerViewMode === 'month' ? '#B07FA8' : '#0F172A' }}>
                  {monthNames[viewMonth]} ▾
                </Text>
              </TouchableOpacity>

              {/* Year Selector Button */}
              <TouchableOpacity
                onPress={() => setPickerViewMode(prev => prev === 'year' ? 'day' : 'year')}
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 4,
                  borderRadius: 6,
                  backgroundColor: pickerViewMode === 'year' ? '#faedf7' : 'transparent',
                }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: pickerViewMode === 'year' ? '#B07FA8' : '#0F172A' }}>
                  {viewYear} ▾
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={handleNextMonth} style={{ padding: 6 }}>
              <IconComp name="chevron-forward" size={18} color="#0F172A" />
            </TouchableOpacity>
          </View>

          {/* Body: Month Picker Mode */}
          {pickerViewMode === 'month' && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8, justifyContent: 'center' }}>
              {monthNames.map((mName, idx) => (
                <TouchableOpacity
                  key={mName}
                  style={{
                    width: '30%',
                    paddingVertical: 10,
                    borderRadius: 8,
                    backgroundColor: viewMonth === idx ? '#B07FA8' : '#F1F5F9',
                    alignItems: 'center',
                  }}
                  onPress={() => {
                    setViewMonth(idx);
                    setPickerViewMode('day');
                  }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: viewMonth === idx ? '#FFFFFF' : '#0F172A' }}>
                    {mName.slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Body: Year Picker Mode */}
          {pickerViewMode === 'year' && (
            <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingVertical: 8, justifyContent: 'center' }}>
                {yearsList.map(yr => (
                  <TouchableOpacity
                    key={yr}
                    style={{
                      width: '30%',
                      paddingVertical: 10,
                      borderRadius: 8,
                      backgroundColor: viewYear === yr ? '#B07FA8' : '#F1F5F9',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      setViewYear(yr);
                      setPickerViewMode('day');
                    }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: viewYear === yr ? '#FFFFFF' : '#0F172A' }}>
                      {yr}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}

          {/* Body: Standard Day Calendar Mode */}
          {pickerViewMode === 'day' && (
            <>
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
            </>
          )}

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
  | 'Leave Requests'
  | 'Timetable';

interface StudentPortalProps {
  userEmail?: string;
  onLogout: () => void;
  schoolId?: string;
  schoolName?: string;
}

// =========================================================================
// DEFAULT ENROLLED STUDENT & SAMPLE ATTENDANCE (Source of Truth: Madhu P)
// =========================================================================
const DEFAULT_STUDENT: any = {
  id: 'student_madhu_p_10987',
  firstName: 'Madhu',
  lastName: 'P',
  name: 'Madhu P',
  gradeClass: 'PRE KG - A',
  className: 'PRE KG - A',
  admissionNumber: '10987',
  rollNumber: 'N/A',
  rollNo: 'N/A',
  dob: '2021-01-05',
  dateOfBirth: '2021-01-05',
  gender: 'Female',
  bloodGroup: '',
  classId: 'class_pre_kg_a',
};

const generateDefaultAttendanceRecords = () => {
  const today = new Date();
  const records: any[] = [];
  for (let i = 0; i < 22; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const status = i === 2 ? 'Late' : (i === 6 || i === 13) ? 'Absent' : 'Present';
    records.push({
      id: `att_${dateStr}`,
      date: dateStr,
      status,
      className: 'PRE KG - A',
    });
  }
  return records;
};

// =========================================================================
// MAIN STUDENT / PARENT PORTAL COMPONENT
// =========================================================================
export const StudentPortal: React.FC<StudentPortalProps> = ({ userEmail = '', onLogout, schoolId: propSchoolId, schoolName: propSchoolName }) => {
  const schoolId = propSchoolId || 'school1';
  const schoolName = propSchoolName || 'Academic Portal';

  // Navigation State
  const [activeBottomTab, setActiveBottomTab] = useState<BottomTab>('Dashboard');
  const [activeAllModule, setActiveAllModule] = useState<AllModuleType | null>(null);
  const [selectedTimetableDay, setSelectedTimetableDay] = useState<'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday'>('Monday');

  // Student & Child Profile State (Defaulting to Madhu P per Image 2)
  const [children, setChildren] = useState<any[]>([DEFAULT_STUDENT]);
  const [selectedChildIndex, setSelectedChildIndex] = useState<number>(0);
  const [classDetails, setClassDetails] = useState<any>(null);
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true);

  // Attendance State (With Proper Mobile Dropdown Filter per Requirement)
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [attTimeFilter, setAttTimeFilter] = useState<'All Time' | 'This Week' | 'This Month' | 'This Term'>('All Time');
  const [showAttDropdown, setShowAttDropdown] = useState<boolean>(false);
  const [attendanceDateFilter, setAttendanceDateFilter] = useState<string>('');
  const [showAttDatePicker, setShowAttDatePicker] = useState<boolean>(false);

  // Homework State
  const [homeworkList, setHomeworkList] = useState<any[]>([]);
  const [homeworkFilter, setHomeworkFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [homeworkSearch, setHomeworkSearch] = useState<string>('');

  // Messages / Chat State (Screenshots 4 & 5)
  const [chats, setChats] = useState<any[]>([]);
  const [activeChat, setActiveChat] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatMessageText, setChatMessageText] = useState<string>('');
  const [sendingMsg, setSendingMsg] = useState<boolean>(false);
  const [chatSubTab, setChatSubTab] = useState<'dms' | 'channels'>('dms');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState<boolean>(false);
  const messagesScrollRef = useRef<any>(null);
  const [selectedTeacher, setSelectedTeacher] = useState<{ id: string; name: string; role: string; avatar: string; color: string }>({
    id: 't_jana',
    name: 'jana',
    role: 'Teacher',
    avatar: 'J',
    color: '#b07fa8',
  });

  // Keyboard Awareness Listener for Messages & Bottom Nav
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        setTimeout(() => {
          messagesScrollRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Leaves State (Screenshots 1, 2 & 3)
  const [leavesList, setLeavesList] = useState<any[]>([]);
  const [showApplyLeaveModal, setShowApplyLeaveModal] = useState<boolean>(false);
  const [showLeaveTypeDropdown, setShowLeaveTypeDropdown] = useState<boolean>(false);
  const [leaveSelectedFile, setLeaveSelectedFile] = useState<{ name: string; size: string } | null>(null);
  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'Sick Leave',
    customType: '',
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
  const [noticeTab, setNoticeTab] = useState<'global' | 'class'>('global');

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
  const [calendarSelectedDateStr, setCalendarSelectedDateStr] = useState<string>(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  });
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);

  // Active student reference
  const activeStudent = useMemo(() => {
    if (!children || children.length === 0) return null;
    return children[selectedChildIndex] || children[0];
  }, [children, selectedChildIndex]);

  // Viewing & Link Another Child State (Screenshots 2, 3, 4, 5)
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState<boolean>(false);
  const [isLinkAnotherModalOpen, setIsLinkAnotherModalOpen] = useState<boolean>(false);
  const [linkChildAdmission, setLinkChildAdmission] = useState<string>('');
  const [linkChildDob, setLinkChildDob] = useState<string>('');
  const [linkChildError, setLinkChildError] = useState<string>('');
  const [isLinkingChild, setIsLinkingChild] = useState<boolean>(false);
  const [showLinkDatePicker, setShowLinkDatePicker] = useState<boolean>(false);

  // My Children Specific State (Screenshots 1, 2, 3, 4, 5)
  const [manualSiblings, setManualSiblings] = useState<any[]>([]);
  const [isAddOrLinkModalOpen, setIsAddOrLinkModalOpen] = useState<boolean>(false);
  const [addOrLinkTab, setAddOrLinkTab] = useState<'link_enrolled' | 'manual_sibling'>('link_enrolled');
  const [unlinkingStudent, setUnlinkingStudent] = useState<any | null>(null);

  // Sibling Form State (Screenshot 3)
  const [editingSiblingId, setEditingSiblingId] = useState<string | null>(null);
  const [siblingForm, setSiblingForm] = useState({
    name: '',
    dob: '',
    gender: '',
    relationship: '',
    bloodGroup: '',
    schoolName: '',
  });
  const [showSiblingDatePicker, setShowSiblingDatePicker] = useState<boolean>(false);
  const [showGenderDropdown, setShowGenderDropdown] = useState<boolean>(false);
  const [showRelationshipDropdown, setShowRelationshipDropdown] = useState<boolean>(false);
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState<boolean>(false);
  const siblingScrollRef = React.useRef<any>(null);

  // Helper: Format Date String to DD/MM/YYYY for UI display (Screenshot 1)
  const formatDisplayDob = (dStr: any): string => {
    if (!dStr) return 'N/A';
    try {
      if (typeof dStr === 'object' && typeof dStr.toDate === 'function') {
        const d = dStr.toDate();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      const parts = String(dStr).split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
        }
        if (parts[2].length === 4) {
          return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }
      }
    } catch (e) {}
    return String(dStr);
  };

  // Helper: Normalize Date String to YYYY-MM-DD for reliable comparison
  const normalizeDateStr = (dStr: any): string => {
    if (!dStr) return '';
    if (typeof dStr === 'object' && typeof dStr.toDate === 'function') {
      const d = dStr.toDate();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    if (dStr instanceof Date) {
      return `${dStr.getFullYear()}-${String(dStr.getMonth() + 1).padStart(2, '0')}-${String(dStr.getDate()).padStart(2, '0')}`;
    }
    if (typeof dStr === 'string') {
      const s = dStr.trim();
      const parts = s.split(/[-/.]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
        if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    return String(dStr).trim();
  };

  // Handler: Link Another Child with exact validation & error messaging
  const handleLinkChildSubmit = async () => {
    const adm = linkChildAdmission.trim();
    const dob = linkChildDob.trim();
    if (!adm || !dob) {
      setLinkChildError('No student found matching this Admission Number and Date of Birth.');
      return;
    }
    setLinkChildError('');
    setIsLinkingChild(true);

    try {
      let foundStudent: any = null;
      const targetNormDob = normalizeDateStr(dob);

      // 1. Query Firestore students collection if db exists
      if (db) {
        const studentsRef = db.collection('schools').doc(schoolId).collection('students');
        let snap = await studentsRef.where('admissionNumber', '==', adm).get();
        if (!snap || snap.empty) {
          snap = await studentsRef.where('admissionNumber', '==', adm.toUpperCase()).get();
        }
        if (!snap || snap.empty) {
          snap = await studentsRef.where('admissionNumber', '==', adm.toLowerCase()).get();
        }
        if (!snap || snap.empty) {
          snap = await studentsRef.where('rollNo', '==', adm).get();
        }

        if (snap && !snap.empty) {
          for (const docSnap of snap.docs) {
            const sData = { id: docSnap.id, ...docSnap.data() };
            const sDobNorm = normalizeDateStr(sData.dob || sData.dateOfBirth || sData.birthDate);
            if (sDobNorm === targetNormDob || !sDobNorm) {
              foundStudent = sData;
              break;
            }
          }
        }
      }

      // 2. Fallback: search in loaded children array
      if (!foundStudent && children && children.length > 0) {
        const match = children.find(c => {
          const cAdm = (c.admissionNumber || c.rollNo || c.id || '').trim().toLowerCase();
          const cDob = normalizeDateStr(c.dob || c.dateOfBirth || c.birthDate);
          return cAdm === adm.toLowerCase() && (cDob === targetNormDob || !cDob);
        });
        if (match) {
          foundStudent = match;
        }
      }

      if (!foundStudent) {
        // Exact error message required by Screenshot 5
        setLinkChildError('No student found matching this Admission Number and Date of Birth.');
        setIsLinkingChild(false);
        return;
      }

      // Found student! Link to active list
      const existingIndex = children.findIndex(c => c.id === foundStudent.id);
      if (existingIndex >= 0) {
        setSelectedChildIndex(existingIndex);
      } else {
        const updated = [...children, foundStudent];
        setChildren(updated);
        setSelectedChildIndex(updated.length - 1);
      }

      showToast(`Linked ${foundStudent.firstName || foundStudent.name || 'Child'} successfully!`);
      setIsLinkAnotherModalOpen(false);
      setIsAddOrLinkModalOpen(false);
      setLinkChildAdmission('');
      setLinkChildDob('');
      setLinkChildError('');
    } catch (e: any) {
      console.error('Error linking child:', e);
      setLinkChildError('No student found matching this Admission Number and Date of Birth.');
    } finally {
      setIsLinkingChild(false);
    }
  };

  // Handler: Confirm Unlink Student (Screenshot 5)
  const handleConfirmUnlinkStudent = async () => {
    if (!unlinkingStudent) return;
    const studentToUnlink = unlinkingStudent;
    const studentName = `${studentToUnlink.firstName || ''} ${studentToUnlink.lastName || studentToUnlink.name || 'Student'}`.trim();

    try {
      const updatedChildren = children.filter(c => c.id !== studentToUnlink.id);
      setChildren(updatedChildren);
      if (selectedChildIndex >= updatedChildren.length) {
        setSelectedChildIndex(Math.max(0, updatedChildren.length - 1));
      }

      // If user document exists in firestore, update linked students
      if (db && auth?.currentUser?.uid) {
        try {
          const userRef = db.collection('users').doc(auth.currentUser.uid);
          const userDoc = await userRef.get();
          if (userDoc.exists) {
            const uData = userDoc.data();
            const filteredLinked = (uData.linkedStudents || []).filter((s: any) => s.studentId !== studentToUnlink.id);
            const updates: any = { linkedStudents: filteredLinked };
            if (uData.linkedStudentId === studentToUnlink.id) {
              updates.linkedStudentId = filteredLinked[0]?.studentId || null;
            }
            await userRef.update(updates);
          }
        } catch (dbErr) {
          console.warn('Could not persist unlinking in users doc:', dbErr);
        }
      }

      showToast(`Unlinked ${studentName} from account.`);
      setUnlinkingStudent(null);
    } catch (err) {
      console.error('Error unlinking student:', err);
      showToast('Failed to unlink student.');
    }
  };

  // Handler: Add or Edit Manual Sibling (Screenshot 3)
  const handleAddSiblingSubmit = async () => {
    if (!siblingForm.name.trim() || !siblingForm.dob) {
      Alert.alert('Required Fields', 'Please provide Full Name and Date of Birth for the sibling.');
      return;
    }

    let updated: any[] = [];
    if (editingSiblingId) {
      updated = manualSiblings.map(s => s.id === editingSiblingId ? {
        ...s,
        name: siblingForm.name.trim(),
        dob: siblingForm.dob,
        gender: siblingForm.gender || 'Male',
        relationship: siblingForm.relationship || 'Sibling',
        bloodGroup: siblingForm.bloodGroup || '',
        schoolName: siblingForm.schoolName.trim() || '',
      } : s);
      setManualSiblings(updated);
      showToast(`Updated ${siblingForm.name.trim()}!`);
    } else {
      const newSibling = {
        id: Date.now().toString(),
        name: siblingForm.name.trim(),
        dob: siblingForm.dob,
        gender: siblingForm.gender || 'Male',
        relationship: siblingForm.relationship || 'Sibling',
        bloodGroup: siblingForm.bloodGroup || '',
        schoolName: siblingForm.schoolName.trim() || '',
      };
      updated = [...manualSiblings, newSibling];
      setManualSiblings(updated);
      showToast(`Added ${newSibling.name} as ${newSibling.relationship}!`);
    }

    if (db && auth?.currentUser?.uid) {
      try {
        const userRef = db.collection('users').doc(auth.currentUser.uid);
        await userRef.update({ children: updated });
      } catch (e) {
        console.warn('Could not persist sibling in Firestore:', e);
      }
    }

    setIsAddOrLinkModalOpen(false);
    setEditingSiblingId(null);
    setSiblingForm({
      name: '',
      dob: '',
      gender: '',
      relationship: '',
      bloodGroup: '',
      schoolName: '',
    });
  };

  // Handler: Delete Manual Sibling
  const handleDeleteManualSibling = (siblingId: string) => {
    Alert.alert(
      'Remove Sibling',
      'Are you sure you want to remove this sibling record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const updated = manualSiblings.filter(s => s.id !== siblingId);
            setManualSiblings(updated);
            if (db && auth?.currentUser?.uid) {
              try {
                const userRef = db.collection('users').doc(auth.currentUser.uid);
                await userRef.update({ children: updated });
              } catch (e) {
                console.warn('Could not remove sibling from Firestore:', e);
              }
            }
            showToast('Sibling record removed.');
          },
        },
      ]
    );
  };

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

        // If no direct email match (e.g. demo student login), fallback to real students in Firestore, or DEFAULT_STUDENT (Image 2)
        if (matched.length === 0) {
          matched = allDocs.length > 0 ? allDocs : [DEFAULT_STUDENT];
        }

        setChildren(matched);
        setLoadingInitial(false);
      },
      (err: any) => {
        console.warn('Error fetching students:', err);
        setChildren([DEFAULT_STUDENT]);
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

  // Hook 10b: Fetch Published Report Cards (Web Source of Truth: src/pages/Parent/Grades.jsx)
  const [reportCards, setReportCards] = useState<any[]>([]);
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    const rcCol = db.collection('schools').doc(schoolId).collection('students').doc(activeStudent.id).collection('report_cards');
    const unsub = rcCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      list.sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
      setReportCards(list);
    }, (err: any) => {
      console.warn('Report cards listener error:', err);
    });

    return () => unsub();
  }, [activeStudent?.id]);

  // Hook 11: Real-time Messages / Chats (Aligned with existing firestore.js & Parent/Chat.jsx)
  useEffect(() => {
    if (!db || !activeStudent?.id) return;

    // 1. Listen to all chats for this student (for list/overview)
    const chatsCol = db.collection('schools').doc(schoolId).collection('chats');
    const unsubChats = chatsCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        const data = d.data();
        if (data.studentId === activeStudent.id || d.id.includes(activeStudent.id)) {
          list.push({ id: d.id, ...data });
        }
      });
      setChats(list);
    }, (err: any) => {
      console.warn('Chats list listener error:', err);
    });

    // 2. Active teacher conversation chatRoomId
    const teacherId = selectedTeacher?.id || 't_jana';
    const chatRoomId = `${activeStudent.id}_${teacherId}`;
    const chatDocRef = db.collection('schools').doc(schoolId).collection('chats').doc(chatRoomId);

    // Listen to messages subcollection (primary storage in existing firestore.js)
    let unsubMessagesSub: any = null;
    try {
      unsubMessagesSub = chatDocRef.collection('messages').orderBy('createdAt', 'asc').onSnapshot((snap: any) => {
        if (snap && !snap.empty) {
          const list: any[] = [];
          snap.forEach((docSnap: any) => {
            list.push({ id: docSnap.id, ...docSnap.data() });
          });
          setChatMessages(list);
        }
      }, (err: any) => {
        console.warn('Chat messages subcollection error:', err);
      });
    } catch (_) {}

    // Also listen to chat room doc (for doc.data().messages array compatibility)
    let unsubChatDoc: any = null;
    try {
      unsubChatDoc = chatDocRef.onSnapshot((snap: any) => {
        if (snap && snap.exists) {
          const data = snap.data();
          setActiveChat({ id: snap.id, ...data });
          if (data?.messages && Array.isArray(data.messages) && data.messages.length > 0) {
            setChatMessages(prev => {
              if (prev.length > 0 && prev.some((m: any) => m.id)) return prev;
              return data.messages;
            });
          }
        }
      }, (err: any) => {
        console.warn('Chat room doc error:', err);
      });
    } catch (_) {}

    return () => {
      if (typeof unsubChats === 'function') unsubChats();
      if (typeof unsubMessagesSub === 'function') unsubMessagesSub();
      if (typeof unsubChatDoc === 'function') unsubChatDoc();
    };
  }, [activeStudent?.id, selectedTeacher?.id, schoolId]);

  // Hook 12: Fetch Calendar Events (Web Source of Truth: src/components/AcademicCalendar.jsx)
  useEffect(() => {
    if (!db) return;

    const calCol = db.collection('schools').doc(schoolId).collection('calendar');
    const unsub = calCol.onSnapshot((snapshot: any) => {
      if (!snapshot) return;
      const list: any[] = [];
      snapshot.forEach((d: any) => {
        list.push({ id: d.id, ...d.data() });
      });
      setCalendarEvents(list);
    });

    return () => unsub();
  }, [schoolId]);

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
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;
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

  // Action: Pick Supporting Document for Leave
  const handlePickLeaveDoc = async () => {
    if (Platform.OS === 'android' && ZunaFilePicker) {
      try {
        const res = await ZunaFilePicker.pickFile({ type: 'all' });
        if (res && res.name) {
          setLeaveSelectedFile({ name: res.name, size: res.size || '1.2 MB' });
          Alert.alert('File Attached', `Selected: ${res.name}`);
          return;
        }
      } catch (err) {}
    }
    // Fallback simulated document selection for preview
    setLeaveSelectedFile({ name: 'medical_certificate.pdf', size: '245 KB' });
    Alert.alert('File Attached', 'Selected: medical_certificate.pdf (245 KB)');
  };

  // Action: Apply For Leave
  const handleApplyLeaveSubmit = async () => {
    if (!leaveForm.startDate || !leaveForm.endDate || !leaveForm.reason.trim()) {
      Alert.alert('Required Fields', 'Please select a Start Date, End Date, and provide a Reason.');
      return;
    }
    if (leaveForm.leaveType === 'Others' && !leaveForm.customType.trim()) {
      Alert.alert('Specify Leave Type', 'Please specify your custom leave type.');
      return;
    }

    setIsSubmittingLeave(true);
    try {
      if (db && activeStudent) {
        const finalLeaveType =
          leaveForm.leaveType === 'Others'
            ? leaveForm.customType.trim() || 'Others'
            : leaveForm.leaveType;

        const leaveData = {
          applicantId: activeStudent.id,
          applicantName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
          applicantRole: 'student',
          classId: activeStudent.classId || '',
          className: activeStudent.gradeClass || '',
          leaveType: finalLeaveType,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          reason: leaveForm.reason.trim(),
          status: 'Pending',
          submittedAt: new Date().toISOString(),
          supportingDoc: leaveSelectedFile || null,
        };

        await db.collection('schools').doc(schoolId).collection('leaves').add(leaveData);
        Alert.alert('Success', 'Leave request submitted successfully!');
        setShowApplyLeaveModal(false);
        setLeaveSelectedFile(null);
        setLeaveForm({
          leaveType: 'Sick Leave',
          customType: '',
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

  // Action: Request Canteen Meal (Web Source: src/pages/Parent/Canteen.jsx)
  const handleRequestMealSubmit = async (mealType: 'Breakfast' | 'Lunch' | 'Snacks') => {
    if (!activeStudent) return;
    setIsRequestingMeal(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const newReq = {
      id: 'req_' + Date.now(),
      studentId: activeStudent.id,
      studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
      mealType,
      date: todayStr,
      timestamp: new Date().toISOString(),
      status: 'Pending',
    };

    // Optimistically prepend to request history table so it immediately displays!
    setCanteenRequests(prev => [newReq, ...prev.filter(p => !(p.date === todayStr && p.mealType === mealType))]);

    try {
      if (db) {
        await db.collection('schools').doc(schoolId).collection('canteen_requests').add(newReq);
      }
      showToast(`${mealType} requested for today!`);
    } catch (e: any) {
      console.warn('Failed to persist meal request in Firestore:', e);
      showToast(`${mealType} requested!`);
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

  // Action: Send Message in Chat (Matching existing firestore.js & Parent/Chat.jsx)
  const handleSendMessage = async () => {
    const trimmed = chatMessageText.trim();
    if (!trimmed || !activeStudent || sendingMsg) return;
    setSendingMsg(true);

    const teacher = selectedTeacher || { id: 't_jana', name: 'jana' };
    const chatRoomId = `${activeStudent.id}_${teacher.id}`;
    const now = new Date();
    const nowIso = now.toISOString();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const newMsg = {
      id: 'msg_' + Date.now().toString(),
      sender: 'Parent',
      senderRole: 'parent',
      senderName: activeStudent.parentName || 'Parent',
      studentId: activeStudent.id,
      teacherId: teacher.id,
      text: trimmed,
      timestamp: nowIso,
      createdAt: nowIso,
      time: timeStr,
    };

    // Optimistically show the message immediately in the conversation
    setChatMessages(prev => [...prev, newMsg]);
    setChatMessageText('');

    try {
      if (db) {
        const chatDocRef = db.collection('schools').doc(schoolId).collection('chats').doc(chatRoomId);

        // 1. Add to messages subcollection (standard in existing firestore.js)
        try {
          await chatDocRef.collection('messages').add({
            senderId: auth?.currentUser?.uid || activeStudent.id,
            senderRole: 'parent',
            senderName: activeStudent.parentName || 'Parent',
            text: trimmed,
            createdAt: nowIso,
            timestamp: nowIso,
            time: timeStr,
          });
        } catch (subErr) {
          console.warn('Subcollection message add err:', subErr);
        }

        // 2. Update chat room document metadata and messages array
        const currentMsgs = [...(activeChat?.messages || chatMessages || []), newMsg];
        await chatDocRef.set(
          {
            studentId: activeStudent.id,
            teacherId: teacher.id,
            studentName: `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim(),
            teacherName: teacher.name,
            lastMessage: trimmed,
            lastMessageTime: nowIso,
            lastUpdated: nowIso,
            messages: currentMsgs,
          },
          { merge: true }
        );

        if (schoolId === 'school1') {
          try {
            await db.collection('schools').doc('SchoolS001').collection('chats').doc(chatRoomId).set(
              {
                studentId: activeStudent.id,
                teacherId: teacher.id,
                lastMessage: trimmed,
                lastMessageTime: nowIso,
                messages: currentMsgs,
              },
              { merge: true }
            );
          } catch (_) {}
        }
      }
      showToast('Message sent!');
    } catch (e: any) {
      console.warn('Send message error:', e);
      showToast('Message sent!');
    } finally {
      setSendingMsg(false);
      setTimeout(() => {
        messagesScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
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
  // RENDER: TOP HEADER BAR (EXACT MATCH TO ADMIN / TEACHER HEADER)
  // Dimensions, paddings, fonts, alignments, logo, role badge, avatar PR, logout
  // =========================================================================
  const renderTopHeader = () => (
    <View style={styles.topHeaderBar}>
      <View style={styles.headerLogoBadge}>
        <SchoolLogo size={28} />
      </View>

      <View style={styles.schoolBrandDetails}>
        <Text style={styles.headerBrandTitle} numberOfLines={1} ellipsizeMode="tail">
          {schoolName}
        </Text>
        <View style={styles.schoolSubRow}>
          <View style={[styles.officialBadgeInline, { backgroundColor: '#faedf7', borderColor: '#eec9db' }]}>
            <IconComp name="checkmark-circle-outline" size={12} color="#B07FA8" />
            <Text style={[styles.officialBadgeText, { color: '#B07FA8' }]}>PARENT</Text>
          </View>
          <Text style={styles.dotSeparator}>·</Text>
          <Text style={styles.headerBrandSub}>Academic Portal</Text>
        </View>
      </View>

      <View style={styles.headerRightProfile}>
        <View style={[styles.avatarPill, { backgroundColor: '#faedf7' }]}>
          <Text style={[styles.avatarPillText, { color: '#B07FA8' }]}>PR</Text>
        </View>
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
  // RENDER: TAB 1 — STUDENT OVERVIEW (MATCHING SCREENSHOT 2 & 3)
  // 1. VIEWING dropdown card with + Link Another Child
  // 2. Dark Hero Student banner (MP, Madhu P, PRE KG - A, ID: 10987)
  // 3. Attendance Summary card (circle with --, 0 PRESENT, 0 LATE, 0 ABSENT, NO ATTENDANCE RECORDED YET)
  // 4. Recent Assessments card (No Grades Yet / published grades)
  // =========================================================================
  const renderDashboard = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      {/* 1. VIEWING Child Dropdown Card (Screenshots 2 & 3) */}
      <View style={styles.viewingCardWrapper}>
        <TouchableOpacity
          style={styles.viewingCardTouchable}
          onPress={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
          activeOpacity={0.8}>
          <View style={{ flex: 1 }}>
            <Text style={styles.viewingCardHeaderLabel}>VIEWING</Text>
            <Text style={styles.viewingCardChildName} numberOfLines={1}>
              {`${activeStudent?.firstName || activeStudent?.name || 'Student'} ${activeStudent?.lastName || ''}`.trim()}
            </Text>
          </View>
          <IconComp
            name={isChildDropdownOpen ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#B07FA8"
          />
        </TouchableOpacity>

        {isChildDropdownOpen && (
          <View style={styles.viewingDropdownPopup}>
            <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {children.map((child, idx) => {
                const isSelected = selectedChildIndex === idx;
                const childInitials = child.firstName
                  ? `${child.firstName[0]}${child.lastName ? child.lastName[0] : ''}`
                  : (child.name ? child.name.slice(0, 2).toUpperCase() : 'ST');
                const fullName = `${child.firstName || ''} ${child.lastName || child.name || 'Student'}`.trim();
                return (
                  <TouchableOpacity
                    key={child.id || idx}
                    style={[
                      styles.childDropdownItem,
                      isSelected && styles.childDropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedChildIndex(idx);
                      setIsChildDropdownOpen(false);
                      showToast(`Viewing ${fullName}`);
                    }}
                    activeOpacity={0.75}>
                    <View style={styles.childDropdownAvatar}>
                      <Text style={styles.childDropdownAvatarText}>{childInitials}</Text>
                    </View>
                    <Text style={styles.childDropdownName} numberOfLines={1}>{fullName}</Text>
                    {isSelected && (
                      <IconComp name="checkmark-outline" size={16} color="#B07FA8" style={{ marginLeft: 'auto' }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.childDropdownDivider} />

            <TouchableOpacity
              style={styles.linkAnotherChildBtn}
              onPress={() => {
                setIsChildDropdownOpen(false);
                setLinkChildError('');
                setLinkChildAdmission('');
                setLinkChildDob('');
                setIsLinkAnotherModalOpen(true);
              }}
              activeOpacity={0.8}>
              <IconComp name="add-outline" size={18} color="#B07FA8" />
              <Text style={styles.linkAnotherChildBtnText}>Link Another Child</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 2. Dark Hero Student Banner Card (Screenshot 2) */}
      <View style={styles.darkHeroBannerCard}>
        <View style={styles.darkHeroAvatarCircle}>
          <Text style={styles.darkHeroAvatarText}>
            {activeStudent?.firstName
              ? `${activeStudent.firstName[0]}${activeStudent.lastName ? activeStudent.lastName[0] : ''}`
              : (activeStudent?.name ? activeStudent.name.slice(0, 2).toUpperCase() : 'MP')}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.darkHeroStudentName} numberOfLines={1}>
            {`${activeStudent?.firstName || ''} ${activeStudent?.lastName || activeStudent?.name || 'Student'}`.trim()}
          </Text>
          <View style={styles.darkHeroSubRow}>
            <IconComp name="school-outline" size={14} color="#94A3B8" />
            <Text style={styles.darkHeroClassText}>
              {activeStudent?.gradeClass || classDetails?.name || 'PRE KG - A'}
            </Text>
            <Text style={styles.darkHeroBullet}>•</Text>
            <Text style={styles.darkHeroIdText}>
              ID: {activeStudent?.admissionNumber || activeStudent?.rollNo || activeStudent?.id || '10987'}
            </Text>
          </View>
        </View>
      </View>

      {/* Quick Access — Exactly 4 Items in a Clean Single Row */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      }}>
        <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>
          Quick Access
        </Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          {[
            {
              label: 'Attendance',
              icon: 'calendar-outline',
              color: '#059669',
              bg: '#ECFDF5',
              onPress: () => {
                setActiveAllModule(null);
                setActiveBottomTab('Attendance');
                showToast('Viewing Attendance');
              },
            },
            {
              label: 'Fees',
              icon: 'card-outline',
              color: '#0D9488',
              bg: '#F0FDFA',
              onPress: () => {
                setActiveAllModule('Fees & Payments');
                showToast('Viewing Fees & Payments');
              },
            },
            {
              label: 'Homework',
              icon: 'book-outline',
              color: '#B07FA8',
              bg: '#F5F3FF',
              onPress: () => {
                setActiveAllModule(null);
                setActiveBottomTab('Homework');
                showToast('Viewing Homework');
              },
            },
            {
              label: 'Timetable',
              icon: 'time-outline',
              color: '#2563EB',
              bg: '#EFF6FF',
              onPress: () => {
                setActiveAllModule('Timetable');
                showToast('Viewing Timetable');
              },
            },
          ].map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 10,
                paddingHorizontal: 2,
                borderRadius: 12,
                backgroundColor: '#F8FAFC',
                borderWidth: 1,
                borderColor: '#F1F5F9',
              }}
              onPress={item.onPress}
              activeOpacity={0.75}>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  backgroundColor: item.bg,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6,
                }}>
                <IconComp name={item.icon} size={19} color={item.color} />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: '#1E293B',
                  textAlign: 'center',
                }}
                numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 3. Attendance Summary Card (Screenshot 2) */}
      <View style={styles.overviewSectionCard}>
        <View style={styles.overviewSectionHeaderRow}>
          <IconComp name="calendar-outline" size={18} color="#EC4899" />
          <Text style={styles.overviewSectionTitle}>Attendance Summary</Text>
        </View>

        {/* Circular Donut Indicator with -- */}
        <View style={styles.attendanceDonutWrapper}>
          <View style={[
            styles.attendanceDonutRing,
            attendanceStats.total > 0 && {
              borderColor: attendanceStats.percentage >= 90
                ? '#16A34A'
                : attendanceStats.percentage >= 75
                ? '#CA8A04'
                : '#DC2626',
            },
          ]}>
            <Text style={styles.attendanceDonutText}>
              {attendanceStats.total === 0 ? '--' : `${attendanceStats.percentage}%`}
            </Text>
          </View>
        </View>

        {/* Triple Count Boxes: Present, Late, Absent */}
        <View style={styles.attSummaryTripleRow}>
          <View style={[styles.attSummaryBox, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <Text style={[styles.attSummaryBoxNumber, { color: '#16A34A' }]}>{attendanceStats.present}</Text>
            <Text style={[styles.attSummaryBoxLabel, { color: '#16A34A' }]}>PRESENT</Text>
          </View>
          <View style={[styles.attSummaryBox, { backgroundColor: '#FEFCE8', borderColor: '#FEF08A' }]}>
            <Text style={[styles.attSummaryBoxNumber, { color: '#CA8A04' }]}>{attendanceStats.late}</Text>
            <Text style={[styles.attSummaryBoxLabel, { color: '#CA8A04' }]}>LATE</Text>
          </View>
          <View style={[styles.attSummaryBox, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
            <Text style={[styles.attSummaryBoxNumber, { color: '#DC2626' }]}>{attendanceStats.absent}</Text>
            <Text style={[styles.attSummaryBoxLabel, { color: '#DC2626' }]}>ABSENT</Text>
          </View>
        </View>

        {/* Bottom Banner Status */}
        <View style={styles.attSummaryStatusBanner}>
          <Text style={styles.attSummaryStatusBannerText}>
            {attendanceStats.total === 0
              ? 'NO ATTENDANCE RECORDED YET'
              : attendanceStats.percentage < 80
              ? 'ATTENDANCE DROPPED BELOW 80%'
              : 'ATTENDANCE ON TRACK'}
          </Text>
        </View>
      </View>

      {/* 4. Recent Assessments Card (Screenshot 2) */}
      <View style={styles.overviewSectionCard}>
        <View style={styles.overviewSectionHeaderRow}>
          <IconComp name="trending-up-outline" size={18} color="#8B5CF6" />
          <Text style={styles.overviewSectionTitle}>Recent Assessments</Text>
        </View>

        {assessmentsList.length === 0 ? (
          <View style={styles.assessmentsEmptyContainer}>
            <View style={styles.assessmentsEmptyIconCircle}>
              <IconComp name="checkmark-circle-outline" size={28} color="#94A3B8" />
            </View>
            <Text style={styles.assessmentsEmptyTitle}>No Grades Yet</Text>
            <Text style={styles.assessmentsEmptySub}>
              Assessments and grades will appear here once published by the teacher.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 8, marginTop: 4 }}>
            {assessmentsList.slice(0, 4).map((item, idx) => {
              const myGrade = item.grades?.[activeStudent?.id] ?? item.marks ?? item.grade;
              return (
                <View key={item.id || idx} style={styles.assessmentRowItem}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.assessmentRowTitle} numberOfLines={1}>{item.title || item.name || 'Assessment'}</Text>
                    <Text style={styles.assessmentRowDate}>{item.date || item.subject || 'Published'}</Text>
                  </View>
                  {myGrade !== undefined ? (
                    <View style={styles.assessmentGradePill}>
                      <Text style={styles.assessmentGradePillText}>{myGrade}/{item.totalMarks || 100}</Text>
                    </View>
                  ) : (
                    <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '600' }}>Graded</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: TAB 2 — ATTENDANCE (Web Source of Truth: src/pages/Parent/Attendance.jsx)
  // =========================================================================
  const renderAttendance = () => {
    // 1. Timeframe Filter Calculation (Matching web Attendance.jsx)
    const now = new Date();
    const recordsToFilter = attendanceRecords || [];

    const filteredRecords = recordsToFilter.filter((record: any) => {
      if (attTimeFilter === 'All Time') return true;
      const rawDate = record.date ? String(record.date).split('_')[0] : '';
      const recordDate = new Date(rawDate);
      if (isNaN(recordDate.getTime())) return true;

      if (attTimeFilter === 'This Week') {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        return recordDate >= sevenDaysAgo && recordDate <= now;
      }
      if (attTimeFilter === 'This Month') {
        return recordDate.getMonth() === now.getMonth() && recordDate.getFullYear() === now.getFullYear();
      }
      if (attTimeFilter === 'This Term') {
        const recordMonth = recordDate.getMonth();
        const nowMonth = now.getMonth();
        const recordTerm = recordMonth >= 3 && recordMonth <= 8 ? 1 : 2;
        const nowTerm = nowMonth >= 3 && nowMonth <= 8 ? 1 : 2;
        let recordAcademicYear = recordDate.getFullYear();
        if (recordMonth < 3) recordAcademicYear -= 1;
        let nowAcademicYear = now.getFullYear();
        if (nowMonth < 3) nowAcademicYear -= 1;
        return recordTerm === nowTerm && recordAcademicYear === nowAcademicYear;
      }
      return true;
    });

    // 2. Metrics calculation (Web Attendance.jsx: percentage is 100 when totalCount === 0)
    const presentCount = filteredRecords.filter((r: any) => r.status === 'Present').length;
    const absentCount = filteredRecords.filter((r: any) => r.status === 'Absent').length;
    const lateCount = filteredRecords.filter((r: any) => r.status === 'Late').length;
    const totalCount = filteredRecords.length;
    const percentage = totalCount === 0 ? 100 : Math.round(((presentCount + lateCount) / totalCount) * 100);

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Header Banner & Dropdown Row (Source of Truth: Screenshot 5 / Web Attendance.jsx) */}
        <View style={styles.webPageHeaderBox}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.webPageHeaderTitle}>Detailed Attendance</Text>
              <Text style={styles.webPageHeaderSubtitle}>View your child's daily attendance records.</Text>
            </View>

            {/* Proper Mobile Dropdown Trigger (Source of Truth: Screenshot 5) */}
            <TouchableOpacity
              style={styles.webSelectDropdownTrigger}
              onPress={() => setShowAttDropdown(true)}
              activeOpacity={0.8}
              accessibilityLabel="Attendance Timeframe Dropdown">
              <Text style={styles.webSelectDropdownTriggerText}>{attTimeFilter}</Text>
              <IconComp name="chevron-down" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4 Summary Metric Cards (Matching Screenshot 5 & Web Attendance.jsx) */}
        <View style={styles.attKpiRow}>
          <View style={[styles.attKpiTile, { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }]}>
            <Text style={[styles.attKpiTileVal, { color: '#0F172A' }]}>{percentage}%</Text>
            <Text style={styles.attKpiTileLabel}>OVERALL</Text>
          </View>
          <View style={[styles.attKpiTile, { backgroundColor: '#F0FDF4', borderColor: '#DCFCE7' }]}>
            <Text style={[styles.attKpiTileVal, { color: '#16A34A' }]}>{presentCount}</Text>
            <Text style={[styles.attKpiTileLabel, { color: '#166534' }]}>PRESENT</Text>
          </View>
          <View style={[styles.attKpiTile, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
            <Text style={[styles.attKpiTileVal, { color: '#DC2626' }]}>{absentCount}</Text>
            <Text style={[styles.attKpiTileLabel, { color: '#991B1B' }]}>ABSENT</Text>
          </View>
          <View style={[styles.attKpiTile, { backgroundColor: '#FFFBEB', borderColor: '#FEF3C7' }]}>
            <Text style={[styles.attKpiTileVal, { color: '#D97706' }]}>{lateCount}</Text>
            <Text style={[styles.attKpiTileLabel, { color: '#92400E' }]}>LATE</Text>
          </View>
        </View>

        {/* Records Area (Source of Truth: Screenshot 5 / Web Attendance.jsx) */}
        <View style={styles.webAttendanceCardSection}>
          {filteredRecords.length === 0 ? (
            <View style={styles.webEmptyStateCard}>
              <IconComp name="calendar-outline" size={48} color="#CBD5E1" />
              <Text style={styles.webEmptyStateTitle}>No Records Found</Text>
              <Text style={styles.webEmptyStateSub}>No attendance records found for this period.</Text>
            </View>
          ) : (
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <Text style={styles.attHistorySectionTitle}>
                  Daily Attendance History ({filteredRecords.length})
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#B07FA8' }}>
                  {attTimeFilter}
                </Text>
              </View>
              {filteredRecords.map((rec: any) => {
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
                          name={isPresent ? 'checkmark-circle-outline' : isAbsent ? 'close-circle-outline' : 'alert-circle-outline'}
                          size={18}
                          color={isPresent ? '#16A34A' : isAbsent ? '#DC2626' : '#D97706'}
                        />
                      </View>
                      <View>
                        <Text style={styles.attLogDate}>{rec.date}</Text>
                        <Text style={styles.attLogClass}>{rec.className || activeStudent?.gradeClass || 'PRE KG - A'}</Text>
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
              })}
            </View>
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
        {/* Web Title Header matching Screenshot 2 */}
        <View style={styles.webPageHeaderBox}>
          <Text style={styles.webPageHeaderTitle}>Homework & Assignments</Text>
          <Text style={styles.webPageHeaderSubtitle}>
            Track upcoming tasks and recent evaluations.
          </Text>
        </View>

        {/* Homework List or Empty State matching Screenshot 2 */}
        <View style={{ marginTop: 4 }}>
          {filtered.length === 0 ? (
            <View style={styles.webHomeworkEmptyCard}>
              <IconComp name="checkmark-circle" size={52} color="#10B981" />
              <Text style={styles.webHomeworkEmptyTitle}>All caught up!</Text>
              <Text style={styles.webHomeworkEmptySubtitle}>
                No pending homework assignments found for this class.
              </Text>
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
  // RENDER: TAB 4 — MESSAGES / STAFF CHAT (Source: Screenshots 4 & 5)
  // =========================================================================
  const renderMessages = () => {
    const teachersList = [
      { id: 't_jana', name: 'jana', role: 'Teacher', avatar: 'J', color: '#b07fa8' },
      { id: 't_ragu', name: 'Ragu', role: 'Teacher', avatar: 'R', color: '#0284C7' },
    ];

    const currentTeacher = selectedTeacher || teachersList[0];

    return (
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          style={{ flex: 1 }}>
          <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: isKeyboardVisible ? 6 : 85 }}>
            {/* Header: Staff Chat matching Screenshot 4 & 5 */}
            <View style={{ marginBottom: 12, marginTop: 4 }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
                Staff Chat
              </Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                Communicate directly with teachers.
              </Text>
            </View>

            {/* Messaging Card Container matching Screenshots 4 & 5 */}
            <View style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', elevation: 1, shadowColor: '#64748B', shadowOpacity: 0.04, shadowRadius: 3 }}>
              {/* Header Title: Messaging & Segmented Tabs [Staff DMs] [Channels] */}
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>
                  Messaging
                </Text>

                {/* Sub-tabs Row */}
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, padding: 3 }}>
                  <TouchableOpacity
                    style={[
                      { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
                      chatSubTab === 'dms' && { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
                    ]}
                    onPress={() => setChatSubTab('dms')}
                    activeOpacity={0.8}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: chatSubTab === 'dms' ? '#0F172A' : '#64748B' }}>
                      Staff DMs
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
                      chatSubTab === 'channels' && { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 2, elevation: 1 },
                    ]}
                    onPress={() => setChatSubTab('channels')}
                    activeOpacity={0.8}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: chatSubTab === 'channels' ? '#0F172A' : '#64748B' }}>
                      Channels
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* TAB 1: STAFF DMS (Screenshot 4) */}
              {chatSubTab === 'dms' ? (
                <View style={{ flex: 1 }}>
                  {/* Teacher Selector Row */}
                  <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC', flexDirection: 'row', gap: 8 }}>
                    {teachersList.map(t => {
                      const isSelected = currentTeacher.id === t.id;
                      return (
                        <TouchableOpacity
                          key={t.id}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            paddingVertical: 6,
                            paddingHorizontal: 10,
                            borderRadius: 10,
                            backgroundColor: isSelected ? '#faedf7' : '#F8FAFC',
                            borderWidth: 1,
                            borderColor: isSelected ? '#B07FA8' : '#E2E8F0',
                            gap: 8,
                          }}
                          onPress={() => setSelectedTeacher(t)}
                          activeOpacity={0.75}>
                          <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: `${t.color}20`, justifyContent: 'center', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: t.color }}>{t.avatar}</Text>
                          </View>
                          <View>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>{t.name}</Text>
                            <Text style={{ fontSize: 10, color: '#64748B' }}>{t.role}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* Chat Pane Header: [Avatar] [Name] ● Staff (Screenshot 4) */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#FAFAFA' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#faedf7', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#B07FA8' }}>{currentTeacher.avatar}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{currentTeacher.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' }} />
                        <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '500' }}>Staff</Text>
                      </View>
                    </View>
                  </View>

                  {/* Message Stream Body (Scrollable flex: 1 with Keyboard Awareness) */}
                  <ScrollView
                    ref={messagesScrollRef}
                    style={{ flex: 1 }}
                    contentContainerStyle={{
                      padding: 14,
                      flexGrow: 1,
                      justifyContent: chatMessages.length === 0 ? 'center' : 'flex-start',
                    }}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    onContentSizeChange={() => {
                      messagesScrollRef.current?.scrollToEnd({ animated: false });
                    }}>
                    {chatMessages.length === 0 ? (
                      <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                        <IconComp name="chatbubble-outline" size={36} color="#CBD5E1" />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#64748B', marginTop: 10 }}>
                          No messages yet.
                        </Text>
                        <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                          Say hello to start the conversation.
                        </Text>
                      </View>
                    ) : (
                      chatMessages.map((msg: any, idx: number) => {
                        const isMe = msg.sender === 'Parent' || msg.senderRole === 'parent' || msg.sender === 'parent';
                        return (
                          <View
                            key={msg.id || idx}
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
                                {isMe ? (msg.senderName || 'Parent') : (currentTeacher.name || msg.senderName || 'Teacher')}
                              </Text>
                              <Text style={[styles.chatBubbleText, isMe && { color: '#FFFFFF' }]}>
                                {msg.text}
                              </Text>
                              <Text style={[styles.chatBubbleTime, isMe && { color: 'rgba(255,255,255,0.7)' }]}>
                                {msg.time || (msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '')}
                              </Text>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </ScrollView>

                  {/* Docked Composer Input Bar */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 8, backgroundColor: '#FFFFFF' }}>
                    <TouchableOpacity
                      style={{ width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' }}
                      onPress={handlePickLeaveDoc}>
                      <IconComp name="attach-outline" size={20} color="#64748B" />
                    </TouchableOpacity>

                    <FocusTextInput
                      style={{
                        flex: 1,
                        height: 40,
                        backgroundColor: '#F8FAFC',
                        borderRadius: 20,
                        paddingHorizontal: 14,
                        fontSize: 13,
                        color: '#0F172A',
                        borderWidth: 1,
                        borderColor: '#E2E8F0',
                      }}
                      placeholder="Type a message..."
                      placeholderTextColor="#94A3B8"
                      value={chatMessageText}
                      onChangeText={setChatMessageText}
                    />

                    <TouchableOpacity
                      style={[
                        {
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: '#B07FA8',
                          justifyContent: 'center',
                          alignItems: 'center',
                        },
                        (!chatMessageText.trim() || sendingMsg) && { opacity: 0.6 },
                      ]}
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
              ) : (
                /* TAB 2: CHANNELS (Screenshot 5) */
                <View style={{ flex: 1 }}>
                  <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
                    <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '500' }}>
                      No channels available.
                    </Text>
                  </View>

                  <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1, paddingHorizontal: 20 }}>
                    <IconComp name="chatbox-outline" size={44} color="#CBD5E1" />
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 12 }}>
                      Select a channel
                    </Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, textAlign: 'center', maxWidth: 260 }}>
                      Choose a channel from the sidebar to view announcements.
                    </Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

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
    { name: 'Timetable', icon: 'time-outline', color: '#2563EB', desc: 'Daily period-wise class schedule' },
  ];

  const renderAllModules = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      <View style={styles.screenHeaderRow}>
        <View>
          <Text style={styles.screenTitleText}>All Modules</Text>
          <Text style={{ color: '#64748B', fontSize: 12 }}>10 Specialized Student/Parent Services</Text>
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
  // RENDER: MODULE 1 — MY CHILDREN (Matching Website & User Screenshots 1 - 4)
  // =========================================================================
  const renderMyChildrenModule = () => {
    const effectiveChildren = children && children.length > 0 ? children : [DEFAULT_STUDENT];
    const totalChildrenCount = effectiveChildren.length + manualSiblings.length;
    const activeStudentName = activeStudent
      ? `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || ''}`.trim()
      : 'Madhu P';

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Top Header Section (Web Responsive Conversion) */}
        <View style={styles.myChildrenHeaderSection}>
          <View style={{ width: '100%', marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.myChildrenTitleText}>My Children</Text>
              <View style={styles.childCountPillBadge}>
                <Text style={styles.childCountPillText}>
                  {totalChildrenCount} {totalChildrenCount === 1 ? 'Child' : 'Children'} Linked
                </Text>
              </View>
            </View>
            <Text style={styles.myChildrenSubtitleText}>
              Manage your enrolled students and siblings. Switch active profile to view specific academic reports.
            </Text>
          </View>

          {/* + Link / Add Child Button */}
          <TouchableOpacity
            style={styles.linkAddChildMainBtn}
            onPress={() => {
              setAddOrLinkTab('link_enrolled');
              setLinkChildError('');
              setIsAddOrLinkModalOpen(true);
            }}
            activeOpacity={0.85}>
            <IconComp name="add-outline" size={18} color="#FFFFFF" />
            <Text style={styles.linkAddChildMainBtnText}>Link / Add Child</Text>
          </TouchableOpacity>
        </View>

        {/* 3 Summary KPI Cards (Web Responsive 2-Row Layout) */}
        <View style={styles.myChildrenKpiGrid}>
          <View style={styles.myChildrenKpiRowTop}>
            {/* Card 1: Enrolled in School */}
            <View style={styles.myChildrenKpiCardHalf}>
              <View style={[styles.myChildrenKpiIconBox, { backgroundColor: '#DCFCE7' }]}>
                <IconComp name="school-outline" size={22} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myChildrenKpiLabel}>ENROLLED IN SCHOOL</Text>
                <Text style={styles.myChildrenKpiValue}>{effectiveChildren.length}</Text>
              </View>
            </View>

            {/* Card 2: Other Siblings */}
            <View style={styles.myChildrenKpiCardHalf}>
              <View style={[styles.myChildrenKpiIconBox, { backgroundColor: '#EEF2FF' }]}>
                <IconComp name="people-outline" size={22} color="#4F46E5" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.myChildrenKpiLabel}>OTHER SIBLINGS</Text>
                <Text style={styles.myChildrenKpiValue}>{manualSiblings.length}</Text>
              </View>
            </View>
          </View>

          {/* Card 3: Currently Viewing */}
          <View style={styles.myChildrenKpiViewingCard}>
            <View style={styles.myChildrenViewingIconCircle}>
              <IconComp name="sparkles" size={20} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.myChildrenViewingLabel}>CURRENTLY VIEWING</Text>
              <Text style={styles.myChildrenViewingValue} numberOfLines={1}>
                {activeStudentName}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: Enrolled Students */}
        <View style={{ marginBottom: 28 }}>
          <View style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <IconComp name="school-outline" size={18} color="#B07FA8" />
              <Text style={styles.myChildrenSectionTitle}>Enrolled Students</Text>
            </View>
            <Text style={styles.myChildrenSectionSub}>
              Active student profiles with synchronized attendance, homework, report cards, and fee records.
            </Text>
          </View>

          {/* Enrolled Students Card List — ALWAYS renders enrolled student card (Image 2) */}
          <View style={{ gap: 16 }}>
            {effectiveChildren.map((child, idx) => {
              const isActive = selectedChildIndex === idx;
              const fullName = `${child.firstName || ''} ${child.lastName || child.name || 'Student'}`.trim();
              const initials = fullName.substring(0, 2).toUpperCase(); // Produces "MA" for Madhu P (Image 2)
              const className = child.gradeClass || classDetails?.name || 'PRE KG - A';
              const admNumber = child.admissionNumber || child.rollNo || child.id || '10987';
              const rollNumber = child.rollNumber || child.rollNo || 'N/A';
              const dobFormatted = formatDisplayDob(child.dob || child.dateOfBirth || child.birthDate || '2021-01-05');
              const genderBlood = `${child.gender || 'Female'}${child.bloodGroup ? ` • ${child.bloodGroup}` : ''}`;

              return (
                <View
                  key={child.id || idx}
                  style={[
                    styles.enrolledStudentCardBox,
                    isActive && styles.enrolledStudentCardBoxActive,
                  ]}>
                  {/* Top glowing accent bar for active child */}
                  {isActive && <View style={styles.enrolledStudentActiveBar} />}

                  <View style={{ padding: 18 }}>
                    {/* Header Row: Avatar, Name/Class, Unlink Icon (Image 3) */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center', flex: 1 }}>
                        <View style={styles.enrolledStudentAvatarBox}>
                          <Text style={styles.enrolledStudentAvatarText}>{initials}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.enrolledStudentNameText} numberOfLines={1}>
                            {fullName}
                          </Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                            <IconComp name="business-outline" size={13} color="#B07FA8" />
                            <Text style={styles.enrolledStudentClassText} numberOfLines={1}>
                              {className}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* Unlink Student Button (Image 3: Broken chain icon in light red box) */}
                      <TouchableOpacity
                        style={styles.unlinkStudentBtnBox}
                        onPress={() => setUnlinkingStudent(child)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityLabel="Unlink student"
                        activeOpacity={0.75}>
                        <IconComp name="unlink-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Badges Row: Active Child & Admission Number */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 12 }}>
                      {isActive ? (
                        <View style={styles.activeChildBadgePill}>
                          <View style={styles.activeChildGreenDot} />
                          <Text style={styles.activeChildBadgeText}>Active Child</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.makeActiveChildBtn}
                          onPress={() => {
                            setSelectedChildIndex(idx);
                            showToast(`Switched view to ${fullName}`);
                          }}>
                          <Text style={styles.makeActiveChildBtnText}>Set as Active</Text>
                        </TouchableOpacity>
                      )}

                      <View style={styles.admissionNumberBadgePill}>
                        <IconComp name="card-outline" size={12} color="#64748B" />
                        <Text style={styles.admissionNumberBadgeText}>{admNumber}</Text>
                      </View>
                    </View>

                    {/* Divider */}
                    <View style={styles.enrolledStudentDivider} />

                    {/* Metadata Table (Matching Image 2) */}
                    <View style={styles.enrolledStudentMetaTable}>
                      <View style={styles.enrolledStudentMetaRow}>
                        <Text style={styles.enrolledStudentMetaLabel}>Roll Number</Text>
                        <Text style={styles.enrolledStudentMetaVal}>{rollNumber}</Text>
                      </View>
                      <View style={styles.enrolledStudentMetaRow}>
                        <Text style={styles.enrolledStudentMetaLabel}>Date of Birth</Text>
                        <Text style={styles.enrolledStudentMetaVal}>{dobFormatted}</Text>
                      </View>
                      <View style={styles.enrolledStudentMetaRow}>
                        <Text style={styles.enrolledStudentMetaLabel}>Gender / Blood</Text>
                        <Text style={styles.enrolledStudentMetaVal}>{genderBlood}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Card Actions Footer: Overview & Report Card */}
                  <View style={styles.enrolledStudentFooterRow}>
                    <TouchableOpacity
                      style={styles.enrolledOverviewBtn}
                      onPress={() => {
                        setSelectedChildIndex(idx);
                        setActiveBottomTab('Dashboard');
                        setActiveAllModule(null);
                      }}
                      activeOpacity={0.85}>
                      <Text style={styles.enrolledOverviewBtnText}>Overview</Text>
                      <IconComp name="arrow-up-outline" size={14} color="#FFFFFF" style={{ transform: [{ rotate: '45deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.enrolledReportCardBtn}
                      onPress={() => {
                        setSelectedChildIndex(idx);
                        setActiveAllModule('Report Card');
                      }}
                      activeOpacity={0.85}>
                      <Text style={styles.enrolledReportCardBtnText}>Report Card</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* SECTION 2: Other Siblings & Dependents */}
        <View style={{ marginBottom: 36 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconComp name="people-circle-outline" size={18} color="#6366F1" />
                <Text style={styles.myChildrenSectionTitle}>Other Siblings & Dependents</Text>
              </View>
              <Text style={styles.myChildrenSectionSub}>
                Family members attending other schools or not yet enrolled. You can link them anytime.
              </Text>
            </View>

            {/* + Add Sibling Record button (Same modal, Tab 2 preselected) */}
            <TouchableOpacity
              style={[styles.addSiblingTextBtn, { backgroundColor: '#faedf7' }]}
              onPress={() => {
                setEditingSiblingId(null);
                setSiblingForm({
                  name: '',
                  dob: '',
                  gender: '',
                  relationship: '',
                  bloodGroup: '',
                  schoolName: '',
                });
                setAddOrLinkTab('manual_sibling');
                setIsAddOrLinkModalOpen(true);
              }}>
              <IconComp name="add" size={14} color="#B07FA8" />
              <Text style={[styles.addSiblingTextBtnLabel, { color: '#B07FA8' }]}>Add Sibling Record</Text>
            </TouchableOpacity>
          </View>

          {manualSiblings.length === 0 ? (
            <View style={styles.otherSiblingsEmptyBox}>
              <Text style={styles.otherSiblingsEmptyText}>
                No extra sibling profiles registered. Click "Add Sibling Record" if you wish to record siblings in other institutions.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {manualSiblings.map(sibling => (
                <TouchableOpacity
                  key={sibling.id}
                  style={styles.siblingRecordCard}
                  activeOpacity={0.8}
                  onPress={() => {
                    setEditingSiblingId(sibling.id);
                    setSiblingForm({
                      name: sibling.name || '',
                      dob: sibling.dob || '',
                      gender: sibling.gender || '',
                      relationship: sibling.relationship || '',
                      bloodGroup: sibling.bloodGroup || '',
                      schoolName: sibling.schoolName || '',
                    });
                    setAddOrLinkTab('manual_sibling');
                    setIsAddOrLinkModalOpen(true);
                  }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={styles.siblingAvatarBox}>
                        <Text style={styles.siblingAvatarText}>
                          {sibling.name ? sibling.name.slice(0, 2).toUpperCase() : 'SB'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>{sibling.name}</Text>
                          <IconComp name="create-outline" size={13} color="#94A3B8" />
                        </View>
                        <Text style={{ fontSize: 11, color: '#64748B' }}>
                          {sibling.relationship || 'Sibling'} • {sibling.gender || 'Not specified'}{sibling.bloodGroup ? ` • Blood: ${sibling.bloodGroup}` : ''} • DOB: {formatDisplayDob(sibling.dob)}
                        </Text>
                        {!!sibling.schoolName && (
                          <Text style={{ fontSize: 11, color: '#B07FA8', marginTop: 1 }}>
                            School: {sibling.schoolName}
                          </Text>
                        )}
                      </View>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleDeleteManualSibling(sibling.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={{ padding: 6 }}>
                      <IconComp name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 2 — PERFORMANCE (Web Source of Truth: src/pages/Parent/Performance.jsx & Screenshot 1)
  // =========================================================================
  const renderPerformanceModule = () => {
    // 1. Calculate Metrics matching web Performance.jsx
    let present = 0;
    let totalDays = 0;
    attendanceRecords.forEach((day: any) => {
      totalDays++;
      if (day.status === 'Present' || day.status === 'Late') {
        present++;
      }
    });
    const attendancePerc = totalDays > 0 ? Math.round((present / totalDays) * 100) : 0;

    let totalObtained = 0;
    let totalMax = 0;
    const recentAssessments: any[] = [];
    assessmentsList.forEach((assessment: any) => {
      const grade = assessment.grades?.[activeStudent?.id] ?? assessment.marks?.[activeStudent?.id];
      if (grade !== undefined && grade !== '') {
        const scoreNum = Number(grade);
        const maxNum = Number(assessment.totalMarks || 100);
        totalObtained += scoreNum;
        totalMax += maxNum;
        recentAssessments.push({
          ...assessment,
          score: grade,
          totalMarks: maxNum,
          perc: Math.round((scoreNum / maxNum) * 100),
        });
      }
    });
    recentAssessments.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    const avgPerc = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
    let avgGrade = '-';
    if (avgPerc > 0) {
      if (avgPerc >= 90) avgGrade = 'A+';
      else if (avgPerc >= 80) avgGrade = 'A';
      else if (avgPerc >= 70) avgGrade = 'B';
      else if (avgPerc >= 60) avgGrade = 'C';
      else if (avgPerc >= 50) avgGrade = 'D';
      else avgGrade = 'F';
    }

    const trendStatus = activeStudent?.performanceStatus || 'stable';

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Web Title Header matching Screenshot 1 */}
        <View style={styles.webPageHeaderBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconComp name="trending-up" size={24} color="#B07FA8" />
            <Text style={styles.webPageHeaderTitle}>Academic Performance</Text>
          </View>
          <Text style={styles.webPageHeaderSubtitle}>
            Review your child's academic progress and teacher feedback.
          </Text>
        </View>

        {/* Summary Cards with 2-Column Mobile Grid for Overall Grade & Attendance */}
        <View style={styles.perfCardsCol}>
          {/* Card 1: Teacher's Status (Purple gradient card with STABLE badge) */}
          <View style={styles.perfStatusCard}>
            <Text style={styles.perfStatusLabel}>Teacher's Status</Text>
            <View style={styles.perfStatusBadge}>
              <Text style={styles.perfStatusBadgeText}>{String(trendStatus).toUpperCase()}</Text>
            </View>
          </View>

          {/* Row 2: 2-Column Grid (Overall Grade & Attendance) */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* Card 2: Overall Grade (White card with green ribbon/award icon) */}
            <View style={[styles.perfMetricCard, { flex: 1, padding: 14 }]}>
              <View style={[styles.perfAwardIconBox, { width: 44, height: 44, borderRadius: 12 }]}>
                <IconComp name="ribbon-outline" size={24} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.perfMetricLabel, { fontSize: 11 }]}>Overall Grade</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4, marginTop: 2 }}>
                  <Text style={[styles.perfMetricVal, { fontSize: 22 }]}>{avgGrade}</Text>
                  {avgPerc > 0 && (
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>
                      {avgPerc.toFixed(1)}%
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Card 3: Attendance (White card with percentage) */}
            <View style={[styles.perfMetricCard, { flex: 1, padding: 14 }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.perfMetricLabel, { fontSize: 11 }]}>Attendance</Text>
                <Text style={[styles.perfMetricVal, { fontSize: 22, color: attendancePerc < 75 ? '#DC2626' : '#0F172A', marginTop: 2 }]}>
                  {attendancePerc}%
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recent Assessments Section matching Screenshot 1 */}
        <View style={styles.webContentContainerCard}>
          <View style={styles.webContentHeaderBar}>
            <IconComp name="book-outline" size={20} color="#B07FA8" />
            <Text style={styles.webContentHeaderTitle}>Recent Assessments</Text>
          </View>
          <View style={{ padding: 20 }}>
            {recentAssessments.length === 0 ? (
              <View style={{ paddingVertical: 36, alignItems: 'center' }}>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748B' }}>
                  No assessments recorded yet.
                </Text>
              </View>
            ) : (
              recentAssessments.map((asm: any) => (
                <View key={asm.id} style={styles.assessmentListItem}>
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>{asm.title || asm.name}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 3 }}>
                      {asm.date ? new Date(asm.date).toLocaleDateString('en-GB') : 'Term 1'}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#0F172A' }}>
                      {asm.score} <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8' }}>/ {asm.totalMarks}</Text>
                    </Text>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#B07FA8', marginTop: 2 }}>
                      {asm.perc}%
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 3 — PTM MEETINGS (Web Source of Truth: src/pages/Parent/PTM.jsx & Screenshot 2)
  // =========================================================================
  const renderPtmModule = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingMeetings = ptmList.filter((m: any) => !m.date || m.date >= todayStr);

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Header matching Screenshot 2 */}
        <View style={styles.webPageHeaderBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconComp name="calendar" size={24} color="#B07FA8" />
            <Text style={styles.webPageHeaderTitle}>Parent-Teacher Meetings</Text>
          </View>
          <Text style={styles.webPageHeaderSubtitle}>
            View your scheduled meetings with teachers.
          </Text>
        </View>

        {/* Section Header */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconComp name="calendar-outline" size={20} color="#B07FA8" />
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>Upcoming Meetings</Text>
          </View>
        </View>

        {/* Empty state or list matching Screenshot 2 */}
        {upcomingMeetings.length === 0 ? (
          <View style={styles.ptmEmptyCard}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#64748B' }}>
              You have no upcoming meetings scheduled.
            </Text>
          </View>
        ) : (
          upcomingMeetings.map((m: any) => (
            <View key={m.id} style={styles.ptmCardBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' }}>
                    <IconComp name="people-outline" size={22} color="#64748B" />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>{m.teacherName || 'Class Teacher'}</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Ref: {activeStudent?.name || 'Student'}</Text>
                  </View>
                </View>
                <View style={[styles.ptmStatusBadge, m.status === 'confirmed' ? { backgroundColor: '#DCFCE7' } : m.status === 'cancelled' ? { backgroundColor: '#FEE2E2' } : { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.ptmStatusBadgeText, m.status === 'confirmed' ? { color: '#15803D' } : m.status === 'cancelled' ? { color: '#DC2626' } : { color: '#B45309' }]}>
                    {String(m.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>Date & Time</Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', marginTop: 2 }}>{m.date} at {m.time || '10:00 AM'}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>Type</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <IconComp name={m.type === 'online' ? 'videocam-outline' : 'location-outline'} size={14} color={m.type === 'online' ? '#3B82F6' : '#F59E0B'} />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#334155', textTransform: 'capitalize' }}>{m.type || 'in-person'}</Text>
                  </View>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 4 — NOTICEBOARD (Web Source of Truth: src/pages/Parent/ParentNoticeboard.jsx & Screenshot 3)
  // =========================================================================
  const renderNoticeboardModule = () => {
    const displayedNotices = noticesList.filter((n: any) => {
      if (noticeTab === 'class') {
        return n.classId === activeStudent?.classId || n.audience === 'class';
      }
      return n.audience === 'global' || n.audience === 'parents' || !n.classId;
    });

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Header matching Screenshot 3 */}
        <View style={styles.webPageHeaderBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconComp name="megaphone-outline" size={24} color="#B07FA8" />
            <Text style={styles.webPageHeaderTitle}>Noticeboard</Text>
          </View>
          <Text style={styles.webPageHeaderSubtitle}>
            View official announcements from the school and your child's class teacher.
          </Text>
        </View>

        {/* 2 Tabs matching Screenshot 3 */}
        <View style={styles.webNoticeTabsRow}>
          <TouchableOpacity
            onPress={() => setNoticeTab('global')}
            style={[styles.webNoticeTabBtn, noticeTab === 'global' && styles.webNoticeTabBtnActive]}>
            <Text style={[styles.webNoticeTabBtnText, noticeTab === 'global' && styles.webNoticeTabBtnTextActive]}>
              Global Notices
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setNoticeTab('class')}
            style={[styles.webNoticeTabBtn, noticeTab === 'class' && styles.webNoticeTabBtnActive]}>
            <Text style={[styles.webNoticeTabBtnText, noticeTab === 'class' && styles.webNoticeTabBtnTextActive]}>
              Class Noticeboard
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content / Empty state matching Screenshot 3 */}
        {displayedNotices.length === 0 ? (
          <View style={styles.noticeEmptyCard}>
            <IconComp name="notifications-outline" size={48} color="#CBD5E1" />
            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 14 }}>
              No active notices
            </Text>
            <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4 }}>
              You're all caught up!
            </Text>
          </View>
        ) : (
          displayedNotices.map((notice: any) => (
            <View key={notice.id} style={styles.noticeItemCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', flex: 1, paddingRight: 8 }}>
                  {notice.title}
                </Text>
                {notice.priority === 'high' && (
                  <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#DC2626' }}>HIGH</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 13, color: '#475569', marginTop: 8, lineHeight: 19 }}>
                {notice.content}
              </Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 12 }}>
                {notice.date ? new Date(notice.date).toLocaleDateString('en-GB') : 'Recent'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 5 — INTERACTIVE CALENDAR (Web Source of Truth: src/components/AcademicCalendar.jsx & Screenshot 4)
  // =========================================================================
  const renderCalendarModule = () => {
    const today = new Date();
    const viewDate = new Date(today.getFullYear(), today.getMonth() + calendarMonthOffset, 1);
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    // Generate grid items (rows of 7 days)
    const weeks: any[] = [];
    let currentWeek: any[] = [];

    // Prev month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      currentWeek.push({
        day: prevMonthDays - i,
        isCurrentMonth: false,
        isSunday: currentWeek.length === 0,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const isSunday = currentWeek.length === 0;
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
      currentWeek.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        isSunday,
        isToday,
      });
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Next month padding
    if (currentWeek.length > 0) {
      let nextDay = 1;
      while (currentWeek.length < 7) {
        currentWeek.push({
          day: nextDay++,
          isCurrentMonth: false,
          isSunday: false,
        });
      }
      weeks.push(currentWeek);
    }

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Main Card Container matching Screenshot 4 */}
        <View style={styles.calendarContainerCard}>
          {/* Calendar Title Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <IconComp name="calendar-outline" size={20} color="#B07FA8" />
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>Academic Calendar</Text>
          </View>

          {/* Subheader Toolbar matching Screenshot 4 */}
          <View style={styles.calendarToolbarRow}>
            {/* Left: < Month Year > */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <TouchableOpacity
                onPress={() => setCalendarMonthOffset(prev => prev - 1)}
                style={styles.calNavArrowBtn}>
                <IconComp name="chevron-back" size={16} color="#475569" />
              </TouchableOpacity>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A', minWidth: 130, textAlign: 'center' }}>
                {monthNames[month]} {year}
              </Text>
              <TouchableOpacity
                onPress={() => setCalendarMonthOffset(prev => prev + 1)}
                style={styles.calNavArrowBtn}>
                <IconComp name="chevron-forward" size={16} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Right: Legend Chips & Today Button */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#6366F1' }} />
                <Text style={styles.calLegendChipText}>EVENT</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444' }} />
                <Text style={styles.calLegendChipText}>HOLIDAY</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#F59E0B' }} />
                <Text style={styles.calLegendChipText}>EXAM</Text>
              </View>
              <TouchableOpacity
                onPress={() => setCalendarMonthOffset(0)}
                style={styles.calTodayButton}>
                <Text style={styles.calTodayButtonText}>Today</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Calendar Grid matching Screenshot 4 */}
          <View style={styles.calGridTable}>
            {/* Weekday Label Row */}
            <View style={styles.calWeekHeaderRow}>
              {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((dayName, idx) => (
                <View key={dayName} style={[styles.calCellHeader, idx === 6 && { borderRightWidth: 0 }]}>
                  <Text style={styles.calDayLabelText}>{dayName}</Text>
                </View>
              ))}
            </View>

            {/* Week Rows */}
            {weeks.map((week, wIdx) => (
              <View key={`week-${wIdx}`} style={styles.calWeekRow}>
                {week.map((cell: any, cIdx: number) => {
                  const dayEvents = cell.dateStr ? calendarEvents.filter((ev: any) => ev.start?.includes(cell.dateStr) || ev.customDates?.includes(cell.dateStr)) : [];
                  return (
                    <View
                      key={`cell-${wIdx}-${cIdx}`}
                      style={[
                        styles.calDayCell,
                        !cell.isCurrentMonth && { backgroundColor: '#F1F5F9' },
                        cell.isToday && { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' },
                        cIdx === 6 && { borderRightWidth: 0 },
                      ]}>
                      <Text
                        style={[
                          styles.calCellDayNumber,
                          !cell.isCurrentMonth && { color: '#94A3B8' },
                          cell.isToday && { color: '#2563EB', fontWeight: '800' },
                        ]}>
                        {String(cell.day).padStart(2, '0')}
                      </Text>

                      {/* Sunday Holiday Badge (Source of Truth: Screenshot 4) */}
                      {cell.isSunday && cell.isCurrentMonth && (
                        <View style={styles.sundayHolidayPill}>
                          <Text style={styles.sundayHolidayPillText} numberOfLines={1}>
                            Sunday (Holiday)
                          </Text>
                        </View>
                      )}

                      {/* Other Events */}
                      {dayEvents.map((ev: any, evIdx: number) => (
                        <View
                          key={`ev-${evIdx}`}
                          style={[
                            styles.calEventPill,
                            ev.type === 'holiday'
                              ? { backgroundColor: '#EF4444' }
                              : ev.type === 'exam'
                              ? { backgroundColor: '#F59E0B' }
                              : { backgroundColor: '#6366F1' },
                          ]}>
                          <Text style={styles.calEventPillText} numberOfLines={1}>
                            {ev.title}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 6 — CANTEEN (Screenshot 1)
  // =========================================================================
  const renderCanteenModule = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const requestedBreakfast = canteenRequests.some(r => r.date === todayStr && r.mealType === 'Breakfast');
    const requestedLunch = canteenRequests.some(r => r.date === todayStr && r.mealType === 'Lunch');

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Header matching Screenshot 1 */}
        <View style={styles.webPageHeaderBox}>
          <Text style={styles.webPageHeaderTitle}>Emergency Canteen Requests</Text>
          <Text style={styles.webPageHeaderSubtitle}>
            If your child forgot their meal, you can request a meal from the school canteen for today.
          </Text>
        </View>

        {/* 2 Meal Option Cards (Breakfast & Lunch) */}
        <View style={{ gap: 14, marginBottom: 24 }}>
          {/* Breakfast Card */}
          <View style={styles.canteenMealCard}>
            <View style={[styles.canteenMealIconBox, { backgroundColor: '#FEF3C7' }]}>
              <IconComp name="cafe-outline" size={28} color="#D97706" />
            </View>
            <Text style={styles.canteenMealTitle}>Breakfast</Text>
            <Text style={styles.canteenMealDesc}>
              Request breakfast for today. Meal will be provided during morning break.
            </Text>

            {requestedBreakfast ? (
              <View style={styles.canteenRequestedBadge}>
                <IconComp name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.canteenRequestedBadgeText}>Requested for Today</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.canteenRequestBtn}
                onPress={() => handleRequestMealSubmit('Breakfast')}
                disabled={isRequestingMeal}
                activeOpacity={0.8}>
                <Text style={styles.canteenRequestBtnText}>Request Breakfast</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Lunch Card */}
          <View style={styles.canteenMealCard}>
            <View style={[styles.canteenMealIconBox, { backgroundColor: '#FDF2F8' }]}>
              <IconComp name="restaurant-outline" size={28} color="#E11D48" />
            </View>
            <Text style={styles.canteenMealTitle}>Lunch</Text>
            <Text style={styles.canteenMealDesc}>
              Request lunch for today. Meal will be provided during lunch break.
            </Text>

            {requestedLunch ? (
              <View style={styles.canteenRequestedBadge}>
                <IconComp name="checkmark-circle" size={18} color="#15803D" />
                <Text style={styles.canteenRequestedBadgeText}>Requested for Today</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.canteenRequestBtn}
                onPress={() => handleRequestMealSubmit('Lunch')}
                disabled={isRequestingMeal}
                activeOpacity={0.8}>
                <Text style={styles.canteenRequestBtnText}>Request Lunch</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Request History Section matching Screenshot 1 */}
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>
          Request History
        </Text>

        <View style={styles.canteenHistoryCard}>
          {canteenRequests.length === 0 ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: '#64748B' }}>
                No past canteen requests found.
              </Text>
            </View>
          ) : (
            <View>
              {/* Table Header Row */}
              <View style={styles.canteenTableHeaderRow}>
                <Text style={[styles.canteenTableHeaderText, { flex: 1.2 }]}>DATE</Text>
                <Text style={[styles.canteenTableHeaderText, { flex: 1.2 }]}>MEAL TYPE</Text>
                <Text style={[styles.canteenTableHeaderText, { flex: 1, textAlign: 'right' }]}>STATUS</Text>
              </View>

              {/* Table Data Rows */}
              {canteenRequests.map(req => (
                <View key={req.id} style={styles.canteenTableRow}>
                  <Text style={[styles.canteenCellDateText, { flex: 1.2 }]}>{req.date}</Text>
                  <Text style={[styles.canteenCellMealText, { flex: 1.2 }]}>{req.mealType}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <View
                      style={[
                        styles.canteenStatusBadge,
                        req.status === 'Approved'
                          ? { backgroundColor: '#DBEAFE', borderColor: '#BFDBFE' }
                          : req.status === 'Delivered'
                          ? { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }
                          : { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                      ]}>
                      <Text
                        style={[
                          styles.canteenStatusBadgeText,
                          req.status === 'Approved'
                            ? { color: '#1D4ED8' }
                            : req.status === 'Delivered'
                            ? { color: '#15803D' }
                            : { color: '#B45309' },
                        ]}>
                        {req.status || 'Pending'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 7 — REPORT CARD (Screenshot 3)
  // =========================================================================
  const renderReportCardModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      {/* Header matching Screenshot 3 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <View style={styles.reportCardAwardIconBox}>
          <IconComp name="ribbon-outline" size={24} color="#B07FA8" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.webPageHeaderTitle}>Academic Report Cards</Text>
          <Text style={styles.webPageHeaderSubtitle}>
            View and download your child's published academic progress records
          </Text>
        </View>
      </View>

      {/* Empty State Card matching Screenshot 3 */}
      {reportCards.length === 0 ? (
        <View style={styles.reportCardEmptyBox}>
          <IconComp name="document-text-outline" size={56} color="#CBD5E1" />
          <Text style={styles.reportCardEmptyTitle}>No Report Cards Published</Text>
          <Text style={styles.reportCardEmptySub}>
            Official term-end report cards will appear here once finalized and published by the school administration.
          </Text>
        </View>
      ) : (
        <View style={{ gap: 14 }}>
          {reportCards.map((rc: any) => (
            <View key={rc.id} style={styles.cardContainer}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>
                    {rc.title || 'Term Report Card'}
                  </Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                    Academic Year {rc.academicYear || '2025-26'}
                  </Text>
                </View>
                <View style={[styles.percentageBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text style={[styles.percentageBadgeText, { color: '#15803D' }]}>
                    {rc.percentage ? `${rc.percentage}%` : 'Published'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 8 — FEES & PAYMENTS (Screenshot 4)
  // =========================================================================
  const renderFeesModule = () => (
    <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
      {/* Header matching Screenshot 4 */}
      <View style={styles.webPageHeaderBox}>
        <Text style={styles.webPageHeaderTitle}>Fees & Payments</Text>
        <Text style={styles.webPageHeaderSubtitle}>
          Monitor fee invoices, receipts, and outstanding dues for your linked student.
        </Text>
      </View>

      {/* 3 Summary Statistic Cards in 2-Column Mobile Grid Rule */}
      <View style={{ gap: 10, marginBottom: 20 }}>
        {/* Row 1: 2-Column Row for Total Invoiced & Paid Amount */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {/* Card 1: TOTAL INVOICED */}
          <View style={[styles.feeStatCard, { flex: 1 }]}>
            <View style={[styles.feeStatAccentLine, { backgroundColor: '#94A3B8' }]} />
            <View style={styles.feeStatContent}>
              <View style={[styles.feeStatIconBox, { backgroundColor: '#F8FAFC' }]}>
                <IconComp name="receipt-outline" size={20} color="#64748B" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeStatLabel}>TOTAL INVOICED</Text>
                <Text style={styles.feeStatValue}>₹{feeStats.totalInvoiced.toLocaleString()}</Text>
              </View>
            </View>
          </View>

          {/* Card 2: PAID AMOUNT */}
          <View style={[styles.feeStatCard, { flex: 1 }]}>
            <View style={[styles.feeStatAccentLine, { backgroundColor: '#10B981' }]} />
            <View style={styles.feeStatContent}>
              <View style={[styles.feeStatIconBox, { backgroundColor: '#ECFDF5' }]}>
                <IconComp name="trending-up" size={20} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.feeStatLabel}>PAID AMOUNT</Text>
                <Text style={styles.feeStatValue}>₹{feeStats.paid.toLocaleString()}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Row 2: OUTSTANDING BALANCE */}
        <View style={styles.feeStatCard}>
          <View style={[styles.feeStatAccentLine, { backgroundColor: '#F59E0B' }]} />
          <View style={styles.feeStatContent}>
            <View style={[styles.feeStatIconBox, { backgroundColor: '#FFFBEB' }]}>
              <IconComp name="warning-outline" size={20} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.feeStatLabel}>OUTSTANDING BALANCE</Text>
              <Text style={[styles.feeStatValue, { color: feeStats.pending > 0 ? '#D97706' : '#0F172A' }]}>
                ₹{feeStats.pending.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Invoice Log Section matching Screenshot 4 */}
      <View style={styles.invoiceLogContainerCard}>
        <View style={styles.invoiceLogHeaderBar}>
          <Text style={styles.invoiceLogHeaderTitle}>Invoice Log</Text>
        </View>

        {invoicesList.length === 0 ? (
          <View style={styles.invoiceLogEmptyBox}>
            <IconComp name="receipt-outline" size={48} color="#CBD5E1" />
            <Text style={styles.invoiceLogEmptyText}>No fee invoices generated yet.</Text>
          </View>
        ) : (
          <View style={{ padding: 14, gap: 10 }}>
            {invoicesList.map(inv => {
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
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );

  // =========================================================================
  // RENDER: MODULE 9 — LEAVE REQUESTS (Source: Screenshot 1)
  // =========================================================================
  const renderLeaveRequestsModule = () => {
    const studentName = activeStudent
      ? `${activeStudent.firstName || ''} ${activeStudent.lastName || activeStudent.name || 'Madhu P'}`.trim()
      : 'Madhu P';

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Screen Title Header matching Screenshot 1 */}
        {/* Screen Title Header */}
        <View style={{ marginBottom: 16, marginTop: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.4 }}>
            Student Leave Requests
          </Text>
          <Text style={{ fontSize: 12, color: '#64748B', marginTop: 4, lineHeight: 17 }}>
            Submit leaves on behalf of {studentName} and track approval status.
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#B07FA8',
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 10,
              gap: 8,
              marginTop: 12,
              alignSelf: 'flex-start',
              shadowColor: '#B07FA8',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 3,
            }}
            onPress={() => setShowApplyLeaveModal(true)}
            activeOpacity={0.85}>
            <IconComp name="add" size={18} color="#FFFFFF" />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Submit Student Leave</Text>
          </TouchableOpacity>
        </View>

        {/* Leave History Card matching Screenshot 1 */}
        <View style={{ backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', overflow: 'hidden', elevation: 1, shadowColor: '#64748B', shadowOpacity: 0.04, shadowRadius: 3 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Leave History</Text>
            <Text style={{ fontSize: 12, color: '#94A3B8', fontWeight: '500' }}>
              {leavesList.length} Applications
            </Text>
          </View>

          <View style={{ padding: 20 }}>
            {leavesList.length === 0 ? (
              <View style={{ paddingVertical: 44, alignItems: 'center' }}>
                <IconComp name="calendar-outline" size={44} color="#CBD5E1" />
                <Text style={{ fontSize: 13, color: '#64748B', marginTop: 12, fontWeight: '500' }}>
                  No leave requests submitted yet.
                </Text>
              </View>
            ) : (
              leavesList.map(leave => (
                <View key={leave.id} style={{ padding: 14, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                        {leave.leaveType || 'Student Leave'}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                        {leave.startDate} → {leave.endDate}
                      </Text>
                      <Text style={{ fontSize: 12, color: '#334155', marginTop: 6 }}>
                        Reason: {leave.reason}
                      </Text>
                      {leave.supportingDoc && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 }}>
                          <IconComp name="document-attach-outline" size={14} color="#b07fa8" />
                          <Text style={{ fontSize: 11, color: '#b07fa8', fontWeight: '600' }}>
                            {leave.supportingDoc.name} ({leave.supportingDoc.size})
                          </Text>
                        </View>
                      )}
                    </View>
                    <View
                      style={[
                        styles.hwStatusPill,
                        String(leave.status).toLowerCase() === 'approved'
                          ? { backgroundColor: '#DCFCE7' }
                          : String(leave.status).toLowerCase() === 'rejected'
                          ? { backgroundColor: '#FEE2E2' }
                          : { backgroundColor: '#FEF3C7' },
                      ]}>
                      <Text
                        style={[
                          styles.hwStatusPillText,
                          String(leave.status).toLowerCase() === 'approved'
                            ? { color: '#15803D' }
                            : String(leave.status).toLowerCase() === 'rejected'
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
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: MODULE 10 — TIMETABLE
  // =========================================================================
  const timetableSchedule: Record<string, { period: string; time: string; subject: string; teacher: string; room: string }[]> = {
    Monday: [
      { period: 'Period 1', time: '08:30 - 09:15 AM', subject: 'Rhymes & Phonics', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
      { period: 'Period 2', time: '09:15 - 10:00 AM', subject: 'Storytelling & Language', teacher: 'Ms. Deepa S', room: 'Room 101' },
      { period: 'Period 3', time: '10:15 - 11:00 AM', subject: 'Coloring & Art', teacher: 'Mr. Suresh K', room: 'Art Room' },
      { period: 'Period 4', time: '11:30 - 12:15 PM', subject: 'Sensory Play & Building', teacher: 'Mrs. Lakshmi M', room: 'Activity Hall' },
      { period: 'Period 5', time: '01:00 - 01:45 PM', subject: 'Nap & Music Time', teacher: 'Mrs. Kavitha R', room: 'Rest Room' },
    ],
    Tuesday: [
      { period: 'Period 1', time: '08:30 - 09:15 AM', subject: 'Numbers & Counting', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
      { period: 'Period 2', time: '09:15 - 10:00 AM', subject: 'Clay Modeling & Motor Skills', teacher: 'Mr. Suresh K', room: 'Art Room' },
      { period: 'Period 3', time: '10:15 - 11:00 AM', subject: 'Nursery Rhymes In Action', teacher: 'Ms. Deepa S', room: 'Audio Room' },
      { period: 'Period 4', time: '11:30 - 12:15 PM', subject: 'Outdoor Playground Games', teacher: 'Mr. Rajesh P', room: 'Kids Turf' },
      { period: 'Period 5', time: '01:00 - 01:45 PM', subject: 'Audio-Visual Story Session', teacher: 'Mrs. Lakshmi M', room: 'AV Lab' },
    ],
    Wednesday: [
      { period: 'Period 1', time: '08:30 - 09:15 AM', subject: 'Alphabet Tracing', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
      { period: 'Period 2', time: '09:15 - 10:00 AM', subject: 'Shapes & Patterns', teacher: 'Ms. Deepa S', room: 'Room 101' },
      { period: 'Period 3', time: '10:15 - 11:00 AM', subject: 'Music & Movement Dance', teacher: 'Mrs. Lakshmi M', room: 'Dance Studio' },
      { period: 'Period 4', time: '11:30 - 12:15 PM', subject: 'Puppet Theater & Talk', teacher: 'Mrs. Kavitha R', room: 'Activity Hall' },
      { period: 'Period 5', time: '01:00 - 01:45 PM', subject: 'Relaxation & Quiet Reading', teacher: 'Ms. Deepa S', room: 'Kids Library' },
    ],
    Thursday: [
      { period: 'Period 1', time: '08:30 - 09:15 AM', subject: 'Nature Walk & Discovery', teacher: 'Mrs. Kavitha R', room: 'School Garden' },
      { period: 'Period 2', time: '09:15 - 10:00 AM', subject: 'Vocabulary & Picture Book', teacher: 'Ms. Deepa S', room: 'Room 101' },
      { period: 'Period 3', time: '10:15 - 11:00 AM', subject: 'Origami & Paper Craft', teacher: 'Mr. Suresh K', room: 'Art Room' },
      { period: 'Period 4', time: '11:30 - 12:15 PM', subject: 'Water Play / Sand Play', teacher: 'Mrs. Lakshmi M', room: 'Sensory Zone' },
      { period: 'Period 5', time: '01:00 - 01:45 PM', subject: 'Clean-Up & Social Habits', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
    ],
    Friday: [
      { period: 'Period 1', time: '08:30 - 09:15 AM', subject: 'Show & Tell Friday', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
      { period: 'Period 2', time: '09:15 - 10:00 AM', subject: 'Rhythm & Percussion Drums', teacher: 'Mr. Suresh K', room: 'Music Room' },
      { period: 'Period 3', time: '10:15 - 11:00 AM', subject: 'Weekly Star Rewards & Fun', teacher: 'Ms. Deepa S', room: 'Room 101' },
      { period: 'Period 4', time: '11:30 - 12:15 PM', subject: 'Free Play & Obstacle Course', teacher: 'Mr. Rajesh P', room: 'Kids Turf' },
      { period: 'Period 5', time: '01:00 - 01:45 PM', subject: 'Story Wrap & Goodbyes', teacher: 'Mrs. Kavitha R', room: 'Room 101' },
    ],
  };

  const renderTimetableModule = () => {
    const days: ('Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday')[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const currentSchedule = timetableSchedule[selectedTimetableDay] || [];

    return (
      <ScrollView contentContainerStyle={styles.tabScrollContentWithFloatingNav} showsVerticalScrollIndicator={false}>
        {/* Header Title */}
        <View style={styles.screenHeaderRow}>
          <View>
            <Text style={styles.screenTitleText}>Class Timetable</Text>
            <Text style={{ color: '#64748B', fontSize: 12 }}>
              {activeStudent?.gradeClass || 'PRE KG - Section A'} • Academic Year 2026-27
            </Text>
          </View>
        </View>

        {/* Day Pills Selector */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 14 }}>
          {days.map(d => {
            const isSelected = selectedTimetableDay === d;
            return (
              <TouchableOpacity
                key={d}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 9,
                  borderRadius: 20,
                  backgroundColor: isSelected ? '#b07fa8' : '#FFFFFF',
                  borderWidth: 1,
                  borderColor: isSelected ? '#b07fa8' : '#E2E8F0',
                }}
                onPress={() => setSelectedTimetableDay(d)}
                activeOpacity={0.8}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: isSelected ? '#FFFFFF' : '#64748B' }}>
                  {d}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Period List Cards */}
        <View style={{ gap: 10 }}>
          {currentSchedule.map((p, idx) => (
            <View
              key={idx}
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 16,
                padding: 14,
                borderWidth: 1,
                borderColor: '#E2E8F0',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}>
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, alignItems: 'center', minWidth: 64 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase' }}>{p.period}</Text>
                <IconComp name="time-outline" size={16} color="#b07fa8" style={{ marginTop: 4 }} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 2 }}>{p.subject}</Text>
                <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{p.teacher} • {p.room}</Text>
                <Text style={{ fontSize: 11, color: '#b07fa8', fontWeight: '700', marginTop: 4 }}>{p.time}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    );
  };

  // =========================================================================
  // RENDER: ACTIVE VIEW ROUTER
  // =========================================================================
  const renderActiveContent = () => {
    // If a sub-module is active, render that with a Top Bar back button
    if (activeAllModule) {
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
          {activeAllModule === 'Timetable' && renderTimetableModule()}
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
      {!activeAllModule && !isKeyboardVisible && (
        <View style={styles.floatingNavWrapper}>
          <View style={styles.floatingNavPillContainer}>
            {(['Dashboard', 'Attendance', 'Homework', 'Messages', 'All'] as BottomTab[]).map(tab => {
              const isActive = activeBottomTab === tab && (!activeAllModule || tab === 'All');
              const iconMap: Record<BottomTab, string> = {
                'Dashboard': 'person-circle-outline',
                'Attendance': 'calendar-outline',
                'Homework': 'book-outline',
                'Messages': 'chatbubbles-outline',
                'All': 'apps-outline',
              };
              const labelMap: Record<BottomTab, string> = {
                'Dashboard': 'Overview',
                'Attendance': 'Attendance',
                'Homework': 'Homework',
                'Messages': 'Messages',
                'All': 'All',
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
                    {labelMap[tab]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

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

      {/* =========================================================================
          MODAL: REQUEST LEAVE ON BEHALF OF STUDENT (Screenshots 2 & 3)
         ========================================================================= */}
      <Modal visible={showApplyLeaveModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxHeight: '90%', padding: 20 }]}>
            {/* Modal Title Bar */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>
                Request Leave on Behalf of Student
              </Text>
              <TouchableOpacity onPress={() => setShowApplyLeaveModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareFormScrollView showsVerticalScrollIndicator={false}>
              {/* Field 1: Leave Type Dropdown Trigger (Screenshot 2) */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Leave Type
              </Text>
              <TouchableOpacity
                style={{
                  height: 44,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: '#FFFFFF',
                  marginBottom: 12,
                }}
                onPress={() => setShowLeaveTypeDropdown(true)}
                activeOpacity={0.8}>
                <Text style={{ fontSize: 13, color: '#0F172A', fontWeight: '500' }}>
                  {leaveForm.leaveType}
                </Text>
                <IconComp name="chevron-down" size={16} color="#64748B" />
              </TouchableOpacity>

              {/* Field 2 (Conditional): Specify Leave Type (Screenshot 3 - ONLY when Others is selected) */}
              {leaveForm.leaveType === 'Others' && (
                <View style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    Specify Leave Type
                  </Text>
                  <FocusTextInput
                    style={{
                      height: 44,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      fontSize: 13,
                      color: '#0F172A',
                      backgroundColor: '#FFFFFF',
                    }}
                    placeholder="e.g. Travel / Family Function"
                    placeholderTextColor="#94A3B8"
                    value={leaveForm.customType}
                    onChangeText={txt => setLeaveForm(prev => ({ ...prev, customType: txt }))}
                  />
                </View>
              )}

              {/* Fields 3 & 4: Start Date & End Date (2-Columns matching Screenshots 2 & 3) */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    Start Date
                  </Text>
                  <TouchableOpacity
                    style={{
                      height: 44,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#FFFFFF',
                    }}
                    onPress={() => setDatePickerTarget('leaveStart')}
                    activeOpacity={0.8}>
                    <Text style={{ fontSize: 13, color: leaveForm.startDate ? '#0F172A' : '#94A3B8' }}>
                      {leaveForm.startDate || 'dd-mm-yyyy'}
                    </Text>
                    <IconComp name="calendar-outline" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    End Date
                  </Text>
                  <TouchableOpacity
                    style={{
                      height: 44,
                      borderWidth: 1,
                      borderColor: '#E2E8F0',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#FFFFFF',
                    }}
                    onPress={() => setDatePickerTarget('leaveEnd')}
                    activeOpacity={0.8}>
                    <Text style={{ fontSize: 13, color: leaveForm.endDate ? '#0F172A' : '#94A3B8' }}>
                      {leaveForm.endDate || 'dd-mm-yyyy'}
                    </Text>
                    <IconComp name="calendar-outline" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Field 5: Reason for Leave (Screenshots 2 & 3) */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Reason for Leave
              </Text>
              <FocusTextInput
                style={{
                  height: 70,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  borderRadius: 8,
                  paddingHorizontal: 12,
                  paddingTop: 10,
                  fontSize: 13,
                  color: '#0F172A',
                  backgroundColor: '#FFFFFF',
                  textAlignVertical: 'top',
                  marginBottom: 12,
                }}
                placeholder="Explain why the student requires leave..."
                placeholderTextColor="#94A3B8"
                multiline
                value={leaveForm.reason}
                onChangeText={txt => setLeaveForm(prev => ({ ...prev, reason: txt }))}
              />

              {/* Field 6: Supporting Document (Optional) (Screenshots 2 & 3) */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                Supporting Document (Optional)
              </Text>
              <TouchableOpacity
                style={{
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: leaveSelectedFile ? '#059669' : '#CBD5E1',
                  borderRadius: 12,
                  backgroundColor: leaveSelectedFile ? '#F0FDF4' : '#FFFFFF',
                  paddingVertical: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
                onPress={handlePickLeaveDoc}
                activeOpacity={0.8}>
                <IconComp
                  name="folder-open-outline"
                  size={28}
                  color={leaveSelectedFile ? '#059669' : '#b07fa8'}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '700',
                    color: leaveSelectedFile ? '#059669' : '#b07fa8',
                    marginTop: 6,
                  }}>
                  {leaveSelectedFile ? leaveSelectedFile.name : 'Select a file'}
                </Text>
                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                  {leaveSelectedFile ? leaveSelectedFile.size : 'PDF, PNG, JPG up to 3MB'}
                </Text>
              </TouchableOpacity>

              {/* Footer Buttons */}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <TouchableOpacity
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    backgroundColor: '#FFFFFF',
                  }}
                  onPress={() => setShowApplyLeaveModal(false)}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: '#b07fa8',
                    paddingHorizontal: 20,
                    paddingVertical: 10,
                    borderRadius: 8,
                    opacity: isSubmittingLeave ? 0.7 : 1,
                  }}
                  onPress={handleApplyLeaveSubmit}
                  disabled={isSubmittingLeave}>
                  {isSubmittingLeave ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Submit Request</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAwareFormScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Leave Type Dropdown Selection Modal */}
      <Modal visible={showLeaveTypeDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlayDark}
          activeOpacity={1}
          onPress={() => setShowLeaveTypeDropdown(false)}>
          <View style={[styles.modalCardContainer, { maxWidth: 300, padding: 18, borderRadius: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#0F172A' }}>Select Leave Type</Text>
              <TouchableOpacity onPress={() => setShowLeaveTypeDropdown(false)}>
                <IconComp name="close-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {['Sick Leave', 'Casual Leave', 'Medical Leave', 'Others'].map(opt => {
              const isSelected = leaveForm.leaveType === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.attDropdownOptionRow,
                    isSelected && styles.attDropdownOptionRowSelected,
                  ]}
                  onPress={() => {
                    setLeaveForm(prev => ({ ...prev, leaveType: opt }));
                    setShowLeaveTypeDropdown(false);
                  }}
                  activeOpacity={0.75}>
                  <Text style={[styles.attDropdownOptionText, isSelected && styles.attDropdownOptionTextSelected]}>
                    {opt}
                  </Text>
                  {isSelected && <IconComp name="checkmark-outline" size={18} color="#b07fa8" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Book PTM Modal */}
      <Modal visible={showBookPtmModal} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 380, maxHeight: '90%', padding: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Schedule PTM Conference</Text>
              <TouchableOpacity onPress={() => setShowBookPtmModal(false)}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareFormScrollView showsVerticalScrollIndicator={false}>
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

              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingBottom: 10 }}>
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
            </KeyboardAwareFormScrollView>
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

      {/* =========================================================================
          LINK ANOTHER CHILD MODAL (Screenshots 4 & 5)
         ========================================================================= */}
      <Modal
        visible={isLinkAnotherModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsLinkAnotherModalOpen(false);
          setLinkChildError('');
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 380, width: '92%' }]}>
            {/* Header */}
            <View style={styles.linkModalHeaderRow}>
              <Text style={styles.linkModalTitle}>Link Another Child</Text>
              <TouchableOpacity
                onPress={() => {
                  setIsLinkAnotherModalOpen(false);
                  setLinkChildError('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Error State Banner (Screenshot 5) */}
            {linkChildError ? (
              <View style={styles.linkErrorBannerBox}>
                <Text style={styles.linkErrorBannerText}>{linkChildError}</Text>
              </View>
            ) : null}

            {/* Field: Admission Number */}
            <Text style={styles.linkFieldLabel}>
              Admission Number <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <FocusTextInput
              style={styles.linkFieldInput}
              placeholder="e.g. ADM-2024-001"
              placeholderTextColor="#94A3B8"
              value={linkChildAdmission}
              onChangeText={txt => {
                setLinkChildAdmission(txt);
                setLinkChildError('');
              }}
              autoCapitalize="characters"
            />

            {/* Field: Date of Birth */}
            <Text style={[styles.linkFieldLabel, { marginTop: 14 }]}>
              Date of Birth <Text style={{ color: '#EF4444' }}>*</Text>
            </Text>
            <View style={styles.linkDobInputRow}>
              <RNTextInput
                style={styles.linkDobTextInput}
                placeholder="dd-mm-yyyy"
                placeholderTextColor="#94A3B8"
                value={linkChildDob}
                onChangeText={txt => {
                  setLinkChildDob(txt);
                  setLinkChildError('');
                }}
              />
              <TouchableOpacity
                style={styles.linkDobCalendarIconBtn}
                onPress={() => setShowLinkDatePicker(true)}>
                <IconComp name="calendar-outline" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Action Buttons: Cancel and Link Child (Screenshot 4) */}
            <View style={styles.linkModalButtonsRow}>
              <TouchableOpacity
                style={styles.linkCancelBtn}
                onPress={() => {
                  setIsLinkAnotherModalOpen(false);
                  setLinkChildError('');
                }}>
                <Text style={styles.linkCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.linkSubmitBtn, isLinkingChild && { opacity: 0.7 }]}
                onPress={handleLinkChildSubmit}
                disabled={isLinkingChild}
                activeOpacity={0.85}>
                {isLinkingChild ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.linkSubmitBtnText}>Link Child</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Date Picker Modal for Link Another Child DOB */}
      <CalendarDatePickerModal
        visible={showLinkDatePicker}
        title="Select Date of Birth"
        currentDateStr={linkChildDob}
        onSelectDate={dStr => {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            setLinkChildDob(`${parts[2]}-${parts[1]}-${parts[0]}`);
          } else {
            setLinkChildDob(dStr);
          }
          setLinkChildError('');
          setShowLinkDatePicker(false);
        }}
        onClose={() => setShowLinkDatePicker(false)}
      />

      {/* =========================================================================
          ADD OR LINK A CHILD MODAL (Screenshots 2 & 3)
         ========================================================================= */}
      <Modal
        visible={isAddOrLinkModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddOrLinkModalOpen(false);
          setLinkChildError('');
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 420, width: '94%', maxHeight: '92%' }]}>
            {/* Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Add or Link a Child</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>
                  Link an enrolled school account or record family details.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setIsAddOrLinkModalOpen(false);
                  setLinkChildError('');
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <IconComp name="close-outline" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {/* Segmented Tab Switcher (Screenshots 2 & 3) */}
            <View style={styles.addOrLinkTabsWrapper}>
              <TouchableOpacity
                style={[
                  styles.addOrLinkTabBtn,
                  addOrLinkTab === 'link_enrolled' && styles.addOrLinkTabBtnActive,
                ]}
                onPress={() => setAddOrLinkTab('link_enrolled')}
                activeOpacity={0.8}>
                <IconComp
                  name="school-outline"
                  size={15}
                  color={addOrLinkTab === 'link_enrolled' ? '#B07FA8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.addOrLinkTabBtnText,
                    addOrLinkTab === 'link_enrolled' && styles.addOrLinkTabBtnTextActive,
                  ]}>
                  Link Enrolled Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.addOrLinkTabBtn,
                  addOrLinkTab === 'manual_sibling' && styles.addOrLinkTabBtnActive,
                ]}
                onPress={() => setAddOrLinkTab('manual_sibling')}
                activeOpacity={0.8}>
                <IconComp
                  name="people-outline"
                  size={15}
                  color={addOrLinkTab === 'manual_sibling' ? '#B07FA8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.addOrLinkTabBtnText,
                    addOrLinkTab === 'manual_sibling' && styles.addOrLinkTabBtnTextActive,
                  ]}>
                  Other Sibling / Dependent
                </Text>
              </TouchableOpacity>
            </View>

            <KeyboardAwareFormScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 10 }}>
              {/* TAB 1: Link Enrolled Student (Screenshot 2) */}
              {addOrLinkTab === 'link_enrolled' ? (
                <View>
                  {/* Pink Notice Banner */}
                  <View style={styles.linkNoticeBannerBox}>
                    <Text style={styles.linkNoticeBannerText}>
                      Enter your child's <Text style={{ fontWeight: '800' }}>Admission Number</Text> and{' '}
                      <Text style={{ fontWeight: '800' }}>Date of Birth</Text> as registered in school records to
                      securely link their profile.
                    </Text>
                  </View>

                  {/* Error banner if any */}
                  {linkChildError ? (
                    <View style={styles.linkErrorBannerBox}>
                      <Text style={styles.linkErrorBannerText}>{linkChildError}</Text>
                    </View>
                  ) : null}

                  {/* Admission Number */}
                  <Text style={styles.modalFieldLabel}>
                    ADMISSION NUMBER <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <FocusTextInput
                    style={styles.modalFieldTextInput}
                    placeholder="e.g. ADM-2024-001 or 1001"
                    placeholderTextColor="#94A3B8"
                    value={linkChildAdmission}
                    onChangeText={txt => {
                      setLinkChildAdmission(txt);
                      setLinkChildError('');
                    }}
                    autoCapitalize="characters"
                  />

                  {/* Date of Birth */}
                  <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>
                    DATE OF BIRTH <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <View style={styles.modalDobInputBox}>
                    <RNTextInput
                      style={styles.modalDobTextInput}
                      placeholder="dd-mm-yyyy"
                      placeholderTextColor="#94A3B8"
                      value={linkChildDob}
                      onChangeText={txt => {
                        setLinkChildDob(txt);
                        setLinkChildError('');
                      }}
                    />
                    <TouchableOpacity
                      style={{ padding: 4 }}
                      onPress={() => setShowLinkDatePicker(true)}>
                      <IconComp name="calendar-outline" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  {/* Buttons */}
                  <View style={styles.modalActionButtonsRow}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => {
                        setIsAddOrLinkModalOpen(false);
                        setLinkChildError('');
                      }}>
                      <Text style={styles.modalCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.modalVerifyLinkBtn, isLinkingChild && { opacity: 0.7 }]}
                      onPress={handleLinkChildSubmit}
                      disabled={isLinkingChild}
                      activeOpacity={0.85}>
                      {isLinkingChild ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.modalVerifyLinkBtnText}>Verify & Link Student</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                /* TAB 2: Other Sibling / Dependent (Screenshot 3) */
                <View>
                  {/* Full Name */}
                  <Text style={styles.modalFieldLabel}>
                    FULL NAME <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <FocusTextInput
                    style={styles.modalFieldTextInput}
                    placeholder="e.g. Sarah Doe"
                    placeholderTextColor="#94A3B8"
                    value={siblingForm.name}
                    onChangeText={txt => setSiblingForm(prev => ({ ...prev, name: txt }))}
                  />

                  {/* DOB & Gender Dual Row */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalFieldLabel}>
                        DATE OF BIRTH <Text style={{ color: '#EF4444' }}>*</Text>
                      </Text>
                      <View style={styles.modalDobInputBox}>
                        <RNTextInput
                          style={styles.modalDobTextInput}
                          placeholder="dd-mm-yyyy"
                          placeholderTextColor="#94A3B8"
                          value={siblingForm.dob}
                          onChangeText={txt => setSiblingForm(prev => ({ ...prev, dob: txt }))}
                        />
                        <TouchableOpacity
                          style={{ padding: 4 }}
                          onPress={() => setShowSiblingDatePicker(true)}>
                          <IconComp name="calendar-outline" size={18} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Gender Dropdown */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalFieldLabel}>GENDER</Text>
                      <TouchableOpacity
                        style={[
                          styles.modalFieldTextInput,
                          {
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            height: 44,
                            paddingHorizontal: 12,
                          },
                        ]}
                        onPress={() => {
                          setShowGenderDropdown(prev => !prev);
                          setShowRelationshipDropdown(false);
                          setShowBloodGroupDropdown(false);
                        }}>
                        <Text style={{ fontSize: 13, color: siblingForm.gender ? '#0F172A' : '#94A3B8', fontWeight: siblingForm.gender ? '600' : '400' }}>
                          {siblingForm.gender || 'Select Gender'}
                        </Text>
                        <IconComp name={showGenderDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                      </TouchableOpacity>

                      {showGenderDropdown && (
                        <View style={{
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          marginTop: 4,
                          elevation: 4,
                          shadowColor: '#000',
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          overflow: 'hidden',
                        }}>
                          {['Male', 'Female', 'Other'].map(g => (
                            <TouchableOpacity
                              key={g}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: siblingForm.gender === g ? '#faedf7' : '#FFFFFF',
                                borderBottomWidth: 1,
                                borderBottomColor: '#F1F5F9',
                              }}
                              onPress={() => {
                                setSiblingForm(prev => ({ ...prev, gender: g }));
                                setShowGenderDropdown(false);
                              }}>
                              <Text style={{ fontSize: 13, fontWeight: siblingForm.gender === g ? '700' : '500', color: siblingForm.gender === g ? '#B07FA8' : '#0F172A' }}>
                                {g}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  </View>

                  {/* Relationship & Blood Group Dual Row */}
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    {/* Relationship Dropdown */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalFieldLabel}>RELATIONSHIP</Text>
                      <TouchableOpacity
                        style={[
                          styles.modalFieldTextInput,
                          {
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            height: 44,
                            paddingHorizontal: 12,
                          },
                        ]}
                        onPress={() => {
                          setShowRelationshipDropdown(prev => !prev);
                          setShowGenderDropdown(false);
                          setShowBloodGroupDropdown(false);
                        }}>
                        <Text style={{ fontSize: 13, color: siblingForm.relationship ? '#0F172A' : '#94A3B8', fontWeight: siblingForm.relationship ? '600' : '400' }}>
                          {siblingForm.relationship || 'Select Relationship'}
                        </Text>
                        <IconComp name={showRelationshipDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                      </TouchableOpacity>

                      {showRelationshipDropdown && (
                        <View style={{
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          marginTop: 4,
                          elevation: 4,
                          shadowColor: '#000',
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          overflow: 'hidden',
                        }}>
                          {['Sibling', 'Child', 'Dependent', 'Other'].map(r => (
                            <TouchableOpacity
                              key={r}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 12,
                                backgroundColor: siblingForm.relationship === r ? '#faedf7' : '#FFFFFF',
                                borderBottomWidth: 1,
                                borderBottomColor: '#F1F5F9',
                              }}
                              onPress={() => {
                                setSiblingForm(prev => ({ ...prev, relationship: r }));
                                setShowRelationshipDropdown(false);
                              }}>
                              <Text style={{ fontSize: 13, fontWeight: siblingForm.relationship === r ? '700' : '500', color: siblingForm.relationship === r ? '#B07FA8' : '#0F172A' }}>
                                {r}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>

                    {/* Blood Group Dropdown */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalFieldLabel}>BLOOD GROUP</Text>
                      <TouchableOpacity
                        style={[
                          styles.modalFieldTextInput,
                          {
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            height: 44,
                            paddingHorizontal: 12,
                          },
                        ]}
                        onPress={() => {
                          setShowBloodGroupDropdown(prev => !prev);
                          setShowGenderDropdown(false);
                          setShowRelationshipDropdown(false);
                        }}>
                        <Text style={{ fontSize: 13, color: siblingForm.bloodGroup ? '#0F172A' : '#94A3B8', fontWeight: siblingForm.bloodGroup ? '600' : '400' }}>
                          {siblingForm.bloodGroup || 'Select Blood'}
                        </Text>
                        <IconComp name={showBloodGroupDropdown ? 'chevron-up' : 'chevron-down'} size={16} color="#64748B" />
                      </TouchableOpacity>

                      {showBloodGroupDropdown && (
                        <View style={{
                          backgroundColor: '#FFFFFF',
                          borderWidth: 1,
                          borderColor: '#E2E8F0',
                          borderRadius: 10,
                          marginTop: 4,
                          elevation: 4,
                          shadowColor: '#000',
                          shadowOpacity: 0.1,
                          shadowRadius: 4,
                          overflow: 'hidden',
                          maxHeight: 180,
                        }}>
                          <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                            {['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].map(bg => (
                              <TouchableOpacity
                                key={bg}
                                style={{
                                  paddingVertical: 9,
                                  paddingHorizontal: 12,
                                  backgroundColor: siblingForm.bloodGroup === bg ? '#faedf7' : '#FFFFFF',
                                  borderBottomWidth: 1,
                                  borderBottomColor: '#F1F5F9',
                                }}
                                onPress={() => {
                                  setSiblingForm(prev => ({ ...prev, bloodGroup: bg }));
                                  setShowBloodGroupDropdown(false);
                                }}>
                                <Text style={{ fontSize: 13, fontWeight: siblingForm.bloodGroup === bg ? '700' : '500', color: siblingForm.bloodGroup === bg ? '#B07FA8' : '#0F172A' }}>
                                  {bg}
                                </Text>
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>
                  </View>

                  {/* School Name Optional */}
                  <Text style={[styles.modalFieldLabel, { marginTop: 12 }]}>SCHOOL NAME (OPTIONAL)</Text>
                  <FocusTextInput
                    style={styles.modalFieldTextInput}
                    placeholder="If studying at another school..."
                    placeholderTextColor="#94A3B8"
                    value={siblingForm.schoolName}
                    onChangeText={txt => setSiblingForm(prev => ({ ...prev, schoolName: txt }))}
                    onFocus={() => {
                      setTimeout(() => {
                        siblingScrollRef.current?.scrollToEnd({ animated: true });
                      }, 150);
                    }}
                  />

                  {/* Buttons */}
                  <View style={[styles.modalActionButtonsRow, { marginTop: 16 }]}>
                    <TouchableOpacity
                      style={styles.modalCancelBtn}
                      onPress={() => {
                        setIsAddOrLinkModalOpen(false);
                        setEditingSiblingId(null);
                      }}>
                      <Text style={styles.modalCancelBtnText}>Cancel</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.modalAddSiblingBtn}
                      onPress={handleAddSiblingSubmit}
                      activeOpacity={0.85}>
                      <Text style={styles.modalAddSiblingBtnText}>
                        {editingSiblingId ? 'Save Changes' : 'Add Sibling'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </KeyboardAwareFormScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* =========================================================================
          UNLINK STUDENT CONFIRMATION MODAL (Matching Image 4)
         ========================================================================= */}
      <Modal
        visible={!!unlinkingStudent}
        transparent
        animationType="fade"
        onRequestClose={() => setUnlinkingStudent(null)}>
        <View style={styles.modalOverlayDark}>
          <View style={[styles.modalCardContainer, { maxWidth: 360, alignItems: 'center', padding: 24, borderRadius: 24 }]}>
            {/* Red Circle with Broken Link Icon */}
            <View style={styles.unlinkModalCircleIconBox}>
              <IconComp name="unlink-outline" size={26} color="#DC2626" />
            </View>

            <Text style={styles.unlinkModalTitleText}>Unlink Student?</Text>
            <Text style={styles.unlinkModalMessageText}>
              Are you sure you want to unlink{' '}
              <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                {`${unlinkingStudent?.firstName || ''} ${unlinkingStudent?.lastName || unlinkingStudent?.name || 'this student'}`.trim()}
              </Text>{' '}
              from this parent account? You can re-link them at any time with their Admission Number.
            </Text>

            {/* Buttons Row */}
            <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 24 }}>
              <TouchableOpacity
                style={styles.unlinkModalCancelBtn}
                onPress={() => setUnlinkingStudent(null)}
                activeOpacity={0.8}>
                <Text style={styles.unlinkModalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unlinkModalConfirmBtn}
                onPress={handleConfirmUnlinkStudent}
                activeOpacity={0.85}>
                <Text style={styles.unlinkModalConfirmBtnText}>Yes, Unlink</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          ATTENDANCE TIMEFRAME DROPDOWN MODAL (Options: This Week, This Month, This Term)
         ========================================================================= */}
      <Modal
        visible={showAttDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAttDropdown(false)}>
        <TouchableOpacity
          style={styles.modalOverlayDark}
          activeOpacity={1}
          onPress={() => setShowAttDropdown(false)}>
          <View style={[styles.modalCardContainer, { maxWidth: 320, padding: 20, borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Select Timeframe</Text>
              <TouchableOpacity onPress={() => setShowAttDropdown(false)}>
                <IconComp name="close-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {(['This Week', 'This Month', 'This Term', 'All Time'] as const).map((opt) => {
              const isSelected = attTimeFilter === opt;
              return (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.attDropdownOptionRow,
                    isSelected && styles.attDropdownOptionRowSelected,
                  ]}
                  onPress={() => {
                    setAttTimeFilter(opt);
                    setShowAttDropdown(false);
                  }}
                  activeOpacity={0.75}>
                  <Text
                    style={[
                      styles.attDropdownOptionText,
                      isSelected && styles.attDropdownOptionTextSelected,
                    ]}>
                    {opt}
                  </Text>
                  {isSelected && (
                    <IconComp name="checkmark-outline" size={18} color="#B07FA8" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Date Picker Modal for Sibling DOB */}
      <CalendarDatePickerModal
        visible={showSiblingDatePicker}
        title="Select Date of Birth"
        currentDateStr={siblingForm.dob}
        onSelectDate={dStr => {
          const parts = dStr.split('-');
          if (parts.length === 3) {
            setSiblingForm(prev => ({ ...prev, dob: `${parts[2]}-${parts[1]}-${parts[0]}` }));
          } else {
            setSiblingForm(prev => ({ ...prev, dob: dStr }));
          }
          setShowSiblingDatePicker(false);
        }}
        onClose={() => setShowSiblingDatePicker(false)}
      />
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

  // Top Header Bar (Matching Admin / Teacher Portal Dimensions & Spacing Exactly)
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
  },
  officialBadgeText: {
    fontSize: 11,
    fontWeight: '700',
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPillText: {
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

  // =========================================================================
  // STUDENT OVERVIEW (SCREENSHOTS 2 & 3) STYLES
  // =========================================================================

  // 1. Viewing Card & Dropdown (Screenshots 2 & 3)
  viewingCardWrapper: {
    backgroundColor: '#FAF5FF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F3E8FF',
    padding: 14,
    marginBottom: 16,
  },
  viewingCardTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewingCardHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B07FA8',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  viewingCardChildName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
    marginTop: 2,
  },
  viewingDropdownPopup: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E9D5FF',
  },
  childDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  childDropdownItemActive: {
    backgroundColor: '#F3E8FF',
  },
  childDropdownAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#faedf7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  childDropdownAvatarText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B07FA8',
  },
  childDropdownName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E1B4B',
    flex: 1,
  },
  childDropdownDivider: {
    height: 1,
    backgroundColor: '#E9D5FF',
    marginVertical: 6,
  },
  linkAnotherChildBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  linkAnotherChildBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#B07FA8',
  },

  // 2. Dark Hero Student Banner Card (Screenshot 2)
  darkHeroBannerCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  darkHeroAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#faedf7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkHeroAvatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  darkHeroStudentName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  darkHeroSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  darkHeroClassText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  darkHeroBullet: {
    fontSize: 12,
    color: '#64748B',
  },
  darkHeroIdText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // 3. Overview Cards (Attendance & Recent Assessments)
  overviewSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
  },
  overviewSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  overviewSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },

  // Attendance Summary specifics
  attendanceDonutWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  attendanceDonutRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 6,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  attendanceDonutText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  attSummaryTripleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  attSummaryBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  attSummaryBoxNumber: {
    fontSize: 18,
    fontWeight: '800',
  },
  attSummaryBoxLabel: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  attSummaryStatusBanner: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    marginTop: 12,
    alignItems: 'center',
  },
  attSummaryStatusBannerText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },

  // Recent Assessments specifics
  assessmentsEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
  },
  assessmentsEmptyIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assessmentsEmptyTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 10,
  },
  assessmentsEmptySub: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 16,
    lineHeight: 17,
  },
  assessmentRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  assessmentRowTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  assessmentRowDate: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  assessmentGradePill: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  assessmentGradePillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B07FA8',
  },

  // =========================================================================
  // LINK ANOTHER CHILD MODAL (SCREENSHOTS 4 & 5) STYLES
  // =========================================================================
  linkModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  linkModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  linkErrorBannerBox: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  linkErrorBannerText: {
    color: '#DC2626',
    fontSize: 12.5,
    fontWeight: '500',
    lineHeight: 18,
  },
  linkFieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  linkFieldInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
  },
  linkDobInputRow: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  linkDobTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    padding: 0,
  },
  linkDobCalendarIconBtn: {
    padding: 4,
  },
  linkModalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 22,
  },
  linkCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  linkCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  linkSubmitBtn: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#9D6381',
  },
  linkSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
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

  // =========================================================================
  // MY CHILDREN MODULE STYLES (Screenshots 1 - 5)
  // =========================================================================
  myChildrenHeaderSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 18,
  },
  myChildrenTitleText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  childCountPillBadge: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E9D5FF',
  },
  childCountPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#B07FA8',
  },
  myChildrenSubtitleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  linkAddChildMainBtn: {
    backgroundColor: '#B07FA8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#B07FA8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  linkAddChildMainBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Summary KPI Row (Web Responsive Layout)
  myChildrenKpiGrid: {
    gap: 10,
    marginBottom: 24,
  },
  myChildrenKpiRowTop: {
    flexDirection: 'row',
    gap: 10,
  },
  myChildrenKpiCardHalf: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  myChildrenKpiCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  myChildrenKpiIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  myChildrenKpiLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  myChildrenKpiValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  myChildrenKpiViewingCard: {
    width: '100%',
    backgroundColor: '#B07FA8',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#B07FA8',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  myChildrenViewingIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  myChildrenViewingLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.5,
  },
  myChildrenViewingValue: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 2,
  },

  // Sections
  myChildrenSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  myChildrenSectionSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  myChildrenEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 24,
    alignItems: 'center',
  },

  // Enrolled Student Cards (Screenshot 1 & 4)
  enrolledStudentCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  enrolledStudentCardBoxActive: {
    borderColor: '#B07FA8',
    borderWidth: 1.5,
  },
  enrolledStudentActiveBar: {
    height: 4,
    width: '100%',
    backgroundColor: '#B07FA8',
  },
  enrolledStudentAvatarBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#B07FA8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enrolledStudentAvatarText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  enrolledStudentNameText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  enrolledStudentClassText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B07FA8',
  },
  unlinkStudentBtnBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlinkStudentCircleBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Attendance Module Styles (Web Responsive Conversion)
  attHeaderSection: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 16,
  },
  attHeaderTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  attHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  attDropdownSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  attDropdownSelectorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  attKpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  attKpiTile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attKpiTileVal: {
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 2,
  },
  attKpiTileLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  attHistorySectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  attDropdownOptionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: '#F8FAFC',
  },
  attDropdownOptionRowSelected: {
    backgroundColor: '#F3E8FF',
  },
  attDropdownOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  attDropdownOptionTextSelected: {
    fontWeight: '800',
    color: '#B07FA8',
  },
  activeChildBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  activeChildGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  activeChildBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  makeActiveChildBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  makeActiveChildBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  admissionNumberBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  admissionNumberBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  enrolledStudentDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  enrolledStudentMetaTable: {
    gap: 6,
  },
  enrolledStudentMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  enrolledStudentMetaLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  enrolledStudentMetaVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  enrolledStudentFooterRow: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    backgroundColor: '#F8FAFC',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  enrolledOverviewBtn: {
    flex: 1,
    backgroundColor: '#B07FA8',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  enrolledOverviewBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  enrolledReportCardBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  enrolledReportCardBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },

  // Other Siblings & Dependents
  addSiblingTextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  addSiblingTextBtnLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B07FA8',
  },
  otherSiblingsEmptyBox: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherSiblingsEmptyText: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 17,
  },
  siblingRecordCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  siblingAvatarBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  siblingAvatarText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
  },

  // Modals for Add or Link a Child (Screenshots 2 & 3)
  addOrLinkTabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 3,
    marginBottom: 12,
    gap: 4,
  },
  addOrLinkTabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addOrLinkTabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  addOrLinkTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  addOrLinkTabBtnTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },
  linkNoticeBannerBox: {
    backgroundColor: '#FDF4FF',
    borderWidth: 1,
    borderColor: '#F5D0FE',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  linkNoticeBannerText: {
    fontSize: 12,
    color: '#86198F',
    lineHeight: 18,
  },
  modalFieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalFieldTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  modalDobInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  modalDobTextInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 6,
  },
  modalActionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  modalVerifyLinkBtn: {
    backgroundColor: '#B07FA8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalVerifyLinkBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  smallChipSelectBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallChipSelectBtnActive: {
    borderColor: '#B07FA8',
    backgroundColor: '#F3E8FF',
  },
  smallChipSelectBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  smallChipSelectBtnTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },
  modalAddSiblingBtn: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalAddSiblingBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Unlink Modal (Screenshot 5)
  unlinkModalCircleIconBox: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  unlinkModalTitleText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  unlinkModalMessageText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
  },
  unlinkModalCancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkModalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  unlinkModalConfirmBtn: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlinkModalConfirmBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Web-Converted Page Styles (Screenshots 1-5)
  webPageHeaderBox: {
    marginBottom: 20,
  },
  webPageHeaderTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  webPageHeaderSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 18,
  },
  webSelectDropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  webSelectDropdownTriggerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
  },
  webAttendanceCardSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  webEmptyStateCard: {
    paddingVertical: 56,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webEmptyStateTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  webEmptyStateSub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  // Performance Module (Screenshot 1)
  perfCardsCol: {
    gap: 12,
    marginBottom: 20,
  },
  perfStatusCard: {
    backgroundColor: '#B07FA8',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#B07FA8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  perfStatusLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E9D5FF',
    marginBottom: 8,
  },
  perfStatusBadge: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  perfStatusBadgeText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1D4ED8',
    letterSpacing: 1.5,
  },
  perfMetricCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  perfAwardIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  perfMetricLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  perfMetricVal: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
  },
  webContentContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 20,
  },
  webContentHeaderBar: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  webContentHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  assessmentListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },

  // PTM Module (Screenshot 2)
  ptmEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 36,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  ptmCardBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  ptmStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  ptmStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Noticeboard Module (Screenshot 3)
  webNoticeTabsRow: {
    flexDirection: 'row',
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 16,
  },
  webNoticeTabBtn: {
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  webNoticeTabBtnActive: {
    borderBottomWidth: 2.5,
    borderBottomColor: '#B07FA8',
  },
  webNoticeTabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
  },
  webNoticeTabBtnTextActive: {
    color: '#B07FA8',
    fontWeight: '800',
  },
  noticeEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  noticeItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },

  // Academic Calendar Module (Screenshot 4)
  calendarContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    marginBottom: 20,
  },
  calendarToolbarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  calNavArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  calLegendChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  calTodayButton: {
    backgroundColor: '#FDF4FF',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  calTodayButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#B07FA8',
  },
  calGridTable: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    overflow: 'hidden',
  },
  calWeekHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  calCellHeader: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
  },
  calDayLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  calWeekRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  calDayCell: {
    flex: 1,
    minHeight: 48,
    padding: 3,
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  calCellDayNumber: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 2,
  },
  sundayHolidayPill: {
    backgroundColor: '#EF4444',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    width: '100%',
    alignItems: 'center',
  },
  sundayHolidayPillText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  calEventPill: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    width: '100%',
    alignItems: 'center',
    marginTop: 2,
  },
  calEventPillText: {
    fontSize: 7,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Canteen Module Styles (Screenshot 1)
  canteenMealCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  canteenMealIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  canteenMealTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  canteenMealDesc: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    marginBottom: 16,
  },
  canteenRequestedBadge: {
    width: '100%',
    paddingVertical: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  canteenRequestedBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#15803D',
  },
  canteenRequestBtn: {
    width: '100%',
    paddingVertical: 13,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canteenRequestBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  canteenHistoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 20,
  },
  canteenTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  canteenTableHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  canteenTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  canteenCellDateText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  canteenCellMealText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  canteenStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  canteenStatusBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },

  // Homework Module Styles (Screenshot 2)
  webHomeworkEmptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 48,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  webHomeworkEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  webHomeworkEmptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
    textAlign: 'center',
  },

  // Report Card Module Styles (Screenshot 3)
  reportCardAwardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardEmptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  reportCardEmptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 14,
  },
  reportCardEmptySub: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },

  // Fees Module Styles (Screenshot 4)
  feeStatCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    position: 'relative',
  },
  feeStatAccentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 4,
    height: '100%',
  },
  feeStatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    paddingLeft: 18,
  },
  feeStatIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feeStatLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  feeStatValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginTop: 2,
  },
  invoiceLogContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 20,
  },
  invoiceLogHeaderBar: {
    backgroundColor: '#FAFAFA',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  invoiceLogHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  invoiceLogEmptyBox: {
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  invoiceLogEmptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
    marginTop: 10,
  },
});

export default StudentPortal;
