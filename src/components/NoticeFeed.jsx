import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { subscribeToNotices } from '../firebase/firestore';
import { LuBell as Bell, LuTriangleAlert as AlertTriangle, LuUsers as Users, LuGraduationCap as GraduationCap } from 'react-icons/lu';

export default function NoticeFeed({ audienceRole }) {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    const unsub = subscribeToNotices(schoolId, audienceRole, (data) => {
      setNotices(data);
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId, audienceRole]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-48">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto pb-24">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <Bell className="text-primary-600" />
          Noticeboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Official announcements from the school administration.</p>
      </div>

      <div className="space-y-4">
        {notices.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
            <Bell size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">No active notices</p>
            <p>You're all caught up!</p>
          </div>
        ) : (
          notices.map((notice) => {
            const isHighPriority = notice.priority === 'high';
            return (
              <div 
                key={notice.id} 
                className={`bg-white dark:bg-slate-900 rounded-3xl border p-6 flex flex-col gap-4 shadow-sm transition-all
                  ${isHighPriority ? 'border-red-200 bg-red-50/10' : 'border-slate-200 dark:border-slate-700'}
                `}
              >
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    {isHighPriority && (
                      <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                        <AlertTriangle size={14} /> High Priority
                      </span>
                    )}
                    <span className="text-sm font-medium text-slate-400 dark:text-slate-300">
                      {new Date(notice.createdAt).toLocaleString(undefined, {
                        month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">{notice.title}</h3>
                </div>
                
                <div className="text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap font-medium">
                  {notice.message}
                </div>
                
                <div className="text-sm font-medium text-slate-400 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800">
                  Posted by: {notice.authorName}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
