import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToGlobalNotices, subscribeToClassNotices, markNoticeAsViewed } from '../../firebase/firestore';
import { LuBell as Bell, LuMegaphone as Megaphone, LuUsers as Users, LuTriangleAlert as AlertTriangle } from 'react-icons/lu';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export default function ParentNoticeboard() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.linkedClassId;
  const studentId = userProfile?.linkedStudentId;

  const [activeTab, setActiveTab] = useState('global');
  const [globalNotices, setGlobalNotices] = useState([]);
  const [classNotices, setClassNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resolvedClassId, setResolvedClassId] = useState(null);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setResolvedClassId(classId || null);
      return;
    }

    const fetchActiveStudentClass = async () => {
      try {
        const studentDoc = await getDoc(doc(db, `schools/${schoolId}/students`, studentId));
        if (studentDoc.exists()) {
          setResolvedClassId(studentDoc.data().classId || classId || null);
        } else {
          setResolvedClassId(classId || null);
        }
      } catch (err) {
        console.error("Failed to dynamically resolve student classId:", err);
        setResolvedClassId(classId || null);
      }
    };

    fetchActiveStudentClass();
  }, [schoolId, studentId, classId]);

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let unsubGlobal = () => {};
    let unsubClass = () => {};

    if (activeTab === 'global') {
      unsubGlobal = subscribeToGlobalNotices(schoolId, 'parents', (data) => {
        setGlobalNotices(data);
        setLoading(false);
        markUnreadAsViewed(data);
      });
    } else if (activeTab === 'class' && resolvedClassId) {
      unsubClass = subscribeToClassNotices(schoolId, resolvedClassId, (data) => {
        // filter out notices meant only for students, and filter specific_parents notices
        const filtered = data.filter(n => {
          if (n.audience === 'students') return false;
          if (n.audience === 'specific_parents') {
            return n.targetStudentIds?.includes(studentId);
          }
          return true;
        });
        setClassNotices(filtered);
        setLoading(false);
        markUnreadAsViewed(filtered);
      });
    } else {
      setLoading(false);
    }

    return () => {
      unsubGlobal();
      unsubClass();
    };
  }, [schoolId, activeTab, resolvedClassId, currentUser, userProfile]);

  const markUnreadAsViewed = (noticesList) => {
    if (!currentUser?.uid || !userProfile) return;
    noticesList.forEach(notice => {
      const alreadyViewed = notice.viewedBy?.some(v => v.uid === currentUser.uid);
      if (!alreadyViewed) {
        markNoticeAsViewed(schoolId, notice.id, {
          uid: currentUser.uid,
          name: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Parent',
          role: 'parent',
          classId: resolvedClassId || classId || ''
        });
      }
    });
  };

  const displayedNotices = activeTab === 'global' ? globalNotices : classNotices;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24 min-w-0 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 w-full">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
            <Megaphone className="text-primary-600 shrink-0" />
            Noticeboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View official announcements from the school and your child's class teacher.</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto w-full custom-scrollbar shrink-0">
        <button
          onClick={() => setActiveTab('global')}
          className={`pb-3 px-4 font-bold transition-colors ${activeTab === 'global' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Global Notices
        </button>
        <button
          onClick={() => setActiveTab('class')}
          className={`pb-3 px-4 font-bold transition-colors ${activeTab === 'class' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Class Noticeboard
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-48">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {displayedNotices.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-500 dark:text-slate-400">
              <Bell size={48} className="mx-auto mb-4 text-slate-300" />
              <p className="text-lg font-medium text-slate-900 dark:text-white">No active notices</p>
              <p>You're all caught up!</p>
            </div>
          ) : (
            displayedNotices.map((notice) => {
              const isHighPriority = notice.priority === 'high';
              
              return (
                <div 
                  key={notice.id} 
                  className={`bg-white dark:bg-slate-900 rounded-3xl border p-6 flex flex-col md:flex-row gap-6 shadow-sm transition-all hover:shadow-md
                    ${isHighPriority ? 'border-red-200 bg-red-50/10' : 'border-slate-200 dark:border-slate-700'}
                  `}
                >
                  <div className="flex-1 space-y-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        {isHighPriority && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider">
                            <AlertTriangle size={14} /> High Priority
                          </span>
                        )}
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-300">
                          {new Date(notice.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-2">{notice.title}</h3>
                    </div>
                    
                    <div className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
                      {notice.message}
                    </div>
                    
                    <div className="text-sm font-medium text-slate-400 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                        <Users size={12} className="text-slate-500 dark:text-slate-400" />
                      </div>
                      Posted by: {notice.authorName}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
