import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { KeyboardAwareFormScrollView } from './KeyboardAwareFormScrollView';

// Try importing vector icons
let IconComp: React.ComponentType<{ name: string; size?: number; color?: string; style?: any }>;
try {
  IconComp = require('react-native-vector-icons/Ionicons').default;
} catch (e) {
  IconComp = ({ name, size = 18, color = '#64748B' }: any) => (
    <Text style={{ fontSize: size * 0.75, color, fontWeight: '700' }}>•</Text>
  );
}

// Try importing Firestore from react-native-firebase
let db: any = null;
try {
  const { getFirestore } = require('@react-native-firebase/firestore');
  db = getFirestore();
} catch (e) {
  console.warn('Firestore Native import failed in TransportManagementModule:', e);
}

export interface TransportRoute {
  id: string;
  name: string;
  vehicleNumber?: string;
  driverName?: string;
  driverPhone?: string;
  capacity: number;
  assignedStudents?: string[];
  createdAt?: string;
}

export interface TransportVehicle {
  id: string;
  vehicleName: string;
  vehicleModel: string;
  registrationNumber: string;
  seatingCapacity: number;
  assignedRouteIds?: string[];
  status: 'Active' | 'Inactive';
  fcExpiryDate?: string;
  insuranceExpiryDate?: string;
  permitExpiryDate?: string;
  roadTaxExpiryDate?: string;
  pollutionCertificateExpiryDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface StudentAssignmentItem {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  admissionNumber?: string;
  admissionNo?: string;
  transportRouteId?: string | null;
  grade?: string;
  class?: string;
}

interface TransportManagementProps {
  schoolId?: string;
  onClose: () => void;
  showToast: (msg: string) => void;
}

export const TransportManagementModule: React.FC<TransportManagementProps> = ({
  schoolId = 'school1',
  onClose,
  showToast,
}) => {
  const targetSchool = schoolId || 'school1';

  // Active Tab: 'routes' | 'vehicles' | 'assignments' (Matching Image 1, 3, 5)
  const [activeTab, setActiveTab] = useState<'routes' | 'vehicles' | 'assignments'>('routes');

  // Live Firestore collections
  const [routes, setRoutes] = useState<TransportRoute[]>([]);
  const [vehicles, setVehicles] = useState<TransportVehicle[]>([]);
  const [students, setStudents] = useState<StudentAssignmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Search & Filter state for Vehicle Management (Matching Image 3)
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState<string>('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState<'all' | 'Active' | 'Inactive'>('all');
  const [vehicleComplianceFilter, setVehicleComplianceFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');
  const [showStatusFilterModal, setShowStatusFilterModal] = useState<boolean>(false);
  const [showComplianceFilterModal, setShowComplianceFilterModal] = useState<boolean>(false);

  // Search & Filter state for Student Assignments (Matching Image 5)
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState<string>('');
  const [assignmentFilterTab, setAssignmentFilterTab] = useState<'all' | 'assigned' | 'unassigned'>('all');

  // Modals state: Routes
  const [showRouteModal, setShowRouteModal] = useState<boolean>(false);
  const [editingRoute, setEditingRoute] = useState<TransportRoute | null>(null);
  const [routeForm, setRouteForm] = useState({
    name: '',
    vehicleNumber: '',
    capacity: '',
    driverName: '',
    driverPhone: '',
  });

  // Modals state: Vehicles
  const [showVehicleModal, setShowVehicleModal] = useState<boolean>(false);
  const [editingVehicle, setEditingVehicle] = useState<TransportVehicle | null>(null);
  const [showVehicleStatusDropdown, setShowVehicleStatusDropdown] = useState<boolean>(false);
  const [vehicleForm, setVehicleForm] = useState({
    vehicleName: '',
    vehicleModel: '',
    registrationNumber: '',
    seatingCapacity: '',
    assignedRouteIds: [] as string[],
    status: 'Active' as 'Active' | 'Inactive',
    fcExpiryDate: '',
    insuranceExpiryDate: '',
    permitExpiryDate: '',
    roadTaxExpiryDate: '',
    pollutionCertificateExpiryDate: '',
  });

  // Modals state: Student Route Assignment
  const [showRouteAssignPicker, setShowRouteAssignPicker] = useState<boolean>(false);
  const [activeStudentForAssign, setActiveStudentForAssign] = useState<StudentAssignmentItem | null>(null);

  // Universal Fallback Date Picker Modal (for iOS or if native dialog is not active)
  type ExpiryDateField =
    | 'fcExpiryDate'
    | 'insuranceExpiryDate'
    | 'permitExpiryDate'
    | 'roadTaxExpiryDate'
    | 'pollutionCertificateExpiryDate';

  const [vehicleDatePicker, setVehicleDatePicker] = useState<{
    visible: boolean;
    field: ExpiryDateField | null;
    title: string;
    day: number;
    month: number; // 0 to 11
    year: number;
    viewMode: 'calendar' | 'month' | 'year';
  }>({
    visible: false,
    field: null,
    title: 'Select Expiry Date',
    day: new Date().getDate(),
    month: new Date().getMonth(),
    year: new Date().getFullYear(),
    viewMode: 'calendar',
  });

  // Real-time Firestore Subscriptions
  useEffect(() => {
    let unsubRoutes: (() => void) | undefined;
    let unsubVehicles: (() => void) | undefined;
    let unsubStudents: (() => void) | undefined;

    if (db) {
      try {
        unsubRoutes = db
          .collection('schools')
          .doc(targetSchool)
          .collection('transportRoutes')
          .onSnapshot(
            (snapshot: any) => {
              if (snapshot) {
                const list: TransportRoute[] = [];
                snapshot.forEach((doc: any) => {
                  list.push({ id: doc.id, ...doc.data() });
                });
                setRoutes(list);
              }
              setLoading(false);
            },
            (err: any) => {
              console.warn('Error fetching transportRoutes:', err);
              setLoading(false);
            }
          );

        unsubVehicles = db
          .collection('schools')
          .doc(targetSchool)
          .collection('vehicles')
          .onSnapshot(
            (snapshot: any) => {
              if (snapshot) {
                const list: TransportVehicle[] = [];
                snapshot.forEach((doc: any) => {
                  list.push({ id: doc.id, ...doc.data() });
                });
                setVehicles(list);
              }
            },
            (err: any) => {
              console.warn('Error fetching vehicles:', err);
            }
          );

        unsubStudents = db
          .collection('schools')
          .doc(targetSchool)
          .collection('students')
          .onSnapshot(
            (snapshot: any) => {
              if (snapshot) {
                const list: StudentAssignmentItem[] = [];
                snapshot.forEach((doc: any) => {
                  const data = doc.data();
                  const fullName =
                    data.name ||
                    `${data.firstName || ''} ${data.lastName || ''}`.trim() ||
                    'Unnamed Student';
                  list.push({
                    id: doc.id,
                    name: fullName,
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    admissionNumber: data.admissionNumber || data.admissionNo || '—',
                    admissionNo: data.admissionNo || data.admissionNumber || '—',
                    transportRouteId: data.transportRouteId || null,
                    grade: data.grade || data.class || '',
                    class: data.class || data.grade || '',
                  });
                });
                setStudents(list);
              }
            },
            (err: any) => {
              console.warn('Error fetching students:', err);
            }
          );
      } catch (e) {
        console.warn('Firestore attach failed in TransportModule:', e);
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    return () => {
      if (unsubRoutes) unsubRoutes();
      if (unsubVehicles) unsubVehicles();
      if (unsubStudents) unsubStudents();
    };
  }, [targetSchool]);

  // Date Formatting Helper (matches Image 4 dd-mm-yyyy)
  const formatDateDisplay = (dateStr?: string) => {
    if (!dateStr) return 'dd-mm-yyyy';
    try {
      const clean = dateStr.trim().split('T')[0];
      const parts = clean.split(/[-/]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          // yyyy-mm-dd -> dd-mm-yyyy
          return `${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[0]}`;
        } else {
          return `${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}-${parts[2]}`;
        }
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  // Open White Calendar Date Picker (Matching rest of app)
  const openNativeDatePicker = (field: ExpiryDateField, title: string = 'Select Expiry Date') => {
    let initialDate = new Date();
    const existingVal = vehicleForm[field];
    if (existingVal) {
      const parts = existingVal.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          initialDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          initialDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        }
      }
    }
    if (isNaN(initialDate.getTime())) initialDate = new Date();

    setVehicleDatePicker({
      visible: true,
      field,
      title,
      day: initialDate.getDate(),
      month: initialDate.getMonth(),
      year: initialDate.getFullYear(),
      viewMode: 'calendar',
    });
  };

  const handleConfirmVehicleDate = () => {
    if (vehicleDatePicker.field) {
      const yyyy = String(vehicleDatePicker.year);
      const mm = String(vehicleDatePicker.month + 1).padStart(2, '0');
      const dd = String(vehicleDatePicker.day).padStart(2, '0');
      const isoStr = `${yyyy}-${mm}-${dd}`;
      setVehicleForm(prev => ({ ...prev, [vehicleDatePicker.field!]: isoStr }));
    }
    setVehicleDatePicker(prev => ({ ...prev, visible: false, field: null }));
  };

  // Compliance Status Computation (Identical to Web Reference)
  const getExpiryStatus = (dateStr?: string): 'active' | 'expiring' | 'expired' => {
    if (!dateStr) return 'active';
    try {
      const parts = dateStr.split('-');
      let expiry: Date;
      if (parts.length === 3 && parts[0].length === 4) {
        expiry = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      } else {
        expiry = new Date(dateStr);
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiry.setHours(0, 0, 0, 0);
      if (expiry < today) return 'expired';

      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 30) return 'expiring';
      return 'active';
    } catch {
      return 'active';
    }
  };

  const getVehicleComplianceStatus = (vehicle: TransportVehicle): 'active' | 'expiring' | 'expired' => {
    const dates = [
      vehicle.fcExpiryDate,
      vehicle.insuranceExpiryDate,
      vehicle.permitExpiryDate,
      vehicle.roadTaxExpiryDate,
      vehicle.pollutionCertificateExpiryDate,
    ];
    let hasExpired = false;
    let hasExpiring = false;
    for (const d of dates) {
      const st = getExpiryStatus(d);
      if (st === 'expired') hasExpired = true;
      if (st === 'expiring') hasExpiring = true;
    }
    if (hasExpired) return 'expired';
    if (hasExpiring) return 'expiring';
    return 'active';
  };

  // Vehicle KPI Metrics (Matching Image 3)
  const vehicleMetrics = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter(v => v.status === 'Active').length;
    const assigned = vehicles.filter(v => v.assignedRouteIds && v.assignedRouteIds.length > 0).length;
    const unassigned = vehicles.filter(v => !v.assignedRouteIds || v.assignedRouteIds.length === 0).length;
    const expiring = vehicles.filter(v => getVehicleComplianceStatus(v) === 'expiring').length;
    const expired = vehicles.filter(v => getVehicleComplianceStatus(v) === 'expired').length;
    return { total, active, assigned, unassigned, expiring, expired };
  }, [vehicles]);

  // Filtered Vehicles (Matching Image 3)
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const q = vehicleSearchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        (v.vehicleName || '').toLowerCase().includes(q) ||
        (v.vehicleModel || '').toLowerCase().includes(q) ||
        (v.registrationNumber || '').toLowerCase().includes(q);

      const matchesStatus =
        vehicleStatusFilter === 'all' ||
        (vehicleStatusFilter === 'Active' && v.status === 'Active') ||
        (vehicleStatusFilter === 'Inactive' && v.status === 'Inactive');

      const compStatus = getVehicleComplianceStatus(v);
      const matchesCompliance =
        vehicleComplianceFilter === 'all' ||
        (vehicleComplianceFilter === 'active' && compStatus === 'active') ||
        (vehicleComplianceFilter === 'expiring' && compStatus === 'expiring') ||
        (vehicleComplianceFilter === 'expired' && compStatus === 'expired');

      return matchesSearch && matchesStatus && matchesCompliance;
    });
  }, [vehicles, vehicleSearchQuery, vehicleStatusFilter, vehicleComplianceFilter]);

  // Filtered Student Assignments (Matching Image 5)
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const q = assignmentSearchQuery.trim().toLowerCase();
      let matchesSearch = true;
      if (q) {
        const studentNameMatch = (s.name || '').toLowerCase().includes(q);
        const admMatch = (s.admissionNumber || s.admissionNo || '').toLowerCase().includes(q);
        let routeMatch = false;
        let driverMatch = false;
        if (s.transportRouteId) {
          const r = routes.find(item => item.id === s.transportRouteId);
          if (r) {
            if ((r.name || '').toLowerCase().includes(q)) routeMatch = true;
            if ((r.driverName || '').toLowerCase().includes(q)) driverMatch = true;
          }
        }
        matchesSearch = studentNameMatch || admMatch || routeMatch || driverMatch;
      }

      const matchesTab =
        assignmentFilterTab === 'all' ||
        (assignmentFilterTab === 'assigned' && !!s.transportRouteId) ||
        (assignmentFilterTab === 'unassigned' && !s.transportRouteId);

      return matchesSearch && matchesTab;
    });
  }, [students, routes, assignmentSearchQuery, assignmentFilterTab]);

  // Route Handlers (Image 2)
  const handleOpenAddRoute = (routeToEdit?: TransportRoute) => {
    if (routeToEdit) {
      setEditingRoute(routeToEdit);
      setRouteForm({
        name: routeToEdit.name || '',
        vehicleNumber: routeToEdit.vehicleNumber || '',
        capacity: String(routeToEdit.capacity || ''),
        driverName: routeToEdit.driverName || '',
        driverPhone: routeToEdit.driverPhone || '',
      });
    } else {
      setEditingRoute(null);
      setRouteForm({
        name: '',
        vehicleNumber: '',
        capacity: '',
        driverName: '',
        driverPhone: '',
      });
    }
    setShowRouteModal(true);
  };

  const handleSaveRoute = async () => {
    const trimmedName = routeForm.name.trim();
    if (!trimmedName) {
      Alert.alert('Required Field', 'Please enter a Route Name.');
      return;
    }

    const parsedCap = parseInt(routeForm.capacity, 10);
    if (isNaN(parsedCap) || parsedCap <= 0) {
      Alert.alert('Invalid Capacity', 'Please enter a valid seating capacity (greater than 0).');
      return;
    }

    if (routeForm.driverPhone) {
      const cleanPhone = routeForm.driverPhone.replace(/[\s\-\(\)]/g, '');
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(cleanPhone)) {
        Alert.alert('Invalid Phone', 'Driver phone number must contain exactly 10 digits.');
        return;
      }
    }

    const payload = {
      name: trimmedName,
      vehicleNumber: routeForm.vehicleNumber.trim().toUpperCase(),
      capacity: parsedCap,
      driverName: routeForm.driverName.trim(),
      driverPhone: routeForm.driverPhone.trim(),
    };

    try {
      if (db) {
        if (editingRoute?.id) {
          await db
            .collection('schools')
            .doc(targetSchool)
            .collection('transportRoutes')
            .doc(editingRoute.id)
            .set(payload, { merge: true });
          if (targetSchool === 'school1') {
            try {
              await db
                .collection('schools')
                .doc('SchoolS001')
                .collection('transportRoutes')
                .doc(editingRoute.id)
                .set(payload, { merge: true });
            } catch (e) {}
          }
          showToast('Route updated successfully!');
        } else {
          const newDoc = {
            ...payload,
            assignedStudents: [],
            createdAt: new Date().toISOString(),
          };
          const ref = await db
            .collection('schools')
            .doc(targetSchool)
            .collection('transportRoutes')
            .add(newDoc);
          if (targetSchool === 'school1') {
            try {
              await db
                .collection('schools')
                .doc('SchoolS001')
                .collection('transportRoutes')
                .doc(ref.id)
                .set(newDoc);
            } catch (e) {}
          }
          showToast('Route created successfully!');
        }
      } else {
        // Fallback local update
        if (editingRoute?.id) {
          setRoutes(prev =>
            prev.map(r => (r.id === editingRoute.id ? ({ ...r, ...payload, capacity: parsedCap } as TransportRoute) : r))
          );
        } else {
          const createdRoute: TransportRoute = {
            id: `local_${Date.now()}`,
            name: trimmedName,
            vehicleNumber: payload.vehicleNumber,
            capacity: parsedCap,
            driverName: payload.driverName,
            driverPhone: payload.driverPhone,
            assignedStudents: [],
            createdAt: new Date().toISOString(),
          };
          setRoutes(prev => [...prev, createdRoute]);
        }
        showToast('Route saved successfully!');
      }
      setShowRouteModal(false);
    } catch (error: any) {
      console.error('Error saving route:', error);
      Alert.alert('Save Failed', error?.message || 'Could not save the route. Please try again.');
    }
  };

  const handleDeleteRoute = (route: TransportRoute) => {
    Alert.alert(
      'Delete Route',
      `Are you sure you want to delete route "${route.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (db) {
                await db
                  .collection('schools')
                  .doc(targetSchool)
                  .collection('transportRoutes')
                  .doc(route.id)
                  .delete();
                if (targetSchool === 'school1') {
                  try {
                    await db
                      .collection('schools')
                      .doc('SchoolS001')
                      .collection('transportRoutes')
                      .doc(route.id)
                      .delete();
                  } catch (e) {}
                }
              }
              setRoutes(prev => prev.filter(r => r.id !== route.id));
              showToast('Route deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete route');
            }
          },
        },
      ]
    );
  };

  // Vehicle Handlers (Image 4)
  const handleOpenAddVehicle = (vehicleToEdit?: TransportVehicle) => {
    if (vehicleToEdit) {
      setEditingVehicle(vehicleToEdit);
      setVehicleForm({
        vehicleName: vehicleToEdit.vehicleName || '',
        vehicleModel: vehicleToEdit.vehicleModel || '',
        registrationNumber: vehicleToEdit.registrationNumber || '',
        seatingCapacity: String(vehicleToEdit.seatingCapacity || ''),
        assignedRouteIds: vehicleToEdit.assignedRouteIds || [],
        status: vehicleToEdit.status || 'Active',
        fcExpiryDate: vehicleToEdit.fcExpiryDate || '',
        insuranceExpiryDate: vehicleToEdit.insuranceExpiryDate || '',
        permitExpiryDate: vehicleToEdit.permitExpiryDate || '',
        roadTaxExpiryDate: vehicleToEdit.roadTaxExpiryDate || '',
        pollutionCertificateExpiryDate: vehicleToEdit.pollutionCertificateExpiryDate || '',
      });
    } else {
      setEditingVehicle(null);
      setVehicleForm({
        vehicleName: '',
        vehicleModel: '',
        registrationNumber: '',
        seatingCapacity: '',
        assignedRouteIds: [],
        status: 'Active',
        fcExpiryDate: '',
        insuranceExpiryDate: '',
        permitExpiryDate: '',
        roadTaxExpiryDate: '',
        pollutionCertificateExpiryDate: '',
      });
    }
    setShowVehicleModal(true);
  };

  const handleSaveVehicle = async () => {
    const vName = vehicleForm.vehicleName.trim();
    if (!vName) {
      Alert.alert('Required Field', 'Vehicle Name is required.');
      return;
    }

    const vModel = vehicleForm.vehicleModel.trim();
    if (!vModel) {
      Alert.alert('Required Field', 'Vehicle Model is required.');
      return;
    }

    const regNo = vehicleForm.registrationNumber.trim().toUpperCase();
    if (!regNo) {
      Alert.alert('Required Field', 'Vehicle Registration Number is required.');
      return;
    }

    // Uniqueness check
    const duplicate = vehicles.some(
      v => v.id !== editingVehicle?.id && (v.registrationNumber || '').trim().toUpperCase() === regNo
    );
    if (duplicate) {
      Alert.alert('Duplicate Vehicle', `Vehicle with Registration Number "${regNo}" already exists.`);
      return;
    }

    const parsedCap = parseInt(vehicleForm.seatingCapacity, 10);
    if (isNaN(parsedCap) || parsedCap <= 0) {
      Alert.alert('Invalid Capacity', 'Seating Capacity must be a positive integer.');
      return;
    }

    const payload: Partial<TransportVehicle> = {
      vehicleName: vName,
      vehicleModel: vModel,
      registrationNumber: regNo,
      seatingCapacity: parsedCap,
      assignedRouteIds: vehicleForm.assignedRouteIds,
      status: vehicleForm.status,
      fcExpiryDate: vehicleForm.fcExpiryDate,
      insuranceExpiryDate: vehicleForm.insuranceExpiryDate,
      permitExpiryDate: vehicleForm.permitExpiryDate,
      roadTaxExpiryDate: vehicleForm.roadTaxExpiryDate,
      pollutionCertificateExpiryDate: vehicleForm.pollutionCertificateExpiryDate,
      updatedAt: new Date().toISOString(),
    };

    try {
      if (db) {
        if (editingVehicle?.id) {
          await db
            .collection('schools')
            .doc(targetSchool)
            .collection('vehicles')
            .doc(editingVehicle.id)
            .set(payload, { merge: true });
          if (targetSchool === 'school1') {
            try {
              await db
                .collection('schools')
                .doc('SchoolS001')
                .collection('vehicles')
                .doc(editingVehicle.id)
                .set(payload, { merge: true });
            } catch (e) {}
          }
          showToast('Vehicle updated successfully!');
        } else {
          const newDoc = {
            ...payload,
            createdAt: new Date().toISOString(),
          };
          const ref = await db
            .collection('schools')
            .doc(targetSchool)
            .collection('vehicles')
            .add(newDoc);
          if (targetSchool === 'school1') {
            try {
              await db
                .collection('schools')
                .doc('SchoolS001')
                .collection('vehicles')
                .doc(ref.id)
                .set(newDoc);
            } catch (e) {}
          }
          showToast('Vehicle registered successfully!');
        }
      } else {
        if (editingVehicle?.id) {
          setVehicles(prev =>
            prev.map(v => (v.id === editingVehicle.id ? ({ ...v, ...payload, seatingCapacity: parsedCap } as TransportVehicle) : v))
          );
        } else {
          const createdVehicle: TransportVehicle = {
            id: `local_v_${Date.now()}`,
            vehicleName: vName,
            vehicleModel: vModel,
            registrationNumber: regNo,
            seatingCapacity: parsedCap,
            assignedRouteIds: vehicleForm.assignedRouteIds,
            status: vehicleForm.status,
            fcExpiryDate: vehicleForm.fcExpiryDate,
            insuranceExpiryDate: vehicleForm.insuranceExpiryDate,
            permitExpiryDate: vehicleForm.permitExpiryDate,
            roadTaxExpiryDate: vehicleForm.roadTaxExpiryDate,
            pollutionCertificateExpiryDate: vehicleForm.pollutionCertificateExpiryDate,
            createdAt: new Date().toISOString(),
          };
          setVehicles(prev => [...prev, createdVehicle]);
        }
        showToast('Vehicle registered successfully!');
      }
      setShowVehicleModal(false);
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      Alert.alert('Save Failed', error?.message || 'Could not register vehicle.');
    }
  };

  const handleDeleteVehicle = (vehicle: TransportVehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete vehicle "${vehicle.vehicleName}" (${vehicle.registrationNumber})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (db) {
                await db
                  .collection('schools')
                  .doc(targetSchool)
                  .collection('vehicles')
                  .doc(vehicle.id)
                  .delete();
                if (targetSchool === 'school1') {
                  try {
                    await db
                      .collection('schools')
                      .doc('SchoolS001')
                      .collection('vehicles')
                      .doc(vehicle.id)
                      .delete();
                  } catch (e) {}
                }
              }
              setVehicles(prev => prev.filter(v => v.id !== vehicle.id));
              showToast('Vehicle removed successfully');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to delete vehicle');
            }
          },
        },
      ]
    );
  };

  // Student Assignment Handlers (Image 5)
  const handleOpenAssignModal = (student: StudentAssignmentItem) => {
    setActiveStudentForAssign(student);
    setShowRouteAssignPicker(true);
  };

  const handleSelectRouteForStudent = async (routeId: string | null) => {
    if (!activeStudentForAssign) return;
    const student = activeStudentForAssign;
    const currentRouteId = student.transportRouteId;

    if (currentRouteId === routeId) {
      setShowRouteAssignPicker(false);
      return;
    }

    try {
      if (routeId) {
        const targetRoute = routes.find(r => r.id === routeId);
        if (targetRoute) {
          const assignedCount = targetRoute.assignedStudents?.length || 0;
          if (assignedCount >= targetRoute.capacity) {
            Alert.alert(
              'Capacity Full',
              `Route "${targetRoute.name}" has reached its maximum capacity of ${targetRoute.capacity} seats.`
            );
            return;
          }
        }
      }

      if (db) {
        const batch = db.batch();

        // 1. Remove student from previous route
        if (currentRouteId) {
          const prevRouteRef = db
            .collection('schools')
            .doc(targetSchool)
            .collection('transportRoutes')
            .doc(currentRouteId);
          const prevRoute = routes.find(r => r.id === currentRouteId);
          if (prevRoute) {
            const updatedStudents = (prevRoute.assignedStudents || []).filter(id => id !== student.id);
            batch.update(prevRouteRef, { assignedStudents: updatedStudents });
          }
        }

        // 2. Add student to new route
        if (routeId) {
          const newRouteRef = db
            .collection('schools')
            .doc(targetSchool)
            .collection('transportRoutes')
            .doc(routeId);
          const newRoute = routes.find(r => r.id === routeId);
          const updatedStudents = Array.from(new Set([...(newRoute?.assignedStudents || []), student.id]));
          batch.update(newRouteRef, { assignedStudents: updatedStudents });
        }

        // 3. Update student doc
        const studentRef = db
          .collection('schools')
          .doc(targetSchool)
          .collection('students')
          .doc(student.id);
        batch.update(studentRef, { transportRouteId: routeId });

        await batch.commit();

        // Sync with SchoolS001 if school1
        if (targetSchool === 'school1') {
          try {
            const batch2 = db.batch();
            if (currentRouteId) {
              const pRef = db
                .collection('schools')
                .doc('SchoolS001')
                .collection('transportRoutes')
                .doc(currentRouteId);
              const pRoute = routes.find(r => r.id === currentRouteId);
              if (pRoute) {
                batch2.update(pRef, {
                  assignedStudents: (pRoute.assignedStudents || []).filter(id => id !== student.id),
                });
              }
            }
            if (routeId) {
              const nRef = db
                .collection('schools')
                .doc('SchoolS001')
                .collection('transportRoutes')
                .doc(routeId);
              const nRoute = routes.find(r => r.id === routeId);
              batch2.update(nRef, {
                assignedStudents: Array.from(new Set([...(nRoute?.assignedStudents || []), student.id])),
              });
            }
            const sRef = db.collection('schools').doc('SchoolS001').collection('students').doc(student.id);
            batch2.update(sRef, { transportRouteId: routeId });
            await batch2.commit();
          } catch (e) {}
        }
      }

      // Update local state
      setStudents(prev =>
        prev.map(s => (s.id === student.id ? { ...s, transportRouteId: routeId } : s))
      );

      setRoutes(prev =>
        prev.map(r => {
          if (r.id === currentRouteId) {
            return { ...r, assignedStudents: (r.assignedStudents || []).filter(id => id !== student.id) };
          }
          if (r.id === routeId) {
            return { ...r, assignedStudents: Array.from(new Set([...(r.assignedStudents || []), student.id])) };
          }
          return r;
        })
      );

      const rName = routes.find(r => r.id === routeId)?.name;
      showToast(routeId ? `Assigned to ${rName}` : 'Student unassigned');
    } catch (err: any) {
      console.error('Error assigning student to route:', err);
      Alert.alert('Assignment Failed', err?.message || 'Could not update student transport route.');
    } finally {
      setShowRouteAssignPicker(false);
      setActiveStudentForAssign(null);
    }
  };

  return (
    <View style={styles.container}>
      {/* ===== PURPLE MODULE CARD (Matching Classes & Sections Image 2) ===== */}
      <View style={styles.moduleHeroHeaderCard}>
        <View style={styles.headerCardTopRow}>
          <View style={styles.headerCardTitleWrapper}>
            <IconComp name="bus-outline" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.moduleHeroTitle} numberOfLines={1}>
              Transport Management
            </Text>
          </View>
        </View>

        <Text style={styles.moduleHeroSub}>
          Manage bus routes, drivers, school vehicles, and student assignments.
        </Text>
      </View>

      {/* ===== ACTION ROW (Matching Classes & Sections Image 2 action area) ===== */}
      <View style={styles.actionButtonRow}>
        {activeTab === 'routes' && (
          <TouchableOpacity
            style={styles.purplePrimaryActionBtn}
            onPress={() => handleOpenAddRoute()}
            activeOpacity={0.85}>
            <IconComp name="add-outline" size={15} color="#FFFFFF" />
            <Text style={styles.purplePrimaryBtnText}>Add New Route</Text>
          </TouchableOpacity>
        )}

        {activeTab === 'vehicles' && (
          <TouchableOpacity
            style={styles.purplePrimaryActionBtn}
            onPress={() => handleOpenAddVehicle()}
            activeOpacity={0.85}>
            <IconComp name="add-outline" size={15} color="#FFFFFF" />
            <Text style={styles.purplePrimaryBtnText}>Register Vehicle</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== SUB-TABS (Matching Image 1, 3, 5) ===== */}
      <View style={styles.tabsBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsBar}>
          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'routes' && styles.tabPillActive]}
            onPress={() => setActiveTab('routes')}
            activeOpacity={0.8}>
            <IconComp
              name="paper-plane-outline"
              size={15}
              color={activeTab === 'routes' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabPillText, activeTab === 'routes' && styles.tabPillTextActive]}>
              Transport Routes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'vehicles' && styles.tabPillActive]}
            onPress={() => setActiveTab('vehicles')}
            activeOpacity={0.8}>
            <IconComp
              name="bus-outline"
              size={16}
              color={activeTab === 'vehicles' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabPillText, activeTab === 'vehicles' && styles.tabPillTextActive]}>
              Vehicle Management
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabPill, activeTab === 'assignments' && styles.tabPillActive]}
            onPress={() => setActiveTab('assignments')}
            activeOpacity={0.8}>
            <IconComp
              name="people-outline"
              size={16}
              color={activeTab === 'assignments' ? '#FFFFFF' : '#64748B'}
            />
            <Text style={[styles.tabPillText, activeTab === 'assignments' && styles.tabPillTextActive]}>
              Student Assignments
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Main Body */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#b07fa8" />
          <Text style={styles.loadingText}>Loading transport records...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.bodyScroll}
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}>
          {/* ========================================================================= */}
          {/* TAB 1: TRANSPORT ROUTES (Image 1) */}
          {/* ========================================================================= */}
          {activeTab === 'routes' && (
            <View>
              {routes.length === 0 ? (
                /* Empty card matching Image 1 exactly */
                <View style={styles.emptyContainerCard}>
                  <View style={styles.emptyIconCircle}>
                    <IconComp name="bus-outline" size={44} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyTitle}>No Routes Found</Text>
                  <Text style={styles.emptySubtitle}>
                    Create your first transport route to begin assigning students.
                  </Text>
                </View>
              ) : (
                <View style={{ gap: 12 }}>
                  {routes.map(route => {
                    const assignedCount = route.assignedStudents?.length || 0;
                    const cap = route.capacity || 40;
                    const percent = Math.min(100, Math.round((assignedCount / cap) * 100));

                    return (
                      <View key={route.id} style={styles.routeCardItem}>
                        <View style={styles.routeCardTopRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.routeCardName}>{route.name}</Text>
                            {route.vehicleNumber ? (
                              <View style={styles.vehicleBadge}>
                                <IconComp name="bus-outline" size={12} color="#475569" />
                                <Text style={styles.vehicleBadgeText}>{route.vehicleNumber}</Text>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.routeActivePill}>
                            <Text style={styles.routeActivePillText}>Active</Text>
                          </View>
                        </View>

                        {/* Driver details */}
                        <View style={styles.driverInfoRow}>
                          <IconComp name="person-circle-outline" size={15} color="#64748B" />
                          <Text style={styles.driverInfoText}>
                            Driver: <Text style={{ fontWeight: '700', color: '#334155' }}>{route.driverName || 'Not Assigned'}</Text>
                            {route.driverPhone ? ` • ${route.driverPhone}` : ''}
                          </Text>
                        </View>

                        {/* Occupancy bar */}
                        <View style={styles.capacityRow}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={styles.capacityLabel}>Occupancy</Text>
                            <Text style={styles.capacityCount}>
                              {assignedCount} / {cap} seats ({percent}%)
                            </Text>
                          </View>
                          <View style={styles.progressBarTrack}>
                            <View
                              style={[
                                styles.progressBarFill,
                                {
                                  width: `${percent}%`,
                                  backgroundColor: percent >= 90 ? '#EF4444' : percent >= 70 ? '#F59E0B' : '#b07fa8',
                                },
                              ]}
                            />
                          </View>
                        </View>

                        {/* Action buttons */}
                        <View style={styles.routeActionsRow}>
                          <TouchableOpacity
                            style={styles.editBtn}
                            onPress={() => handleOpenAddRoute(route)}>
                            <IconComp name="create-outline" size={14} color="#64748B" />
                            <Text style={styles.editBtnText}>Edit</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteBtn}
                            onPress={() => handleDeleteRoute(route)}>
                            <IconComp name="trash-outline" size={14} color="#EF4444" />
                            <Text style={styles.deleteBtnText}>Delete</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: VEHICLE MANAGEMENT (Image 3) */}
          {/* ========================================================================= */}
          {activeTab === 'vehicles' && (
            <View>
              {/* 6 Metric KPI Cards (Matching Image 3) */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.metricsRow}>
                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>TOTAL</Text>
                  <Text style={[styles.metricCount, { color: '#0F172A' }]}>{vehicleMetrics.total}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>ACTIVE</Text>
                  <Text style={[styles.metricCount, { color: '#059669' }]}>{vehicleMetrics.active}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>ASSIGNED</Text>
                  <Text style={[styles.metricCount, { color: '#b07fa8' }]}>{vehicleMetrics.assigned}</Text>
                </View>

                <View style={styles.metricCard}>
                  <Text style={styles.metricLabel}>UNASSIGNED</Text>
                  <Text style={[styles.metricCount, { color: '#D97706' }]}>{vehicleMetrics.unassigned}</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.metricLabel, { color: '#B45309' }]}>EXPIRING (30D)</Text>
                  <Text style={[styles.metricCount, { color: '#D97706' }]}>{vehicleMetrics.expiring}</Text>
                </View>

                <View style={[styles.metricCard, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}>
                  <Text style={[styles.metricLabel, { color: '#B91C1C' }]}>EXPIRED DOCS</Text>
                  <Text style={[styles.metricCount, { color: '#DC2626' }]}>{vehicleMetrics.expired}</Text>
                </View>
              </ScrollView>

              {/* Search & Filters Bar (Matching Image 3) */}
              <View style={styles.searchAndFiltersCard}>
                {/* Search Input */}
                <View style={styles.searchInputWrapper}>
                  <IconComp name="search-outline" size={17} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputText}
                    placeholder="Search vehicles..."
                    placeholderTextColor="#94A3B8"
                    value={vehicleSearchQuery}
                    onChangeText={setVehicleSearchQuery}
                  />
                  {vehicleSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setVehicleSearchQuery('')}>
                      <IconComp name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Dropdowns Row */}
                <View style={styles.filtersControlsRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 4 }}>
                    <IconComp name="funnel-outline" size={13} color="#64748B" />
                    <Text style={styles.filtersLabel}>FILTERS:</Text>
                  </View>

                  {/* Status Dropdown */}
                  <TouchableOpacity
                    style={styles.filterDropdownBtn}
                    onPress={() => setShowStatusFilterModal(true)}
                    activeOpacity={0.75}>
                    <Text style={styles.filterDropdownText} numberOfLines={1}>
                      {vehicleStatusFilter === 'all'
                        ? 'All Statuses'
                        : vehicleStatusFilter === 'Active'
                        ? 'Active Only'
                        : 'Inactive Only'}
                    </Text>
                    <IconComp name="chevron-down-outline" size={12} color="#64748B" />
                  </TouchableOpacity>

                  {/* Compliance Status Dropdown */}
                  <TouchableOpacity
                    style={styles.filterDropdownBtn}
                    onPress={() => setShowComplianceFilterModal(true)}
                    activeOpacity={0.75}>
                    <Text style={styles.filterDropdownText} numberOfLines={1}>
                      {vehicleComplianceFilter === 'all'
                        ? 'All Compliance Statuses'
                        : vehicleComplianceFilter === 'active'
                        ? 'Documents Active'
                        : vehicleComplianceFilter === 'expiring'
                        ? 'Expiring Soon (30 Days)'
                        : 'Has Expired Documents'}
                    </Text>
                    <IconComp name="chevron-down-outline" size={12} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Table Container (Matching Image 3) */}
              <View style={styles.tableCardContainer}>
                {/* Scrollable Table matching Image 3 headers */}
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ minWidth: 700 }}>
                    {/* Table Header */}
                    <View style={styles.vehicleTableHeaderRow}>
                      <Text style={[styles.vehicleColHeader, { width: 140 }]}>VEHICLE DETAILS</Text>
                      <Text style={[styles.vehicleColHeader, { width: 130 }]}>REGISTRATION NO</Text>
                      <Text style={[styles.vehicleColHeader, { width: 90 }]}>CAPACITY</Text>
                      <Text style={[styles.vehicleColHeader, { width: 140 }]}>COMPLIANCE STATUS</Text>
                      <Text style={[styles.vehicleColHeader, { width: 130 }]}>ASSIGNED ROUTE(S)</Text>
                      <Text style={[styles.vehicleColHeader, { width: 80 }]}>STATUS</Text>
                      <Text style={[styles.vehicleColHeader, { width: 100, textAlign: 'right' }]}>ACTIONS</Text>
                    </View>

                    {/* Empty State matching Image 3 */}
                    {filteredVehicles.length === 0 ? (
                      <View style={styles.emptyTableStateRow}>
                        <View style={styles.emptyIconCircleSmall}>
                          <IconComp name="bus-outline" size={32} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyTableTitle}>No vehicles found matching filters</Text>
                      </View>
                    ) : (
                      filteredVehicles.map(vehicle => {
                        const compStatus = getVehicleComplianceStatus(vehicle);
                        const assignedRouteNames = (vehicle.assignedRouteIds || [])
                          .map(rId => routes.find(r => r.id === rId)?.name)
                          .filter(Boolean);

                        return (
                          <View key={vehicle.id} style={styles.vehicleTableRow}>
                            {/* Vehicle Details */}
                            <View style={{ width: 140, paddingRight: 8 }}>
                              <Text style={styles.vehicleNameText} numberOfLines={1}>
                                {vehicle.vehicleName}
                              </Text>
                              <Text style={styles.vehicleModelText} numberOfLines={1}>
                                {vehicle.vehicleModel}
                              </Text>
                            </View>

                            {/* Registration No */}
                            <View style={{ width: 130, paddingRight: 8 }}>
                              <Text style={styles.vehicleRegText} numberOfLines={1}>
                                {vehicle.registrationNumber}
                              </Text>
                            </View>

                            {/* Capacity */}
                            <View style={{ width: 90, paddingRight: 8 }}>
                              <Text style={styles.vehicleCellText}>
                                {vehicle.seatingCapacity} seats
                              </Text>
                            </View>

                            {/* Compliance Status */}
                            <View style={{ width: 140, paddingRight: 8 }}>
                              <View
                                style={[
                                  styles.pillBadge,
                                  compStatus === 'active' && { backgroundColor: '#ECFDF5' },
                                  compStatus === 'expiring' && { backgroundColor: '#FEF3C7' },
                                  compStatus === 'expired' && { backgroundColor: '#FEE2E2' },
                                ]}>
                                <Text
                                  style={[
                                    styles.pillBadgeText,
                                    compStatus === 'active' && { color: '#059669' },
                                    compStatus === 'expiring' && { color: '#D97706' },
                                    compStatus === 'expired' && { color: '#DC2626' },
                                  ]}>
                                  {compStatus === 'active'
                                    ? 'Docs Active'
                                    : compStatus === 'expiring'
                                    ? 'Expiring Soon'
                                    : 'Expired Docs'}
                                </Text>
                              </View>
                            </View>

                            {/* Assigned Route */}
                            <View style={{ width: 130, paddingRight: 8 }}>
                              <Text style={styles.vehicleCellText} numberOfLines={1}>
                                {assignedRouteNames.length > 0 ? assignedRouteNames.join(', ') : 'None'}
                              </Text>
                            </View>

                            {/* Status */}
                            <View style={{ width: 80, paddingRight: 8 }}>
                              <View
                                style={[
                                  styles.pillBadge,
                                  vehicle.status === 'Active'
                                    ? { backgroundColor: '#F0FDF4' }
                                    : { backgroundColor: '#F1F5F9' },
                                ]}>
                                <Text
                                  style={[
                                    styles.pillBadgeText,
                                    vehicle.status === 'Active' ? { color: '#16A34A' } : { color: '#64748B' },
                                  ]}>
                                  {vehicle.status}
                                </Text>
                              </View>
                            </View>

                            {/* Actions */}
                            <View style={{ width: 100, flexDirection: 'row', justifyContent: 'flex-end', gap: 6 }}>
                              <TouchableOpacity
                                style={styles.tableActionIconBtn}
                                onPress={() => handleOpenAddVehicle(vehicle)}>
                                <IconComp name="create-outline" size={15} color="#475569" />
                              </TouchableOpacity>
                              <TouchableOpacity
                                style={styles.tableActionIconBtn}
                                onPress={() => handleDeleteVehicle(vehicle)}>
                                <IconComp name="trash-outline" size={15} color="#EF4444" />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: STUDENT ASSIGNMENTS (Image 5) */}
          {/* ========================================================================= */}
          {activeTab === 'assignments' && (
            <View>
              {/* Search Box (Matching Image 5) */}
              <View style={styles.assignmentSearchCard}>
                <View style={styles.searchInputWrapper}>
                  <IconComp name="search-outline" size={17} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInputText}
                    placeholder="Search students or assigned routes..."
                    placeholderTextColor="#94A3B8"
                    value={assignmentSearchQuery}
                    onChangeText={setAssignmentSearchQuery}
                  />
                  {assignmentSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setAssignmentSearchQuery('')}>
                      <IconComp name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Filter Tabs Row */}
                <View style={styles.assignmentFilterPillsRow}>
                  {[
                    { id: 'all', label: 'All Students' },
                    { id: 'assigned', label: 'Assigned' },
                    { id: 'unassigned', label: 'Not Assigned' },
                  ].map(tab => (
                    <TouchableOpacity
                      key={tab.id}
                      style={[
                        styles.assignmentFilterPill,
                        assignmentFilterTab === tab.id && styles.assignmentFilterPillActive,
                      ]}
                      onPress={() => setAssignmentFilterTab(tab.id as any)}>
                      <Text
                        style={[
                          styles.assignmentFilterPillText,
                          assignmentFilterTab === tab.id && styles.assignmentFilterPillTextActive,
                        ]}>
                        {tab.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Table Container (Matching Image 5) */}
              <View style={styles.tableCardContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View style={{ minWidth: 680 }}>
                    {/* Table Header Row (STUDENT | ADMISSION NO | ASSIGNED ROUTE | DRIVER & CONTACT | ACTIONS) */}
                    <View style={styles.studentTableHeaderRow}>
                      <Text style={[styles.studentColHeader, { width: 140 }]}>STUDENT</Text>
                      <Text style={[styles.studentColHeader, { width: 130 }]}>ADMISSION NO</Text>
                      <Text style={[styles.studentColHeader, { width: 140 }]}>ASSIGNED ROUTE</Text>
                      <Text style={[styles.studentColHeader, { width: 140 }]}>DRIVER & CONTACT</Text>
                      <Text style={[styles.studentColHeader, { width: 120, textAlign: 'right' }]}>ACTIONS</Text>
                    </View>

                    {/* Table Body */}
                    {filteredStudents.length === 0 ? (
                      <View style={styles.emptyTableStateRow}>
                        <View style={styles.emptyIconCircleSmall}>
                          <IconComp name="people-outline" size={32} color="#94A3B8" />
                        </View>
                        <Text style={styles.emptyTableTitle}>No students found matching search</Text>
                      </View>
                    ) : (
                      filteredStudents.map(student => {
                        const assignedRoute = routes.find(r => r.id === student.transportRouteId);

                        return (
                          <View key={student.id} style={styles.studentTableRow}>
                            {/* Student Name */}
                            <View style={{ width: 140, paddingRight: 8 }}>
                              <Text style={styles.studentNameText} numberOfLines={1}>
                                {student.name}
                              </Text>
                              {student.grade ? (
                                <Text style={styles.studentGradeText} numberOfLines={1}>
                                  {student.grade}
                                </Text>
                              ) : null}
                            </View>

                            {/* Admission No */}
                            <View style={{ width: 130, paddingRight: 8 }}>
                              <Text style={styles.studentAdmText} numberOfLines={1}>
                                {student.admissionNumber || student.admissionNo || '—'}
                              </Text>
                            </View>

                            {/* Assigned Route */}
                            <View style={{ width: 140, paddingRight: 8 }}>
                              {assignedRoute ? (
                                <View style={styles.assignedRouteBadge}>
                                  <Text style={styles.assignedRouteBadgeText} numberOfLines={1}>
                                    {assignedRoute.name}
                                  </Text>
                                </View>
                              ) : (
                                <Text style={styles.notAssignedItalicText}>Not assigned</Text>
                              )}
                            </View>

                            {/* Driver & Contact (Matching Image 5) */}
                            <View style={{ width: 140, paddingRight: 8 }}>
                              {assignedRoute ? (
                                <View>
                                  <Text style={styles.driverNameText} numberOfLines={1}>
                                    {assignedRoute.driverName || 'Driver —'}
                                  </Text>
                                  {assignedRoute.driverPhone ? (
                                    <Text style={styles.driverPhoneText} numberOfLines={1}>
                                      {assignedRoute.driverPhone}
                                    </Text>
                                  ) : null}
                                </View>
                              ) : (
                                <Text style={styles.driverDashText}>-</Text>
                              )}
                            </View>

                            {/* Actions: Quick Assign... Dropdown Button (Matching Image 5) */}
                            <View style={{ width: 120, alignItems: 'flex-end' }}>
                              <TouchableOpacity
                                style={[
                                  styles.quickAssignDropdownBtn,
                                  assignedRoute && styles.quickAssignDropdownBtnAssigned,
                                ]}
                                onPress={() => handleOpenAssignModal(student)}
                                activeOpacity={0.75}>
                                <Text
                                  style={[
                                    styles.quickAssignDropdownText,
                                    assignedRoute && styles.quickAssignDropdownTextAssigned,
                                  ]}
                                  numberOfLines={1}>
                                  {assignedRoute ? 'Change...' : 'Quick Assign...'}
                                </Text>
                                <IconComp
                                  name="chevron-down-outline"
                                  size={12}
                                  color={assignedRoute ? '#b07fa8' : '#64748B'}
                                />
                              </TouchableOpacity>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: ADD NEW ROUTE / EDIT ROUTE (Image 2) */}
      {/* ========================================================================= */}
      <Modal visible={showRouteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContentBox}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconComp name="paper-plane-outline" size={20} color="#b07fa8" />
                <Text style={styles.modalTitleText}>
                  {editingRoute ? 'Edit Route' : 'New Route'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowRouteModal(false)}
                style={styles.modalCloseIconBtn}
                activeOpacity={0.7}>
                <IconComp name="close-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareFormScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12 }}>
              {/* Field 1: Route Name */}
              <Text style={styles.inputFieldLabel}>Route Name</Text>
              <TextInput
                style={styles.modalTextInput}
                placeholder="e.g. North City Loop"
                placeholderTextColor="#94A3B8"
                value={routeForm.name}
                onChangeText={v => setRouteForm(p => ({ ...p, name: v }))}
              />

              {/* Row 2: Vehicle No. & Capacity (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Vehicle No.</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="E.G. BUS-12"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={routeForm.vehicleNumber}
                    onChangeText={v => setRouteForm(p => ({ ...p, vehicleNumber: v.toUpperCase() }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Capacity</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. 40"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={routeForm.capacity}
                    onChangeText={v => setRouteForm(p => ({ ...p, capacity: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>

              {/* Row 3: Driver Name & Driver Phone (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Driver Name</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. Rajan Kumar"
                    placeholderTextColor="#94A3B8"
                    value={routeForm.driverName}
                    onChangeText={v => setRouteForm(p => ({ ...p, driverName: v }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Driver Phone</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. 9876543210"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={routeForm.driverPhone}
                    onChangeText={v => setRouteForm(p => ({ ...p, driverPhone: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>
            </KeyboardAwareFormScrollView>

            {/* Modal Footer (Cancel & Create Route) */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowRouteModal(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSavePurpleBtn}
                onPress={handleSaveRoute}
                activeOpacity={0.85}>
                <Text style={styles.modalSaveBtnText}>
                  {editingRoute ? 'Save Changes' : 'Create Route'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: REGISTER SCHOOL VEHICLE (Image 4) */}
      {/* ========================================================================= */}
      <Modal visible={showVehicleModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBox, { maxHeight: '92%' }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <IconComp name="bus-outline" size={20} color="#b07fa8" />
                <Text style={styles.modalTitleText}>
                  {editingVehicle ? 'Edit School Vehicle' : 'Register School Vehicle'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowVehicleModal(false)}
                style={styles.modalCloseIconBtn}
                activeOpacity={0.7}>
                <IconComp name="close-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <KeyboardAwareFormScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 12 }}>
              {/* Row 1: Vehicle Name * & Vehicle Model * (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Vehicle Name *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. School Bus 15"
                    placeholderTextColor="#94A3B8"
                    value={vehicleForm.vehicleName}
                    onChangeText={v => setVehicleForm(p => ({ ...p, vehicleName: v }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Vehicle Model *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. Tata Winger 2024"
                    placeholderTextColor="#94A3B8"
                    value={vehicleForm.vehicleModel}
                    onChangeText={v => setVehicleForm(p => ({ ...p, vehicleModel: v }))}
                  />
                </View>
              </View>

              {/* Row 2: Registration Number (Unique) * & Seating Capacity * (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Registration Number (Unique) *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. MH-12-PQ-4567"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={vehicleForm.registrationNumber}
                    onChangeText={v => setVehicleForm(p => ({ ...p, registrationNumber: v.toUpperCase() }))}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Seating Capacity *</Text>
                  <TextInput
                    style={styles.modalTextInput}
                    placeholder="e.g. 40"
                    placeholderTextColor="#94A3B8"
                    keyboardType="number-pad"
                    value={vehicleForm.seatingCapacity}
                    onChangeText={v => setVehicleForm(p => ({ ...p, seatingCapacity: v.replace(/[^0-9]/g, '') }))}
                  />
                </View>
              </View>

              {/* Row 3: Assigned Route(s) & Vehicle Status * (2 Columns) */}
              <View style={styles.twoColumnRow}>
                {/* Assigned Route(s) Box */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Assigned Route(s)</Text>
                  <View style={styles.routeSelectorBox}>
                    <ScrollView style={{ maxHeight: 95 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                      {routes.length === 0 ? (
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontStyle: 'italic', padding: 4 }}>
                          No routes created yet
                        </Text>
                      ) : (
                        routes.map(r => {
                          const isSelected = vehicleForm.assignedRouteIds.includes(r.id);
                          return (
                            <TouchableOpacity
                              key={r.id}
                              style={[
                                styles.routeSelectItemRow,
                                isSelected && styles.routeSelectItemRowActive,
                              ]}
                              onPress={() => {
                                setVehicleForm(p => {
                                  const exists = p.assignedRouteIds.includes(r.id);
                                  return {
                                    ...p,
                                    assignedRouteIds: exists
                                      ? p.assignedRouteIds.filter(id => id !== r.id)
                                      : [...p.assignedRouteIds, r.id],
                                  };
                                });
                              }}
                              activeOpacity={0.7}>
                              <View
                                style={[
                                  styles.routeCheckbox,
                                  isSelected && styles.routeCheckboxActive,
                                ]}>
                                {isSelected && <IconComp name="checkmark" size={11} color="#FFFFFF" />}
                              </View>
                              <Text
                                style={[
                                  styles.routeSelectItemText,
                                  isSelected && styles.routeSelectItemTextActive,
                                ]}
                                numberOfLines={1}>
                                {r.name}
                              </Text>
                            </TouchableOpacity>
                          );
                        })
                      )}
                    </ScrollView>
                  </View>
                  <Text style={styles.routeHelperText}>
                    Hold Ctrl (or tap to select multiple routes)
                  </Text>
                </View>

                {/* Vehicle Status Dropdown */}
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>Vehicle Status *</Text>
                  <TouchableOpacity
                    style={styles.statusDropdownSelectBtn}
                    onPress={() => setShowVehicleStatusDropdown(prev => !prev)}
                    activeOpacity={0.75}>
                    <Text style={styles.statusDropdownSelectText}>{vehicleForm.status}</Text>
                    <IconComp name="chevron-down-outline" size={14} color="#64748B" />
                  </TouchableOpacity>

                  {showVehicleStatusDropdown && (
                    <View style={styles.statusDropdownOptionsPopup}>
                      {(['Active', 'Inactive'] as const).map(st => (
                        <TouchableOpacity
                          key={st}
                          style={[
                            styles.statusDropdownOptionItem,
                            vehicleForm.status === st && styles.statusDropdownOptionItemActive,
                          ]}
                          onPress={() => {
                            setVehicleForm(p => ({ ...p, status: st }));
                            setShowVehicleStatusDropdown(false);
                          }}>
                          <Text
                            style={[
                              styles.statusDropdownOptionText,
                              vehicleForm.status === st && styles.statusDropdownOptionTextActive,
                            ]}>
                            {st}
                          </Text>
                          {vehicleForm.status === st && (
                            <IconComp name="checkmark" size={14} color="#b07fa8" />
                          )}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* COMPLIANCE & EXPIRY DATES HEADER (Matching Image 4) */}
              <View style={styles.complianceHeaderBox}>
                <Text style={styles.complianceSectionTitle}>COMPLIANCE & EXPIRY DATES</Text>
              </View>

              {/* Row 4: FC Expiry & Insurance Expiry (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>FITNESS CERTIFICATE (FC) EXPIRY *</Text>
                  <TouchableOpacity
                    style={styles.datePickerInputBox}
                    onPress={() => openNativeDatePicker('fcExpiryDate')}
                    activeOpacity={0.75}>
                    <Text style={styles.datePickerInputText}>
                      {formatDateDisplay(vehicleForm.fcExpiryDate)}
                    </Text>
                    <IconComp name="calendar-outline" size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>INSURANCE EXPIRY *</Text>
                  <TouchableOpacity
                    style={styles.datePickerInputBox}
                    onPress={() => openNativeDatePicker('insuranceExpiryDate')}
                    activeOpacity={0.75}>
                    <Text style={styles.datePickerInputText}>
                      {formatDateDisplay(vehicleForm.insuranceExpiryDate)}
                    </Text>
                    <IconComp name="calendar-outline" size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 5: Permit Expiry & Road Tax Expiry (2 Columns) */}
              <View style={styles.twoColumnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>PERMIT EXPIRY *</Text>
                  <TouchableOpacity
                    style={styles.datePickerInputBox}
                    onPress={() => openNativeDatePicker('permitExpiryDate')}
                    activeOpacity={0.75}>
                    <Text style={styles.datePickerInputText}>
                      {formatDateDisplay(vehicleForm.permitExpiryDate)}
                    </Text>
                    <IconComp name="calendar-outline" size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.inputFieldLabel}>ROAD TAX EXPIRY *</Text>
                  <TouchableOpacity
                    style={styles.datePickerInputBox}
                    onPress={() => openNativeDatePicker('roadTaxExpiryDate')}
                    activeOpacity={0.75}>
                    <Text style={styles.datePickerInputText}>
                      {formatDateDisplay(vehicleForm.roadTaxExpiryDate)}
                    </Text>
                    <IconComp name="calendar-outline" size={17} color="#64748B" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 6: Pollution Certificate (PUC) Expiry */}
              <View style={{ marginTop: 2 }}>
                <Text style={styles.inputFieldLabel}>POLLUTION CERTIFICATE (PUC) EXPIRY *</Text>
                <TouchableOpacity
                  style={styles.datePickerInputBox}
                  onPress={() => openNativeDatePicker('pollutionCertificateExpiryDate')}
                  activeOpacity={0.75}>
                  <Text style={styles.datePickerInputText}>
                    {formatDateDisplay(vehicleForm.pollutionCertificateExpiryDate)}
                  </Text>
                  <IconComp name="calendar-outline" size={17} color="#64748B" />
                </TouchableOpacity>
              </View>
            </KeyboardAwareFormScrollView>

            {/* Modal Footer (Cancel & Register Vehicle) */}
            <View style={styles.modalFooterRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowVehicleModal(false)}
                activeOpacity={0.7}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSavePurpleBtn}
                onPress={handleSaveVehicle}
                activeOpacity={0.85}>
                <Text style={styles.modalSaveBtnText}>
                  {editingVehicle ? 'Save Vehicle' : 'Register Vehicle'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK ASSIGN ROUTE PICKER (Image 5) */}
      {/* ========================================================================= */}
      <Modal visible={showRouteAssignPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContentBox, { maxWidth: 380 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitleText}>Assign Transport Route</Text>
                <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }} numberOfLines={1}>
                  Student: {activeStudentForAssign?.name} ({activeStudentForAssign?.admissionNumber || activeStudentForAssign?.admissionNo})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowRouteAssignPicker(false)}
                style={styles.modalCloseIconBtn}
                activeOpacity={0.7}>
                <IconComp name="close-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
              {/* Unassign Option */}
              <TouchableOpacity
                style={[
                  styles.routeAssignItem,
                  !activeStudentForAssign?.transportRouteId && styles.routeAssignItemCurrent,
                ]}
                onPress={() => handleSelectRouteForStudent(null)}
                activeOpacity={0.7}>
                <IconComp name="close-circle-outline" size={18} color="#EF4444" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routeAssignItemName, { color: '#EF4444' }]}>Unassign / No Transport</Text>
                  <Text style={styles.routeAssignItemSub}>Remove student from bus roster</Text>
                </View>
              </TouchableOpacity>

              {/* List of Available Routes */}
              {routes.map(r => {
                const assignedCount = r.assignedStudents?.length || 0;
                const isFull = assignedCount >= r.capacity;
                const isCurrent = activeStudentForAssign?.transportRouteId === r.id;

                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.routeAssignItem,
                      isCurrent && styles.routeAssignItemCurrent,
                      isFull && !isCurrent && { opacity: 0.6 },
                    ]}
                    onPress={() => handleSelectRouteForStudent(r.id)}
                    activeOpacity={0.7}>
                    <IconComp
                      name="bus-outline"
                      size={18}
                      color={isCurrent ? '#b07fa8' : '#475569'}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.routeAssignItemName, isCurrent && { color: '#b07fa8' }]}>
                        {r.name}
                      </Text>
                      <Text style={styles.routeAssignItemSub}>
                        Vehicle: {r.vehicleNumber || '—'} • {assignedCount}/{r.capacity} seats
                      </Text>
                    </View>
                    {isCurrent ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Assigned</Text>
                      </View>
                    ) : isFull ? (
                      <View style={[styles.currentBadge, { backgroundColor: '#FEE2E2' }]}>
                        <Text style={[styles.currentBadgeText, { color: '#DC2626' }]}>Full</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { width: '100%', alignItems: 'center' }]}
              onPress={() => setShowRouteAssignPicker(false)}
              activeOpacity={0.7}>
              <Text style={styles.modalCancelBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ========================================================================= */}
      {/* FILTER PICKER MODAL: VEHICLE STATUS (Image 3) */}
      {/* ========================================================================= */}
      <Modal visible={showStatusFilterModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowStatusFilterModal(false)}>
          <View style={[styles.modalContentBox, { maxWidth: 300 }]}>
            <Text style={styles.filterModalTitle}>Filter by Vehicle Status</Text>
            {[
              { label: 'All Statuses', val: 'all' as const },
              { label: 'Active Only', val: 'Active' as const },
              { label: 'Inactive Only', val: 'Inactive' as const },
            ].map(opt => (
              <TouchableOpacity
                key={opt.val}
                style={[
                  styles.filterOptionItem,
                  vehicleStatusFilter === opt.val && styles.filterOptionItemActive,
                ]}
                onPress={() => {
                  setVehicleStatusFilter(opt.val);
                  setShowStatusFilterModal(false);
                }}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.filterOptionText,
                    vehicleStatusFilter === opt.val && styles.filterOptionTextActive,
                  ]}>
                  {opt.label}
                </Text>
                {vehicleStatusFilter === opt.val && (
                  <IconComp name="checkmark" size={16} color="#b07fa8" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* FILTER PICKER MODAL: COMPLIANCE STATUS (Image 3) */}
      {/* ========================================================================= */}
      <Modal visible={showComplianceFilterModal} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowComplianceFilterModal(false)}>
          <View style={[styles.modalContentBox, { maxWidth: 320 }]}>
            <Text style={styles.filterModalTitle}>Filter by Compliance Status</Text>
            {[
              { label: 'All Compliance Statuses', val: 'all' as const },
              { label: 'Documents Active', val: 'active' as const },
              { label: 'Expiring Soon (30 Days)', val: 'expiring' as const },
              { label: 'Has Expired Documents', val: 'expired' as const },
            ].map(opt => (
              <TouchableOpacity
                key={opt.val}
                style={[
                  styles.filterOptionItem,
                  vehicleComplianceFilter === opt.val && styles.filterOptionItemActive,
                ]}
                onPress={() => {
                  setVehicleComplianceFilter(opt.val);
                  setShowComplianceFilterModal(false);
                }}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.filterOptionText,
                    vehicleComplianceFilter === opt.val && styles.filterOptionTextActive,
                  ]}>
                  {opt.label}
                </Text>
                {vehicleComplianceFilter === opt.val && (
                  <IconComp name="checkmark" size={16} color="#b07fa8" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ========================================================================= */}
      {/* WHITE CALENDAR DATE PICKER MODAL (Matching Global App DatePicker) */}
      {/* ========================================================================= */}
      <Modal visible={vehicleDatePicker.visible} transparent animationType="fade" onRequestClose={() => setVehicleDatePicker(p => ({ ...p, visible: false }))}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, width: '100%', maxWidth: 360, elevation: 6 }}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>{vehicleDatePicker.title}</Text>
              <TouchableOpacity onPress={() => setVehicleDatePicker(p => ({ ...p, visible: false }))} style={{ padding: 4 }}>
                <IconComp name="close-outline" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            {vehicleDatePicker.viewMode === 'month' ? (
              /* MONTH SELECTION GRID */
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Select Month</Text>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                    onPress={() => setVehicleDatePicker(p => ({ ...p, viewMode: 'calendar' }))}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Back to Calendar</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((mName, idx) => {
                    const isSelected = vehicleDatePicker.month === idx;
                    return (
                      <TouchableOpacity
                        key={mName}
                        style={{
                          width: '30%',
                          paddingVertical: 12,
                          borderRadius: 10,
                          backgroundColor: isSelected ? '#b07fa8' : '#F8FAFC',
                          alignItems: 'center',
                          borderWidth: 1,
                          borderColor: isSelected ? '#b07fa8' : '#E2E8F0',
                        }}
                        onPress={() => {
                          setVehicleDatePicker(p => ({ ...p, month: idx, viewMode: 'calendar' }));
                        }}>
                        <Text style={{ fontSize: 13, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFFFFF' : '#0F172A' }}>
                          {mName}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : vehicleDatePicker.viewMode === 'year' ? (
              /* YEAR SELECTION GRID */
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#64748B' }}>Select Year</Text>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: '#F1F5F9' }}
                    onPress={() => setVehicleDatePicker(p => ({ ...p, viewMode: 'calendar' }))}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A' }}>Back to Calendar</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 240 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                    {Array.from({ length: 66 }, (_, i) => 1970 + i).map(yNum => {
                      const isSelected = vehicleDatePicker.year === yNum;
                      return (
                        <TouchableOpacity
                          key={yNum}
                          style={{
                            width: '30%',
                            paddingVertical: 10,
                            borderRadius: 10,
                            backgroundColor: isSelected ? '#b07fa8' : '#F8FAFC',
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: isSelected ? '#b07fa8' : '#E2E8F0',
                          }}
                          onPress={() => {
                            setVehicleDatePicker(p => ({ ...p, year: yNum, viewMode: 'calendar' }));
                          }}>
                          <Text style={{ fontSize: 13, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFFFFF' : '#0F172A' }}>
                            {yNum}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            ) : (
              /* STANDARD CALENDAR VIEW WITH MONTH & YEAR HEADERS */
              <View>
                {/* Month / Year Navigator */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, marginBottom: 14 }}>
                  <TouchableOpacity
                    onPress={() => {
                      if (vehicleDatePicker.month === 0) {
                        setVehicleDatePicker(p => ({ ...p, month: 11, year: p.year - 1 }));
                      } else {
                        setVehicleDatePicker(p => ({ ...p, month: p.month - 1 }));
                      }
                    }}
                    style={{ padding: 6 }}>
                    <IconComp name="chevron-back" size={18} color="#0F172A" />
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                      onPress={() => setVehicleDatePicker(p => ({ ...p, viewMode: 'month' }))}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                        {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][vehicleDatePicker.month]}
                      </Text>
                      <IconComp name="chevron-down" size={12} color="#64748B" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 4,
                        paddingHorizontal: 8,
                        borderRadius: 8,
                        backgroundColor: '#FFFFFF',
                        borderWidth: 1,
                        borderColor: '#CBD5E1',
                      }}
                      onPress={() => setVehicleDatePicker(p => ({ ...p, viewMode: 'year' }))}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                        {vehicleDatePicker.year}
                      </Text>
                      <IconComp name="chevron-down" size={12} color="#64748B" />
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (vehicleDatePicker.month === 11) {
                        setVehicleDatePicker(p => ({ ...p, month: 0, year: p.year + 1 }));
                      } else {
                        setVehicleDatePicker(p => ({ ...p, month: p.month + 1 }));
                      }
                    }}
                    style={{ padding: 6 }}>
                    <IconComp name="chevron-forward" size={18} color="#0F172A" />
                  </TouchableOpacity>
                </View>

                {/* Weekday Labels (Exact 7-column alignment) */}
                <View style={{ flexDirection: 'row', width: '100%', marginBottom: 8 }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                    <View key={i} style={{ width: '14.285%', alignItems: 'center' }}>
                      <Text style={{ textAlign: 'center', fontSize: 12, fontWeight: '700', color: i === 0 ? '#EF4444' : '#64748B' }}>
                        {d}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Days Grid (Exact 7-column alignment) */}
                {(() => {
                  const daysInMonth = new Date(vehicleDatePicker.year, vehicleDatePicker.month + 1, 0).getDate();
                  const firstDayIndex = new Date(vehicleDatePicker.year, vehicleDatePicker.month, 1).getDay();
                  const cells = [];
                  for (let i = 0; i < firstDayIndex; i++) {
                    cells.push(<View key={`empty-${i}`} style={{ width: '14.285%', height: 40 }} />);
                  }
                  for (let day = 1; day <= daysInMonth; day++) {
                    const isSelected = vehicleDatePicker.day === day;
                    const dayOfWeek = new Date(vehicleDatePicker.year, vehicleDatePicker.month, day).getDay();
                    const isSunday = dayOfWeek === 0;
                    cells.push(
                      <TouchableOpacity
                        key={`day-${day}`}
                        onPress={() => setVehicleDatePicker(p => ({ ...p, day }))}
                        style={{
                          width: '14.285%',
                          height: 40,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            justifyContent: 'center',
                            alignItems: 'center',
                            borderRadius: 16,
                            backgroundColor: isSelected ? '#b07fa8' : 'transparent',
                          }}>
                          <Text style={{ fontSize: 13, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFFFFF' : isSunday ? '#EF4444' : '#0F172A' }}>
                            {day}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
                      {cells}
                    </View>
                  );
                })()}

                {/* Bottom Action Buttons: Cancel and Confirm */}
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                  <TouchableOpacity
                    style={{ paddingHorizontal: 14, paddingVertical: 8 }}
                    onPress={() => setVehicleDatePicker(p => ({ ...p, visible: false }))}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      backgroundColor: '#b07fa8',
                      paddingHorizontal: 18,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                    onPress={handleConfirmVehicleDate}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF' }}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  moduleHeroHeaderCard: {
    backgroundColor: '#b07fa8',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 12,
    shadowColor: '#b07fa8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 3,
  },
  headerCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  headerCardTitleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  moduleHeroTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  moduleHeroSub: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.92)',
    lineHeight: 18,
    fontWeight: '500',
  },
  actionButtonRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  purplePrimaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#b07fa8',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#b07fa8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  purplePrimaryBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    lineHeight: 16,
  },
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#b07fa8',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 6,
    shadowColor: '#b07fa8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // Tabs Bar (Matching Image 1, 3, 5)
  tabsBarWrapper: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  tabPillActive: {
    backgroundColor: '#b07fa8',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  bodyScroll: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },

  // Empty state card (Matching Image 1)
  emptyContainerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 54,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  emptyIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 300,
  },

  // Route Cards
  routeCardItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  routeCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  vehicleBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  routeActivePill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  routeActivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 10,
  },
  driverInfoText: {
    fontSize: 12,
    color: '#64748B',
  },
  capacityRow: {
    marginTop: 6,
    marginBottom: 12,
  },
  capacityLabel: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  capacityCount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  routeActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 6,
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Vehicle Metrics Row (Matching Image 3)
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    paddingBottom: 14,
  },
  metricCard: {
    width: 105,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  metricCount: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 6,
  },

  // Search & Filters Card (Matching Image 3)
  searchAndFiltersCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
  },
  filtersControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  filtersLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  filterDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 6,
    paddingHorizontal: 10,
    gap: 6,
  },
  filterDropdownText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },

  // Table Card Container (Matching Image 3 & 5)
  tableCardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },

  // Vehicle Table Styles (Matching Image 3)
  vehicleTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  vehicleColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  vehicleTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  vehicleNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  vehicleModelText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  vehicleRegText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: '700',
    color: '#334155',
  },
  vehicleCellText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
  },
  tableActionIconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },

  // Empty Table state
  emptyTableStateRow: {
    paddingVertical: 44,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconCircleSmall: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTableTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    textAlign: 'center',
  },

  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  // Student Assignment Tab (Image 5)
  assignmentSearchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  assignmentFilterPillsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  assignmentFilterPill: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  assignmentFilterPillActive: {
    backgroundColor: '#b07fa8',
  },
  assignmentFilterPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  assignmentFilterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  studentTableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  studentColHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  studentTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  studentNameText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  studentGradeText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  studentAdmText: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#475569',
    fontWeight: '700',
  },
  assignedRouteBadge: {
    backgroundColor: '#FAF5FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  assignedRouteBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#7E22CE',
  },
  notAssignedItalicText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  driverNameText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
  },
  driverPhoneText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  driverDashText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  quickAssignDropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  quickAssignDropdownBtnAssigned: {
    backgroundColor: '#FAF5FF',
    borderColor: '#b07fa8',
  },
  quickAssignDropdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  quickAssignDropdownTextAssigned: {
    color: '#b07fa8',
    fontWeight: '700',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContentBox: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  inputFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  modalTextInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0F172A',
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 14,
    marginTop: 8,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  modalSavePurpleBtn: {
    backgroundColor: '#b07fa8',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    shadowColor: '#b07fa8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  modalSaveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Vehicle Modal Specific
  routeSelectorBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    padding: 4,
    height: 95,
  },
  routeSelectItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  routeSelectItemRowActive: {
    backgroundColor: '#FAF5FF',
  },
  routeCheckbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeCheckboxActive: {
    backgroundColor: '#b07fa8',
    borderColor: '#b07fa8',
  },
  routeSelectItemText: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  routeSelectItemTextActive: {
    color: '#b07fa8',
    fontWeight: '700',
  },
  routeHelperText: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 4,
  },

  statusDropdownSelectBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  statusDropdownSelectText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F172A',
  },
  statusDropdownOptionsPopup: {
    marginTop: 4,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
  },
  statusDropdownOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  statusDropdownOptionItemActive: {
    backgroundColor: '#FAF5FF',
  },
  statusDropdownOptionText: {
    fontSize: 12,
    color: '#334155',
  },
  statusDropdownOptionTextActive: {
    color: '#b07fa8',
    fontWeight: '700',
  },

  complianceHeaderBox: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    marginTop: 16,
    paddingTop: 12,
    marginBottom: 4,
  },
  complianceSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
  },
  datePickerInputBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
  },
  datePickerInputText: {
    fontSize: 13,
    color: '#0F172A',
  },

  // Route assignment modal items
  routeAssignItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
    marginBottom: 8,
  },
  routeAssignItemCurrent: {
    borderColor: '#b07fa8',
    backgroundColor: '#FAF5FF',
  },
  routeAssignItemName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  routeAssignItemSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FAF5FF',
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b07fa8',
  },

  // Filter option modal
  filterModalTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  filterOptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  filterOptionItemActive: {
    backgroundColor: '#FAF5FF',
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  filterOptionText: {
    fontSize: 13,
    color: '#334155',
  },
  filterOptionTextActive: {
    color: '#b07fa8',
    fontWeight: '700',
  },
});
