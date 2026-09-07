import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToGlobalNotices, subscribeToClassNotices, createNotice, deleteNotice, updateNotice, subscribeToSubCollection } from '../../firebase/firestore';
import { LuBell as Bell, LuMegaphone as Megaphone, LuPlus as Plus, LuX as X, LuTrash2 as Trash2, LuUsers as Users, LuGraduationCap as GraduationCap, LuTriangleAlert as AlertTriangle, LuSend as Send, LuPencil as Edit, LuEye as Eye } from 'react-icons/lu';
import { whatsappService } from '../../services/whatsappService';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';
import usePermissions from '../../hooks/usePermissions';

export default function Noticeboard() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('noticeboard');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('noticeboard');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('noticeboard');

  const [activeTab, setActiveTab] = useState('global');
  const [globalNotices, setGlobalNotices] = useState([]);
  const [classNotices, setClassNotices] = useState([]);
  const [classesMap, setClassesMap] = useState({});
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
    priority: 'normal'
  });

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let unsubGlobal = () => {};
    let unsubClass = () => {};

    if (activeTab === 'global') {
      unsubGlobal = subscribeToGlobalNotices(schoolId, null, (data) => {
        setGlobalNotices(data);
        setLoading(false);
      });
    } else if (activeTab === 'class') {
      unsubClass = subscribeToClassNotices(schoolId, null, (data) => {
        setClassNotices(data);
        setLoading(false);
      });
    }

    const unsubClasses = subscribeToSubCollection(schoolId, 'classes', (data) => {
      const cmap = {};
      data.forEach(c => {
        cmap[c.id] = c.name || c.className || c.id;
      });
      setClassesMap(cmap);
    });

    return () => {
      unsubGlobal();
      unsubClass();
      unsubClasses();
    };
  }, [schoolId, activeTab]);

  const handleSaveNotice = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      if (editingNotice) {
        await updateNotice(schoolId, editingNotice.id, {
          ...newNotice,
          authorName: (userProfile.name && userProfile.name !== 'undefined') ? userProfile.name : ((userProfile.firstName && userProfile.firstName !== 'undefined') ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin User')
        });
        toast.success("Notice updated successfully!");
      } else {
        const noticePayload = {
          ...newNotice,
          type: 'global',
          authorId: currentUser.uid,
          authorName: (userProfile.name && userProfile.name !== 'undefined') ? userProfile.name : ((userProfile.firstName && userProfile.firstName !== 'undefined') ? `${userProfile.firstName} ${userProfile.lastName}` : 'Admin User')
        };
        const noticeId = await createNotice(schoolId, noticePayload);
        
        toast.success("Notice published successfully! WhatsApp messages queued.");
        
        whatsappService.sendNoticeNotification(schoolId, noticeId, noticePayload);
      }
      
      setShowCreateModal(false);
      setEditingNotice(null);
      setNewNotice({ title: '', message: '', audience: 'all', priority: 'normal' });
    } catch (error) {
      toast.error(`Failed to ${editingNotice ? 'update' : 'create'} notice.`);
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
      priority: notice.priority
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
    <div className="p-8 max-w-5xl mx-auto pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <Megaphone className="text-primary-600" />
            Noticeboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Broadcast global announcements and oversee class notices.</p>
        </div>
        
        {activeTab === 'global' && hasCreatePermission && (
          <button 
            onClick={() => {
              setEditingNotice(null);
              setNewNotice({ title: '', message: '', audience: 'all', priority: 'normal' });
              setShowCreateModal(true);
            }}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 shadow-sm flex items-center gap-2 transition-colors"
          >
            <Plus size={20} /> Create Global Notice
          </button>
        )}
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200 dark:border-slate-700 overflow-x-auto custom-scrollbar w-full">
        <button
          onClick={() => setActiveTab('global')}
          className={`pb-3 px-4 font-bold transition-colors whitespace-nowrap ${activeTab === 'global' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Global Notices
        </button>
        <button
          onClick={() => setActiveTab('class')}
          className={`pb-3 px-4 font-bold transition-colors whitespace-nowrap ${activeTab === 'class' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
        >
          Class Notices (From Teachers)
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
              <p>{activeTab === 'global' ? "Click 'Create Global Notice' to broadcast an announcement." : "No class notices have been posted by teachers yet."}</p>
            </div>
          ) : (
            displayedNotices.map((notice) => {
              const isHighPriority = notice.priority === 'high';
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
                        <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider
                          ${notice.audience === 'all' ? 'bg-purple-100 text-purple-700' : 
                            notice.audience === 'teachers' ? 'bg-blue-100 text-blue-700' : 
                            notice.audience === 'students' ? 'bg-orange-100 text-orange-700' : 
                            notice.audience === 'students_parents' ? 'bg-teal-100 text-teal-700' : 
                            'bg-green-100 text-green-700'}
                        `}>
                          {(notice.audience === 'all' || notice.audience === 'parents' || notice.audience === 'students_parents' || notice.audience === 'students') && <Users size={14} />}
                          {notice.audience === 'teachers' && <GraduationCap size={14} />}
                          To: {(notice.audience || 'all').replace('_', ' & ')}
                          {activeTab === 'class' && notice.classId ? ` (Class: ${classesMap[notice.classId] || notice.classId})` : ''}
                        </span>
                        <span className="text-sm font-medium text-slate-400 dark:text-slate-300">
                          {new Date(notice.createdAt).toLocaleString(undefined, {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </span>
                        
                        <button 
                          onClick={() => openViewersModal(notice.viewedBy)}
                          className="ml-auto flex items-center gap-1.5 px-3 py-1 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold cursor-pointer transition-colors border border-primary-200"
                        >
                          <Eye size={14} /> {viewsCount} {viewsCount === 1 ? 'View' : 'Views'}
                        </button>
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
                  
                  <div className="shrink-0 flex items-start md:items-center gap-2">
                    {hasEditPermission && (
                      <button 
                        onClick={() => openEditModal(notice)}
                        className="p-3 text-slate-400 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl transition-colors tooltip-trigger"
                        title="Edit Notice"
                      >
                        <Edit size={20} />
                      </button>
                    )}
                    {hasDeletePermission && (
                      <button 
                        onClick={() => setConfirmModalState({ isOpen: true, noticeId: notice.id })}
                        className="p-3 text-red-400 hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-600 rounded-xl transition-colors tooltip-trigger"
                        title="Delete Notice"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>
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
                <Megaphone className="text-primary-600" /> {editingNotice ? 'Edit Notice' : 'Broadcast Global Notice'}
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
                    placeholder="e.g. School closed tomorrow"
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
                      onChange={(e) => setNewNotice({...newNotice, audience: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 font-medium"
                    >
                      {activeTab === 'global' ? (
                        <>
                          <option value="all">Everyone (Teachers, Parents)</option>
                          <option value="teachers">Teachers Only</option>
                          <option value="parents">Parents Only</option>
                        </>
                      ) : (
                        <>
                          <option value="all">Everyone in Class</option>
                          <option value="parents">Parents Only</option>
                        </>
                      )}
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
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm flex justify-center items-center gap-2 transition-colors">
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
