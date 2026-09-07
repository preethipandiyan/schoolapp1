import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentsByClass, getTransportRoutes, subscribeToAttendance } from '../../firebase/firestore';
import { getDoc, doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuUsers as Users, LuSearch as Search, LuGraduationCap as GraduationCap, LuMail as Mail, LuCircleCheck as CheckCircle2, LuBus, LuUserCheck, LuUserX, LuUser, LuUserRound, LuFileDown, LuX } from 'react-icons/lu';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { isMale, isFemale, normalizeGender } from '../../utils/genderUtils';

export default function ClassRoster() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const [classId, setClassId] = useState(userProfile?.assignedClassId || null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!schoolId || !currentUser?.uid) return;
    const q = query(collection(db, `schools/${schoolId}/teachers`), where("userId", "==", currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setClassId(snap.docs[0].data().assignedClassId || null);
      }
    });
    return () => unsub();
  }, [schoolId, currentUser?.uid]);

  const [classDetails, setClassDetails] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // New States for Dashboard
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState({});
  const [todayDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD

  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    admissionNumber: true,
    firstName: true,
    lastName: true,
    rollNumber: true,
    gender: true,
    dob: true,
    email: true,
    phone: true,
    address: true,
    guardianName: true,
    guardianPhone: true,
    bloodGroup: true
  });

  const availableFieldsList = [
    { key: 'admissionNumber', label: 'Admission Number' },
    { key: 'firstName', label: 'First Name' },
    { key: 'lastName', label: 'Last Name' },
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'gender', label: 'Gender' },
    { key: 'dob', label: 'Date of Birth' },
    { key: 'email', label: 'Email Address' },
    { key: 'phone', label: 'Phone Number' },
    { key: 'address', label: 'Home Address' },
    { key: 'guardianName', label: 'Guardian Name' },
    { key: 'guardianPhone', label: 'Guardian Phone' },
    { key: 'bloodGroup', label: 'Blood Group' }
  ];

  const handleFieldToggle = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSelectAll = (selectVal) => {
    const updated = {};
    availableFieldsList.forEach(field => {
      updated[field.key] = selectVal;
    });
    setSelectedFields(updated);
  };

  const handleExport = () => {
    if (students.length === 0) {
      toast.error("No student data available to export.");
      return;
    }

    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const exportData = students.map((student, index) => {
      const row = { "S.No": index + 1 };
      availableFieldsList.forEach(field => {
        if (selectedFields[field.key]) {
          row[field.label] = student[field.key] || '';
        }
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Class Roster");
    
    const rawName = exportFileName.trim() || (classDetails ? `${classDetails.name}_Section_${classDetails.section}_Students` : "Class_Roster_Students");
    const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
    
    XLSX.writeFile(workbook, finalFileName);
    setShowExportModal(false);
    toast.success("Student details exported successfully!");
  };

  useEffect(() => {
    if (!schoolId) return;
    if (!classId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    let classUnsub, studentsUnsub;

    classUnsub = onSnapshot(doc(db, `schools/${schoolId}/classes`, classId), (docSnap) => {
      if (docSnap.exists()) {
        setClassDetails({ id: docSnap.id, ...docSnap.data() });
      }
    });

    studentsUnsub = subscribeToStudentsByClass(schoolId, classId, (studentsData) => {
      studentsData.sort((a, b) => a.firstName.localeCompare(b.firstName));
      setStudents(studentsData);
      setLoading(false);
    });

    // Fetch Transport Routes
    getTransportRoutes(schoolId).then(routes => {
      setTransportRoutes(routes);
    }).catch(console.error);

    // Subscribe to Today's Forenoon Attendance in real-time
    let attendanceUnsub;
    let fallbackUnsub;

    attendanceUnsub = subscribeToAttendance(schoolId, classId, `${todayDate}_FN`, (record) => {
      if (record && record.records) {
        setAttendanceRecords(record.records);
      } else {
        // Fallback: subscribe to today's date-only record
        if (fallbackUnsub) fallbackUnsub();
        fallbackUnsub = subscribeToAttendance(schoolId, classId, todayDate, (fallbackRecord) => {
          if (fallbackRecord && fallbackRecord.records) {
            setAttendanceRecords(fallbackRecord.records);
          } else {
            setAttendanceRecords({});
          }
        });
      }
    });

    return () => {
      if (classUnsub) classUnsub();
      if (studentsUnsub) studentsUnsub();
      if (attendanceUnsub) attendanceUnsub();
      if (fallbackUnsub) fallbackUnsub();
    };
  }, [schoolId, classId, todayDate]);

  const filteredStudents = students.filter(student => {
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
           (student.admissionNumber && student.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  // Calculate Stats
  const totalStudents = students.length;
  const boysCount = students.filter(s => isMale(s.gender)).length;
  const girlsCount = students.filter(s => isFemale(s.gender)).length;
  let presentCount = 0;
  let absentCount = 0;
  students.forEach(student => {
     if (attendanceRecords[student.id] === 'Present') presentCount++;
     if (attendanceRecords[student.id] === 'Absent') absentCount++;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!classId) {
    return (
      <div className="p-8 text-center mt-20">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <Users size={32} className="text-slate-400 dark:text-slate-300" />
        </div>
        <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">Not a Class Teacher</p>
        <p className="text-slate-500 dark:text-slate-400">You must be assigned as a primary Class Teacher to view the class roster.</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="mb-6 bg-gradient-to-r from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-lg relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-primary-500/20 rounded-full blur-2xl translate-y-1/2"></div>
        
        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/20 mb-4 backdrop-blur-sm">
            <Users size={14} /> My Assigned Class
          </span>
          <h1 className="text-4xl md:text-5xl font-black mb-2 tracking-tight">
            Class Dashboard
          </h1>
          <p className="text-slate-300 text-lg flex items-center gap-2">
            {classDetails ? `${classDetails.name} - Section ${classDetails.section}` : 'Loading Class...'}
          </p>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Class Strength</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{totalStudents}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Boys</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <LuUser size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{boysCount}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Girls</span>
            <div className="p-2 bg-pink-50 text-pink-600 rounded-lg">
              <LuUserRound size={18} />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 dark:text-white">{girlsCount}</div>
        </div>

        <div 
          onClick={() => navigate('/teacher/attendance')}
          className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-between cursor-pointer hover:shadow-md hover:border-primary-200 dark:hover:border-slate-700 transition-all hover:bg-slate-50/50"
        >
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">Today's Attendance</span>
            <div className="flex gap-2">
              <div className="p-2 bg-green-50 text-green-600 rounded-lg" title="Present">
                <LuUserCheck size={18} />
              </div>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg" title="Absent">
                <LuUserX size={18} />
              </div>
            </div>
          </div>
          <div className="flex items-end gap-2">
            <div className="text-3xl font-black text-green-600">{presentCount}</div>
            <div className="text-lg font-medium text-slate-400 dark:text-slate-300 mb-1">/</div>
            <div className="text-3xl font-black text-red-500">{absentCount}</div>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-4 items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search students by name or admission number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
            />
          </div>
          
          <button
            onClick={() => {
              if (students.length === 0) {
                toast.error("No student data available to export.");
                return;
              }
              const defaultName = classDetails ? `${classDetails.name}_Section_${classDetails.section}_Students` : "Class_Roster_Students";
              setExportFileName(defaultName);
              setShowExportModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold hover:bg-primary-700 shadow-md shadow-primary-600/10 transition-all active:scale-[0.98]"
          >
            <LuFileDown size={18} />
            Export
          </button>
        </div>

        {/* Roster Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Student Name</th>
                <th className="p-4">Admission No.</th>
                <th className="p-4">Gender</th>
                <th className="p-4">Bus Route</th>
                <th className="p-4">Bus Number</th>
                <th className="p-4 pr-6 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <GraduationCap size={32} className="text-slate-400 dark:text-slate-300" />
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">No students found</p>
                    <p>There are no students matching your search, or none assigned to this class yet.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm border border-primary-200 shadow-sm">
                          {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {student.firstName} {student.lastName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 size={10} className="text-green-500"/> Active
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-medium text-slate-600 dark:text-slate-300 bg-slate-50/30">
                      {student.admissionNumber}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {normalizeGender(student.gender, '—')}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <LuBus size={14} className="text-slate-400 dark:text-slate-300" />
                        {student.busRoute || student.transportDetails || <span className="text-slate-400 dark:text-slate-300 italic">—</span>}
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">
                      {(() => {
                         const routeName = student.busRoute || student.transportDetails;
                         if (!routeName) return <span className="text-slate-400 dark:text-slate-300 italic">—</span>;
                         const matchedRoute = transportRoutes.find(r => r.name === routeName || r.id === routeName);
                         return matchedRoute?.vehicleNumber ? (
                           <span className="font-mono bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-xs border border-slate-200 dark:border-slate-700">
                             {matchedRoute.vehicleNumber}
                           </span>
                         ) : <span className="text-slate-400 dark:text-slate-300 italic">Unknown</span>;
                      })()}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {/* These actions will be wired up in subsequent modules */}
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => navigate('/teacher/grades')}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-primary-200 dark:hover:border-slate-700 rounded-lg transition-colors"
                        >
                          Add Grade
                        </button>
                        <button 
                          onClick={() => navigate('/teacher/attendance')}
                          className="px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-green-700 hover:bg-green-50 border border-slate-200 dark:border-slate-700 hover:border-green-200 rounded-lg transition-colors"
                        >
                          Attendance
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Export Student Roster</h3>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 font-medium">Select columns to include in the exported Excel spreadsheet</p>
              </div>
              <button 
                onClick={() => setShowExportModal(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              {/* File Name Input */}
              <div className="space-y-1.5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">File Name</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. Class_Roster_Students"
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm font-semibold"
                  />
                  <span className="absolute right-4 top-2.5 text-xs text-slate-400 dark:text-slate-300 font-bold font-mono select-none">.xlsx</span>
                </div>
              </div>

              {/* Select All / Deselect All Controls */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectAll(true)}
                  className="px-3 py-1.5 text-xs font-bold bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAll(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  Deselect All
                </button>
              </div>

              {/* Checkbox Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {availableFieldsList.map((field) => (
                  <label 
                    key={field.key}
                    className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 cursor-pointer select-none transition-colors"
                  >
                    <input 
                      type="checkbox"
                      checked={selectedFields[field.key]}
                      onChange={() => handleFieldToggle(field.key)}
                      className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{field.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
              >
                <LuFileDown size={18} />
                Generate Sheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
