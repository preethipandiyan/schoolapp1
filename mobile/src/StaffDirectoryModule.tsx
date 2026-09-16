import React, { useState, useMemo, forwardRef } from 'react';
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
  Dimensions,
  KeyboardAvoidingView,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KeyboardAwareFormScrollView } from './KeyboardAwareFormScrollView';

// Native Bridge for File Picking & Opening
const { NativeModules } = require('react-native');
const ZunaFilePicker = NativeModules.ZunaFilePicker;

export interface StaffItem {
  id: string;
  staffId?: string;
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  mobileNumber?: string;
  phone?: string;
  role: string;
  roles?: string[];
  gender: string;
  staffType: string;
  staff_type?: string;
  status: string;
  dob?: string;
  nationality?: string;
  maritalStatus?: string;
  bloodGroup?: string;
  fatherGuardianName?: string;
  emergencyContact?: string;
  assignedClassId?: string;
  languagesKnown?: string;
  residentialAddress?: string;
  highestQualification?: string;
  degreeSpecialization?: string;
  universityName?: string;
  yearOfPassing?: string;
  previousExperience?: string;
  previousOrganization?: string;
  subjectSpecialization?: string;
  gradesClassesHandled?: string;
  professionalCertifications?: string;
  govtIdType?: string;
  govtIdNumber?: string;
  aadharNumber?: string;
  panNumber?: string;
  taxIdDetails?: string;
  pfNumber?: string;
  esicNumber?: string;
  uanNumber?: string;
  bankAccountNumber?: string;
  bankName?: string;
  branchName?: string;
  ifscCode?: string;
  photoUrl?: string;
  academicCertificates?: any[];
  markSheets?: any[];
  experienceCertificates?: any[];
  relievingLetter?: any[];
  resume?: any[];
  referenceLetters?: any[];
  govtIdDocument?: any[];
  salarySlips?: any[];
  classAssignments: string[];
  subjectAssignments: string[];
  customData?: any;
}

export const ALL_ROLES_LIST = [
  'Correspondent',
  'Principal',
  'Vice Principal',
  'Subject Wise Head',
  'Class Incharge',
  'Staffs',
  'Administrative Officer',
  'Finance Department',
  'Library',
  'Canteen',
  'Transport',
  'Janitors',
  'Hostel Inventory',
  'Security',
];

const pickDocument = async (type: 'excel' | 'image' | 'pdf' | 'document' | 'all' = 'all'): Promise<{ name: string; size: string; type: string; uri: string; filePath: string; base64: string } | null> => {
  if (Platform.OS === 'android' && ZunaFilePicker) {
    try {
      const res = await ZunaFilePicker.pickFile({ type });
      return res;
    } catch (err: any) {
      if (err?.message !== 'USER_CANCELLED') {
        console.warn('Native file picker error:', err);
      }
      return null;
    }
  }
  return null;
};

const saveAndOpenFile = async (fileName: string, mimeType: string, base64Data: string) => {
  if (Platform.OS === 'android' && ZunaFilePicker) {
    try {
      return await ZunaFilePicker.saveAndOpenFile(fileName, mimeType, base64Data);
    } catch (err: any) {
      console.warn('saveAndOpenFile native error:', err);
    }
  }
};

// Icon Helper Component
const IconComp = ({ name, size = 18, color = '#64748B', style }: { name: string; size?: number; color?: string; style?: any }) => {
  try {
    return <Ionicons name={name || 'square-outline'} size={size} color={color || '#64748B'} style={style} />;
  } catch (e) {
    return <Text style={[{ fontSize: size * 0.7, color: color || '#64748B' }, style]}>●</Text>;
  }
};

// Focus-Aware TextInput with Mauve (#B07FA8) border
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

// =========================================================================
// MAIN STAFF DIRECTORY SCREEN COMPONENT
// =========================================================================
interface StaffDirectoryScreenProps {
  staffList: StaffItem[];
  classesList?: any[];
  schoolId: string;
  onRefresh?: () => void;
  showToast: (msg: string) => void;
  addSubDocument: (schoolId: string, subCollection: string, data: any) => Promise<string>;
  updateSubDocument: (schoolId: string, subCollection: string, docId: string, data: any) => Promise<void>;
  deleteSubDocument: (schoolId: string, subCollection: string, docId: string) => Promise<void>;
  onAddStaffPress?: () => void;
}

export const StaffDirectoryScreen: React.FC<StaffDirectoryScreenProps> = ({
  staffList,
  classesList = [],
  schoolId,
  showToast,
  addSubDocument,
  updateSubDocument,
  deleteSubDocument,
}) => {
  // Search & Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [genderFilter, setGenderFilter] = useState('All Genders');
  const [staffTypeFilter, setStaffTypeFilter] = useState('All Staff Types');
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Dropdown filter popover / modal states
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  // Modals state
  const [showAddStaffModal, setShowAddStaffModal] = useState(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState(false);
  const [selectedStaffForView, setSelectedStaffForView] = useState<StaffItem | null>(null);
  const [selectedStaffForEdit, setSelectedStaffForEdit] = useState<StaffItem | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<StaffItem | null>(null);

  // Metric counts (calculated from all real staff data)
  const totalStaffCount = staffList.length;
  const activeStaffCount = staffList.filter(s => (s.status || 'Active').toLowerCase() === 'active').length;
  const maleStaffCount = staffList.filter(s => (s.gender || '').toLowerCase() === 'male').length;
  const femaleStaffCount = staffList.filter(s => (s.gender || '').toLowerCase() === 'female').length;
  const teachersCount = staffList.filter(s => (s.staffType || '').toLowerCase().includes('teach') && !(s.staffType || '').toLowerCase().includes('non')).length;
  const nonTeachingCount = staffList.filter(s => (s.staffType || '').toLowerCase().includes('non')).length;

  // Combined filtering logic
  const filteredStaff = useMemo(() => {
    return staffList.filter(st => {
      // 1. Search Query (matches name, staffId, email, mobileNumber)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (st.name || '').toLowerCase().includes(q);
        const emailMatch = (st.email || '').toLowerCase().includes(q);
        const idMatch = (st.staffId || st.employeeId || '').toLowerCase().includes(q);
        const mobileMatch = (st.mobileNumber || st.phone || '').includes(q);
        if (!nameMatch && !emailMatch && !idMatch && !mobileMatch) {
          return false;
        }
      }

      // 2. Role Filter
      if (roleFilter !== 'All Roles') {
        const roles = st.roles || [st.role];
        const hasRole = roles.some(r => {
          if (!r) return false;
          if (roleFilter === 'Hostel Inventory') {
            return r.toLowerCase().includes('hostel') || r.toLowerCase().includes('inventory');
          }
          return r.toLowerCase() === roleFilter.toLowerCase();
        });
        if (!hasRole && st.role !== roleFilter) {
          return false;
        }
      }

      // 3. Status Filter
      if (statusFilter !== 'All Status' && statusFilter !== 'All') {
        const stStatus = (st.status || 'Active').toLowerCase();
        if (stStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // 4. Gender Filter
      if (genderFilter !== 'All Genders' && genderFilter !== 'All') {
        const stGender = (st.gender || 'Male').toLowerCase();
        if (stGender !== genderFilter.toLowerCase()) {
          return false;
        }
      }

      // 5. Staff Type Filter
      if (staffTypeFilter !== 'All Staff Types' && staffTypeFilter !== 'All') {
        const isNonTeach = (st.staffType || '').toLowerCase().includes('non') || (st.staff_type || '').toLowerCase().includes('non');
        if (staffTypeFilter === 'Teaching Staff' && isNonTeach) {
          return false;
        }
        if (staffTypeFilter === 'Non-Teaching Staff' && !isNonTeach) {
          return false;
        }
      }

      return true;
    });
  }, [staffList, searchQuery, roleFilter, statusFilter, genderFilter, staffTypeFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredStaff.length / rowsPerPage));
  const paginatedStaff = useMemo(() => {
    const startIdx = (currentPage - 1) * rowsPerPage;
    return filteredStaff.slice(startIdx, startIdx + rowsPerPage);
  }, [filteredStaff, currentPage, rowsPerPage]);

  // Handle Export Staff
  const handleExportStaff = () => {
    if (staffList.length === 0) {
      Alert.alert('No Data', 'No staff data available to report');
      showToast('No staff data available to report');
      return;
    }

    try {
      const exportData = filteredStaff.map((s, idx) => ({
        'S.No': idx + 1,
        'Staff ID': s.staffId || s.employeeId || `STF${1000 + idx}`,
        'Full Name': s.name,
        'Email Address': s.email,
        'Mobile Number': s.mobileNumber || s.phone || '',
        'Role': (s.roles && s.roles.length > 0 ? s.roles.join(', ') : s.role) || 'Staffs',
        'Staff Type': s.staffType || 'Teaching',
        'Status': s.status || 'Active',
        'Gender': s.gender || '',
        'Date of Birth': s.dob || '',
        'Blood Group': s.bloodGroup || '',
        'Aadhaar Number': s.aadharNumber || '',
        'PAN Number': s.panNumber || '',
        'Highest Qualification': s.highestQualification || '',
        'Bank Name': s.bankName || '',
        'Account Number': s.bankAccountNumber || '',
        'IFSC Code': s.ifscCode || '',
        'Class Assignments': (s.classAssignments || []).join('; '),
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Staff Directory');
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `Staff_Directory_${new Date().toISOString().slice(0, 10)}.xlsx`;

      saveAndOpenFile(fileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64);
      showToast('Staff directory exported successfully!');
    } catch (e: any) {
      console.warn('Export error:', e);
      Alert.alert('Export Error', e?.message || 'Failed to export staff directory');
    }
  };

  // Handle Delete Staff Member
  const confirmDeleteStaff = async () => {
    if (!staffToDelete) return;
    try {
      await deleteSubDocument(schoolId, 'teachers', staffToDelete.id);
      showToast(`Removed staff member: ${staffToDelete.name}`);
      setStaffToDelete(null);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete staff member.');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Header Title & Subtitle Matching Screenshot 1 */}
        <View style={styles.headerSection}>
          <Text style={styles.headerTitle}>Staff Directory & Attachments</Text>
          <Text style={styles.headerSubtitle}>Manage your teachers, upload documents, and assign classes.</Text>
        </View>

        {/* Top Action Buttons (Export, + Add Staff, Bulk Import) */}
        <View style={styles.actionRow}>
          {/* Export Button (Outline with Download icon) */}
          <TouchableOpacity style={styles.outlineActionBtn} onPress={handleExportStaff} activeOpacity={0.7}>
            <IconComp name="download-outline" size={15} color="#475569" />
            <Text style={styles.outlineActionBtnText}>Export</Text>
          </TouchableOpacity>

          {/* + Add Staff Button (Outline with User Plus icon) */}
          <TouchableOpacity style={styles.purpleOutlineActionBtn} onPress={() => setShowAddStaffModal(true)} activeOpacity={0.7}>
            <IconComp name="person-add-outline" size={15} color="#7C3AED" />
            <Text style={styles.purpleOutlineActionBtnText}>+ Add Staff</Text>
          </TouchableOpacity>

          {/* Bulk Import Button (Solid Purple with Cloud Upload icon) */}
          <TouchableOpacity style={styles.solidPurpleActionBtn} onPress={() => setShowBulkImportModal(true)} activeOpacity={0.7}>
            <IconComp name="cloud-upload-outline" size={15} color="#FFFFFF" />
            <Text style={styles.solidPurpleActionBtnText}>Bulk Import</Text>
          </TouchableOpacity>
        </View>

        {/* 6 Metric Cards Row (Screenshot 1 Matching) */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsScrollContainer}>
          {/* TOTAL STAFF */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#EEF2FF' }]}>
              <IconComp name="people" size={18} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.metricLabel}>TOTAL STAFF</Text>
              <Text style={styles.metricValue}>{totalStaffCount}</Text>
            </View>
          </View>

          {/* ACTIVE */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#ECFDF5' }]}>
              <IconComp name="checkmark-circle-outline" size={18} color="#059669" />
            </View>
            <View>
              <Text style={styles.metricLabel}>ACTIVE</Text>
              <Text style={[styles.metricValue, { color: '#059669' }]}>{activeStaffCount}</Text>
            </View>
          </View>

          {/* MALE STAFF */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#EFF6FF' }]}>
              <IconComp name="person" size={18} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.metricLabel}>MALE STAFF</Text>
              <Text style={styles.metricValue}>{maleStaffCount}</Text>
            </View>
          </View>

          {/* FEMALE STAFF */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FDF2F8' }]}>
              <IconComp name="person" size={18} color="#DB2777" />
            </View>
            <View>
              <Text style={styles.metricLabel}>FEMALE STAFF</Text>
              <Text style={styles.metricValue}>{femaleStaffCount}</Text>
            </View>
          </View>

          {/* TEACHERS */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FFFBEB' }]}>
              <IconComp name="school-outline" size={18} color="#D97706" />
            </View>
            <View>
              <Text style={styles.metricLabel}>TEACHERS</Text>
              <Text style={styles.metricValue}>{teachersCount}</Text>
            </View>
          </View>

          {/* NON-TEACHING */}
          <View style={styles.metricCard}>
            <View style={[styles.metricIconWrap, { backgroundColor: '#FAF5FF' }]}>
              <IconComp name="briefcase-outline" size={18} color="#9333EA" />
            </View>
            <View>
              <Text style={styles.metricLabel}>NON-TEACHING</Text>
              <Text style={styles.metricValue}>{nonTeachingCount}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Filter & Search Bar Matching Screenshot 1 */}
        <View style={styles.filterSectionCard}>
          {/* Search Input with Search Icon and Mauve Focus */}
          <View style={styles.searchInputWrapper}>
            <IconComp name="search-outline" size={18} color="#94A3B8" style={styles.searchIcon} />
            <FocusTextInput
              style={styles.searchInput}
              placeholder="Search staff by name or email..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} style={{ padding: 4 }}>
                <IconComp name="close-circle" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Dropdown Pills Row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterPillsScroll}>
            {/* Role Filter */}
            <TouchableOpacity
              style={[styles.filterDropdownBtn, roleFilter !== 'All Roles' && styles.filterDropdownBtnActive]}
              onPress={() => setActiveDropdown('role')}>
              <Text style={[styles.filterDropdownBtnText, roleFilter !== 'All Roles' && styles.filterDropdownBtnTextActive]}>
                {roleFilter}
              </Text>
              <IconComp name="chevron-down" size={14} color={roleFilter !== 'All Roles' ? '#B07FA8' : '#64748B'} />
            </TouchableOpacity>

            {/* Status Filter */}
            <TouchableOpacity
              style={[styles.filterDropdownBtn, statusFilter !== 'All Status' && styles.filterDropdownBtnActive]}
              onPress={() => setActiveDropdown('status')}>
              <Text style={[styles.filterDropdownBtnText, statusFilter !== 'All Status' && styles.filterDropdownBtnTextActive]}>
                {statusFilter}
              </Text>
              <IconComp name="chevron-down" size={14} color={statusFilter !== 'All Status' ? '#B07FA8' : '#64748B'} />
            </TouchableOpacity>

            {/* Gender Filter */}
            <TouchableOpacity
              style={[styles.filterDropdownBtn, genderFilter !== 'All Genders' && styles.filterDropdownBtnActive]}
              onPress={() => setActiveDropdown('gender')}>
              <Text style={[styles.filterDropdownBtnText, genderFilter !== 'All Genders' && styles.filterDropdownBtnTextActive]}>
                {genderFilter}
              </Text>
              <IconComp name="chevron-down" size={14} color={genderFilter !== 'All Genders' ? '#B07FA8' : '#64748B'} />
            </TouchableOpacity>

            {/* Staff Type Filter */}
            <TouchableOpacity
              style={[styles.filterDropdownBtn, staffTypeFilter !== 'All Staff Types' && styles.filterDropdownBtnActive]}
              onPress={() => setActiveDropdown('staffType')}>
              <IconComp name="filter-outline" size={12} color={staffTypeFilter !== 'All Staff Types' ? '#B07FA8' : '#64748B'} style={{ marginRight: 4 }} />
              <Text style={[styles.filterDropdownBtnText, staffTypeFilter !== 'All Staff Types' && styles.filterDropdownBtnTextActive]}>
                {staffTypeFilter === 'All Staff Types' ? 'Staff Type' : staffTypeFilter}
              </Text>
              <IconComp name="chevron-down" size={14} color={staffTypeFilter !== 'All Staff Types' ? '#B07FA8' : '#64748B'} />
            </TouchableOpacity>

            {/* Rows Per Page */}
            <TouchableOpacity
              style={styles.filterDropdownBtn}
              onPress={() => setActiveDropdown('rows')}>
              <Text style={styles.filterDropdownBtnText}>{rowsPerPage} rows</Text>
              <IconComp name="chevron-down" size={14} color="#64748B" />
            </TouchableOpacity>

            {/* Clear Filters Button if any filter active */}
            {(roleFilter !== 'All Roles' || statusFilter !== 'All Status' || genderFilter !== 'All Genders' || staffTypeFilter !== 'All Staff Types' || searchQuery !== '') && (
              <TouchableOpacity
                style={styles.clearFiltersBtn}
                onPress={() => {
                  setRoleFilter('All Roles');
                  setStatusFilter('All Status');
                  setGenderFilter('All Genders');
                  setStaffTypeFilter('All Staff Types');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}>
                <Text style={styles.clearFiltersBtnText}>Reset</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Staff Table / List Section */}
        <View style={styles.listContainer}>
          {/* Table Header Row */}
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.tableHeaderColText, { flex: 2 }]}>STAFF NAME</Text>
            <Text style={[styles.tableHeaderColText, { flex: 1.6 }]}>CONTACT</Text>
            <Text style={[styles.tableHeaderColText, { flex: 1.8 }]}>CLASS ASSIGNMENTS</Text>
            <Text style={[styles.tableHeaderColText, { flex: 1.2, textAlign: 'right' }]}>ACTIONS</Text>
          </View>

          {/* Content: Staff Cards or Empty State */}
          {paginatedStaff.length === 0 ? (
            /* EMPTY STATE MATCHING SCREENSHOT 1 */
            <View style={styles.emptyStateContainer}>
              <View style={styles.emptyShieldIconWrap}>
                <IconComp name="shield-checkmark-outline" size={44} color="#94A3B8" />
              </View>
              <Text style={styles.emptyStateTitle}>No staff members found</Text>
              <Text style={styles.emptyStateSubtitle}>
                Generate a teacher invite link to start onboarding your faculty.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setShowAddStaffModal(true)}>
                <IconComp name="person-add-outline" size={16} color="#FFFFFF" />
                <Text style={styles.emptyAddBtnText}>Add Staff Member</Text>
              </TouchableOpacity>
            </View>
          ) : (
            paginatedStaff.map(st => {
              const initial = (st.name || 'S').trim().charAt(0).toUpperCase();
              const isInactive = (st.status || '').toLowerCase() === 'inactive';
              return (
                <View key={st.id} style={styles.staffCard}>
                  {/* Row 1: Name, Role Pill, Status Pill */}
                  <View style={styles.staffCardHeaderRow}>
                    <View style={styles.staffAvatarCircle}>
                      <Text style={styles.staffAvatarText}>{initial}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={styles.staffNameText}>{st.name}</Text>
                        {st.staffId ? <Text style={styles.staffIdBadge}>#{st.staffId}</Text> : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 3 }}>
                        <View style={[styles.statusPill, isInactive ? styles.statusPillInactive : styles.statusPillActive]}>
                          <Text style={[styles.statusPillText, isInactive ? styles.statusPillTextInactive : styles.statusPillTextActive]}>
                            {st.status || 'Active'}
                          </Text>
                        </View>
                        <View style={styles.rolePill}>
                          <Text style={styles.rolePillText}>{st.role || 'Staffs'}</Text>
                        </View>
                        <View style={styles.staffTypePill}>
                          <Text style={styles.staffTypePillText}>{st.staffType || 'Teaching'}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Actions Row */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => setSelectedStaffForView(st)}>
                        <IconComp name="eye-outline" size={18} color="#64748B" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => setSelectedStaffForEdit(st)}>
                        <IconComp name="create-outline" size={18} color="#3B82F6" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => setStaffToDelete(st)}>
                        <IconComp name="trash-outline" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Row 2: Contact Info */}
                  <View style={styles.staffContactRow}>
                    <Text style={styles.contactItemText} numberOfLines={1}>
                      📧 {st.email || 'No email provided'}
                    </Text>
                    {(st.mobileNumber || st.phone) ? (
                      <Text style={styles.contactItemText}>
                        📞 {st.mobileNumber || st.phone}
                      </Text>
                    ) : null}
                  </View>

                  {/* Row 3: Class & Subject Assignments */}
                  {((st.classAssignments && st.classAssignments.length > 0) || (st.subjectAssignments && st.subjectAssignments.length > 0)) ? (
                    <View style={styles.assignmentsRow}>
                      {(st.classAssignments || []).map((ca, idx) => (
                        <View key={`ca-${idx}`} style={styles.classBadgePill}>
                          <Text style={styles.classBadgeText}>{ca}</Text>
                        </View>
                      ))}
                      {(st.subjectAssignments || []).map((sa, idx) => (
                        <View key={`sa-${idx}`} style={styles.subjBadgePill}>
                          <Text style={styles.subjBadgeText}>{sa}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.unassignedText}>No class or subject assigned</Text>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Pagination Controls */}
        {filteredStaff.length > rowsPerPage && (
          <View style={styles.paginationRow}>
            <Text style={styles.paginationInfoText}>
              Showing {Math.min((currentPage - 1) * rowsPerPage + 1, filteredStaff.length)} - {Math.min(currentPage * rowsPerPage, filteredStaff.length)} of {filteredStaff.length}
            </Text>
            <View style={styles.paginationBtns}>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]}
                disabled={currentPage === 1}
                onPress={() => setCurrentPage(p => Math.max(1, p - 1))}>
                <IconComp name="chevron-back" size={16} color={currentPage === 1 ? '#CBD5E1' : '#1E293B'} />
              </TouchableOpacity>
              <Text style={styles.pageNumberText}>Page {currentPage} of {totalPages}</Text>
              <TouchableOpacity
                style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]}
                disabled={currentPage === totalPages}
                onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                <IconComp name="chevron-forward" size={16} color={currentPage === totalPages ? '#CBD5E1' : '#1E293B'} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>

      {/* FILTER SELECTION MODAL */}
      <Modal visible={!!activeDropdown} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlayDark}
          activeOpacity={1}
          onPress={() => setActiveDropdown(null)}>
          <View style={styles.filterModalCard}>
            <View style={styles.filterModalHeader}>
              <Text style={styles.filterModalTitle}>
                {activeDropdown === 'role' && 'Select Staff Role'}
                {activeDropdown === 'status' && 'Select Staff Status'}
                {activeDropdown === 'gender' && 'Select Gender'}
                {activeDropdown === 'staffType' && 'Select Staff Type'}
                {activeDropdown === 'rows' && 'Select Rows Limit'}
              </Text>
              <TouchableOpacity onPress={() => setActiveDropdown(null)}>
                <IconComp name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 350 }}>
              {activeDropdown === 'role' && (
                <>
                  <TouchableOpacity
                    style={[styles.filterOptionItem, roleFilter === 'All Roles' && styles.filterOptionItemActive]}
                    onPress={() => { setRoleFilter('All Roles'); setCurrentPage(1); setActiveDropdown(null); }}>
                    <Text style={[styles.filterOptionText, roleFilter === 'All Roles' && styles.filterOptionTextActive]}>All Roles</Text>
                  </TouchableOpacity>
                  {ALL_ROLES_LIST.map(r => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.filterOptionItem, roleFilter === r && styles.filterOptionItemActive]}
                      onPress={() => { setRoleFilter(r); setCurrentPage(1); setActiveDropdown(null); }}>
                      <Text style={[styles.filterOptionText, roleFilter === r && styles.filterOptionTextActive]}>{r}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {activeDropdown === 'status' && (
                ['All Status', 'Active', 'Inactive'].map(s => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.filterOptionItem, statusFilter === s && styles.filterOptionItemActive]}
                    onPress={() => { setStatusFilter(s); setCurrentPage(1); setActiveDropdown(null); }}>
                    <Text style={[styles.filterOptionText, statusFilter === s && styles.filterOptionTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))
              )}

              {activeDropdown === 'gender' && (
                ['All Genders', 'Male', 'Female', 'Other'].map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.filterOptionItem, genderFilter === g && styles.filterOptionItemActive]}
                    onPress={() => { setGenderFilter(g); setCurrentPage(1); setActiveDropdown(null); }}>
                    <Text style={[styles.filterOptionText, genderFilter === g && styles.filterOptionTextActive]}>{g}</Text>
                  </TouchableOpacity>
                ))
              )}

              {activeDropdown === 'staffType' && (
                ['All Staff Types', 'Teaching Staff', 'Non-Teaching Staff'].map(st => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.filterOptionItem, staffTypeFilter === st && styles.filterOptionItemActive]}
                    onPress={() => { setStaffTypeFilter(st); setCurrentPage(1); setActiveDropdown(null); }}>
                    <Text style={[styles.filterOptionText, staffTypeFilter === st && styles.filterOptionTextActive]}>{st}</Text>
                  </TouchableOpacity>
                ))
              )}

              {activeDropdown === 'rows' && (
                [10, 20, 50].map(limit => (
                  <TouchableOpacity
                    key={limit}
                    style={[styles.filterOptionItem, rowsPerPage === limit && styles.filterOptionItemActive]}
                    onPress={() => { setRowsPerPage(limit); setCurrentPage(1); setActiveDropdown(null); }}>
                    <Text style={[styles.filterOptionText, rowsPerPage === limit && styles.filterOptionTextActive]}>{limit} rows</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* DELETE CONFIRMATION MODAL */}
      <Modal visible={!!staffToDelete} transparent animationType="fade">
        <View style={styles.modalOverlayDark}>
          <View style={styles.confirmDeleteCard}>
            <View style={styles.confirmDeleteIconWrap}>
              <IconComp name="alert-circle-outline" size={32} color="#DC2626" />
            </View>
            <Text style={styles.confirmDeleteTitle}>Delete Staff Member</Text>
            <Text style={styles.confirmDeleteMessage}>
              Are you sure you want to delete <Text style={{ fontWeight: 'bold' }}>{staffToDelete?.name}</Text>? This action cannot be undone.
            </Text>
            <View style={styles.confirmDeleteButtonsRow}>
              <TouchableOpacity
                style={styles.cancelDeleteBtn}
                onPress={() => setStaffToDelete(null)}>
                <Text style={styles.cancelDeleteBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDeleteBtn}
                onPress={confirmDeleteStaff}>
                <Text style={styles.confirmDeleteBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* VIEW / DETAILS MODAL */}
      {selectedStaffForView && (
        <ViewStaffModal
          staff={selectedStaffForView}
          visible={!!selectedStaffForView}
          onClose={() => setSelectedStaffForView(null)}
          onEdit={() => {
            const st = selectedStaffForView;
            setSelectedStaffForView(null);
            setSelectedStaffForEdit(st);
          }}
        />
      )}

      {/* ADD STAFF MODAL (MULTI-TAB) */}
      <AddStaffModal
        visible={showAddStaffModal}
        schoolId={schoolId}
        classesList={classesList}
        existingStaff={staffList}
        onClose={() => setShowAddStaffModal(false)}
        onStaffAdded={(newStaff) => {
          setShowAddStaffModal(false);
          showToast(`Added staff member ${newStaff.name}!`);
        }}
        addSubDocument={addSubDocument}
        showToast={showToast}
      />

      {/* EDIT STAFF MODAL (MULTI-TAB) */}
      {selectedStaffForEdit && (
        <AddStaffModal
          visible={!!selectedStaffForEdit}
          editStaff={selectedStaffForEdit}
          schoolId={schoolId}
          classesList={classesList}
          existingStaff={staffList}
          onClose={() => setSelectedStaffForEdit(null)}
          onStaffAdded={(updated) => {
            setSelectedStaffForEdit(null);
            showToast(`Updated staff member ${updated.name}!`);
          }}
          addSubDocument={addSubDocument}
          updateSubDocument={updateSubDocument}
          showToast={showToast}
        />
      )}

      {/* BULK IMPORT MODAL (SCREENSHOT 2 MATCHING) */}
      <BulkImportStaffModal
        visible={showBulkImportModal}
        schoolId={schoolId}
        onClose={() => setShowBulkImportModal(false)}
        addSubDocument={addSubDocument}
        showToast={showToast}
      />
    </View>
  );
};

// =========================================================================
// ADD STAFF MULTI-TAB MODAL COMPONENT (SCREENSHOTS 3, 4, 5 MATCHING)
// =========================================================================
interface AddStaffModalProps {
  visible: boolean;
  schoolId: string;
  classesList: any[];
  existingStaff: StaffItem[];
  editStaff?: StaffItem | null;
  onClose: () => void;
  onStaffAdded: (st: StaffItem) => void;
  addSubDocument: (schoolId: string, subCollection: string, data: any) => Promise<string>;
  updateSubDocument?: (schoolId: string, subCollection: string, docId: string, data: any) => Promise<void>;
  showToast: (msg: string) => void;
}

type TabKey = 'Personal' | 'Educational' | 'Professional' | 'Government & Identity' | 'Employment' | 'Banking' | 'Uploads';

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  visible,
  schoolId,
  classesList,
  existingStaff,
  editStaff = null,
  onClose,
  onStaffAdded,
  addSubDocument,
  updateSubDocument,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('Personal');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form fields state (Starts EMPTY for new staff, filled for editing)
  const [staffId, setStaffId] = useState(editStaff?.staffId || editStaff?.employeeId || '');
  const [firstName, setFirstName] = useState(editStaff?.firstName || (editStaff ? editStaff.name.split(' ')[0] : ''));
  const [lastName, setLastName] = useState(editStaff?.lastName || (editStaff ? editStaff.name.split(' ').slice(1).join(' ') : ''));
  const [email, setEmail] = useState(editStaff?.email || '');
  const [mobileNumber, setMobileNumber] = useState(editStaff?.mobileNumber || editStaff?.phone || '');
  const [dob, setDob] = useState(editStaff?.dob || '');
  const [gender, setGender] = useState(editStaff?.gender || 'Male');
  const [nationality, setNationality] = useState(editStaff?.nationality || 'Indian');
  const [maritalStatus, setMaritalStatus] = useState(editStaff?.maritalStatus || 'Single');
  const [bloodGroup, setBloodGroup] = useState(editStaff?.bloodGroup || '');
  const [fatherGuardianName, setFatherGuardianName] = useState(editStaff?.fatherGuardianName || '');
  const [emergencyContact, setEmergencyContact] = useState(editStaff?.emergencyContact || '');
  const [assignedRoles, setAssignedRoles] = useState<string[]>(
    editStaff?.roles || (editStaff?.role ? [editStaff.role] : ['Staffs'])
  );
  const [assignedClassId, setAssignedClassId] = useState(editStaff?.assignedClassId || '');
  const [staffType, setStaffType] = useState(editStaff?.staffType || (editStaff?.staff_type === 'non-teaching' ? 'Non-Teaching Staff' : 'Teaching Staff'));
  const [languagesKnown, setLanguagesKnown] = useState(editStaff?.languagesKnown || '');
  const [residentialAddress, setResidentialAddress] = useState(editStaff?.residentialAddress || '');

  // Educational
  const [highestQualification, setHighestQualification] = useState(editStaff?.highestQualification || '');
  const [degreeSpecialization, setDegreeSpecialization] = useState(editStaff?.degreeSpecialization || '');
  const [universityName, setUniversityName] = useState(editStaff?.universityName || '');
  const [yearOfPassing, setYearOfPassing] = useState(editStaff?.yearOfPassing || '');

  // Professional
  const [previousExperience, setPreviousExperience] = useState(editStaff?.previousExperience || '0');
  const [previousOrganization, setPreviousOrganization] = useState(editStaff?.previousOrganization || '');
  const [subjectSpecialization, setSubjectSpecialization] = useState(editStaff?.subjectSpecialization || '');
  const [gradesClassesHandled, setGradesClassesHandled] = useState(editStaff?.gradesClassesHandled || '');
  const [professionalCertifications, setProfessionalCertifications] = useState(editStaff?.professionalCertifications || '');

  // Government & Identity
  const [govtIdType, setGovtIdType] = useState(editStaff?.govtIdType || 'Aadhaar');
  const [govtIdNumber, setGovtIdNumber] = useState(editStaff?.govtIdNumber || '');
  const [aadharNumber, setAadharNumber] = useState(editStaff?.aadharNumber || '');
  const [panNumber, setPanNumber] = useState(editStaff?.panNumber || '');
  const [taxIdDetails, setTaxIdDetails] = useState(editStaff?.taxIdDetails || '');

  // Employment
  const [pfNumber, setPfNumber] = useState(editStaff?.pfNumber || '');
  const [esicNumber, setEsicNumber] = useState(editStaff?.esicNumber || '');
  const [uanNumber, setUanNumber] = useState(editStaff?.uanNumber || '');

  // Banking
  const [bankName, setBankName] = useState(editStaff?.bankName || '');
  const [bankAccountNumber, setBankAccountNumber] = useState(editStaff?.bankAccountNumber || '');
  const [branchName, setBranchName] = useState(editStaff?.branchName || '');
  const [ifscCode, setIfscCode] = useState(editStaff?.ifscCode || '');

  // Uploads state (holds picked files)
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, any[]>>({
    photo: editStaff?.photoUrl ? [{ name: 'Current Photo', uri: editStaff.photoUrl }] : [],
    academicCertificates: editStaff?.academicCertificates || [],
    markSheets: editStaff?.markSheets || [],
    experienceCertificates: editStaff?.experienceCertificates || [],
    relievingLetter: editStaff?.relievingLetter || [],
    resume: editStaff?.resume || [],
    referenceLetters: editStaff?.referenceLetters || [],
    govtIdDocument: editStaff?.govtIdDocument || [],
  });

  // Modal pickers state inside Add Staff
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showMaritalPicker, setShowMaritalPicker] = useState(false);
  const [showStaffTypePicker, setShowStaffTypePicker] = useState(false);
  const [showGovtIdTypePicker, setShowGovtIdTypePicker] = useState(false);

  // Date Picker State
  const [pickerDay, setPickerDay] = useState('15');
  const [pickerMonth, setPickerMonth] = useState('06');
  const [pickerYear, setPickerYear] = useState('1990');

  // Multi-tab items
  const TABS: TabKey[] = [
    'Personal',
    'Educational',
    'Professional',
    'Government & Identity',
    'Employment',
    'Banking',
    'Uploads',
  ];

  // Validation function matching web rules
  const validateForm = (): boolean => {
    const errs: Record<string, string> = {};

    if (!staffId.trim()) errs.staffId = 'Staff ID is required';
    if (!firstName.trim()) errs.firstName = 'First name is required';
    if (!lastName.trim()) errs.lastName = 'Last name is required';
    if (!email.trim()) {
      errs.email = 'Email is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) errs.email = 'Invalid email format';
    }

    // Uniqueness check
    const currentId = editStaff?.id;
    const isIdDuplicate = existingStaff.some(
      s => s.id !== currentId && s.staffId && s.staffId.trim().toLowerCase() === staffId.trim().toLowerCase()
    );
    if (isIdDuplicate) errs.staffId = 'Staff ID must be unique';

    const isEmailDuplicate = existingStaff.some(
      s => s.id !== currentId && s.email && s.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (isEmailDuplicate) errs.email = 'Email must be unique';

    if (mobileNumber.trim() && !/^\d{10}$/.test(mobileNumber.trim())) {
      errs.mobileNumber = 'Mobile number must be 10 digits';
    }

    if (emergencyContact.trim() && !/^\d{10}$/.test(emergencyContact.trim())) {
      errs.emergencyContact = 'Emergency contact must be 10 digits';
    }

    if (aadharNumber.trim() && !/^\d{12}$/.test(aadharNumber.trim())) {
      errs.aadharNumber = 'Aadhaar number must be 12 digits';
    }

    if (panNumber.trim() && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
      errs.panNumber = 'Invalid PAN format (e.g. ABCDE1234F)';
    }

    if (ifscCode.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
      errs.ifscCode = 'Invalid IFSC format (e.g. SBIN0001234)';
    }

    if (yearOfPassing.trim()) {
      const currentYear = new Date().getFullYear();
      if (Number(yearOfPassing) > currentYear) {
        errs.yearOfPassing = 'Year cannot be in the future';
      }
    }

    if (bankAccountNumber.trim() && !/^\d+$/.test(bankAccountNumber.trim())) {
      errs.bankAccountNumber = 'Bank account must be digits only';
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.staffId || errs.firstName || errs.lastName || errs.email || errs.mobileNumber || errs.emergencyContact) {
        setActiveTab('Personal');
      } else if (errs.yearOfPassing) {
        setActiveTab('Educational');
      } else if (errs.aadharNumber || errs.panNumber) {
        setActiveTab('Government & Identity');
      } else if (errs.bankAccountNumber || errs.ifscCode) {
        setActiveTab('Banking');
      }
      return false;
    }
    return true;
  };

  // Handle Pick File for Uploads Tab
  const handlePickFileForSlot = async (slotKey: string, fileType: 'image' | 'pdf' | 'document') => {
    const file = await pickDocument(fileType);
    if (file) {
      setUploadedFiles(prev => ({
        ...prev,
        [slotKey]: slotKey === 'photo' ? [file] : [...(prev[slotKey] || []), file],
      }));
      showToast(`Attached ${file.name}`);
    }
  };

  // Handle Remove File
  const handleRemoveFile = (slotKey: string, index: number) => {
    setUploadedFiles(prev => {
      const list = [...(prev[slotKey] || [])];
      list.splice(index, 1);
      return { ...prev, [slotKey]: list };
    });
  };

  // Save / Submit Staff Member
  const handleSubmit = async () => {
    if (!validateForm()) {
      Alert.alert('Validation Error', 'Please resolve the highlighted errors before saving.');
      return;
    }

    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      const primaryRole = assignedRoles.length > 0 ? assignedRoles[0] : 'Staffs';
      const isTeaching = staffType.toLowerCase().includes('teach') && !staffType.toLowerCase().includes('non');

      const staffData: any = {
        staffId: staffId.trim(),
        employeeId: staffId.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        name: fullName,
        email: email.trim(),
        mobileNumber: mobileNumber.trim(),
        phone: mobileNumber.trim(),
        dob: dob.trim(),
        gender,
        nationality: nationality.trim(),
        maritalStatus,
        bloodGroup: bloodGroup.trim(),
        fatherGuardianName: fatherGuardianName.trim(),
        emergencyContact: emergencyContact.trim(),
        role: primaryRole,
        roles: assignedRoles,
        assignedClassId: assignedClassId || '',
        staffType: isTeaching ? 'Teaching Staff' : 'Non-Teaching Staff',
        staff_type: isTeaching ? 'teaching' : 'non-teaching',
        status: editStaff?.status || 'Active',
        languagesKnown: languagesKnown.trim(),
        residentialAddress: residentialAddress.trim(),
        highestQualification: highestQualification.trim(),
        degreeSpecialization: degreeSpecialization.trim(),
        universityName: universityName.trim(),
        yearOfPassing: yearOfPassing.trim(),
        previousExperience: previousExperience.trim(),
        previousOrganization: previousOrganization.trim(),
        subjectSpecialization: subjectSpecialization.trim(),
        gradesClassesHandled: gradesClassesHandled.trim(),
        professionalCertifications: professionalCertifications.trim(),
        govtIdType,
        govtIdNumber: govtIdNumber.trim(),
        aadharNumber: aadharNumber.trim(),
        panNumber: panNumber.trim().toUpperCase(),
        taxIdDetails: taxIdDetails.trim(),
        pfNumber: pfNumber.trim(),
        esicNumber: esicNumber.trim(),
        uanNumber: uanNumber.trim(),
        bankName: bankName.trim(),
        bankAccountNumber: bankAccountNumber.trim(),
        branchName: branchName.trim(),
        ifscCode: ifscCode.trim().toUpperCase(),
        classAssignments: assignedClassId ? [`Class: ${assignedClassId}`] : (editStaff?.classAssignments || []),
        subjectAssignments: subjectSpecialization ? [subjectSpecialization] : (editStaff?.subjectAssignments || []),
        academicCertificates: uploadedFiles.academicCertificates || [],
        markSheets: uploadedFiles.markSheets || [],
        experienceCertificates: uploadedFiles.experienceCertificates || [],
        relievingLetter: uploadedFiles.relievingLetter || [],
        resume: uploadedFiles.resume || [],
        referenceLetters: uploadedFiles.referenceLetters || [],
        govtIdDocument: uploadedFiles.govtIdDocument || [],
        updatedAt: new Date().toISOString(),
      };

      if (uploadedFiles.photo && uploadedFiles.photo.length > 0) {
        staffData.photoUrl = uploadedFiles.photo[0].uri || '';
      }

      if (editStaff && editStaff.id && updateSubDocument) {
        await updateSubDocument(schoolId, 'teachers', editStaff.id, staffData);
        onStaffAdded({ id: editStaff.id, ...staffData });
      } else {
        staffData.createdAt = new Date().toISOString();
        const newId = await addSubDocument(schoolId, 'teachers', staffData);
        onStaffAdded({ id: newId, ...staffData });
      }
    } catch (err: any) {
      console.warn('Save staff error:', err);
      Alert.alert('Save Failed', err?.message || 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}>
      <View style={styles.addStaffModalOverlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.addStaffKeyboardWrapper}>
          <View style={styles.addStaffModalSheet}>
            {/* Modal Header */}
            <View style={styles.addStaffHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.headerIconCircle}>
                  <IconComp name="person-add" size={18} color="#7C3AED" />
                </View>
                <View>
                  <Text style={styles.addStaffHeaderTitle}>
                    {editStaff ? 'Edit Staff Member' : 'Add Staff Member'}
                  </Text>
                  <Text style={styles.addStaffHeaderSubtitle}>Admin Portal · Staff Directory</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <IconComp name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            {/* Horizontal Tabs Navigation */}
            <View style={styles.tabsNavContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tabsNavScroll}>
                {TABS.map(tab => {
                  const isActive = activeTab === tab;
                  return (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tabNavItem, isActive && styles.tabNavItemActive]}
                      onPress={() => setActiveTab(tab)}>
                      <Text style={[styles.tabNavText, isActive && styles.tabNavTextActive]}>{tab}</Text>
                      {isActive && <View style={styles.tabNavIndicator} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Scrollable Tab Body Content */}
            <KeyboardAwareFormScrollView
              style={styles.addStaffScrollBody}
              contentContainerStyle={styles.addStaffScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              
              {/* ================= TAB 1: PERSONAL ================= */}
              {activeTab === 'Personal' && (
                <View style={styles.tabSectionContainer}>
                  {/* Staff ID */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>STAFF ID *</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.staffId ? styles.inputBoxError : null]}
                      placeholder="e.g. ST1001"
                      placeholderTextColor="#94A3B8"
                      value={staffId}
                      onChangeText={setStaffId}
                    />
                    {errors.staffId ? <Text style={styles.fieldErrorText}>{errors.staffId}</Text> : null}
                  </View>

                  {/* First Name & Last Name (2 columns) */}
                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>FIRST NAME *</Text>
                      <FocusTextInput
                        style={[styles.inputBox, errors.firstName ? styles.inputBoxError : null]}
                        placeholder="e.g. John"
                        placeholderTextColor="#94A3B8"
                        value={firstName}
                        onChangeText={setFirstName}
                      />
                      {errors.firstName ? <Text style={styles.fieldErrorText}>{errors.firstName}</Text> : null}
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>LAST NAME *</Text>
                      <FocusTextInput
                        style={[styles.inputBox, errors.lastName ? styles.inputBoxError : null]}
                        placeholder="e.g. Doe"
                        placeholderTextColor="#94A3B8"
                        value={lastName}
                        onChangeText={setLastName}
                      />
                      {errors.lastName ? <Text style={styles.fieldErrorText}>{errors.lastName}</Text> : null}
                    </View>
                  </View>

                  {/* Email Address (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>EMAIL ADDRESS *</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.email ? styles.inputBoxError : null]}
                      placeholder="john.doe@example.com"
                      placeholderTextColor="#94A3B8"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      value={email}
                      onChangeText={setEmail}
                    />
                    {errors.email ? <Text style={styles.fieldErrorText}>{errors.email}</Text> : null}
                  </View>

                  {/* Mobile Number & Date of Birth (2 columns) */}
                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>MOBILE NUMBER</Text>
                      <FocusTextInput
                        style={[styles.inputBox, errors.mobileNumber ? styles.inputBoxError : null]}
                        placeholder="e.g. 9876543210"
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        value={mobileNumber}
                        onChangeText={setMobileNumber}
                      />
                      {errors.mobileNumber ? <Text style={styles.fieldErrorText}>{errors.mobileNumber}</Text> : null}
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
                      <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setShowDatePicker(true)}>
                        <Text style={[styles.dropdownTriggerText, !dob && { color: '#94A3B8' }]}>
                          {dob || 'dd-mm-yyyy'}
                        </Text>
                        <IconComp name="calendar-outline" size={16} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Gender & Marital Status (2 columns) */}
                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>GENDER</Text>
                      <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setShowGenderPicker(true)}>
                        <Text style={styles.dropdownTriggerText}>{gender}</Text>
                        <IconComp name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>MARITAL STATUS</Text>
                      <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setShowMaritalPicker(true)}>
                        <Text style={styles.dropdownTriggerText}>{maritalStatus}</Text>
                        <IconComp name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Nationality & Blood Group (2 columns) */}
                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>NATIONALITY</Text>
                      <FocusTextInput
                        style={styles.inputBox}
                        placeholder="e.g. Indian"
                        placeholderTextColor="#94A3B8"
                        value={nationality}
                        onChangeText={setNationality}
                      />
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>BLOOD GROUP</Text>
                      <FocusTextInput
                        style={styles.inputBox}
                        placeholder="e.g. O+, A-"
                        placeholderTextColor="#94A3B8"
                        value={bloodGroup}
                        onChangeText={setBloodGroup}
                      />
                    </View>
                  </View>

                  {/* Father / Guardian Name (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>FATHER / GUARDIAN NAME</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="Father or Guardian Name"
                      placeholderTextColor="#94A3B8"
                      value={fatherGuardianName}
                      onChangeText={setFatherGuardianName}
                    />
                  </View>

                  {/* Emergency Contact Details (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>EMERGENCY CONTACT DETAILS</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.emergencyContact ? styles.inputBoxError : null]}
                      placeholder="Emergency Mobile No."
                      placeholderTextColor="#94A3B8"
                      keyboardType="phone-pad"
                      value={emergencyContact}
                      onChangeText={setEmergencyContact}
                    />
                    {errors.emergencyContact ? <Text style={styles.fieldErrorText}>{errors.emergencyContact}</Text> : null}
                  </View>

                  {/* Assigned Roles * (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>ASSIGNED ROLES *</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowRolePicker(true)}>
                      <Text style={{ color: '#64748B', fontSize: 13 }}>-- Choose a role to add --</Text>
                      <IconComp name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>

                    {/* Tag Pills */}
                    <View style={styles.tagsContainer}>
                      {assignedRoles.map(r => (
                        <View key={r} style={styles.roleTagPill}>
                          <Text style={styles.roleTagText}>{r}</Text>
                          <TouchableOpacity
                            onPress={() => {
                              const updated = assignedRoles.filter(x => x !== r);
                              setAssignedRoles(updated.length > 0 ? updated : ['Staffs']);
                            }}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <IconComp name="close" size={13} color="#4338CA" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  </View>

                  {/* Assign Class & Staff Type (2 columns) */}
                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>ASSIGN CLASS (OPTIONAL)</Text>
                      <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setShowClassPicker(true)}>
                        <Text style={styles.dropdownTriggerText} numberOfLines={1}>
                          {assignedClassId ? `Class: ${assignedClassId}` : '-- Unassigned --'}
                        </Text>
                        <IconComp name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>STAFF TYPE *</Text>
                      <TouchableOpacity
                        style={styles.dropdownTrigger}
                        onPress={() => setShowStaffTypePicker(true)}>
                        <Text style={styles.dropdownTriggerText} numberOfLines={1}>{staffType}</Text>
                        <IconComp name="chevron-down" size={14} color="#64748B" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Languages Known (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>LANGUAGES KNOWN</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. English, Hindi, Tamil"
                      placeholderTextColor="#94A3B8"
                      value={languagesKnown}
                      onChangeText={setLanguagesKnown}
                    />
                  </View>

                  {/* Residential Address (Full width) */}
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>RESIDENTIAL ADDRESS</Text>
                    <FocusTextInput
                      style={[styles.inputBox, { height: 72, textAlignVertical: 'top', paddingTop: 8 }]}
                      placeholder="Full Residential Address"
                      placeholderTextColor="#94A3B8"
                      multiline
                      numberOfLines={3}
                      value={residentialAddress}
                      onChangeText={setResidentialAddress}
                    />
                  </View>
                </View>
              )}

              {/* ================= TAB 2: EDUCATIONAL ================= */}
              {activeTab === 'Educational' && (
                <View style={styles.tabSectionContainer}>
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>HIGHEST QUALIFICATION</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. Master of Arts"
                      placeholderTextColor="#94A3B8"
                      value={highestQualification}
                      onChangeText={setHighestQualification}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>DEGREE(S) AND SPECIALIZATION</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. B.Ed in English Literature"
                      placeholderTextColor="#94A3B8"
                      value={degreeSpecialization}
                      onChangeText={setDegreeSpecialization}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>UNIVERSITY / COLLEGE NAME</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. University of Delhi"
                      placeholderTextColor="#94A3B8"
                      value={universityName}
                      onChangeText={setUniversityName}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>YEAR OF PASSING</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.yearOfPassing ? styles.inputBoxError : null]}
                      placeholder="e.g. 2018"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={4}
                      value={yearOfPassing}
                      onChangeText={setYearOfPassing}
                    />
                    {errors.yearOfPassing ? <Text style={styles.fieldErrorText}>{errors.yearOfPassing}</Text> : null}
                  </View>
                </View>
              )}

              {/* ================= TAB 3: PROFESSIONAL ================= */}
              {activeTab === 'Professional' && (
                <View style={styles.tabSectionContainer}>
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>PREVIOUS EXPERIENCE (YEARS)</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="0"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={previousExperience}
                      onChangeText={setPreviousExperience}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>PREVIOUS SCHOOL / ORGANIZATION</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="Previous School Name"
                      placeholderTextColor="#94A3B8"
                      value={previousOrganization}
                      onChangeText={setPreviousOrganization}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>SUBJECT SPECIALIZATION</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. English Literature, Physics"
                      placeholderTextColor="#94A3B8"
                      value={subjectSpecialization}
                      onChangeText={setSubjectSpecialization}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>GRADES / CLASSES HANDLED</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. Class 9, Class 10 (comma separated)"
                      placeholderTextColor="#94A3B8"
                      value={gradesClassesHandled}
                      onChangeText={setGradesClassesHandled}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>PROFESSIONAL CERTIFICATIONS</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. TEFL, CBSE In-Service Training"
                      placeholderTextColor="#94A3B8"
                      value={professionalCertifications}
                      onChangeText={setProfessionalCertifications}
                    />
                  </View>
                </View>
              )}

              {/* ================= TAB 4: GOVERNMENT & IDENTITY ================= */}
              {activeTab === 'Government & Identity' && (
                <View style={styles.tabSectionContainer}>
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>GOVERNMENT-ISSUED ID TYPE</Text>
                    <TouchableOpacity
                      style={styles.dropdownTrigger}
                      onPress={() => setShowGovtIdTypePicker(true)}>
                      <Text style={styles.dropdownTriggerText}>{govtIdType}</Text>
                      <IconComp name="chevron-down" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>GOVERNMENT-ISSUED ID NUMBER</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="ID Document Number"
                      placeholderTextColor="#94A3B8"
                      value={govtIdNumber}
                      onChangeText={setGovtIdNumber}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>AADHAAR NUMBER (12 DIGITS)</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.aadharNumber ? styles.inputBoxError : null]}
                      placeholder="e.g. 123456789012"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      maxLength={12}
                      value={aadharNumber}
                      onChangeText={setAadharNumber}
                    />
                    {errors.aadharNumber ? <Text style={styles.fieldErrorText}>{errors.aadharNumber}</Text> : null}
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>PAN NUMBER</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.panNumber ? styles.inputBoxError : null]}
                      placeholder="e.g. ABCDE1234F"
                      placeholderTextColor="#94A3B8"
                      autoCapitalize="characters"
                      maxLength={10}
                      value={panNumber}
                      onChangeText={setPanNumber}
                    />
                    {errors.panNumber ? <Text style={styles.fieldErrorText}>{errors.panNumber}</Text> : null}
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>TAX IDENTIFICATION DETAILS (IF DIFFERENT)</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="Tax ID particulars"
                      placeholderTextColor="#94A3B8"
                      value={taxIdDetails}
                      onChangeText={setTaxIdDetails}
                    />
                  </View>
                </View>
              )}

              {/* ================= TAB 5: EMPLOYMENT ================= */}
              {activeTab === 'Employment' && (
                <View style={styles.tabSectionContainer}>
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>PF NUMBER</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="Provident Fund Number"
                      placeholderTextColor="#94A3B8"
                      value={pfNumber}
                      onChangeText={setPfNumber}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>ESIC NUMBER</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="ESIC Registration Number"
                      placeholderTextColor="#94A3B8"
                      value={esicNumber}
                      onChangeText={setEsicNumber}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>UAN NUMBER</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="Universal Account Number"
                      placeholderTextColor="#94A3B8"
                      value={uanNumber}
                      onChangeText={setUanNumber}
                    />
                  </View>
                </View>
              )}

              {/* ================= TAB 6: BANKING ================= */}
              {activeTab === 'Banking' && (
                <View style={styles.tabSectionContainer}>
                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>BANK NAME</Text>
                    <FocusTextInput
                      style={styles.inputBox}
                      placeholder="e.g. State Bank of India"
                      placeholderTextColor="#94A3B8"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                  </View>

                  <View style={styles.formColFull}>
                    <Text style={styles.fieldLabel}>BANK ACCOUNT NUMBER</Text>
                    <FocusTextInput
                      style={[styles.inputBox, errors.bankAccountNumber ? styles.inputBoxError : null]}
                      placeholder="Digits only"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={bankAccountNumber}
                      onChangeText={setBankAccountNumber}
                    />
                    {errors.bankAccountNumber ? <Text style={styles.fieldErrorText}>{errors.bankAccountNumber}</Text> : null}
                  </View>

                  <View style={styles.formRowTwo}>
                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>BRANCH NAME</Text>
                      <FocusTextInput
                        style={styles.inputBox}
                        placeholder="e.g. Connaught Place Branch"
                        placeholderTextColor="#94A3B8"
                        value={branchName}
                        onChangeText={setBranchName}
                      />
                    </View>

                    <View style={styles.formCol}>
                      <Text style={styles.fieldLabel}>IFSC CODE</Text>
                      <FocusTextInput
                        style={[styles.inputBox, errors.ifscCode ? styles.inputBoxError : null]}
                        placeholder="e.g. SBIN0001234"
                        placeholderTextColor="#94A3B8"
                        autoCapitalize="characters"
                        maxLength={11}
                        value={ifscCode}
                        onChangeText={setIfscCode}
                      />
                      {errors.ifscCode ? <Text style={styles.fieldErrorText}>{errors.ifscCode}</Text> : null}
                    </View>
                  </View>
                </View>
              )}

              {/* ================= TAB 7: UPLOADS ================= */}
              {activeTab === 'Uploads' && (
                <View style={styles.tabSectionContainer}>
                  {/* Photo Slot */}
                  <View style={styles.uploadSlotBox}>
                    <Text style={styles.uploadSlotLabel}>PHOTOGRAPH (JPG/PNG)</Text>
                    <View style={styles.uploadBtnRow}>
                      <TouchableOpacity
                        style={styles.chooseFileBtn}
                        onPress={() => handlePickFileForSlot('photo', 'image')}>
                        <Text style={styles.chooseFileBtnText}>Choose File</Text>
                      </TouchableOpacity>
                      <Text style={styles.slotStatusText} numberOfLines={1}>
                        {(uploadedFiles.photo && uploadedFiles.photo.length > 0)
                          ? uploadedFiles.photo[0].name
                          : 'No file chosen'}
                      </Text>
                    </View>
                    {uploadedFiles.photo && uploadedFiles.photo.length > 0 && (
                      <TouchableOpacity
                        style={{ marginTop: 4, alignSelf: 'flex-start' }}
                        onPress={() => handleRemoveFile('photo', 0)}>
                        <Text style={{ fontSize: 12, color: '#EF4444' }}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Multi File Slots */}
                  {[
                    { key: 'academicCertificates', label: 'ACADEMIC CERTIFICATES (PDF/IMAGES)', type: 'document' as const },
                    { key: 'markSheets', label: 'MARK SHEETS (PDF/IMAGES)', type: 'document' as const },
                    { key: 'experienceCertificates', label: 'EXPERIENCE CERTIFICATES (PDF/IMAGES)', type: 'document' as const },
                    { key: 'relievingLetter', label: 'RELIEVING LETTER (PDF/IMAGES)', type: 'document' as const },
                    { key: 'resume', label: 'RESUME / CV (PDF/IMAGES)', type: 'document' as const },
                    { key: 'referenceLetters', label: 'REFERENCE LETTERS (PDF/IMAGES)', type: 'document' as const },
                    { key: 'govtIdDocument', label: 'GOVERNMENT-ISSUED ID DOCUMENT (PDF/IMAGES)', type: 'document' as const },
                  ].map(slot => (
                    <View key={slot.key} style={styles.uploadSlotBox}>
                      <Text style={styles.uploadSlotLabel}>{slot.label}</Text>
                      <View style={styles.uploadBtnRow}>
                        <TouchableOpacity
                          style={styles.chooseFileBtn}
                          onPress={() => handlePickFileForSlot(slot.key, slot.type)}>
                          <Text style={styles.chooseFileBtnText}>Choose Files</Text>
                        </TouchableOpacity>
                        <Text style={styles.slotStatusText} numberOfLines={1}>
                          {(uploadedFiles[slot.key] && uploadedFiles[slot.key].length > 0)
                            ? `${uploadedFiles[slot.key].length} file(s) chosen`
                            : 'No file chosen'}
                        </Text>
                      </View>

                      {/* Attached items list */}
                      {(uploadedFiles[slot.key] || []).map((f, idx) => (
                        <View key={idx} style={styles.attachedFileChip}>
                          <IconComp name="document-text-outline" size={13} color="#64748B" />
                          <Text style={styles.attachedFileName} numberOfLines={1}>{f.name}</Text>
                          <TouchableOpacity onPress={() => handleRemoveFile(slot.key, idx)}>
                            <IconComp name="close-circle" size={14} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </KeyboardAwareFormScrollView>

            {/* Fixed Bottom Actions Bar */}
            <View style={styles.addStaffFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={onClose}
                disabled={saving}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSubmitBtn}
                onPress={handleSubmit}
                disabled={saving}
                activeOpacity={0.8}>
                {saving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>
                    {editStaff ? 'Save Changes' : 'Add Staff Member'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

        {/* DATE OF BIRTH PICKER MODAL */}
        <Modal visible={showDatePicker} transparent animationType="fade">
          <View style={styles.modalOverlayDark}>
            <View style={styles.pickerDialogCard}>
              <Text style={styles.pickerDialogTitle}>Select Date of Birth</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
                {/* Day */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>DAY</Text>
                  <FocusTextInput
                    style={styles.inputBox}
                    placeholder="DD"
                    keyboardType="numeric"
                    maxLength={2}
                    value={pickerDay}
                    onChangeText={setPickerDay}
                  />
                </View>
                {/* Month */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>MONTH</Text>
                  <FocusTextInput
                    style={styles.inputBox}
                    placeholder="MM"
                    keyboardType="numeric"
                    maxLength={2}
                    value={pickerMonth}
                    onChangeText={setPickerMonth}
                  />
                </View>
                {/* Year */}
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.fieldLabel}>YEAR</Text>
                  <FocusTextInput
                    style={styles.inputBox}
                    placeholder="YYYY"
                    keyboardType="numeric"
                    maxLength={4}
                    value={pickerYear}
                    onChangeText={setPickerYear}
                  />
                </View>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
                <TouchableOpacity
                  style={styles.dialogCancelBtn}
                  onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.dialogCancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dialogOkBtn}
                  onPress={() => {
                    const formatted = `${pickerDay.padStart(2, '0')}-${pickerMonth.padStart(2, '0')}-${pickerYear}`;
                    setDob(formatted);
                    setShowDatePicker(false);
                  }}>
                  <Text style={styles.dialogOkBtnText}>Select</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ROLE PICKER MODAL */}
        <Modal visible={showRolePicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowRolePicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Assign Roles</Text>
              <ScrollView style={{ maxHeight: 350 }}>
                {ALL_ROLES_LIST.map(r => {
                  const isAssigned = assignedRoles.includes(r);
                  return (
                    <TouchableOpacity
                      key={r}
                      style={[styles.filterOptionItem, isAssigned && styles.filterOptionItemActive]}
                      onPress={() => {
                        if (isAssigned) {
                          const updated = assignedRoles.filter(x => x !== r);
                          setAssignedRoles(updated.length > 0 ? updated : ['Staffs']);
                        } else {
                          setAssignedRoles(prev => [...prev, r]);
                        }
                        setShowRolePicker(false);
                      }}>
                      <Text style={[styles.filterOptionText, isAssigned && styles.filterOptionTextActive]}>
                        {r} {isAssigned ? '✓' : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* CLASS PICKER MODAL */}
        <Modal visible={showClassPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowClassPicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Assign Class</Text>
              <ScrollView style={{ maxHeight: 350 }}>
                <TouchableOpacity
                  style={[styles.filterOptionItem, !assignedClassId && styles.filterOptionItemActive]}
                  onPress={() => { setAssignedClassId(''); setShowClassPicker(false); }}>
                  <Text style={[styles.filterOptionText, !assignedClassId && styles.filterOptionTextActive]}>-- Unassigned --</Text>
                </TouchableOpacity>
                {classesList.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.filterOptionItem, assignedClassId === c.name && styles.filterOptionItemActive]}
                    onPress={() => { setAssignedClassId(`${c.name} - ${c.section || 'A'}`); setShowClassPicker(false); }}>
                    <Text style={[styles.filterOptionText, assignedClassId === c.name && styles.filterOptionTextActive]}>
                      {c.name} - {c.section || 'Section A'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* GENDER PICKER */}
        <Modal visible={showGenderPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowGenderPicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Select Gender</Text>
              {['Male', 'Female', 'Other'].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.filterOptionItem, gender === g && styles.filterOptionItemActive]}
                  onPress={() => { setGender(g); setShowGenderPicker(false); }}>
                  <Text style={[styles.filterOptionText, gender === g && styles.filterOptionTextActive]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* MARITAL STATUS PICKER */}
        <Modal visible={showMaritalPicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowMaritalPicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Select Marital Status</Text>
              {['Single', 'Married', 'Divorced', 'Widowed'].map(m => (
                <TouchableOpacity
                  key={m}
                  style={[styles.filterOptionItem, maritalStatus === m && styles.filterOptionItemActive]}
                  onPress={() => { setMaritalStatus(m); setShowMaritalPicker(false); }}>
                  <Text style={[styles.filterOptionText, maritalStatus === m && styles.filterOptionTextActive]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* STAFF TYPE PICKER */}
        <Modal visible={showStaffTypePicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowStaffTypePicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Select Staff Type</Text>
              {['Teaching Staff', 'Non-Teaching Staff'].map(st => (
                <TouchableOpacity
                  key={st}
                  style={[styles.filterOptionItem, staffType === st && styles.filterOptionItemActive]}
                  onPress={() => { setStaffType(st); setShowStaffTypePicker(false); }}>
                  <Text style={[styles.filterOptionText, staffType === st && styles.filterOptionTextActive]}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* GOVT ID TYPE PICKER */}
        <Modal visible={showGovtIdTypePicker} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlayDark}
            activeOpacity={1}
            onPress={() => setShowGovtIdTypePicker(false)}>
            <View style={styles.filterModalCard}>
              <Text style={styles.filterModalTitle}>Select ID Type</Text>
              {['Aadhaar', 'PAN', 'Passport', 'VoterID', 'DrivingLicense'].map(idType => (
                <TouchableOpacity
                  key={idType}
                  style={[styles.filterOptionItem, govtIdType === idType && styles.filterOptionItemActive]}
                  onPress={() => { setGovtIdType(idType); setShowGovtIdTypePicker(false); }}>
                  <Text style={[styles.filterOptionText, govtIdType === idType && styles.filterOptionTextActive]}>
                    {idType === 'Aadhaar' ? 'Aadhaar Card' : idType === 'PAN' ? 'PAN Card' : idType}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      </Modal>
  );
};

// =========================================================================
// BULK IMPORT STAFF MODAL COMPONENT (SCREENSHOT 2 MATCHING)
// =========================================================================
interface BulkImportStaffModalProps {
  visible: boolean;
  schoolId: string;
  onClose: () => void;
  addSubDocument: (schoolId: string, subCollection: string, data: any) => Promise<string>;
  showToast: (msg: string) => void;
}

export const BulkImportStaffModal: React.FC<BulkImportStaffModalProps> = ({
  visible,
  schoolId,
  onClose,
  addSubDocument,
  showToast,
}) => {
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: string; base64: string } | null>(null);
  const [importing, setImporting] = useState(false);

  // Download 32 Columns Template
  const handleDownloadTemplate = () => {
    try {
      const headers = [
        'Staff ID', 'Full Name', 'Date of Birth', 'Gender', 'Nationality', 'Marital Status',
        'Blood Group', 'Aadhar Number', 'Languages Known', 'Mobile Number', 'Email Address',
        'Residential Address', 'Emergency Contact Details', 'Father Name/Guardian Name',
        'Highest Qualification', 'Degree(s) and Specialization', 'University/College Name',
        'Year of Passing', 'Previous Experience (Years)', 'Previous School/Organization',
        'Subject Specialization', 'Grades/Classes Handled', 'Certifications',
        'Government-issued ID', 'Tax Identification Details (PAN)', 'PF Number', 'ESIC Number',
        'UAN Number', 'Bank Account Number', 'Bank Name and Branch', 'IFSC Code', 'PAN Number',
      ];
      const sampleRow = [
        'STF001', 'John Doe', '1990-01-15', 'Male', 'Indian', 'Single',
        'A+', '123456789012', 'English, Hindi', '9876543210', 'john.doe@school.com',
        '123 Main St, City', 'Jane Doe - 9876500000', 'Robert Doe', 'M.Sc Education',
        'B.Ed, Mathematics', 'Delhi University', '2015', '5', 'ABC School',
        'Mathematics', '9, 10, 11', 'B.Ed', 'Aadhaar', 'ABCDE1234F', 'PF123456',
        'ESIC789', 'UAN456', '123456789012', 'State Bank, Main Branch', 'SBIN0001234', 'ABCDE1234F',
      ];

      const ws = XLSX.utils.aoa_to_sheet([headers, sampleRow]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Staff Import');
      const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      saveAndOpenFile('staff_import_template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', b64);
      showToast('Downloaded staff import template!');
    } catch (e: any) {
      console.warn('Template download error:', e);
      Alert.alert('Error', 'Failed to generate staff import template');
    }
  };

  // Pick Excel/CSV file
  const handlePickFile = async () => {
    const file = await pickDocument('excel');
    if (file) {
      setSelectedFile({
        name: file.name,
        size: file.size,
        base64: file.base64,
      });
      showToast(`Selected file: ${file.name}`);
    }
  };

  // Upload & Process File
  const handleUploadFile = async () => {
    if (!selectedFile) {
      Alert.alert('File Required', 'Please choose an Excel (.xlsx) or CSV file first.');
      return;
    }

    setImporting(true);
    try {
      if (!selectedFile.base64) {
        throw new Error('Could not read file data. Please select a valid file.');
      }

      const wb = XLSX.read(selectedFile.base64, { type: 'base64' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const rawData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (rawData.length === 0) {
        Alert.alert('Empty File', 'The file appears to be empty or has no data rows.');
        setImporting(false);
        return;
      }

      const getField = (row: any, ...aliases: string[]) => {
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach(k => {
          normalizedRow[k.trim().toLowerCase().replace(/\s+/g, ' ')] = row[k];
        });
        for (const alias of aliases) {
          const val = normalizedRow[alias.trim().toLowerCase().replace(/\s+/g, ' ')];
          if (val !== undefined && String(val).trim() !== '') return String(val).trim();
        }
        return '';
      };

      let successCount = 0;
      for (const row of rawData) {
        let firstName = getField(row, 'first name', 'firstname', 'first_name');
        let lastName = getField(row, 'last name', 'lastname', 'last_name', 'surname');
        const fullName = getField(row, 'full name', 'fullname', 'name', 'staff name');
        if (!firstName && fullName) {
          const parts = fullName.trim().split(' ');
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        }

        const emailVal = getField(row, 'email address', 'email', 'e-mail', 'mail');
        if (!emailVal && !fullName && !firstName) continue; // skip blank row

        const staffIdVal = getField(row, 'staff id', 'staffid', 'employee id', 'employeeid', 'id') || `STF${Date.now().toString().slice(-4)}`;
        const roleVal = getField(row, 'role', 'roles', 'designation', 'position') || 'Staffs';
        const staffTypeVal = getField(row, 'staff type', 'stafftype', 'type') || 'Teaching Staff';
        const isTeaching = !staffTypeVal.toLowerCase().includes('non');

        const staffDoc: any = {
          staffId: staffIdVal,
          employeeId: staffIdVal,
          firstName: firstName || 'Staff',
          lastName: lastName || '',
          name: fullName || `${firstName} ${lastName}`.trim(),
          email: emailVal || `${staffIdVal.toLowerCase()}@school.internal`,
          mobileNumber: getField(row, 'mobile number', 'mobile', 'phone', 'contact'),
          phone: getField(row, 'mobile number', 'mobile', 'phone', 'contact'),
          dob: getField(row, 'date of birth', 'dob', 'birth date'),
          gender: getField(row, 'gender', 'sex') || 'Male',
          nationality: getField(row, 'nationality') || 'Indian',
          maritalStatus: getField(row, 'marital status', 'maritalstatus') || 'Single',
          bloodGroup: getField(row, 'blood group', 'bloodgroup'),
          aadharNumber: getField(row, 'aadhar number', 'aadhar', 'aadhaar', 'aadhaar number'),
          panNumber: getField(row, 'pan number', 'pan'),
          highestQualification: getField(row, 'highest qualification', 'qualification'),
          degreeSpecialization: getField(row, 'degree(s) and specialization', 'degree', 'specialization'),
          universityName: getField(row, 'university/college name', 'university', 'college'),
          yearOfPassing: getField(row, 'year of passing', 'passing year'),
          previousExperience: getField(row, 'previous experience (years)', 'experience', 'previous experience') || '0',
          previousOrganization: getField(row, 'previous school/organization', 'previous school', 'organization'),
          subjectSpecialization: getField(row, 'subject specialization', 'subject'),
          gradesClassesHandled: getField(row, 'grades/classes handled', 'classes handled', 'grades handled'),
          professionalCertifications: getField(row, 'certifications', 'professional certifications'),
          govtIdType: getField(row, 'government-issued id', 'id type') || 'Aadhaar',
          taxIdDetails: getField(row, 'tax identification details (pan)', 'tax id'),
          pfNumber: getField(row, 'pf number', 'pf'),
          esicNumber: getField(row, 'esic number', 'esic'),
          uanNumber: getField(row, 'uan number', 'uan'),
          bankAccountNumber: getField(row, 'bank account number', 'account number', 'bank account'),
          bankName: getField(row, 'bank name and branch', 'bank name', 'bank'),
          branchName: getField(row, 'branch name', 'branch'),
          ifscCode: getField(row, 'ifsc code', 'ifsc'),
          residentialAddress: getField(row, 'residential address', 'address'),
          emergencyContact: getField(row, 'emergency contact details', 'emergency contact'),
          fatherGuardianName: getField(row, 'father name/guardian name', 'father name', 'guardian name'),
          languagesKnown: getField(row, 'languages known', 'languages'),
          role: roleVal,
          roles: [roleVal],
          staffType: isTeaching ? 'Teaching Staff' : 'Non-Teaching Staff',
          staff_type: isTeaching ? 'teaching' : 'non-teaching',
          status: 'Active',
          classAssignments: [],
          subjectAssignments: [],
          createdAt: new Date().toISOString(),
        };

        await addSubDocument(schoolId, 'teachers', staffDoc);
        successCount++;
      }

      showToast(`Bulk imported ${successCount} staff members!`);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      console.warn('Bulk import parse error:', err);
      Alert.alert('Import Failed', err?.message || 'Failed to parse Excel file.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlayDark}>
        <View style={styles.bulkImportCard}>
          {/* Header Matching Screenshot 2 */}
          <View style={styles.bulkImportHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <IconComp name="document-text-outline" size={20} color="#7C3AED" />
              <Text style={styles.bulkImportTitle}>Bulk Import Staff</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <IconComp name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20 }}>
            {/* Description */}
            <Text style={styles.bulkImportSubtitle}>
              Upload an Excel (.xlsx) or CSV file to bulk import staff.
            </Text>

            {/* Required & Optional Columns Box Matching Screenshot 2 */}
            <View style={styles.columnsGuideBox}>
              <Text style={styles.columnsSectionHeading}>Required Columns:</Text>
              <View style={styles.pillWrapRow}>
                <View style={styles.requiredPill}>
                  <Text style={styles.requiredPillText}>Full Name *</Text>
                </View>
                <View style={styles.requiredPill}>
                  <Text style={styles.requiredPillText}>Email Address *</Text>
                </View>
              </View>

              <Text style={[styles.columnsSectionHeading, { marginTop: 12 }]}>
                Optional (all other columns supported):
              </Text>
              <View style={styles.pillWrapRow}>
                {[
                  'Staff ID', 'Mobile Number', 'Gender', 'Date of Birth',
                  'Blood Group', 'Role', 'Staff Type', 'Aadhar Number',
                  'PAN Number', 'PF Number', 'Bank Account Number',
                ].map(col => (
                  <View key={col} style={styles.optionalPill}>
                    <Text style={styles.optionalPillText}>{col}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Download Full Template Button */}
            <TouchableOpacity
              style={styles.downloadTemplateLinkBtn}
              onPress={handleDownloadTemplate}
              activeOpacity={0.7}>
              <IconComp name="download-outline" size={15} color="#7C3AED" />
              <Text style={styles.downloadTemplateLinkText}>
                Download Full Template (32 columns)
              </Text>
            </TouchableOpacity>

            {/* Drag or Click Upload Dropzone Matching Screenshot 2 */}
            <TouchableOpacity
              style={[styles.dropzoneContainer, selectedFile ? styles.dropzoneContainerActive : null]}
              onPress={handlePickFile}
              activeOpacity={0.8}>
              <View style={styles.cloudIconWrapper}>
                <IconComp
                  name={selectedFile ? 'checkmark-circle' : 'cloud-upload-outline'}
                  size={36}
                  color={selectedFile ? '#059669' : '#B07FA8'}
                />
              </View>
              {selectedFile ? (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.selectedFileName} numberOfLines={1}>{selectedFile.name}</Text>
                  <Text style={styles.selectedFileReady}>Ready to upload</Text>
                </View>
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.dropzoneMainText}>Click or drag file to upload</Text>
                  <Text style={styles.dropzoneSubText}>Excel or CSV file</Text>
                </View>
              )}
            </TouchableOpacity>
          </ScrollView>

          {/* Bottom Action Buttons (Cancel, Upload File) */}
          <View style={styles.bulkImportFooter}>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={onClose}
              disabled={importing}>
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalSubmitBtn, !selectedFile && { opacity: 0.6 }]}
              onPress={handleUploadFile}
              disabled={importing || !selectedFile}>
              {importing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.modalSubmitBtnText}>Upload File</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// =========================================================================
// VIEW STAFF DETAIL MODAL COMPONENT
// =========================================================================
interface ViewStaffModalProps {
  staff: StaffItem;
  visible: boolean;
  onClose: () => void;
  onEdit: () => void;
}

export const ViewStaffModal: React.FC<ViewStaffModalProps> = ({
  staff,
  visible,
  onClose,
  onEdit,
}) => {
  const [activeTab, setActiveTab] = useState<'Profile' | 'Education & Work' | 'Identity & Bank' | 'Documents'>('Profile');

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlayDark}>
        <View style={styles.viewStaffCard}>
          {/* Header */}
          <View style={styles.viewStaffHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.staffAvatarCircle}>
                <Text style={styles.staffAvatarText}>{(staff.name || 'S')[0]}</Text>
              </View>
              <View>
                <Text style={styles.viewStaffTitle}>{staff.name}</Text>
                <Text style={styles.viewStaffSub}>{staff.role || 'Staffs'} • {staff.staffType || 'Teaching Staff'}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <IconComp name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Mini Tab Navigation */}
          <View style={styles.miniTabsRow}>
            {(['Profile', 'Education & Work', 'Identity & Bank', 'Documents'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[styles.miniTabBtn, activeTab === tab && styles.miniTabBtnActive]}
                onPress={() => setActiveTab(tab)}>
                <Text style={[styles.miniTabBtnText, activeTab === tab && styles.miniTabBtnTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Details Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
            {activeTab === 'Profile' && (
              <View style={{ gap: 12 }}>
                <DetailItem label="STAFF ID" value={staff.staffId || staff.employeeId || 'N/A'} />
                <DetailItem label="EMAIL" value={staff.email || 'N/A'} />
                <DetailItem label="MOBILE NUMBER" value={staff.mobileNumber || staff.phone || 'N/A'} />
                <DetailItem label="DATE OF BIRTH" value={staff.dob || 'N/A'} />
                <DetailItem label="GENDER" value={staff.gender || 'N/A'} />
                <DetailItem label="BLOOD GROUP" value={staff.bloodGroup || 'N/A'} />
                <DetailItem label="NATIONALITY" value={staff.nationality || 'Indian'} />
                <DetailItem label="MARITAL STATUS" value={staff.maritalStatus || 'Single'} />
                <DetailItem label="FATHER / GUARDIAN" value={staff.fatherGuardianName || 'N/A'} />
                <DetailItem label="EMERGENCY CONTACT" value={staff.emergencyContact || 'N/A'} />
                <DetailItem label="RESIDENTIAL ADDRESS" value={staff.residentialAddress || 'N/A'} />
              </View>
            )}

            {activeTab === 'Education & Work' && (
              <View style={{ gap: 12 }}>
                <DetailItem label="HIGHEST QUALIFICATION" value={staff.highestQualification || 'N/A'} />
                <DetailItem label="DEGREE & SPECIALIZATION" value={staff.degreeSpecialization || 'N/A'} />
                <DetailItem label="UNIVERSITY / COLLEGE" value={staff.universityName || 'N/A'} />
                <DetailItem label="YEAR OF PASSING" value={staff.yearOfPassing || 'N/A'} />
                <DetailItem label="PREVIOUS EXPERIENCE" value={`${staff.previousExperience || '0'} Years`} />
                <DetailItem label="PREVIOUS ORGANIZATION" value={staff.previousOrganization || 'N/A'} />
                <DetailItem label="SUBJECT SPECIALIZATION" value={staff.subjectSpecialization || 'N/A'} />
                <DetailItem label="GRADES / CLASSES HANDLED" value={staff.gradesClassesHandled || 'N/A'} />
                <DetailItem label="CERTIFICATIONS" value={staff.professionalCertifications || 'N/A'} />
              </View>
            )}

            {activeTab === 'Identity & Bank' && (
              <View style={{ gap: 12 }}>
                <DetailItem label="GOVT ID TYPE" value={staff.govtIdType || 'Aadhaar'} />
                <DetailItem label="GOVT ID NUMBER" value={staff.govtIdNumber || 'N/A'} />
                <DetailItem label="AADHAAR NUMBER" value={staff.aadharNumber || 'N/A'} />
                <DetailItem label="PAN NUMBER" value={staff.panNumber || 'N/A'} />
                <DetailItem label="PF NUMBER" value={staff.pfNumber || 'N/A'} />
                <DetailItem label="ESIC NUMBER" value={staff.esicNumber || 'N/A'} />
                <DetailItem label="UAN NUMBER" value={staff.uanNumber || 'N/A'} />
                <DetailItem label="BANK NAME" value={staff.bankName || 'N/A'} />
                <DetailItem label="ACCOUNT NUMBER" value={staff.bankAccountNumber || 'N/A'} />
                <DetailItem label="BRANCH NAME" value={staff.branchName || 'N/A'} />
                <DetailItem label="IFSC CODE" value={staff.ifscCode || 'N/A'} />
              </View>
            )}

            {activeTab === 'Documents' && (
              <View style={{ gap: 12 }}>
                {[
                  { label: 'Academic Certificates', list: staff.academicCertificates },
                  { label: 'Mark Sheets', list: staff.markSheets },
                  { label: 'Experience Certificates', list: staff.experienceCertificates },
                  { label: 'Relieving Letter', list: staff.relievingLetter },
                  { label: 'Resume / CV', list: staff.resume },
                  { label: 'Reference Letters', list: staff.referenceLetters },
                  { label: 'Govt ID Document', list: staff.govtIdDocument },
                ].map(docGroup => (
                  <View key={docGroup.label} style={{ marginBottom: 8 }}>
                    <Text style={styles.detailLabelText}>{docGroup.label}</Text>
                    {(docGroup.list && docGroup.list.length > 0) ? (
                      docGroup.list.map((d: any, i: number) => (
                        <View key={i} style={styles.attachedFileChip}>
                          <IconComp name="document-outline" size={14} color="#64748B" />
                          <Text style={styles.attachedFileName} numberOfLines={1}>{d.name || `Document ${i + 1}`}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>No document attached</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </ScrollView>

          {/* Footer with Edit button */}
          <View style={styles.viewStaffFooter}>
            <TouchableOpacity style={styles.viewEditBtn} onPress={onEdit}>
              <IconComp name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.viewEditBtnText}>Edit Staff Details</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DetailItem = ({ label, value }: { label: string; value: string }) => (
  <View style={{ marginBottom: 6 }}>
    <Text style={styles.detailLabelText}>{label}</Text>
    <Text style={styles.detailValueText}>{value}</Text>
  </View>
);

// =========================================================================
// STYLESHEET MATCHING SCREENSHOTS 1, 2, 3, 4, 5
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerSection: {
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 3,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginVertical: 10,
  },
  outlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  outlineActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  purpleOutlineActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD6FE',
    backgroundColor: '#F5F3FF',
  },
  purpleOutlineActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#7C3AED',
  },
  solidPurpleActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#b07fa8',
  },
  solidPurpleActionBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Metrics horizontal scroll
  metricsScrollContainer: {
    gap: 10,
    marginVertical: 10,
    paddingRight: 10,
  },
  metricCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    minWidth: 145,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  metricIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricValue: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },

  // Filters section
  filterSectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginVertical: 10,
    gap: 10,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 42,
    fontSize: 13,
    color: '#0F172A',
  },
  filterPillsScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  filterDropdownBtnActive: {
    borderColor: '#B07FA8',
    backgroundColor: '#FAF5FF',
  },
  filterDropdownBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  filterDropdownBtnTextActive: {
    color: '#7C3AED',
  },
  clearFiltersBtn: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  clearFiltersBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },

  // Table & Cards
  listContainer: {
    marginTop: 6,
    gap: 10,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tableHeaderColText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  staffCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  staffAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EDE9FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffAvatarText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#7C3AED',
  },
  staffNameText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffIdBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  statusPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusPillActive: {
    backgroundColor: '#ECFDF5',
  },
  statusPillInactive: {
    backgroundColor: '#FEF2F2',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillTextActive: {
    color: '#059669',
  },
  statusPillTextInactive: {
    color: '#DC2626',
  },
  rolePill: {
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rolePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#7C3AED',
  },
  staffTypePill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  staffTypePillText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    paddingTop: 4,
  },
  contactItemText: {
    fontSize: 12,
    color: '#64748B',
  },
  assignmentsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  classBadgePill: {
    backgroundColor: '#faedf7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  classBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b07fa8',
  },
  subjBadgePill: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  subjBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  unassignedText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },

  // Empty state
  emptyStateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 45,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 10,
  },
  emptyShieldIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyStateTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  emptyStateSubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    backgroundColor: '#b07fa8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Pagination
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },
  paginationInfoText: {
    fontSize: 12,
    color: '#64748B',
  },
  paginationBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },

  // Modal Common
  modalOverlayDark: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  modalSubmitBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#b07fa8',
  },
  modalSubmitBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Add Staff Modal - Mobile Near Full-Screen Bottom Sheet
  addStaffModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  addStaffKeyboardWrapper: {
    width: '100%',
    height: '95%',
  },
  addStaffModalSheet: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    flexDirection: 'column',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
  },
  addStaffModalCard: {
    width: '100%',
    maxWidth: 620,
    height: '92%',
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  addStaffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  headerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStaffHeaderTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  addStaffHeaderSubtitle: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748B',
    marginTop: 1,
  },
  tabsNavContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  tabsNavScroll: {
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tabNavItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    position: 'relative',
  },
  tabNavItemActive: {},
  tabNavText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabNavTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },
  tabNavIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 10,
    right: 10,
    height: 3,
    backgroundColor: '#7C3AED',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  addStaffScrollBody: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  addStaffScrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 60,
  },
  tabSectionContainer: {
    gap: 14,
  },
  formColFull: {
    width: '100%',
  },
  formRowTwo: {
    flexDirection: 'row',
    gap: 12,
  },
  formRowThree: {
    flexDirection: 'row',
    gap: 8,
  },
  formCol: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  inputBox: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#0F172A',
  },
  inputBoxError: {
    borderColor: '#EF4444',
  },
  fieldErrorText: {
    fontSize: 10,
    color: '#EF4444',
    marginTop: 3,
    fontWeight: '600',
  },
  dropdownTrigger: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownTriggerText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  roleTagPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  roleTagText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4338CA',
    letterSpacing: 0.3,
  },
  uploadSlotBox: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  uploadSlotLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.4,
  },
  uploadBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chooseFileBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  chooseFileBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  slotStatusText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
  },
  attachedFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 4,
  },
  attachedFileName: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  addStaffFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },

  // Bulk Import Modal Matching Screenshot 2
  bulkImportCard: {
    width: '100%',
    maxWidth: 540,
    height: '88%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  bulkImportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  bulkImportTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  bulkImportSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  columnsGuideBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
  },
  columnsSectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
    marginBottom: 6,
  },
  pillWrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  requiredPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  requiredPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
  optionalPill: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  optionalPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  downloadTemplateLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  downloadTemplateLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7C3AED',
    textDecorationLine: 'underline',
  },
  dropzoneContainer: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#FBCFE8',
    borderRadius: 16,
    backgroundColor: '#FFFDFE',
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dropzoneContainerActive: {
    borderColor: '#059669',
    backgroundColor: '#F0FDF4',
  },
  cloudIconWrapper: {
    marginBottom: 4,
  },
  dropzoneMainText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  dropzoneSubText: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectedFileName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
    maxWidth: 240,
  },
  selectedFileReady: {
    fontSize: 11,
    fontWeight: '600',
    color: '#059669',
    marginTop: 2,
  },
  bulkImportFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },

  // Filter Dropdown Popover Modal
  filterModalCard: {
    width: '90%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    maxHeight: '80%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 10,
    marginBottom: 6,
  },
  filterModalTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  filterOptionItem: {
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  filterOptionItemActive: {
    backgroundColor: '#FAF5FF',
  },
  filterOptionText: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  filterOptionTextActive: {
    color: '#7C3AED',
    fontWeight: '800',
  },

  // Confirm Delete Card
  confirmDeleteCard: {
    width: '85%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  confirmDeleteIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  confirmDeleteTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 6,
  },
  confirmDeleteMessage: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  confirmDeleteButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  cancelDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  cancelDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#DC2626',
    alignItems: 'center',
  },
  confirmDeleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // View Staff Card
  viewStaffCard: {
    width: '92%',
    maxWidth: 540,
    height: '88%',
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
  },
  viewStaffHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  viewStaffTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewStaffSub: {
    fontSize: 12,
    color: '#64748B',
  },
  miniTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  miniTabBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  miniTabBtnActive: {
    borderBottomWidth: 2,
    borderBottomColor: '#7C3AED',
  },
  miniTabBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  miniTabBtnTextActive: {
    color: '#7C3AED',
  },
  detailLabelText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  detailValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
    marginTop: 1,
  },
  viewStaffFooter: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    alignItems: 'flex-end',
  },
  viewEditBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#7C3AED',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
  },
  viewEditBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Date Dialog
  pickerDialogCard: {
    width: '85%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
  },
  pickerDialogTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  dialogCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dialogCancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  dialogOkBtn: {
    backgroundColor: '#b07fa8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  dialogOkBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
