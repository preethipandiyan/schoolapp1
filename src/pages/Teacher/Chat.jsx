import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStudentsByClass, subscribeToMessages, sendMessage, checkParentRegistration, deleteChatMessage, updateChatRoomStatus, subscribeToChatRoom, getChatsForTeacher, markChatRead, createChannel, getChannelsForUser, subscribeToChannelMessages, sendChannelMessage } from '../../firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { LuMessageSquare as MessageSquare, LuFile as FileIcon, LuTrash2 as Trash2, LuCircleCheck as CheckCircle, LuClock as Clock, LuDownload as DownloadIcon, LuX as XIcon, LuCopy as Copy, LuForward as Forward, LuBan as Ban } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ChatInput from '../../components/ChatInput';
import CustomAudioPlayer from '../../components/CustomAudioPlayer';
import ConfirmModal from '../../components/ConfirmModal';
import * as XLSX from 'xlsx';

export default function TeacherChat() {
  const { userProfile, currentUser } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.assignedClassId;

  const [students, setStudents] = useState([]);
  const [activeStudent, setActiveStudent] = useState(null);
  
  // Channels State
  const [activeTab, setActiveTab] = useState('dms'); // 'dms' | 'channels'
  const [channels, setChannels] = useState([]);
  const [activeChannel, setActiveChannel] = useState(null);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [showCreateChannelModal, setShowCreateChannelModal] = useState(false);
  
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [parentLinked, setParentLinked] = useState(null); // null = checking, true = linked, false = not linked
  const messagesEndRef = useRef(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '' });

  const [linkedParentId, setLinkedParentId] = useState(null);
  const [previewFile, setPreviewFile] = useState(null); // { url, type }
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, msgId: null, isMe: false });

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
  const [parentName, setParentName] = useState('');
  const [chatRoomData, setChatRoomData] = useState(null);
  
  const [loadingStudents, setLoadingStudents] = useState(true);
  
  // Fetch students and chats
  useEffect(() => {
    let unsubChats = null;
    
    const fetchStudentsAndChats = async () => {
      if (!schoolId) {
        setLoadingStudents(false);
        return;
      }
      
      try {
        // 1. Get class students if classId exists
        let classStudents = [];
        if (classId) {
          classStudents = await getStudentsByClass(schoolId, classId);
        }

        // 2. Subscribe to chats for this teacher
        const { collection, query, where, onSnapshot } = await import('firebase/firestore');
        const chatsRef = collection(db, `schools/${schoolId}/chats`);
        const q = query(chatsRef, where("teacherId", "==", currentUser.uid));
        
        unsubChats = onSnapshot(q, async (snapshot) => {
          const chatsMap = new Map();
          snapshot.forEach(doc => {
            chatsMap.set(doc.data().studentId, { id: doc.id, ...doc.data() });
          });

          const allStudents = [...classStudents];
          
          // Add any students from chats that aren't in the class
          for (const [studentId, chatData] of chatsMap.entries()) {
            if (!allStudents.find(s => s.id === studentId)) {
              try {
                const studentDoc = await getDoc(doc(db, `schools/${schoolId}/students`, studentId));
                if (studentDoc.exists()) {
                  allStudents.push({ id: studentDoc.id, ...studentDoc.data() });
                }
              } catch (e) {
                console.error("Failed to fetch extra student:", e);
              }
            }
          }
          
          // Attach chat unread counts to the student objects
          const enrichedStudents = allStudents.map(student => {
            const chatInfo = chatsMap.get(student.id);
            return {
              ...student,
              unreadCount: chatInfo?.unreadCount_teacher || 0,
              lastMessageTime: chatInfo?.lastMessageTime || null
            };
          });

          // Sort by last message time, then name
          enrichedStudents.sort((a, b) => {
            if (a.lastMessageTime && b.lastMessageTime) {
              return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
            }
            if (a.lastMessageTime) return -1;
            if (b.lastMessageTime) return 1;
            return a.firstName.localeCompare(b.firstName);
          });

          setStudents(enrichedStudents);
          setLoadingStudents(false);
        });

      } catch (error) {
        console.error("Error fetching students and chats:", error);
        setLoadingStudents(false);
      }
    };

    fetchStudentsAndChats();

    return () => {
      if (unsubChats) unsubChats();
    };
  }, [schoolId, classId, currentUser]);

  // Fetch Channels
  useEffect(() => {
    if (schoolId && currentUser?.uid) {
      getChannelsForUser(schoolId, 'teacher', currentUser.uid, classId)
        .then(data => {
          setChannels(data);
        })
        .catch(console.error)
        .finally(() => setLoadingChannels(false));
    } else {
      setLoadingChannels(false);
    }
  }, [schoolId, currentUser, classId]);

  // Handle Channel Selection
  useEffect(() => {
    let unsubscribe = null;
    if (activeTab === 'channels' && activeChannel && schoolId) {
      setMessages([]);
      unsubscribe = subscribeToChannelMessages(schoolId, activeChannel.id, (newMessages) => {
        setMessages(newMessages);
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeChannel, activeTab, schoolId]);

  // Handle student selection and message subscription
  useEffect(() => {
    let unsubscribe = null;
    let unsubscribeRoom = null;
    
    const setupChat = async () => {
      if (activeStudent && schoolId) {
        setMessages([]); // clear old messages
        setParentName('');
        setChatRoomData(null);
        
        // 1. Check if parent is registered
        try {
          const parentDoc = await checkParentRegistration(schoolId, activeStudent.id);
          if (parentDoc) {
            setLinkedParentId(parentDoc.id);
            setParentName(parentDoc.name || `${parentDoc.firstName || ''} ${parentDoc.lastName || ''}`.trim() || 'Parent');
          } else {
            setLinkedParentId(null);
            setParentName('');
          }
        } catch (error) {
          console.error("Permission error checking parent registration:", error);
          setLinkedParentId(null);
          setParentName('');
        }

        // 2. Subscribe to messages using new room format (studentId_teacherId)
        unsubscribe = subscribeToMessages(schoolId, activeStudent.id, currentUser.uid, (newMessages) => {
          setMessages(newMessages);
          try {
            const chatRoomId = `${activeStudent.id}_${currentUser.uid}`;
            markChatRead(schoolId, chatRoomId, 'teacher');
          } catch (err) {}
        });

        // 3. Subscribe to chat room metadata
        unsubscribeRoom = subscribeToChatRoom(schoolId, activeStudent.id, currentUser.uid, (roomData) => {
          setChatRoomData(roomData);
        });

        // 4. Mark chat as read
        try {
          const chatRoomId = `${activeStudent.id}_${currentUser.uid}`;
          await markChatRead(schoolId, chatRoomId, 'teacher');
        } catch (err) {
          console.error("Failed to mark chat as read:", err);
        }
      }
    };

    setupChat();

    return () => {
      if (unsubscribe) unsubscribe();
      if (unsubscribeRoom) unsubscribeRoom();
    };
  }, [activeStudent, schoolId, currentUser.uid]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (text, mediaUrl, mediaType) => {
    if (!schoolId) return;

    try {
      if (activeTab === 'channels' && activeChannel) {
        await sendChannelMessage(
          schoolId,
          activeChannel.id,
          currentUser.uid,
          'teacher',
          `${userProfile.firstName || ''} ${userProfile.lastName || ''}`.trim() || 'Teacher',
          text,
          mediaUrl,
          mediaType
        );
      } else if (activeTab === 'dms' && activeStudent) {
        await sendMessage(
          schoolId,
          activeStudent.id,
          currentUser.uid,
          linkedParentId,
          currentUser.uid,
          'teacher',
          text,
          mediaUrl,
          mediaType
        );
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message.");
    }
  };

  const handleDeleteAction = async (type) => {
    try {
      if (activeTab === 'dms') {
        await deleteChatMessage(schoolId, `${activeStudent.id}_${currentUser.uid}`, deleteModal.msgId, type, currentUser.uid);
      } else if (activeTab === 'channels') {
        await deleteChatMessage(schoolId, activeChannel.id, deleteModal.msgId, type, currentUser.uid);
      }
      setDeleteModal({ isOpen: false, msgId: null, isMe: false });
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Message copied");
  };

  const handleForward = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success("Message copied to clipboard for forwarding");
  };

  const formatDateSeparator = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    
    const diffTime = Math.abs(today - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return date.toLocaleDateString('en-GB');
    }
    return date.toLocaleDateString('en-GB');
  };

  const renderMessageContent = (msg, isMe) => {
    if (msg.isDeletedForEveryone) {
      return (
        <p className="text-sm italic flex items-center gap-1 opacity-70">
          <Ban size={14} /> This message was deleted
        </p>
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {msg.mediaUrl && (
          <div className="mb-1">
            {msg.mediaType === 'image' && (
              <button 
                onClick={() => setPreviewFile({ url: msg.mediaUrl, type: 'image' })} 
                className="focus:outline-none hover:opacity-90 transition-opacity text-left block"
              >
                <img src={msg.mediaUrl} alt="Attachment" className="max-w-full h-auto max-h-48 rounded-lg object-contain bg-black/5 dark:bg-white/5 cursor-zoom-in" />
              </button>
            )}
            {msg.mediaType === 'audio' && (
              <CustomAudioPlayer src={msg.mediaUrl} isMe={isMe} />
            )}
            {msg.mediaType === 'document' && (
              <button 
                onClick={() => setPreviewFile({ url: msg.mediaUrl, type: 'document' })} 
                className="flex items-center gap-2 p-3 bg-black/5 dark:bg-white/5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors focus:outline-none text-left w-full text-inherit"
              >
                <FileIcon size={20} className="shrink-0" />
                <span className="text-sm font-semibold underline truncate">View Document</span>
              </button>
            )}
          </div>
        )}
        {msg.text && <p className="text-sm whitespace-pre-wrap">{msg.text}</p>}
      </div>
    );
  };

  const handleDownloadExcel = async () => {
    try {
      const toastId = toast.loading('Generating Excel sheet...');
      // Fetch all chats for this teacher
      const chats = await getChatsForTeacher(schoolId, currentUser.uid);
      const chatsMap = new Map();
      chats.forEach(c => chatsMap.set(c.studentId, c));

      // Construct rows based on roster
      const data = students.map(student => {
        const chatInfo = chatsMap.get(student.id);
        return {
          "Student ID": student.id,
          "Student Name": `${student.firstName} ${student.lastName}`,
          "Parent Name": chatInfo?.parentName || 'Unknown',
          "Chat Status": chatInfo?.status === 'completed' ? 'Completed' : 'Active',
          "Last Activity": chatInfo?.lastMessageTime ? new Date(chatInfo.lastMessageTime).toLocaleString() : 'N/A'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Parent Chat Status");
      
      // Auto-size columns
      const cols = [{ wch: 15 }, { wch: 25 }, { wch: 25 }, { wch: 15 }, { wch: 20 }];
      worksheet['!cols'] = cols;

      XLSX.writeFile(workbook, `Parent_Chats_Status_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success('Excel sheet downloaded successfully!');
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast.error('Failed to download Excel sheet');
    }
  };

  if (loadingStudents) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-0 sm:p-4 md:p-8 max-w-7xl mx-auto h-[100dvh] md:h-[calc(100vh-2rem)] flex flex-col bg-slate-50 dark:bg-slate-800 md:bg-transparent">
      <div className="mb-4 md:mb-6 shrink-0 p-4 md:p-0 bg-white dark:bg-slate-900 md:bg-transparent border-b border-slate-200 dark:border-slate-700 md:border-transparent">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">Parent Messaging</h1>
        <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 mt-1">Communicate directly with parents of your students.</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-0 md:gap-6 flex-1 min-h-0 bg-white dark:bg-slate-900 md:bg-transparent">
        
        {/* Sidebar */}
        <div className={`w-full lg:w-80 flex-col bg-white dark:bg-slate-900 md:border md:border-slate-200 md:rounded-3xl overflow-hidden md:shadow-sm shrink-0 ${
          activeStudent || activeChannel ? 'hidden lg:flex' : 'flex'
        }`}>
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-slate-700 dark:text-slate-200">Messaging</h2>
              {activeTab === 'dms' && (
                <button 
                  onClick={handleDownloadExcel}
                  title="Download Live Sheet"
                  className="p-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <DownloadIcon size={18} />
                </button>
              )}
              {activeTab === 'channels' && (
                <button 
                  onClick={() => setShowCreateChannelModal(true)}
                  title="Create Channel"
                  className="px-3 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors"
                >
                  + Create
                </button>
              )}
            </div>
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
              <button 
                onClick={() => { setActiveTab('dms'); setActiveChannel(null); }}
                className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${activeTab === 'dms' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                DMs
              </button>
              <button 
                onClick={() => { setActiveTab('channels'); setActiveStudent(null); }}
                className={`flex-1 text-sm font-bold py-1.5 rounded-lg transition-colors ${activeTab === 'channels' ? 'bg-white dark:bg-slate-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
              >
                Channels
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {activeTab === 'dms' ? (
              students.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No students in your class.</div>
              ) : (
                students.map(student => (
                  <button
                    key={student.id}
                    onClick={() => setActiveStudent(student)}
                    className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors ${
                      activeStudent?.id === student.id 
                        ? 'bg-primary-50 dark:bg-slate-800 border-l-4 border-l-primary-600 border-y-transparent border-r-transparent shadow-sm' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      activeStudent?.id === student.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      {student.firstName.charAt(0)}{student.lastName.charAt(0)}
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate flex items-center justify-between">
                        <span>{student.firstName} {student.lastName}</span>
                        {student.unreadCount > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                            {student.unreadCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">Parent Chat</div>
                    </div>
                  </button>
                ))
              )
            ) : (
              loadingChannels ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">Loading channels...</div>
              ) : channels.length === 0 ? (
                <div className="p-6 text-center text-slate-500 dark:text-slate-400 text-sm">No channels found.</div>
              ) : (
                channels.map(channel => (
                  <button
                    key={channel.id}
                    onClick={() => setActiveChannel(channel)}
                    className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-colors ${
                      activeChannel?.id === channel.id 
                        ? 'bg-primary-50 dark:bg-slate-800 border-l-4 border-l-primary-600 border-y-transparent border-r-transparent shadow-sm' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border-l-4 border-transparent'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                      activeChannel?.id === channel.id ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                    }`}>
                      #
                    </div>
                    <div className="overflow-hidden flex-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate flex items-center justify-between">
                        <span>{channel.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{channel.description || 'Channel'}</div>
                    </div>
                  </button>
                ))
              )
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`flex-1 bg-white dark:bg-slate-900 md:rounded-3xl md:border border-slate-200 dark:border-slate-700 md:shadow-sm flex-col min-h-0 overflow-hidden relative ${
          !activeStudent && !activeChannel ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeTab === 'dms' && activeStudent && (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setActiveStudent(null)}
                    className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                    {activeStudent.firstName.charAt(0)}{activeStudent.lastName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                      {parentName ? `Parent: ${parentName}` : `${activeStudent.firstName} ${activeStudent.lastName}`}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      {linkedParentId ? (
                        <><span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> Student: {activeStudent.firstName} {activeStudent.lastName}</>
                      ) : (
                        <><span className="w-2 h-2 rounded-full bg-amber-500 inline-block"></span> Parent Not Registered</>
                      )}
                    </p>
                  </div>
                </div>
                
                {linkedParentId && (
                  <button
                    onClick={() => {
                      const newStatus = chatRoomData?.status === 'completed' ? 'active' : 'completed';
                      updateChatRoomStatus(schoolId, activeStudent.id, currentUser.uid, newStatus);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                      chatRoomData?.status === 'completed'
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {chatRoomData?.status === 'completed' ? (
                      <><CheckCircle size={16} /> Completed</>
                    ) : (
                      <><Clock size={16} /> Mark Completed</>
                    )}
                  </button>
                )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 p-4 md:p-6 overflow-y-auto overflow-x-hidden custom-scrollbar bg-[#f0f2f5] dark:bg-slate-900/50 shadow-inner flex flex-col gap-4 relative">
                {messages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 text-center">
                    <MessageSquare size={48} className="mb-4 text-slate-200" />
                    <p>No messages yet.</p>
                    <p className="text-sm">Send a message to start the conversation.</p>
                  </div>
                ) : (
                  (() => {
                    let unreadCounter = chatRoomData?.unreadCount_parent || 0;
                    const readStatus = {};
                    const visibleMessages = messages.filter(m => !m.deletedFor?.includes(currentUser.uid));

                    for (let i = visibleMessages.length - 1; i >= 0; i--) {
                      if (visibleMessages[i].senderId === currentUser.uid) {
                        readStatus[visibleMessages[i].id] = unreadCounter <= 0;
                        unreadCounter--;
                      }
                    }

                    let lastDateString = null;

                    return visibleMessages.map(msg => {
                      const isMe = msg.senderId === currentUser.uid;
                      const msgDate = new Date(msg.createdAt).toDateString();
                      const showDateSeparator = msgDate !== lastDateString;
                      if (showDateSeparator) {
                        lastDateString = msgDate;
                      }

                      return (
                        <React.Fragment key={msg.id}>
                          {showDateSeparator && (
                            <div className="flex justify-center my-4 z-10">
                              <span className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-md shadow-sm text-slate-500 dark:text-slate-400 text-[11px] font-bold px-4 py-1.5 rounded-full border border-slate-200/50 dark:border-slate-700/50">
                                {formatDateSeparator(msg.createdAt)}
                              </span>
                            </div>
                          )}
                          <div className={`flex ${isMe ? 'justify-end' : 'justify-start'} group items-center gap-2`}>
                            
                            {/* Message Options (Me) */}
                            {isMe && !msg.isDeletedForEveryone && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10 shrink-0">
                                {msg.text && <button onClick={() => handleCopy(msg.text)} className="p-1.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" title="Copy"><Copy size={14}/></button>}
                                {msg.text && <button onClick={() => handleForward(msg.text)} className="p-1.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" title="Forward"><Forward size={14}/></button>}
                                <button onClick={() => setDeleteModal({isOpen: true, msgId: msg.id, isMe: true})} className="p-1.5 bg-white dark:bg-slate-900 text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-700 shadow-sm border border-slate-200 dark:border-slate-700" title="Delete"><Trash2 size={14}/></button>
                              </div>
                            )}

                            <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                              isMe 
                                ? (msg.isDeletedForEveryone ? 'bg-primary-500 text-white/80 rounded-tr-sm' : 'bg-gradient-to-br from-primary-500 to-primary-600 text-white rounded-tr-sm shadow-md shadow-primary-500/20')
                                : (msg.isDeletedForEveryone ? 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-tl-sm shadow-sm' : 'bg-white dark:bg-slate-900 border-0 text-slate-800 dark:text-slate-100 rounded-tl-sm shadow-md shadow-slate-200/50 dark:shadow-none')
                            } relative`}>
                              
                              {renderMessageContent(msg, isMe)}
                              <span className={`text-[10px] mt-1 flex items-center gap-1 ${isMe ? 'text-primary-200 justify-end' : 'text-slate-400 dark:text-slate-300 justify-start'}`}>
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                {isMe && (
                                  <span title={readStatus[msg.id] ? "Seen" : "Sent"} className="font-bold ml-1 tracking-tighter">
                                    {readStatus[msg.id] ? "✓✓" : "✓"}
                                  </span>
                                )}
                              </span>
                            </div>

                            {/* Message Options (Non-Me) */}
                            {!isMe && !msg.isDeletedForEveryone && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10 shrink-0">
                                {msg.text && <button onClick={() => handleCopy(msg.text)} className="p-1.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" title="Copy"><Copy size={14}/></button>}
                                {msg.text && <button onClick={() => handleForward(msg.text)} className="p-1.5 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-100 shadow-sm border border-slate-200 dark:border-slate-700" title="Forward"><Forward size={14}/></button>}
                                <button onClick={() => setDeleteModal({isOpen: true, msgId: msg.id, isMe: false})} className="p-1.5 bg-white dark:bg-slate-900 text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-slate-800 hover:text-red-700 shadow-sm border border-slate-200 dark:border-slate-700" title="Delete"><Trash2 size={14}/></button>
                              </div>
                            )}
                          </div>
                        </React.Fragment>
                      );
                    });
                  })()
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <ChatInput 
                schoolId={schoolId} 
                chatRoomId={`${activeStudent.id}_${currentUser.uid}`} 
                onSendMessage={handleSendMessage} 
              />
            </>
          )}

          {activeTab === 'dms' && !activeStudent && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 p-8 text-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Select a student</h3>
              <p className="max-w-xs">Choose a student from the roster to view their parent's chat history or start a new conversation.</p>
            </div>
          )}

          {activeTab === 'channels' && activeChannel && (
            <>
              {/* Channel Header */}
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setActiveChannel(null)}
                      className="lg:hidden p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full"
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    </button>
                    <div className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-lg">
                      #
                    </div>
                    <div>
                      <h2 className="font-bold text-slate-900 dark:text-white text-lg">
                        {activeChannel.name}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {activeChannel.description || 'Group Channel'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Channel Messages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar bg-slate-50/30 dark:bg-slate-800/30">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 text-center">
                      <MessageSquare size={48} className="mb-4 text-slate-200" />
                      <p>No messages in this channel yet.</p>
                      <p className="text-sm mt-1">Send the first message!</p>
                    </div>
                  ) : (
                    messages.map((msg, idx) => {
                      const isTeacher = msg.senderRole === 'teacher';
                      return (
                        <div key={msg.id} className={`flex flex-col ${isTeacher ? 'items-end' : 'items-start'}`}>
                          <div className={`text-xs font-semibold mb-1 ${isTeacher ? 'text-primary-600' : 'text-slate-500 dark:text-slate-400'}`}>
                            {msg.senderName}
                          </div>
                          <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-4 shadow-sm ${
                            isTeacher 
                              ? 'bg-gradient-to-br from-primary-600 to-primary-700 text-white rounded-tr-none' 
                              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none'
                          }`}>
                            {msg.text && <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.text}</p>}
                            {msg.mediaUrl && (
                              <div className="mt-3">
                                {msg.mediaType === 'image' && (
                                  <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="block w-48 h-48 sm:w-64 sm:h-64 rounded-xl overflow-hidden shadow-sm hover:opacity-90 transition-opacity">
                                    <img src={msg.mediaUrl} alt="attachment" className="w-full h-full object-cover" />
                                  </a>
                                )}
                                {msg.mediaType === 'audio' && (
                                  <div className="min-w-[200px] sm:min-w-[250px]">
                                    <CustomAudioPlayer url={msg.mediaUrl} isOwnMessage={isTeacher} />
                                  </div>
                                )}
                                {msg.mediaType === 'document' && (
                                  <button onClick={() => handleDownload(msg.mediaUrl)} className={`flex items-center gap-3 p-3 rounded-xl transition-colors w-full text-left ${
                                    isTeacher ? 'bg-primary-500 hover:bg-primary-400 text-white' : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                                  }`}>
                                    <div className={`p-2 rounded-lg shrink-0 ${isTeacher ? 'bg-primary-400 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                                      <FileIcon size={20} />
                                    </div>
                                    <div className="overflow-hidden">
                                      <div className="font-semibold text-sm truncate">Document File</div>
                                      <div className={`text-xs ${isTeacher ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'}`}>Click to download</div>
                                    </div>
                                  </button>
                                )}
                              </div>
                            )}
                            <div className={`text-[10px] mt-2 flex items-center gap-1 ${
                              isTeacher ? 'text-primary-100' : 'text-slate-400 dark:text-slate-300'
                            }`}>
                              <Clock size={10} />
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Channel Message Input */}
                <div className="shrink-0 bg-white dark:bg-slate-900">
                  <ChatInput onSendMessage={handleSendMessage} />
                </div>
              </>
          )}

          {activeTab === 'channels' && !activeChannel && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-300 p-8 text-center bg-slate-50/50 dark:bg-slate-800/50">
              <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4">
                <MessageSquare size={32} className="text-slate-300" />
              </div>
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Select a channel</h3>
              <p className="max-w-xs">Choose a channel to start sending announcements.</p>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        message={confirmModal.message}
        title="Delete Message"
      />

      {deleteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-[90]">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Message</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to delete this message?</p>
            <div className="flex flex-col gap-2">
              {deleteModal.isMe && (
                <button 
                  onClick={() => handleDeleteAction('for_everyone')}
                  className="w-full py-3 px-4 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl font-bold transition-colors"
                >
                  Delete for Everyone
                </button>
              )}
              <button 
                onClick={() => handleDeleteAction('for_me')}
                className="w-full py-3 px-4 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl font-bold transition-colors"
              >
                Delete for Me
              </button>
              <button 
                onClick={() => setDeleteModal({ isOpen: false, msgId: null, isMe: false })}
                className="w-full py-3 px-4 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold transition-colors mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
      
      {/* Create Channel Modal */}
      {showCreateChannelModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl p-6 relative">
            <button 
              onClick={() => setShowCreateChannelModal(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <XIcon size={20} />
            </button>
            
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Create New Channel</h2>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.target);
              const name = formData.get('name');
              const description = formData.get('description');
              const targetClass = formData.get('targetClass'); // 'all' or classId
              const isReadOnly = formData.get('isReadOnly') === 'on';

              if (!name.trim()) return;

              try {
                const channelData = {
                  name,
                  description,
                  classId: targetClass,
                  createdBy: currentUser.uid,
                  isReadOnly
                };
                const newChannelId = await createChannel(schoolId, channelData);
                const newChannel = { id: newChannelId, ...channelData, createdAt: new Date().toISOString() };
                setChannels(prev => [newChannel, ...prev]);
                setActiveChannel(newChannel);
                setActiveTab('channels');
                setShowCreateChannelModal(false);
                toast.success('Channel created successfully!');
              } catch (err) {
                toast.error('Failed to create channel');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Channel Name</label>
                <input 
                  type="text" 
                  name="name" 
                  required 
                  placeholder="e.g. 10A Science Announcements"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Description (Optional)</label>
                <textarea 
                  name="description" 
                  placeholder="What is this channel for?"
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none"
                  rows="3"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Target Audience</label>
                <select 
                  name="targetClass" 
                  className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-none bg-white dark:bg-slate-900"
                >
                  <option value={classId}>My Assigned Class Only</option>
                  <option value="all">Entire School</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="isReadOnly" name="isReadOnly" defaultChecked className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500" />
                <label htmlFor="isReadOnly" className="text-sm font-medium text-slate-700 dark:text-slate-200">Read-Only (Parents cannot reply)</label>
              </div>
              <button 
                type="submit" 
                className="w-full mt-4 bg-primary-600 text-white font-bold py-3 rounded-xl hover:bg-primary-700 transition-colors"
              >
                Create Channel
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
