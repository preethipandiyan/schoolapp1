import React, { useState, useEffect } from 'react';
import { LuLifeBuoy, LuSearch, LuMessageSquare, LuCircleCheck, LuClock, LuX, LuSend, LuTrash2, LuUser } from 'react-icons/lu';
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import ConfirmModal from '../../components/ConfirmModal';

const zunaConfig = {
  apiKey: "AIzaSyAzEP2LTXsGvCsFyxITkgoon_2AL4yGKyo",
  authDomain: "zuna-landing-page-22564.firebaseapp.com",
  projectId: "zuna-landing-page-22564",
  storageBucket: "zuna-landing-page-22564.firebasestorage.app",
  messagingSenderId: "806137313772",
  appId: "1:806137313772:web:57cf450537cb9c4fff68c9"
};

const zunaApp = getApps().find(a => a.name === 'ZunaSharedApp') || initializeApp(zunaConfig, 'ZunaSharedApp');
const zunaDb = getFirestore(zunaApp);

export default function SupportTickets() {
  const [tickets, setTickets] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, ticketId: null });
  const itemsPerPage = 10;

  useEffect(() => {
    let mainList = [];
    let supportList = [];

    const getLocal = () => {
      try {
        const saved = localStorage.getItem('zuna_tickets');
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [];
    };

    const mergeAndEmit = () => {
      const localList = getLocal();
      const ticketMap = new Map();
      [...mainList, ...supportList, ...localList].forEach(t => {
        if (t && t.id) {
          ticketMap.set(t.id, { ...ticketMap.get(t.id), ...t });
        }
      });
      const combined = Array.from(ticketMap.values());
      combined.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setTickets(combined);
    };

    // Emit initial local cache immediately
    const initialLocal = getLocal();
    if (initialLocal.length > 0) {
      setTickets(initialLocal);
    }

    // Subscribe to Firestore 'tickets' collection
    const unsub1 = onSnapshot(collection(zunaDb, 'tickets'), (snapshot) => {
      mainList = snapshot.docs.map(d => {
        const data = d.data();
        const tid = data.id || d.id;
        return {
          firestoreDocId: d.id,
          id: tid,
          sourceCollection: 'tickets',
          school: data.school || data.clientName || data.hospitalName || 'School Admin',
          ...data,
          id: tid
        };
      }).filter(t => t.status !== 'deleted');
      mergeAndEmit();
    }, (err) => console.warn('Firestore tickets snapshot warn:', err));

    // Subscribe to Firestore 'support_tickets' collection
    const unsub2 = onSnapshot(collection(zunaDb, 'support_tickets'), (snapshot) => {
      supportList = snapshot.docs.map(d => {
        const data = d.data();
        const tid = data.id || d.id;
        return {
          firestoreDocId: d.id,
          id: tid,
          sourceCollection: 'support_tickets',
          school: data.school || data.clientName || data.hospitalName || 'School Admin',
          ...data,
          id: tid
        };
      });
      mergeAndEmit();
    }, (err) => console.warn('Firestore support_tickets snapshot warn:', err));

    // Listen to cross-tab BroadcastChannel
    let bc;
    if (typeof window !== 'undefined' && window.BroadcastChannel) {
      try {
        bc = new BroadcastChannel('zuna_tickets_channel');
        bc.onmessage = (evt) => {
          if (evt.data) {
            setTickets(prev => {
              const exists = prev.some(t => t.id === evt.data.id);
              if (exists) return prev;
              return [evt.data, ...prev];
            });
          }
        };
      } catch (err) {}
    }

    return () => {
      unsub1();
      unsub2();
      if (bc) bc.close();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const handleStatusChange = async (ticketId, newStatus) => {
    const target = tickets.find(t => t.id === ticketId);
    const targetDocId = target?.firestoreDocId || ticketId;
    const colName = target?.sourceCollection === 'support_tickets' ? 'support_tickets' : 'tickets';

    // Local state update
    setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, status: newStatus } : t));
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(prev => ({ ...prev, status: newStatus }));
    }

    try {
      await updateDoc(doc(zunaDb, colName, targetDocId), {
        status: newStatus,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Status update warning:', err);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSubmittingReply(true);

    const replyObj = {
      sender: 'Agent',
      author: 'SuperAdmin Support',
      text: replyText.trim(),
      timestamp: new Date().toISOString()
    };

    const targetDocId = selectedTicket.firestoreDocId || selectedTicket.id;
    const colName = selectedTicket.sourceCollection === 'support_tickets' ? 'support_tickets' : 'tickets';
    const updatedMessages = [...(selectedTicket.messages || []), replyObj];

    // Local state update
    setSelectedTicket(prev => ({ ...prev, messages: updatedMessages, status: 'in-progress' }));
    setTickets(prev => prev.map(t => t.id === selectedTicket.id ? { ...t, messages: updatedMessages, status: 'in-progress' } : t));
    setReplyText('');

    try {
      await updateDoc(doc(zunaDb, colName, targetDocId), {
        messages: updatedMessages,
        status: 'in-progress',
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.warn('Reply update warning:', err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteTicketClick = (ticketId) => {
    setConfirmModal({
      isOpen: true,
      ticketId
    });
  };

  const handleConfirmDeleteTicket = async () => {
    const { ticketId } = confirmModal;
    if (!ticketId) return;

    setConfirmModal({ isOpen: false, ticketId: null });

    const target = tickets.find(t => t.id === ticketId);
    const targetDocId = target?.firestoreDocId || ticketId;
    const colName = target?.sourceCollection === 'support_tickets' ? 'support_tickets' : 'tickets';

    setTickets(prev => prev.filter(t => t.id !== ticketId));
    if (selectedTicket && selectedTicket.id === ticketId) {
      setSelectedTicket(null);
    }

    try {
      await deleteDoc(doc(zunaDb, colName, targetDocId));
    } catch (err) {
      try {
        await updateDoc(doc(zunaDb, colName, targetDocId), { status: 'deleted' });
      } catch (e) {}
    }
  };

  const filteredTickets = tickets.filter(t => {
    const schoolName = t.school || t.clientName || t.hospitalName || '';
    const matchesSearch = 
      schoolName.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      t.id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredTickets.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedTickets = filteredTickets.slice(startIndex, startIndex + itemsPerPage);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'resolved': return <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><LuCircleCheck size={14} /> Resolved</span>;
      case 'in-progress':
      case 'pending': return <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><LuClock size={14} /> In Progress</span>;
      case 'open': return <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><LuMessageSquare size={14} /> Open</span>;
      default: return <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 w-fit">{status}</span>;
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'low': return 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
      default: return 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto flex flex-col min-w-0">
      <div className="mb-8 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuLifeBuoy className="text-primary-600" /> Support Tickets
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage live support requests and technical issues across all tenant school admins.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row gap-4 shrink-0 min-w-0">
          <div className="relative flex-1 max-w-full sm:max-w-md">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
            <input 
              type="text"
              placeholder="Search by ticket ID, school, or subject..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-medium"
            />
          </div>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 font-semibold"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="overflow-auto p-6 flex-1">
          <div className="space-y-4">
            {paginatedTickets.map(ticket => {
              const msgCount = ticket.messages?.length || 1;
              const dateStr = ticket.createdAt ? (new Date(ticket.createdAt).toLocaleDateString('en-GB')) : 'Today';
              return (
                <div 
                  key={ticket.id} 
                  onClick={() => setSelectedTicket(ticket)}
                  className="flex flex-col sm:flex-row gap-4 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-slate-700 hover:shadow-md transition-all cursor-pointer bg-white dark:bg-slate-900 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-sm font-black text-slate-400 dark:text-slate-300 group-hover:text-primary-500 transition-colors">#{ticket.id}</span>
                      {getStatusBadge(ticket.status)}
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase tracking-wider rounded-md border ${getPriorityColor(ticket.priority)}`}>
                        {ticket.priority || 'medium'} priority
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">{ticket.subject}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">From: <span className="text-slate-700 dark:text-slate-200 font-semibold">{ticket.school || ticket.clientName || 'School Admin'}</span></p>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-4 sm:pt-0 sm:pl-6">
                    <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <LuMessageSquare size={16} /> {msgCount} messages
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-300 font-medium">
                      Created {dateStr}
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTickets.length === 0 && (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <LuLifeBuoy size={48} className="mx-auto mb-4 text-slate-300" />
                <p className="text-lg font-medium text-slate-700 dark:text-slate-200">No support tickets found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
              <span className="font-semibold text-slate-900 dark:text-white">
                {Math.min(startIndex + itemsPerPage, filteredTickets.length)}
              </span>{' '}
              of <span className="font-semibold text-slate-900 dark:text-white">{filteredTickets.length}</span> tickets
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white shadow-sm'
                        : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Detail Drawer Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn" onClick={() => setSelectedTicket(null)}>
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-extrabold text-primary-600">#{selectedTicket.id}</span>
                  {getStatusBadge(selectedTicket.status)}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTicket.subject}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">From: <span className="font-bold text-slate-700 dark:text-slate-200">{selectedTicket.school || selectedTicket.clientName || 'School Admin'}</span></p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDeleteTicketClick(selectedTicket.id)}
                  className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
                  title="Delete Ticket"
                >
                  <LuTrash2 size={18} />
                </button>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="p-2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  <LuX size={20} />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Status:</span>
                <select
                  value={selectedTicket.status}
                  onChange={(e) => handleStatusChange(selectedTicket.id, e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  <option value="open">Open</option>
                  <option value="in-progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
              <div className="text-slate-400 dark:text-slate-300 font-medium">
                Created: {selectedTicket.createdAt ? new Date(selectedTicket.createdAt).toLocaleString() : 'Recently'}
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="p-6 flex-1 overflow-y-auto space-y-4 bg-slate-50/30">
              <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 dark:border-slate-700">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 block mb-1">Original Issue Description:</span>
                <p className="text-sm text-slate-800 dark:text-slate-100 font-medium">{selectedTicket.description}</p>
              </div>

              {(selectedTicket.messages || []).map((msg, idx) => {
                const isAgent = msg.sender === 'Agent' || msg.sender === 'SuperAdmin';
                return (
                  <div key={idx} className={`flex gap-3 ${isAgent ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-4 rounded-2xl ${isAgent ? 'bg-primary-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm'}`}>
                      <div className="flex items-center justify-between gap-4 text-xs opacity-75 mb-1">
                        <span className="font-bold">{msg.author || msg.sender}</span>
                        <span>{msg.timestamp}</span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Form */}
            <form onSubmit={handleSendReply} className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex gap-3">
              <input 
                type="text" 
                placeholder="Type reply to school admin..."
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-white font-medium"
                required
              />
              <button 
                type="submit"
                disabled={submittingReply}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-2xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
              >
                <LuSend size={14} /> {submittingReply ? 'Sending...' : 'Reply'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Confirm Delete Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, ticketId: null })}
        onConfirm={handleConfirmDeleteTicket}
        title="Delete Support Ticket"
        message="Are you sure you want to delete this support ticket? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
      />
    </div>
  );
}
