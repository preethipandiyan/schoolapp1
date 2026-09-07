import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToGlobalNotices, subscribeToClassNotices, createNotice, deleteNotice, markNoticeAsViewed, updateNotice, subscribeToSubCollection, subscribeToStudentsByClass } from '../../firebase/firestore';
import { LuBell as Bell, LuMegaphone as Megaphone, LuPlus as Plus, LuX as X, LuTrash2 as Trash2, LuUsers as Users, LuTriangleAlert as AlertTriangle, LuSend as Send, LuPencil as Edit, LuEye as Eye } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function TeacherNoticeboard() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.assignedClassId;

  const [activeTab, setActiveTab] = useState('global');
  const [globalNotices, setGlobalNotices] = useState([]);
  const [classNotices, setClassNotices] = useState([]);
  const [classesMap, setClassesMap] = useState({});
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [selectedViewers, setSelectedViewers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);
  
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, noticeId: null });
  
  const [newNotice, setNewNotice] = useState({
    title: '',
    message: '',
    audience: 'all',
    priority: 'normal',
    sendWhatsApp: false,
    targetStudentIds: []
  });

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let unsubGlobal = () => {};
    let unsubClass = () => {};

    if (activeTab === 'global') {
      unsubGlobal = subscribeToGlobalNotices(schoolId, 'teachers', (data) => {
        setGlobalNotices(data);
        setLoading(false);
        markUnreadAsViewed(data);
      });
    } else if (activeTab === 'class' && classId) {
      unsubClass = subscribeToClassNotices(schoolId, classId, (data) => {
        setClassNotices(data);
        setLoading(false);
        markUnreadAsViewed(data);
      });
    } else {
      setLoading(false);
    }

    const unsubClasses = subscribeToSubCollection(schoolId, 'classes', (data) => {
      const cmap = {};
      data.forEach(c => {
        cmap[c.id] = c.name || c.className || c.id;
      });
      setClassesMap(cmap);
    });

    let unsubStudents = () => {};
    if (classId) {
      unsubStudents = subscribeToStudentsByClass(schoolId, classId, (data) => {
        data.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
        setStudents(data);
      });
    }

    return () => {
      unsubGlobal();
      unsubClass();
      unsubClasses();
      unsubStudents();
    };
  }, [schoolId, activeTab, classId, currentUser, userProfile]);

  const markUnreadAsViewed = (noticesList) => {
    if (!currentUser?.uid || !userProfile) return;
    noticesList.forEach(notice => {
      const alreadyViewed = notice.viewedBy?.some(v => v.uid === currentUser.uid);
      if (!alreadyViewed) {
        markNoticeAsViewed(schoolId, notice.id, {
          uid: currentUser.uid,
          name: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Teacher',
          role: 'teacher',
          classId: classId || ''
        });
      }
    });
  };

  const handleSaveNotice = async (e) => {
    e.preventDefault();
    if (!classId) {
      toast.error("You must be assigned to a class to create a class notice.");
      return;
    }
    
    setCreating(true);
    try {
      if (editingNotice) {
        await updateNotice(schoolId, editingNotice.id, {
          ...newNotice,
          authorName: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Teacher'
        });
        toast.success("Notice updated successfully!");
      } else {
        await createNotice(schoolId, {
          ...newNotice,
          type: 'class',
          classId: classId,
          authorId: currentUser.uid,
          authorName: userProfile.name || `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Teacher'
        });
        toast.success("Notice published successfully!");
      }
      
      setShowCreateModal(false);
      setEditingNotice(null);
      setNewNotice({ title: '', message: '', audience: 'all', priority: 'normal', sendWhatsApp: false, targetStudentIds: [] });
    } catch (error) {
      console.error("Error saving notice:", error);
      toast.error(`Failed to ${editingNotice ? 'update' : 'create'} notice: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (notice) => {
    setEditingNotice(notice);
    setNewNotice({
      title: notice.title,
      message: notice.message,
      audience: notice.audience,
      priority: notice.priority,
      sendWhatsApp: notice.sendWhatsApp || false,
      targetStudentIds: notice.targetStudentIds || []
    });
    setShowCreateModal(true);
  };

  const executeDeleteNotice = async () => {
    const noticeId = confirmModalState.noticeId;
    if (!noticeId) return;
    try {
      await deleteNotice(schoolId, noticeId);
      toast.success("Notice deleted.");
    } catch (error) {
      toast.error("Failed to delete notice.");
    } finally {
      setConfirmModalState({ isOpen: false, noticeId: null });
    }
  };
  
  const openViewersModal = (viewers) => {
    setSelectedViewers(viewers || []);
    setShowViewersModal(true);
  };

  const displayedNotices = activeTab === 'global' ? globalNotices : classNotices;

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto pb-24 min-w-0 w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4 w-full shrink-0">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
            <Megaphone className="text-primary-600 shrink-0" />
            Noticeboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">View official announcements and broadcast messages to your class.</p>
        </div>
        
        {activeTab === 'class' && (
          <button 
            onClick={() => {
              setEditingNotice(null);
              setNewNotice({ title: '', message: '', audience: 'all', priority: 'normal', sendWhatsApp: false, targetStudentIds: [] });
              setShowCreateModal(true);
            }}
            className="w-full sm:w-auto justify-center px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus size={20} /> Create Class Notice
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto w-full custom-scrollbar shrink-0">
        <button
          onClick={() => setActiveTab('global')}
          className={`pb-3 px-4 font-bold whitespace-nowrap transition-colors ${activeTab === 'global' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Global Notices
        </button>
        <button
          onClick={() => setActiveTab('class')}
          className={`pb-3 px-4 font-bold whitespace-nowrap transition-colors ${activeTab === 'class' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
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
              <p>{activeTab === 'global' ? "You're all caught up!" : "Create your first notice for your class."}</p>
            </div>
          ) : (
            displayedNotices.map((notice) => {
              const isHighPriority = notice.priority === 'high';
              const isAuthor = notice.authorId === currentUser.uid;
              const viewsCount = notice.viewedBy?.length || 0;
              
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
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200`}>
                          <Users size={14} /> To: {notice.audience === 'specific_parents' ? `Selected Parents (${notice.targetStudentIds?.length || 0})` : (notice.audience || 'all').replace('_', ' & ')}
                        </span>
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-300">
                          {new Date(notice.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        
                        {(isAuthor || activeTab === 'global') && (
                          <button 
                            onClick={() => openViewersModal(notice.viewedBy)}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-primary-200"
                          >
                            <Eye size={14} /> {viewsCount} {viewsCount === 1 ? 'View' : 'Views'}
                          </button>
                        )}
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
                  
                  {isAuthor && activeTab === 'class' && (
                    <div className="shrink-0 flex items-start md:items-center gap-2">
                      <button 
                        onClick={() => openEditModal(notice)}
                        className="p-3 text-slate-400 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors tooltip-trigger"
                        title="Edit Notice"
                      >
                        <Edit size={20} />
                      </button>
                      <button 
                        onClick={() => setConfirmModalState({ isOpen: true, noticeId: notice.id })}
                        className="p-3 text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-600 rounded-xl transition-colors tooltip-trigger"
                        title="Delete Notice"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Create / Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone className="text-primary-600" /> {editingNotice ? 'Edit Class Notice' : 'Broadcast Class Notice'}
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNotice} className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">
              <div className="p-6 space-y-6 flex-1">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Notice Title</label>
                  <input 
                    type="text" required
                    value={newNotice.title}
                    onChange={(e) => setNewNotice({...newNotice, title: e.target.value})}
                    placeholder="e.g. Bring your textbooks tomorrow"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-medium"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Message</label>
                  <textarea 
                    required rows="4"
                    value={newNotice.message}
                    onChange={(e) => setNewNotice({...newNotice, message: e.target.value})}
                    placeholder="Type the full announcement here..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-medium resize-none"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Target Audience</label>
                    <select 
                      value={newNotice.audience}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNewNotice({...newNotice, audience: val, targetStudentIds: val === 'specific_parents' ? [] : newNotice.targetStudentIds});
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-medium"
                    >
                      <option value="all">Everyone in Class</option>
                      <option value="parents">All Parents</option>
                      <option value="specific_parents">Specific Parents</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Priority</label>
                    <select 
                      value={newNotice.priority}
                      onChange={(e) => setNewNotice({...newNotice, priority: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-medium"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High (Urgent)</option>
                    </select>
                  </div>
                </div>

                {newNotice.audience === 'specific_parents' && (
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Select Students (Parents of these students will receive the notice)</label>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-2 space-y-1">
                      {students.map(student => (
                        <label key={student.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                          <input 
                            type="checkbox" 
                            checked={newNotice.targetStudentIds.includes(student.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewNotice({...newNotice, targetStudentIds: [...newNotice.targetStudentIds, student.id]});
                              } else {
                                setNewNotice({...newNotice, targetStudentIds: newNotice.targetStudentIds.filter(id => id !== student.id)});
                              }
                            }}
                            className="w-4 h-4 text-primary-600 border-slate-300 dark:border-slate-600 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">{student.firstName} {student.lastName}</span>
                        </label>
                      ))}
                      {students.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400 p-2">No students found in this class.</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm flex items-center gap-2 transition-colors">
                  {creating ? 'Saving...' : <><Send size={18} /> {editingNotice ? 'Update' : 'Broadcast'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Viewers Modal */}
      {showViewersModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4 sm:p-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Eye className="text-primary-600" /> Read Receipts ({selectedViewers.length})
              </h2>
              <button onClick={() => setShowViewersModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-2 flex-1 overflow-y-auto custom-scrollbar">
              {selectedViewers.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <p>No one has viewed this notice yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {selectedViewers.map((viewer, index) => (
                    <div key={index} className="p-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl">
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{viewer.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 capitalize">{viewer.role} {viewer.classId ? `- Class: ${classesMap[viewer.classId] || viewer.classId}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, noticeId: null })}
        onConfirm={executeDeleteNotice}
        title="Delete Notice"
        message="Are you sure you want to delete this notice? It will be removed immediately."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
