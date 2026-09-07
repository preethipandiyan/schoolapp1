import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToStudentPTMs, updatePTM } from '../../firebase/firestore';
import { LuCalendarClock, LuCalendarCheck, LuCircleCheck, LuClock, LuVideo, LuMapPin, LuCircleX, LuUsers } from 'react-icons/lu';
import toast from 'react-hot-toast';
import ConfirmModal from '../../components/ConfirmModal';

export default function PTM() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const studentId = userProfile?.linkedStudentId;

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, meetingId: null });

  useEffect(() => {
    if (!schoolId || !studentId) return;
    
    setLoading(true);
    const unsub = subscribeToStudentPTMs(schoolId, studentId, (data) => {
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMeetings(data);
      setLoading(false);
    });

    return () => unsub();
  }, [schoolId, studentId]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'confirmed': return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuCircleCheck size={14} /> Confirmed</span>;
      case 'pending': return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuClock size={14} /> Pending</span>;
      case 'cancelled': return <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuCircleX size={14} /> Cancelled</span>;
      default: return null;
    }
  };

  const handleCancelClick = (meetingId) => {
    setConfirmModal({
      isOpen: true,
      meetingId
    });
  };

  const handleConfirmCancel = async () => {
    const { meetingId } = confirmModal;
    if (!meetingId) return;

    setConfirmModal({ isOpen: false, meetingId: null });

    try {
      await updatePTM(schoolId, meetingId, { status: 'cancelled' });
      toast.success('Meeting cancelled');
    } catch (error) {
      toast.error('Failed to cancel meeting');
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const upcomingMeetings = meetings.filter(m => m.date >= todayStr);
  const pastMeetings = meetings.filter(m => m.date < todayStr);

  const formatTime12hr = (time24) => {
    if (!time24) return '';
    const [hours, minutes] = time24.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto pb-24 h-full flex flex-col min-w-0 w-full">
      <div className="mb-8 shrink-0 min-w-0 w-full">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 truncate">
          <LuCalendarClock className="text-primary-600 shrink-0" /> Parent-Teacher Meetings
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">View your scheduled meetings with teachers.</p>
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-3 mb-4">
            <LuCalendarCheck className="text-primary-600" size={24} />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Upcoming Meetings</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {upcomingMeetings.map(meeting => (
              <div key={meeting.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300 shrink-0">
                      <LuUsers size={24} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">Class Teacher</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">Ref: {meeting.studentName}</p>
                    </div>
                  </div>
                  {getStatusBadge(meeting.status)}
                </div>
                
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-4 flex-1">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Date & Time</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{new Date(meeting.date).toLocaleDateString('en-GB')} at {formatTime12hr(meeting.time)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Type</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        {meeting.type === 'online' ? <LuVideo size={14} className="text-blue-500" /> : <LuMapPin size={14} className="text-amber-500" />}
                        <span className="capitalize">{meeting.type}</span>
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <span className="px-2.5 py-1 bg-primary-50 text-primary-700 text-xs font-bold rounded-lg">Upcoming</span>
                  
                  {meeting.status !== 'cancelled' && (
                    <button onClick={() => handleCancelClick(meeting.id)} className="text-sm font-bold text-red-600 hover:text-red-700">Cancel</button>
                  )}
                </div>
              </div>
            ))}
            {upcomingMeetings.length === 0 && (
              <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400 font-medium bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700">
                You have no upcoming meetings scheduled.
              </div>
            )}
          </div>
        </section>

        {pastMeetings.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <LuCalendarClock className="text-slate-400 dark:text-slate-300" size={24} />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Past Meetings</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-75 hover:opacity-100 transition-opacity">
              {pastMeetings.map(meeting => (
                <div key={meeting.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col group">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300 shrink-0">
                        <LuUsers size={24} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight truncate">Class Teacher</h3>
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">Ref: {meeting.studentName}</p>
                      </div>
                    </div>
                    {getStatusBadge(meeting.status)}
                  </div>
                  
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 flex-1">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Date & Time</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{new Date(meeting.date).toLocaleDateString('en-GB')} at {formatTime12hr(meeting.time)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Type</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                          {meeting.type === 'online' ? <LuVideo size={14} className="text-blue-500" /> : <LuMapPin size={14} className="text-amber-500" />}
                          <span className="capitalize">{meeting.type}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
      {/* Confirm Cancel Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, meetingId: null })}
        onConfirm={handleConfirmCancel}
        title="Cancel Meeting"
        message="Are you sure you want to cancel this meeting?"
        confirmText="Cancel Meeting"
        cancelText="Go Back"
        type="danger"
      />
    </div>
  );
}
