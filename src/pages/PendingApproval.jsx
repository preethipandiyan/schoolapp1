import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getDoc, doc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useNavigate } from 'react-router-dom';
import { LuClock as Clock, LuRefreshCcw as RefreshCcw, LuLogOut as LogOut } from 'react-icons/lu';
import { logoutUser } from '../firebase/auth';

export default function PendingApproval() {
  const { userProfile, currentUser, updateProfileData } = useAuth();
  const [status, setStatus] = useState('pending');
  const navigate = useNavigate();

  useEffect(() => {
    const checkStatus = async () => {
      if (userProfile && userProfile.schoolId) {
        try {
          const schoolDoc = await getDoc(doc(db, 'schools', userProfile.schoolId));
          if (schoolDoc.exists()) {
            const data = schoolDoc.data();
            setStatus(data.status);
            if (data.status === 'approved') {
              navigate('/admin');
            }
          }
        } catch (error) {
          console.error("Error checking status:", error);
        }
      } else {
        // Fallback: If they lack a schoolId, SuperAdmin will auto-heal them via TenantManagement
        console.log("Awaiting SuperAdmin connection...");
      }
    };

    checkStatus();
  }, [userProfile, navigate]);

  const handleLogout = async () => {
    await logoutUser();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col justify-center items-center p-4">
      <div className="glass max-w-md w-full p-8 rounded-3xl text-center shadow-xl">
        <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Clock size={40} className="animate-pulse" />
        </div>
        
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">Pending Approval</h1>
        <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed">
          Your school registration is currently under review by our team. 
          You will gain access to your dashboard once approved.
        </p>

        <div className="bg-slate-100 dark:bg-slate-700 rounded-xl p-4 mb-8 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Current Status:</span>
          <span className="px-3 py-1 bg-amber-200 text-amber-800 text-xs font-bold uppercase rounded-full tracking-wider">
            {status}
          </span>
        </div>

        <div className="flex flex-col gap-4 justify-center">
          <button 
            onClick={() => navigate('/admin')}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            Bypass & Enter Dashboard (Debug)
          </button>
          
          <div className="flex gap-4 justify-center">
            <button 
              onClick={() => window.location.reload()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors font-medium"
          >
            <RefreshCcw size={18} />
            Refresh
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition-colors font-medium"
          >
            <LogOut size={18} />
            Log out
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
