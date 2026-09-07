import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getChatThreads, subscribeToMessages } from '../../firebase/firestore';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuMessageSquare as MessageSquare, LuFile as FileIcon, LuSearch as Search, LuShieldAlert as ShieldAlert, LuDownload as DownloadIcon, LuX as XIcon, LuBan as Ban } from 'react-icons/lu';
import CustomAudioPlayer from '../../components/CustomAudioPlayer';

export default function ChatMonitor() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [threads, setThreads] = useState([]);
  const [filteredThreads, setFilteredThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [previewFile, setPreviewFile] = useState(null); // { url, type }

  const handleDownload = async (url, customName = 'file') => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      
      let fileName = customName;
      try {
        const decoded = decodeURIComponent(url.split('/').pop().split('?')[0]);
        if (decoded && decoded.includes('.')) {
          fileName = decoded;
        }
      } catch (e) {
        console.warn(e);
      }
      
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error downloading file:", err);
      window.open(url, '_blank');
    }
  };
  
  const messagesEndRef = useRef(null);

  const [usersMap, setUsersMap] = useState(new Map());
  const [studentsMap, setStudentsMap] = useState(new Map());

  // Fetch all chat threads for the school and user maps
  useEffect(() => {
    if (schoolId) {
      const fetchData = async () => {
        try {
          const [threadsData, usersSnap, studentsSnap] = await Promise.all([
            getChatThreads(schoolId),
            getDocs(query(collection(db, 'users'), where('schoolId', '==', schoolId))),
            getDocs(collection(db, `schools/${schoolId}/students`))
          ]);
          
          const uMap = new Map();
          usersSnap.forEach(doc => {
            const data = doc.data();
            const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            uMap.set(doc.id, data.name || fullName || data.email?.split('@')[0] || 'Unknown User');
          });
          setUsersMap(uMap);

          const sMap = new Map();
          studentsSnap.forEach(doc => {
            const data = doc.data();
            const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
            sMap.set(doc.id, data.name || fullName || 'Unknown Student');
          });
          setStudentsMap(sMap);

          setThreads(threadsData);
          setFilteredThreads(threadsData);
        } catch (err) {
          console.error("Error fetching monitor data:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [schoolId]);

  // Handle Search Filtering
  useEffect(() => {
    const lowerQuery = searchQuery.toLowerCase();
    setFilteredThreads(
      threads.filter(t => 
        (t.lastMessage && t.lastMessage.toLowerCase().includes(lowerQuery)) ||
        (t.studentId && t.studentId.toLowerCase().includes(lowerQuery)) ||
        (t.teacherId && t.teacherId.toLowerCase().includes(lowerQuery))
      )
    );
  }, [searchQuery, threads]);

  // Subscribe to messages when a thread is selected
  useEffect(() => {
    let unsubscribe = null;
    if (schoolId && activeThread) {
      setMessages([]); // Clear old messages
      unsubscribe = subscribeToMessages(schoolId, activeThread.studentId, activeThread.teacherId, (newMessages) => {
        setMessages(newMessages);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [schoolId, activeThread]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMessageContent = (msg, isTeacher) => {
    return (
      <div className="flex flex-col gap-2">
        {msg.isDeletedForEveryone && (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-md self-start">
            <Ban size={12} /> Deleted by Sender
          </div>
        )}
        {msg.mediaUrl && (
          <div className="mb-1 opacity-80">
            {msg.mediaType === 'image' && (
              <button 
                onClick={() => setPreviewFile({ url: msg.mediaUrl, type: 'image' })} 
                className="focus:outline-none hover:opacity-90 transition-opacity text-left block"
              >
                <img src={msg.mediaUrl} alt="Attachment" className="max-w-full h-auto max-h-48 rounded-lg object-contain bg-black/5 cursor-zoom-in" />
              </button>
            )}
            {msg.mediaType === 'audio' && (
              <CustomAudioPlayer src={msg.mediaUrl} isMe={isTeacher} />
            )}
            {msg.mediaType === 'document' && (
              <button 
                onClick={() => setPreviewFile({ url: msg.mediaUrl, type: 'document' })} 
                className="flex items-center gap-2 p-3 bg-black/5 rounded-lg hover:bg-black/10 transition-colors focus:outline-none text-left w-full text-inherit"
              >
                <FileIcon size={20} className="shrink-0" />
                <span className="text-sm font-semibold underline truncate">View Document</span>
              </button>
            )}
          </div>
        )}
        {msg.text && <p className={`text-sm whitespace-pre-wrap ${msg.isDeletedForEveryone ? 'text-slate-500 dark:text-slate-400 italic' : ''}`}>{msg.text}</p>}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="mb-6 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <ShieldAlert className="text-red-500" />
            Chat Monitor
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Audit and monitor all communications between parents and staff.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        
        {/* Sidebar - Threads List */}
        <div className="w-full lg:w-96 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm shrink-0">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={18} />
              <input
                type="text"
                placeholder="Search threads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
              />
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No chat threads found.</div>
            ) : (
              filteredThreads.map(thread => (
                <button
                  key={thread.id}
                  onClick={() => setActiveThread(thread)}
                  className={`w-full text-left p-3 rounded-2xl flex items-start gap-3 transition-colors ${
                    activeThread?.id === thread.id 
                      ? 'bg-red-50 dark:bg-slate-800 border border-red-200 dark:border-slate-700' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                    activeThread?.id === thread.id ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}>
                    {thread.teacherId ? (usersMap.get(thread.teacherId) || '..').substring(0,2).toUpperCase() : '..'}
                  </div>
                  <div className="overflow-hidden flex-1">
                    <div className="font-bold text-slate-900 dark:text-white truncate text-sm">
                      Thread: {studentsMap.get(thread.studentId) || thread.studentId}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 truncate font-medium">Parent: {usersMap.get(thread.parentId) || thread.parentId}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Staff: {usersMap.get(thread.teacherId) || thread.teacherId}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-300 truncate mt-1">
                      {thread.lastMessage || 'No recent messages'}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Viewer Area */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col min-h-0 overflow-hidden relative">
          {activeThread ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-red-50 dark:bg-slate-800 flex items-center gap-4 shrink-0">
                <div className="w-10 h-10 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-lg">
                  <ShieldAlert size={20} />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                    Monitoring: Thread {activeThread.id}
                  </h2>
                  <p className="text-xs text-red-600 font-semibold uppercase tracking-wider">
                    Read-Only Audit Mode
                  </p>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto custom-scrollbar bg-slate-50/30 flex flex-col gap-4">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 text-center">
                    <MessageSquare size={48} className="mb-4 text-slate-200" />
                    <p>No messages in this thread yet.</p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isTeacher = msg.senderRole === 'teacher';
                    return (
                      <div key={msg.id} className={`flex ${isTeacher ? 'justify-end' : 'justify-start'} w-full`}>
                        <div className={`max-w-[85%] md:max-w-[75%] flex flex-col ${isTeacher ? 'items-end' : 'items-start'}`}>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 px-1 tracking-wide">
                            {usersMap.get(msg.senderId) || (isTeacher ? 'Teacher / Staff' : 'Parent')}
                          </span>
                          <div className={`rounded-2xl p-4 w-full ${
                            isTeacher 
                              ? 'bg-slate-800 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm'
                          }`}>
                            {renderMessageContent(msg, isTeacher)}
                            <span className={`text-xs mt-2 block ${isTeacher ? 'text-slate-400 dark:text-slate-300' : 'text-slate-400 dark:text-slate-300'}`}>
                              {new Date(msg.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-300 text-center p-8 bg-slate-50/50 dark:bg-slate-800/50">
              <div>
                <ShieldAlert size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-300">Select a thread to monitor</p>
                <p className="text-sm mt-1">Audit logs are read-only and confidential.</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {previewFile && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center z-[9999] p-4 animate-fade-in">
          <div className="absolute top-4 right-4 flex items-center gap-3">
            <button
              onClick={() => handleDownload(previewFile.url)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
              title="Download File"
            >
              <DownloadIcon size={22} />
            </button>
            <button
              onClick={() => setPreviewFile(null)}
              className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors flex items-center justify-center backdrop-blur-sm"
              title="Close Preview"
            >
              <XIcon size={22} />
            </button>
          </div>
          <div className="max-w-4xl w-full max-h-[85vh] flex items-center justify-center p-4">
            {previewFile.type === 'image' ? (
              <img
                src={previewFile.url}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
              />
            ) : (
              previewFile.url.toLowerCase().includes('.pdf') || previewFile.url.toLowerCase().includes('/raw/upload') ? (
                <iframe 
                  src={previewFile.url} 
                  title="Document Preview"
                  className="w-[85vw] md:w-[70vw] h-[75vh] rounded-2xl border border-white/10 bg-white dark:bg-slate-900 shadow-2xl"
                />
              ) : (
                <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 text-center flex flex-col items-center gap-6">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-3xl flex items-center justify-center shadow-inner">
                    <FileIcon size={40} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white truncate max-w-xs mx-auto">
                      {decodeURIComponent(previewFile.url.split('/').pop().split('?')[0]) || 'Attachment Document'}
                    </h3>
                    <p className="text-sm text-slate-400 dark:text-slate-300 mt-2">Preview is not supported for this file extension.</p>
                  </div>
                  <button
                    onClick={() => handleDownload(previewFile.url)}
                    className="w-full py-3 bg-slate-900 text-white hover:bg-slate-800 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg"
                  >
                    <DownloadIcon size={18} /> Download to View
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
