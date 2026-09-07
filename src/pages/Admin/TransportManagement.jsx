import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  getSubCollection, 
  createTransportRoute, 
  getTransportRoutes, 
  assignStudentToRoute, 
  subscribeToSubCollection, 
  subscribeToTransportRoutes, 
  updateSubDocument, 
  deleteSubDocument,
  addSubDocument
} from '../../firebase/firestore';
import { doc, writeBatch, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { 
  LuBus as Bus, 
  LuPlus as Plus, 
  LuX as X, 
  LuUsers as Users, 
  LuPhone as Phone, 
  LuNavigation as Navigation, 
  LuTriangleAlert as AlertTriangle, 
  LuCircleCheck as CheckCircle2,
  LuCalendar as Calendar,
  LuSearch as Search,
  LuFilter as Filter,
  LuFileWarning as FileWarning,
  LuInfo as Info,
  LuShieldAlert as ShieldAlert
} from 'react-icons/lu';
import { Edit, Trash2, Eye, MoreVertical } from 'lucide-react';
import ConfirmModal from '../../components/ConfirmModal';
import toast from 'react-hot-toast';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import { uploadCustomDataFiles } from '../../utils/cloudinary';
import usePermissions from '../../hooks/usePermissions';

export default function TransportManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('transport');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('transport');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('transport');

  const [activeTab, setActiveTab] = useState('routes'); // 'routes' | 'vehicles' | 'assignments'

  const [routes, setRoutes] = useState([]);
  const [students, setStudents] = useState([]); // All students to populate assign list
  const [loading, setLoading] = useState(true);

  // Vehicles state
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState('');
  const [vehicleStatusFilter, setVehicleStatusFilter] = useState('all'); // 'all' | 'Active' | 'Inactive'
  const [vehicleComplianceFilter, setVehicleComplianceFilter] = useState('all'); // 'all' | 'expiring' | 'expired'
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [activeRouteId, setActiveRouteId] = useState(null); // For assignment
  const [selectedRouteToView, setSelectedRouteToView] = useState(null);
  const [confirmDeleteState, setConfirmDeleteState] = useState({ isOpen: false, id: null, name: '' });

  // Vehicle Modals state
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showViewVehicleModal, setShowViewVehicleModal] = useState(false);
  const [selectedVehicleToView, setSelectedVehicleToView] = useState(null);
  const [vehicleConfirmDeleteState, setVehicleConfirmDeleteState] = useState({ isOpen: false, id: null, name: '' });

  // Forms state
  const [creating, setCreating] = useState(false);
  const [newRoute, setNewRoute] = useState({
    name: '',
    vehicleNumber: '',
    driverName: '',
    driverPhone: '',
    capacity: '',
    customData: {}
  });
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Vehicle Form State
  const [savingVehicle, setSavingVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({
    vehicleName: '',
    vehicleModel: '',
    registrationNumber: '',
    seatingCapacity: '',
    assignedRouteIds: [],
    fcExpiryDate: '',
    insuranceExpiryDate: '',
    permitExpiryDate: '',
    roadTaxExpiryDate: '',
    pollutionCertificateExpiryDate: '',
    status: 'Active'
  });

  // Student assignments tab search
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState('');

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    setLoadingVehicles(true);
    let routesUnsub, studentsUnsub, vehiclesUnsub;

    routesUnsub = subscribeToTransportRoutes(schoolId, (routesData) => {
      setRoutes(routesData);
      setLoading(false);
    });

    studentsUnsub = subscribeToSubCollection(schoolId, 'students', (studentsData) => {
      setStudents(studentsData);
    });

    vehiclesUnsub = subscribeToSubCollection(schoolId, 'vehicles', (vehiclesData) => {
      setVehicles(vehiclesData);
      setLoadingVehicles(false);
    });

    return () => {
      if (routesUnsub) routesUnsub();
      if (studentsUnsub) studentsUnsub();
      if (vehiclesUnsub) vehiclesUnsub();
    };
  }, [schoolId]);

  // Route Handlers
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (newRoute.id && !hasEditPermission) {
      toast.error("You do not have permission to edit transport routes.");
      return;
    }
    if (!newRoute.id && !hasCreatePermission) {
      toast.error("You do not have permission to create transport routes.");
      return;
    }
    if (!newRoute.name || !newRoute.capacity) return;

    if (newRoute.driverPhone) {
      const cleanPhone = newRoute.driverPhone.replace(/[\s\-\(\)]/g, '');
      const phoneRegex = /^(?:\+?91|0)?[1-9]\d{9}$/;
      if (!phoneRegex.test(cleanPhone)) {
        toast.error("Please enter a valid 10-digit driver phone number.");
        return;
      }
    }

    setCreating(true);

    try {
      const uploadedCustomData = await uploadCustomDataFiles(newRoute.customData, schoolId, 'transport');

      if (newRoute.id) {
        await updateSubDocument(schoolId, 'transportRoutes', newRoute.id, {
          ...newRoute,
          customData: uploadedCustomData,
          capacity: Number(newRoute.capacity)
        });
        toast.success("Route updated successfully!");
      } else {
        await createTransportRoute(schoolId, {
          ...newRoute,
          customData: uploadedCustomData,
          capacity: Number(newRoute.capacity)
        });
        toast.success("Route created successfully!");
      }
      
      setShowCreateModal(false);
      setNewRoute({ name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '', customData: {} });
    } catch (error) {
      console.error("Error saving route:", error);
      toast.error("Failed to save route.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoute = async () => {
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete transport routes.");
      return;
    }
    if (!confirmDeleteState.id) return;
    try {
      await deleteSubDocument(schoolId, 'transportRoutes', confirmDeleteState.id);
      toast.success("Route deleted successfully");
      setConfirmDeleteState({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error("Error deleting route:", error);
      toast.error("Failed to delete route");
    }
  };

  const handleAssignStudent = async (e) => {
    e.preventDefault();
    if (!hasEditPermission) {
      toast.error("You do not have permission to modify student assignments.");
      return;
    }
    if (!activeRouteId || !selectedStudentId) return;
    
    // Capacity Check
    const route = routes.find(r => r.id === activeRouteId);
    if (!route) return;
    
    if (route.assignedStudents?.length >= route.capacity) {
      toast.error("Cannot assign student. This bus has reached its maximum capacity!");
      return;
    }

    setAssigning(true);
    try {
      await assignStudentToRoute(schoolId, activeRouteId, selectedStudentId);
      setShowAssignModal(false);
      setSelectedStudentId('');
    } catch (error) {
      console.error("Error assigning student:", error);
      toast.error("Failed to assign student.");
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassignStudent = async (routeId, studentId) => {
    if (!hasEditPermission) {
      toast.error("You do not have permission to modify student assignments.");
      return;
    }
    if (!schoolId || !routeId || !studentId) return;
    try {
      const batch = writeBatch(db);
      
      const routeRef = doc(db, `schools/${schoolId}/transportRoutes`, routeId);
      batch.update(routeRef, {
        assignedStudents: arrayRemove(studentId)
      });

      const studentRef = doc(db, `schools/${schoolId}/students`, studentId);
      batch.update(studentRef, {
        transportRouteId: null
      });

      await batch.commit();
      
      if (selectedRouteToView) {
        setSelectedRouteToView(prev => ({
          ...prev,
          assignedStudents: prev.assignedStudents?.filter(id => id !== studentId) || []
        }));
      }
      
      toast.success("Student unassigned successfully");
    } catch (error) {
      console.error("Error unassigning student:", error);
      toast.error("Failed to unassign student");
    }
  };

  const openAssignModal = (routeId) => {
    if (!hasEditPermission) {
      toast.error("You do not have permission to modify student assignments.");
      return;
    }
    setActiveRouteId(routeId);
    setShowAssignModal(true);
  };

  // Helper to get unassigned students for dropdown
  const unassignedStudents = students.filter(s => !s.transportRouteId);

  // Helper to format route display name
  const getRouteName = (routeId) => {
    const route = routes.find(r => r.id === routeId);
    return route ? route.name : 'Unknown Route';
  };

  // Compliance date calculation helpers
  const getExpiryStatus = (dateStr) => {
    if (!dateStr) return 'active';
    const expiry = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (expiry < today) return 'expired';
    
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return 'expiring';
    return 'active';
  };

  const getVehicleComplianceStatus = (vehicle) => {
    const dates = [
      vehicle.fcExpiryDate,
      vehicle.insuranceExpiryDate,
      vehicle.permitExpiryDate,
      vehicle.roadTaxExpiryDate,
      vehicle.pollutionCertificateExpiryDate
    ];
    let hasExpired = false;
    let hasExpiring = false;
    for (const d of dates) {
      const status = getExpiryStatus(d);
      if (status === 'expired') hasExpired = true;
      if (status === 'expiring') hasExpiring = true;
    }
    if (hasExpired) return 'expired';
    if (hasExpiring) return 'expiring';
    return 'active';
  };

  // Vehicle KPIs
  const totalVehiclesCount = vehicles.length;
  const activeVehiclesCount = vehicles.filter(v => v.status === 'Active').length;
  const assignedVehiclesCount = vehicles.filter(v => v.assignedRouteIds && v.assignedRouteIds.length > 0).length;
  const unassignedVehiclesCount = vehicles.filter(v => !v.assignedRouteIds || v.assignedRouteIds.length === 0).length;
  const expiringVehiclesCount = vehicles.filter(v => getVehicleComplianceStatus(v) === 'expiring').length;
  const expiredVehiclesCount = vehicles.filter(v => getVehicleComplianceStatus(v) === 'expired').length;

  // Filtered vehicles
  const filteredVehicles = vehicles.filter(v => {
    const q = vehicleSearchQuery.trim().toLowerCase();
    const matchesSearch = 
      (v.vehicleName || '').toLowerCase().includes(q) ||
      (v.vehicleModel || '').toLowerCase().includes(q) ||
      (v.registrationNumber || '').toLowerCase().includes(q);

    const matchesStatus = vehicleStatusFilter === 'all' || v.status === vehicleStatusFilter;
    
    const complianceStatus = getVehicleComplianceStatus(v);
    const matchesCompliance = 
      vehicleComplianceFilter === 'all' || 
      complianceStatus === vehicleComplianceFilter;

    return matchesSearch && matchesStatus && matchesCompliance;
  });

  // Handle Save Vehicle
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    if (newVehicle.id && !hasEditPermission) {
      toast.error("You do not have permission to edit vehicles.");
      return;
    }
    if (!newVehicle.id && !hasCreatePermission) {
      toast.error("You do not have permission to register vehicles.");
      return;
    }

    // Capacity validation
    const parsedCapacity = parseInt(newVehicle.seatingCapacity, 10);
    if (isNaN(parsedCapacity) || parsedCapacity <= 0) {
      toast.error("Seating Capacity must be a positive integer.");
      return;
    }

    // Reg No uniqueness check
    const regNo = (newVehicle.registrationNumber || '').trim().toUpperCase();
    const isDuplicate = vehicles.some(
      v => v.id !== newVehicle.id && (v.registrationNumber || '').trim().toUpperCase() === regNo
    );
    if (isDuplicate) {
      toast.error(`Vehicle Registration Number "${regNo}" already exists in the system.`);
      return;
    }

    setSavingVehicle(true);
    try {
      const payload = {
        ...newVehicle,
        registrationNumber: regNo,
        seatingCapacity: parsedCapacity,
        updatedAt: new Date().toISOString(),
        createdBy: userProfile?.name || userProfile?.email || 'System'
      };

      if (newVehicle.id) {
        await updateSubDocument(schoolId, 'vehicles', newVehicle.id, payload);
        toast.success("Vehicle updated successfully!");
      } else {
        await addSubDocument(schoolId, 'vehicles', {
          ...payload,
          createdAt: new Date().toISOString()
        });
        toast.success("Vehicle registered successfully!");
      }
      setShowVehicleModal(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save vehicle details.");
    } finally {
      setSavingVehicle(false);
    }
  };

  // Handle Delete Vehicle
  const handleDeleteVehicle = async () => {
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete vehicles.");
      return;
    }
    if (!vehicleConfirmDeleteState.id) return;
    try {
      await deleteDoc(doc(db, `schools/${schoolId}/vehicles`, vehicleConfirmDeleteState.id));
      toast.success("Vehicle deleted successfully");
      setVehicleConfirmDeleteState({ isOpen: false, id: null, name: '' });
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      toast.error("Failed to delete vehicle");
    }
  };

  // Student list search
  const filteredStudents = students.filter(s => {
    const q = assignmentSearchQuery.trim().toLowerCase();
    const name = `${s.firstName || ''} ${s.lastName || ''}`.toLowerCase();
    const admNo = (s.admissionNumber || '').toLowerCase();
    const route = getRouteName(s.transportRouteId).toLowerCase();
    return name.includes(q) || admNo.includes(q) || route.includes(q);
  });

  if (loading || loadingVehicles) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-w-0 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Transport Management</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage bus routes, drivers, school vehicles, and student assignments.</p>
        </div>
        
        {/* Actions based on active tab */}
        {hasCreatePermission && (
          <div className="w-full sm:w-auto">
            {activeTab === 'routes' && (
              <button 
                onClick={() => {
                  setNewRoute({ name: '', vehicleNumber: '', driverName: '', driverPhone: '', capacity: '', customData: {} });
                  setShowCreateModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold shadow-sm flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
              >
                <Plus size={18} /> Add New Route
              </button>
            )}
            {activeTab === 'vehicles' && (
              <button 
                onClick={() => {
                  setNewVehicle({
                    vehicleName: '',
                    vehicleModel: '',
                    registrationNumber: '',
                    seatingCapacity: '',
                    assignedRouteIds: [],
                    fcExpiryDate: '',
                    insuranceExpiryDate: '',
                    permitExpiryDate: '',
                    roadTaxExpiryDate: '',
                    pollutionCertificateExpiryDate: '',
                    status: 'Active'
                  });
                  setShowVehicleModal(true);
                }}
                className="w-full sm:w-auto px-4 py-2.5 bg-primary-600 text-white rounded-xl font-semibold shadow-sm flex items-center justify-center gap-2 hover:bg-primary-700 transition-colors"
              >
                <Plus size={18} /> Register Vehicle
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 mb-6 border-b border-slate-200 dark:border-slate-700 pb-3 overflow-x-auto w-full custom-scrollbar">
        <button
          onClick={() => setActiveTab('routes')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
            activeTab === 'routes'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Navigation size={18} />
          <span>Transport Routes</span>
        </button>

        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
            activeTab === 'vehicles'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Bus size={18} />
          <span>Vehicle Management</span>
        </button>

        <button
          onClick={() => setActiveTab('assignments')}
          className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-sm whitespace-nowrap transition-all ${
            activeTab === 'assignments'
              ? 'bg-primary-600 text-white shadow-md shadow-primary-500/20'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Users size={18} />
          <span>Student Assignments</span>
        </button>
      </div>

      {/* -------------------- TAB 1: ROUTES -------------------- */}
      {activeTab === 'routes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {routes.length === 0 ? (
            <div className="col-span-full bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
              <Bus size={64} className="mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Routes Found</h3>
              <p>Create your first transport route to begin assigning students.</p>
            </div>
          ) : (
            routes.map(route => {
              const currentCount = route.assignedStudents?.length || 0;
              const isFull = currentCount >= route.capacity;
              const percentage = Math.round((currentCount / route.capacity) * 100) || 0;

              return (
                <div key={route.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                  <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-tight pr-4 truncate">{route.name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => { setSelectedRouteToView(route); setShowViewModal(true); }}
                          className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={18} />
                        </button>
                        {hasEditPermission && (
                          <button 
                            onClick={() => { setNewRoute(route); setShowCreateModal(true); }}
                            className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Edit Route"
                          >
                            <Edit size={18} />
                          </button>
                        )}
                        {hasDeletePermission && (
                          <button 
                            onClick={() => setConfirmDeleteState({ isOpen: true, id: route.id, name: route.name })}
                            className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Delete Route"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-200/50 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-mono font-bold tracking-wide">
                      {route.vehicleNumber}
                    </div>
                  </div>

                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                        <Users size={16} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      <div className="overflow-hidden">
                        <p className="font-semibold text-slate-900 dark:text-white truncate">{route.driverName || 'No Driver Assigned'}</p>
                        <p className="text-xs truncate flex items-center gap-1"><Phone size={10}/> {route.driverPhone || 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Capacity</span>
                        <span className={`font-bold text-sm ${isFull ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                          {currentCount} / {route.capacity}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : percentage > 80 ? 'bg-amber-500' : 'bg-green-500'}`}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  {hasEditPermission && (
                    <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 mt-auto">
                      <button 
                        onClick={() => openAssignModal(route.id)}
                        disabled={isFull}
                        className="w-full py-2.5 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-slate-700 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFull ? <><AlertTriangle size={16}/> Bus Full</> : <><Plus size={16}/> Assign Student</>}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* -------------------- TAB 2: VEHICLE MANAGEMENT -------------------- */}
      {activeTab === 'vehicles' && (
        <div className="space-y-6">
          {/* Vehicle Dashboard Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Total</span>
              <span className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-2">{totalVehiclesCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Active</span>
              <span className="text-2xl font-black text-green-600 mt-2">{activeVehiclesCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Assigned</span>
              <span className="text-2xl font-black text-primary-600 mt-2">{assignedVehiclesCount}</span>
            </div>
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Unassigned</span>
              <span className="text-2xl font-black text-amber-600 mt-2">{unassignedVehiclesCount}</span>
            </div>
            <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Expiring (30d)</span>
              <span className="text-2xl font-black text-amber-700 mt-2">{expiringVehiclesCount}</span>
            </div>
            <div className="bg-red-50 p-4 rounded-2xl border border-red-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Expired Docs</span>
              <span className="text-2xl font-black text-red-700 mt-2">{expiredVehiclesCount}</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="relative w-full md:max-w-sm">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">
                <Search size={18} />
              </span>
              <input 
                type="text"
                placeholder="Search vehicles..."
                value={vehicleSearchQuery}
                onChange={(e) => setVehicleSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">
                <Filter size={14}/> Filters:
              </div>
              <select
                value={vehicleStatusFilter}
                onChange={(e) => setVehicleStatusFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="Active">Active Only</option>
                <option value="Inactive">Inactive Only</option>
              </select>
              <select
                value={vehicleComplianceFilter}
                onChange={(e) => setVehicleComplianceFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
              >
                <option value="all">All Compliance Statuses</option>
                <option value="active">Documents Active</option>
                <option value="expiring">Expiring Soon (30 days)</option>
                <option value="expired">Has Expired Documents</option>
              </select>
            </div>
          </div>

          {/* Vehicles Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full min-w-0">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Vehicle Details</th>
                    <th className="py-4 px-6">Registration No</th>
                    <th className="py-4 px-6">Capacity</th>
                    <th className="py-4 px-6">Compliance Status</th>
                    <th className="py-4 px-6">Assigned Route(s)</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-600 dark:text-slate-300 font-medium">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="py-12 text-center text-slate-400 dark:text-slate-300">
                        <Bus size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700 dark:text-slate-200">No vehicles found matching filters</p>
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map(vehicle => {
                      const complianceStatus = getVehicleComplianceStatus(vehicle);
                      return (
                        <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{vehicle.vehicleName}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{vehicle.vehicleModel}</p>
                            </div>
                          </td>
                          <td className="py-4 px-6 font-mono font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                            {vehicle.registrationNumber}
                          </td>
                          <td className="py-4 px-6 font-semibold text-slate-800 dark:text-slate-100">
                            {vehicle.seatingCapacity} seats
                          </td>
                          <td className="py-4 px-6">
                            {complianceStatus === 'expired' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-red-100 text-red-700 border border-red-200">
                                <ShieldAlert size={14}/> Expired Docs
                              </span>
                            ) : complianceStatus === 'expiring' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-700 border border-amber-200">
                                <AlertTriangle size={14}/> Expiring (30d)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-green-100 text-green-700 border border-green-200">
                                <CheckCircle2 size={14}/> All Compliant
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                              {vehicle.assignedRouteIds && vehicle.assignedRouteIds.length > 0 ? (
                                vehicle.assignedRouteIds.map(rid => (
                                  <span key={rid} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-md text-xs font-bold text-slate-600 dark:text-slate-300">
                                    {getRouteName(rid)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-slate-400 dark:text-slate-300 italic font-medium">None assigned</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              vehicle.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              {vehicle.status}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-2">
                              <button 
                                onClick={() => { setSelectedVehicleToView(vehicle); setShowViewVehicleModal(true); }}
                                className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="View Details"
                              >
                                <Eye size={18} />
                              </button>
                              {hasEditPermission && (
                                <button 
                                  onClick={() => { setNewVehicle(vehicle); setShowVehicleModal(true); }}
                                  className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Edit Vehicle"
                                >
                                  <Edit size={18} />
                                </button>
                              )}
                              {hasDeletePermission && (
                                <button 
                                  onClick={() => setVehicleConfirmDeleteState({ isOpen: true, id: vehicle.id, name: vehicle.vehicleName })}
                                  className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="Delete Vehicle"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- TAB 3: STUDENT ASSIGNMENTS -------------------- */}
      {activeTab === 'assignments' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <div className="relative w-full md:max-w-sm">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300">
                <Search size={18} />
              </span>
              <input 
                type="text"
                placeholder="Search students or assigned routes..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="overflow-x-auto w-full min-w-0">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-300 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-6">Student</th>
                    <th className="py-4 px-6">Admission No</th>
                    <th className="py-4 px-6">Assigned Route</th>
                    <th className="py-4 px-6">Driver & Contact</th>
                    <th className="py-4 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm text-slate-600 dark:text-slate-300 font-medium">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400 dark:text-slate-300">
                        <Users size={40} className="mx-auto mb-2 text-slate-300" />
                        <p className="font-semibold text-slate-700 dark:text-slate-200">No student assignments found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map(student => {
                      const route = routes.find(r => r.id === student.transportRouteId);
                      return (
                        <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-4 px-6 font-bold text-slate-900 dark:text-white">
                            {student.firstName} {student.lastName}
                          </td>
                          <td className="py-4 px-6 font-mono font-semibold text-slate-600 dark:text-slate-300">
                            {student.admissionNumber || '-'}
                          </td>
                          <td className="py-4 px-6">
                            {route ? (
                              <span className="inline-flex items-center px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold text-xs">
                                {route.name}
                              </span>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-300 italic">Not assigned</span>
                            )}
                          </td>
                          <td className="py-4 px-6">
                            {route ? (
                              <div>
                                <p className="font-semibold text-slate-800 dark:text-slate-100">{route.driverName || 'N/A'}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">{route.driverPhone || 'N/A'}</p>
                              </div>
                            ) : (
                              <span className="text-slate-400 dark:text-slate-300">-</span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            {route ? (
                              hasEditPermission && (
                                <button 
                                  onClick={() => handleUnassignStudent(route.id, student.id)}
                                  className="px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                                >
                                  Unassign Student
                                </button>
                              )
                            ) : (
                              hasEditPermission && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      setActiveRouteId(e.target.value);
                                      setSelectedStudentId(student.id);
                                      // Trigger quick assignment
                                      assignStudentToRoute(schoolId, e.target.value, student.id).then(() => {
                                        toast.success("Student assigned successfully");
                                      }).catch(err => {
                                        console.error(err);
                                        toast.error("Failed to assign student");
                                      });
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
                                >
                                  <option value="">Quick Assign...</option>
                                  {routes.map(r => (
                                    <option key={r.id} value={r.id} disabled={(r.assignedStudents?.length || 0) >= r.capacity}>
                                      {r.name} ({(r.assignedStudents?.length || 0)}/{r.capacity})
                                    </option>
                                  ))}
                                </select>
                              )
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- VEHICLE REGISTRATION/EDIT MODAL -------------------- */}
      {showVehicleModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bus className="text-primary-600" /> {newVehicle.id ? 'Edit Vehicle Details' : 'Register School Vehicle'}
              </h2>
              <button onClick={() => setShowVehicleModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Vehicle Name *</label>
                    <input 
                      type="text" required
                      value={newVehicle.vehicleName}
                      onChange={(e) => setNewVehicle({...newVehicle, vehicleName: e.target.value})}
                      placeholder="e.g. School Bus 15"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Vehicle Model *</label>
                    <input 
                      type="text" required
                      value={newVehicle.vehicleModel}
                      onChange={(e) => setNewVehicle({...newVehicle, vehicleModel: e.target.value})}
                      placeholder="e.g. Tata Winger 2024"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Registration Number (Unique) *</label>
                    <input 
                      type="text" required
                      value={newVehicle.registrationNumber}
                      onChange={(e) => setNewVehicle({...newVehicle, registrationNumber: e.target.value})}
                      placeholder="e.g. MH-12-PQ-4567"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Seating Capacity *</label>
                    <input 
                      type="number" min="1" required
                      value={newVehicle.seatingCapacity}
                      onChange={(e) => setNewVehicle({...newVehicle, seatingCapacity: e.target.value})}
                      placeholder="e.g. 40"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Assigned Route(s)</label>
                    <select
                      multiple
                      value={newVehicle.assignedRouteIds || []}
                      onChange={(e) => {
                        const values = Array.from(e.target.selectedOptions, option => option.value);
                        setNewVehicle({...newVehicle, assignedRouteIds: values});
                      }}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 min-h-[110px]"
                    >
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>
                          {r.name} ({r.vehicleNumber})
                        </option>
                      ))}
                    </select>
                    <p className="text-slate-400 dark:text-slate-300 text-xs mt-1.5">Hold <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">Ctrl</kbd> (or <kbd className="font-mono bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">Cmd</kbd> on Mac) to select multiple routes.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Vehicle Status *</label>
                    <select 
                      value={newVehicle.status}
                      onChange={(e) => setNewVehicle({...newVehicle, status: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 appearance-none cursor-pointer"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Compliance & Expiry Dates</h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fitness Certificate (FC) Expiry *</label>
                      <input 
                        type="date" required
                        value={newVehicle.fcExpiryDate}
                        onChange={(e) => setNewVehicle({...newVehicle, fcExpiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Insurance Expiry *</label>
                      <input 
                        type="date" required
                        value={newVehicle.insuranceExpiryDate}
                        onChange={(e) => setNewVehicle({...newVehicle, insuranceExpiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Permit Expiry *</label>
                      <input 
                        type="date" required
                        value={newVehicle.permitExpiryDate}
                        onChange={(e) => setNewVehicle({...newVehicle, permitExpiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Road Tax Expiry *</label>
                      <input 
                        type="date" required
                        value={newVehicle.roadTaxExpiryDate}
                        onChange={(e) => setNewVehicle({...newVehicle, roadTaxExpiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Pollution Certificate (PUC) Expiry *</label>
                      <input 
                        type="date" required
                        value={newVehicle.pollutionCertificateExpiryDate}
                        onChange={(e) => setNewVehicle({...newVehicle, pollutionCertificateExpiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowVehicleModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={savingVehicle}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {savingVehicle ? 'Saving...' : (newVehicle.id ? 'Save Details' : 'Register Vehicle')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------- VIEW VEHICLE DETAILS MODAL -------------------- */}
      {showViewVehicleModal && selectedVehicleToView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bus className="text-indigo-600" /> Vehicle Information
              </h2>
              <button onClick={() => setShowViewVehicleModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">{selectedVehicleToView.vehicleName}</h3>
                  <p className="text-slate-500 dark:text-slate-400 font-semibold">{selectedVehicleToView.vehicleModel}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                  selectedVehicleToView.status === 'Active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                }`}>
                  {selectedVehicleToView.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Registration Number</label>
                  <p className="text-slate-900 dark:text-white font-mono font-bold text-base uppercase">{selectedVehicleToView.registrationNumber}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Seating Capacity</label>
                  <p className="text-slate-900 dark:text-white font-semibold text-base">{selectedVehicleToView.seatingCapacity} seats</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-2">Assigned Routes</label>
                <div className="flex flex-wrap gap-2">
                  {selectedVehicleToView.assignedRouteIds && selectedVehicleToView.assignedRouteIds.length > 0 ? (
                    selectedVehicleToView.assignedRouteIds.map(rid => (
                      <span key={rid} className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700">
                        {getRouteName(rid)}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-400 dark:text-slate-300 italic text-sm">No transport routes assigned to this vehicle.</span>
                  )}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 space-y-4">
                <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase tracking-wider">Compliance Status</h4>
                
                <div className="space-y-3">
                  {[
                    { label: 'Fitness Certificate (FC) Expiry', date: selectedVehicleToView.fcExpiryDate },
                    { label: 'Insurance Policy Expiry', date: selectedVehicleToView.insuranceExpiryDate },
                    { label: 'Route Permit Expiry', date: selectedVehicleToView.permitExpiryDate },
                    { label: 'Road Tax Certificate Expiry', date: selectedVehicleToView.roadTaxExpiryDate },
                    { label: 'Pollution Certificate (PUC) Expiry', date: selectedVehicleToView.pollutionCertificateExpiryDate }
                  ].map((doc, idx) => {
                    const status = getExpiryStatus(doc.date);
                    return (
                      <div key={idx} className="flex justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                        <div>
                          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{doc.label}</p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">{doc.date ? new Date(doc.date).toLocaleDateString('en-GB') : 'N/A'}</p>
                        </div>
                        <div>
                          {status === 'expired' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 border border-red-200">Expired</span>
                          ) : status === 'expiring' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-700 border border-amber-200">Expiring</span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 border border-green-200">Active</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button onClick={() => setShowViewVehicleModal(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 font-bold rounded-xl transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing Create Route Modals */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Navigation className="text-primary-600" /> {newRoute.id ? 'Edit Route' : 'New Route'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Route Name</label>
                  <input 
                    type="text" required
                    value={newRoute.name}
                    onChange={(e) => setNewRoute({...newRoute, name: e.target.value})}
                    placeholder="e.g. North City Loop"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Vehicle No.</label>
                    <input 
                      type="text" required
                      value={newRoute.vehicleNumber}
                      onChange={(e) => setNewRoute({...newRoute, vehicleNumber: e.target.value})}
                      placeholder="e.g. BUS-12"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Capacity</label>
                    <input 
                      type="number" min="1" required
                      value={newRoute.capacity}
                      onChange={(e) => setNewRoute({...newRoute, capacity: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Driver Name</label>
                    <input 
                      type="text" required
                      value={newRoute.driverName}
                      onChange={(e) => setNewRoute({...newRoute, driverName: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Driver Phone</label>
                    <input 
                      type="tel" required
                      value={newRoute.driverPhone}
                      onChange={(e) => setNewRoute({...newRoute, driverPhone: e.target.value})}
                      placeholder="e.g. 9876543210"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <CustomFieldsRenderer
                    moduleKey="transport"
                    customData={newRoute.customData}
                    onChange={(k, v) => setNewRoute(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                  />
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={creating}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors"
                >
                  {creating ? 'Saving...' : (newRoute.id ? 'Save Changes' : 'Create Route')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Student Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="text-primary-600" /> Assign Student
              </h2>
              <button onClick={() => setShowAssignModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAssignStudent} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Student</label>
                    <select 
                      required
                      value={selectedStudentId}
                      onChange={(e) => setSelectedStudentId(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 appearance-none pr-10 cursor-pointer"
                      style={{ backgroundImage: `url('data:image/svg+xml;utf8,<svg fill="none" viewBox="0 0 24 24" stroke="%2364748B" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>')`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1.2em' }}
                    >
                      <option value="">Choose an unassigned student...</option>
                      {unassignedStudents.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName} (ID: {s.admissionNumber})
                        </option>
                      ))}
                    </select>
                    {unassignedStudents.length === 0 && (
                      <p className="text-amber-600 text-sm mt-2 flex items-center gap-1">
                        <AlertTriangle size={14}/> All students are currently assigned to routes.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button 
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={assigning || unassignedStudents.length === 0}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {assigning ? 'Assigning...' : 'Assign to Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Route Modal */}
      {showViewModal && selectedRouteToView && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Bus className="text-indigo-600" /> Route Details
              </h2>
              <button onClick={() => setShowViewModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Route Name</label>
                <p className="text-slate-900 dark:text-white font-semibold">{selectedRouteToView.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Vehicle No.</label>
                  <p className="text-slate-900 dark:text-white font-mono font-semibold">{selectedRouteToView.vehicleNumber}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Capacity</label>
                  <p className="text-slate-900 dark:text-white font-semibold">
                    {selectedRouteToView.assignedStudents?.length || 0} / {selectedRouteToView.capacity}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Driver Name</label>
                  <p className="text-slate-900 dark:text-white font-semibold">{selectedRouteToView.driverName || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Driver Phone</label>
                  <p className="text-slate-900 dark:text-white font-semibold">{selectedRouteToView.driverPhone || 'N/A'}</p>
                </div>
              </div>

              {selectedRouteToView.customData && Object.keys(selectedRouteToView.customData).length > 0 && (
                <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                  <CustomFieldsRenderer
                    moduleKey="transport"
                    customData={selectedRouteToView.customData}
                    readOnly={true}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-2">Assigned Students</label>
                {selectedRouteToView.assignedStudents?.length > 0 ? (
                  <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <ul className="divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar">
                      {selectedRouteToView.assignedStudents.map((s, idx) => {
                        const sId = typeof s === 'object' ? (s.id || s.studentId) : String(s);
                        const studentData = students.find(st => String(st.id) === String(sId));
                        
                        let displayName = sId;
                        if (studentData) {
                          const fullName = `${studentData.firstName || ''} ${studentData.lastName || ''}`.trim();
                          displayName = fullName || studentData.name || 'Unnamed Student';
                        } else {
                          displayName = `Student ID: ${sId}`;
                        }

                        return (
                          <li key={idx} className="p-3 text-sm text-slate-700 dark:text-slate-200 flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <span className="font-medium">{displayName}</span>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 dark:text-slate-300 font-mono">{studentData?.admissionNumber || 'N/A'}</span>
                              <button 
                                type="button"
                                onClick={() => handleUnassignStudent(selectedRouteToView.id, sId)}
                                className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                title="Unassign Student"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 dark:text-slate-400 italic p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">No students assigned to this route yet.</p>
                )}
              </div>
            </div>
            
            <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end shrink-0">
              <button onClick={() => setShowViewModal(false)} className="px-6 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold hover:bg-slate-300 rounded-xl transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Route Confirmation */}
      <ConfirmModal 
        isOpen={confirmDeleteState.isOpen}
        onClose={() => setConfirmDeleteState({ isOpen: false, id: null, name: '' })}
        onConfirm={handleDeleteRoute}
        title="Delete Route"
        message={`Are you sure you want to delete the route "${confirmDeleteState.name}"? This will unassign all students currently on this route. This action cannot be undone.`}
        confirmText="Delete Route"
      />

      {/* Delete Vehicle Confirmation */}
      <ConfirmModal 
        isOpen={vehicleConfirmDeleteState.isOpen}
        onClose={() => setVehicleConfirmDeleteState({ isOpen: false, id: null, name: '' })}
        onConfirm={handleDeleteVehicle}
        title="Delete Vehicle"
        message={`Are you sure you want to delete the vehicle "${vehicleConfirmDeleteState.name}"? This action cannot be undone.`}
        confirmText="Delete Vehicle"
      />
    </div>
  );
}
