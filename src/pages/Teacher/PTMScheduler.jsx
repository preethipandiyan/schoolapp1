import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  subscribeToClassPTMs, 
  subscribeToStudentsByClass, 
  createPTM, 
  updatePTM 
} from '../../firebase/firestore';
import { LuCalendarClock, LuPlus, LuCalendarCheck, LuClock, LuUsers, LuCircleCheck, LuVideo, LuMapPin, LuCircleX, LuX } from 'react-icons/lu';
import toast from 'react-hot-toast';
import { whatsappService } from '../../services/whatsappService';

const TimePicker12Hour = ({ value, onChange, required }) => {
  let initialHour12 = '';
  let initialMinute = '';
  let initialPeriod = 'AM';

  if (value) {
    const [h, m] = value.split(':');
    const hour24 = parseInt(h, 10);
    initialPeriod = hour24 >= 12 ? 'PM' : 'AM';
    initialHour12 = (hour24 % 12 || 12).toString().padStart(2, '0');
    initialMinute = m;
  }

  const [hour, setHour] = useState(initialHour12);
  const [minute, setMinute] = useState(initialMinute);
  const [period, setPeriod] = useState(initialPeriod);

  const handleChange = (h, m, p) => {
    setHour(h);
    setMinute(m);
    setPeriod(p);
    
    if (h && m) {
      let h24 = parseInt(h, 10);
      if (p === 'PM' && h24 !== 12) h24 += 12;
      if (p === 'AM' && h24 === 12) h24 = 0;
      
      const time24 = `${h24.toString().padStart(2, '0')}:${m}`;
      onChange(time24);
    } else {
      onChange(''); 
    }
  };

  const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  return (
    <div className="flex w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-primary-500 overflow-hidden divide-x divide-slate-200 dark:divide-slate-700">
      <select 
        required={required}
        value={hour} 
        onChange={(e) => handleChange(e.target.value, minute, period)}
        className="flex-1 px-3 py-2.5 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 appearance-none text-center cursor-pointer outline-none"
      >
        <option value="" disabled>HH</option>
        {hours.map(h => <option key={h} value={h}>{h}</option>)}
      </select>
      <select 
        required={required}
        value={minute} 
        onChange={(e) => handleChange(hour, e.target.value, period)}
        className="flex-1 px-3 py-2.5 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 appearance-none text-center cursor-pointer outline-none"
      >
        <option value="" disabled>MM</option>
        {minutes.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
      <select 
        value={period} 
        onChange={(e) => handleChange(hour, minute, e.target.value)}
        className="flex-1 px-3 py-2.5 bg-transparent border-none focus:ring-0 text-slate-700 dark:text-slate-200 appearance-none text-center cursor-pointer font-bold outline-none"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

export default function PTMScheduler() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const classId = userProfile?.assignedClassId;

  const [activeTab, setActiveTab] = useState('upcoming');
  const [meetings, setMeetings] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    studentId: '',
    date: '',
    time: '',
    type: 'online'
  });

  useEffect(() => {
    if (!schoolId || !classId) return;
    
    setLoading(true);
    let unsubMeetings, unsubStudents;

    unsubMeetings = subscribeToClassPTMs(schoolId, classId, (data) => {
      // sort by date descending
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setMeetings(data);
      setLoading(false);
    });

    unsubStudents = subscribeToStudentsByClass(schoolId, classId, (data) => {
      setStudents(data);
    });

    return () => {
      if (unsubMeetings) unsubMeetings();
      if (unsubStudents) unsubStudents();
    };
  }, [schoolId, classId]);

  const handleBookMeeting = async (e) => {
    e.preventDefault();
    if (!newMeeting.studentId || !newMeeting.date || !newMeeting.time) return;

    const student = students.find(s => s.id === newMeeting.studentId);
    if (!student) return;

    setCreating(true);
    try {
      const ptmPayload = {
        classId,
        teacherId: userProfile?.uid,
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        parentName: student.parentName || 'Parent',
        date: newMeeting.date,
        time: newMeeting.time,
        type: newMeeting.type,
        status: 'confirmed'
      };
      const ptmId = await createPTM(schoolId, ptmPayload);
      toast.success("Meeting booked successfully!");
      setShowCreateModal(false);
      setNewMeeting({ studentId: '', date: '', time: '', type: 'online' });
      
      // Send WhatsApp notification in the background
      whatsappService.sendPTMNotification(schoolId, ptmId, ptmPayload);
    } catch (error) {
      toast.error("Failed to book meeting");
    } finally {
      setCreating(false);
    }
  };

  const updateMeetingStatus = async (ptmId, status) => {
    try {
      await updatePTM(schoolId, ptmId, { status });
      toast.success(`Meeting ${status}`);
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'confirmed': return <span className="flex items-center gap-1 px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuCircleCheck size={14} /> Confirmed</span>;
      case 'pending': return <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuClock size={14} /> Pending</span>;
      case 'cancelled': return <span className="flex items-center gap-1 px-2.5 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-bold uppercase tracking-wider"><LuCircleX size={14} /> Cancelled</span>;
      default: return null;
    }
  };

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  
  const displayedMeetings = meetings.filter(m => {
    if (activeTab === 'upcoming') {
      return m.date >= todayStr;
    } else {
      return m.date < todayStr;
    }
  });

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col relative">
      <div className="mb-8 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <LuCalendarClock className="text-primary-600" /> PTM Scheduler
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage Parent-Teacher Meetings and set your availability.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCreateModal(true)} className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2">
            <LuPlus size={18} /> Book Meeting
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 px-6 pt-4 shrink-0">
          <button 
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'upcoming' ? 'border-primary-600 text-primary-700 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50'}`}
          >
            <LuCalendarCheck size={18} /> Upcoming Meetings
          </button>
          <button 
            onClick={() => setActiveTab('past')}
            className={`px-6 py-3 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'past' ? 'border-primary-600 text-primary-700 bg-white dark:bg-slate-900' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100/50'}`}
          >
            <LuCalendarClock size={18} /> Past Meetings
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {displayedMeetings.map(meeting => (
              <div key={meeting.id} className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-300 dark:hover:border-slate-700 hover:shadow-md transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-400 dark:text-slate-300 shrink-0 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                      <LuUsers size={24} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{meeting.parentName}</h3>
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Ref: {meeting.studentName}</p>
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
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-1">Meeting Type</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1">
                        {meeting.type === 'online' ? <LuVideo size={14} className="text-blue-500" /> : <LuMapPin size={14} className="text-amber-500" />}
                        <span className="capitalize">{meeting.type}</span>
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-2">
                  <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg">Class PTM</span>
                  
                  {meeting.status === 'pending' ? (
                    <div className="flex gap-2">
                      <button onClick={() => updateMeetingStatus(meeting.id, 'cancelled')} className="px-4 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Decline</button>
                      <button onClick={() => updateMeetingStatus(meeting.id, 'confirmed')} className="px-4 py-1.5 bg-primary-600 text-white text-xs font-bold rounded-lg hover:bg-primary-700 transition-colors">Approve</button>
                    </div>
                  ) : meeting.status === 'confirmed' && activeTab === 'upcoming' ? (
                    <button onClick={() => updateMeetingStatus(meeting.id, 'cancelled')} className="text-sm font-bold text-red-600 hover:text-red-700">Cancel</button>
                  ) : (
                    <button className="text-sm font-bold text-primary-600 hover:text-primary-700">View Details &rarr;</button>
                  )}
                </div>
              </div>
            ))}
            {displayedMeetings.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500 dark:text-slate-400 font-medium">
                No meetings found in this category.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Book Meeting</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <LuX size={20} />
              </button>
            </div>

            <form onSubmit={handleBookMeeting}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Student</label>
                  <select 
                    required
                    value={newMeeting.studentId}
                    onChange={(e) => setNewMeeting({...newMeeting, studentId: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(s => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Date</label>
                    <input 
                      type="date" required min={todayStr}
                      value={newMeeting.date}
                      onChange={(e) => setNewMeeting({...newMeeting, date: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Time</label>
                    <TimePicker12Hour 
                      required
                      value={newMeeting.time}
                      onChange={(val) => setNewMeeting({...newMeeting, time: val})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Meeting Type</label>
                  <select 
                    value={newMeeting.type}
                    onChange={(e) => setNewMeeting({...newMeeting, type: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option value="online">Online (Video Call)</option>
                    <option value="in-person">In-Person</option>
                  </select>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">
                  {creating ? 'Booking...' : 'Book Meeting'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

