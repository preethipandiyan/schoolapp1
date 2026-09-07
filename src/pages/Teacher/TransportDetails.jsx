import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentsByClass, getTransportRoutes } from '../../firebase/firestore';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuBus, LuSearch as Search, LuPhone, LuUser, LuMapPin, LuUsers } from 'react-icons/lu';
import { TableSkeleton } from '../../components/Skeleton';
import toast from 'react-hot-toast';

export default function TransportDetails() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const [classId, setClassId] = useState(userProfile?.assignedClassId || null);

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
  const [transportRoutes, setTransportRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

    getTransportRoutes(schoolId).then(routes => {
      setTransportRoutes(routes);
    }).catch(err => {
      console.error("Error fetching routes:", err);
      toast.error("Failed to load transport routes.");
    });

    return () => {
      if (classUnsub) classUnsub();
      if (studentsUnsub) studentsUnsub();
    };
  }, [schoolId, classId]);

  const filteredStudents = students.filter(student => {
    const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
    const routeName = (student.busRoute || student.transportDetails || student.transportRouteId || '').toLowerCase();
    return fullName.includes(searchQuery.toLowerCase()) || 
           routeName.includes(searchQuery.toLowerCase()) ||
           (student.admissionNumber && student.admissionNumber.toLowerCase().includes(searchQuery.toLowerCase()));
  });

  const totalBusStudents = students.filter(s => s.busRoute || s.transportDetails || s.transportRouteId).length;

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        <TableSkeleton rows={6} columns={5} />
      </div>
    );
  }

  if (!classId) {
    return (
      <div className="p-8 text-center mt-20">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
          <LuBus size={32} className="text-slate-400 dark:text-slate-300" />
        </div>
        <p className="text-xl font-bold text-slate-900 dark:text-white mb-2">Not a Class Teacher</p>
        <p className="text-slate-500 dark:text-slate-400">You must be assigned as a primary Class Teacher to view transport details.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 w-full">
        <div className="w-full md:w-auto">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="p-2.5 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-xl">
              <LuBus size={24} />
            </div>
            Student Transport Details
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 flex items-center gap-2">
            {classDetails ? (
               <><span className="font-bold text-slate-700 dark:text-slate-300">{classDetails.name} - Section {classDetails.section}</span></>
            ) : 'Loading Class...'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
            <LuUsers size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Total Class Strength</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{students.length}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <LuBus size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Using School Transport</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white">{totalBusStudents}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search by student name, route..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4 pl-6">Student</th>
                <th className="p-4">Bus Route</th>
                <th className="p-4">Vehicle No.</th>
                <th className="p-4">Driver Name</th>
                <th className="p-4 pr-6 text-right">Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-16 text-center text-slate-500 dark:text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <LuBus size={32} className="text-slate-400 dark:text-slate-300" />
                    </div>
                    <p className="text-lg font-bold text-slate-900 dark:text-white mb-1">No transport details found</p>
                    <p>No students match your search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const routeName = student.busRoute || student.transportDetails || student.transportRouteId;
                  let matchedRoute = null;
                  if (routeName) {
                     matchedRoute = transportRoutes.find(r => r.name === routeName || r.id === routeName);
                  }

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-4 pl-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm border border-primary-200 shadow-sm shrink-0">
                            {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {student.firstName} {student.lastName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                              {student.admissionNumber}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {routeName ? (
                          <div className="flex items-center gap-2">
                             <LuMapPin size={14} className="text-primary-500" />
                             <span className="font-semibold">{matchedRoute?.name || routeName}</span>
                          </div>
                        ) : (
                           <span className="text-slate-400 dark:text-slate-500 italic">Self Transport</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {matchedRoute?.vehicleNumber ? (
                          <span className="font-mono font-bold bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-md text-xs border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200">
                            {matchedRoute.vehicleNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">
                        {matchedRoute?.driverName ? (
                          <div className="flex items-center gap-2">
                            <LuUser size={14} className="text-slate-400" />
                            <span className="font-medium text-slate-800 dark:text-slate-200">{matchedRoute.driverName}</span>
                          </div>
                        ) : (
                           <span className="text-slate-400 dark:text-slate-500 italic">—</span>
                        )}
                      </td>
                      <td className="p-4 pr-6 text-right">
                        {matchedRoute?.driverPhone ? (
                          <a href={`tel:${matchedRoute.driverPhone}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg text-sm font-bold transition-colors">
                            <LuPhone size={14} />
                            {matchedRoute.driverPhone}
                          </a>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500 italic">—</span>
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
  );
}
