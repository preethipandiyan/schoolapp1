import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { addSubDocument, subscribeToSubCollection } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { LuCoffee as Coffee, LuUtensils as Utensils, LuCircleCheck as CheckCircle2 } from 'react-icons/lu';

export default function Canteen() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const studentId = userProfile?.linkedStudentId;

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToSubCollection(schoolId, 'canteen_requests', (allReqs) => {
      setRequests(allReqs.filter(r => r.studentId === studentId));
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId, studentId]);

  const handleRequestMeal = async (mealType) => {
    setSubmitting(true);
    try {
      await addSubDocument(schoolId, 'canteen_requests', {
        studentId,
        mealType,
        date: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        status: 'Pending'
      });
      toast.success(`${mealType} requested successfully!`);
      // fetchRequests(); - Handled by real-time listener
    } catch (error) {
      console.error("Error requesting meal:", error);
      toast.error("Failed to request meal.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const requestedBreakfast = requests.some(r => r.date === todayStr && r.mealType === 'Breakfast');
  const requestedLunch = requests.some(r => r.date === todayStr && r.mealType === 'Lunch');

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto pb-24 min-w-0 w-full">
      <div className="mb-8 min-w-0 w-full">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white truncate">Emergency Canteen Requests</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">If your child forgot their meal, you can request a meal from the school canteen for today.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Breakfast Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden relative group">
          <div className="w-16 h-16 bg-amber-50 text-amber-500 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
            <Coffee size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Breakfast</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Request breakfast for today. Meal will be provided during morning break.</p>
          
          {requestedBreakfast ? (
            <div className="w-full py-3 bg-green-50 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-200">
              <CheckCircle2 size={20} /> Requested for Today
            </div>
          ) : (
            <button 
              onClick={() => handleRequestMeal('Breakfast')}
              disabled={submitting}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Request Breakfast
            </button>
          )}
        </div>

        {/* Lunch Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden relative group">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110">
            <Utensils size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Lunch</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Request lunch for today. Meal will be provided during lunch break.</p>
          
          {requestedLunch ? (
            <div className="w-full py-3 bg-green-50 text-green-700 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-200">
              <CheckCircle2 size={20} /> Requested for Today
            </div>
          ) : (
            <button 
              onClick={() => handleRequestMeal('Lunch')}
              disabled={submitting}
              className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              Request Lunch
            </button>
          )}
        </div>
      </div>

      {/* History */}
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Request History</h2>
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No past canteen requests found.
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4">Meal Type</th>
                  <th className="p-4 pr-6 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).map((req) => (
                  <tr key={req.id} className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                    <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white">{req.date}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300">{req.mealType}</td>
                    <td className="p-4 pr-6 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                        req.status === 'Pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        req.status === 'Approved' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                        req.status === 'Delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                        req.status === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}>
                        {req.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
