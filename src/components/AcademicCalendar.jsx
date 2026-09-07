import React, { useState, useEffect } from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useAuth } from '../context/AuthContext';
import { getSubCollection, addSubDocument, updateSubDocument, deleteSubDocument } from '../firebase/firestore';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import { LuPlus as Plus, LuX as X, LuCalendarDays as CalendarIcon, LuTrash2 as Trash2 } from 'react-icons/lu';
import usePermissions from '../hooks/usePermissions';

import enUS from 'date-fns/locale/en-US';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
  });

export default function AcademicCalendar({ isAdmin }) {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = isAdmin && (userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('calendar'));
  const hasEditPermission = isAdmin && (userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('calendar'));
  const hasDeletePermission = isAdmin && (userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('calendar'));

  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, onConfirm: null, message: '', title: '' });
  const [newEvent, setNewEvent] = useState({ title: '', start: '', end: '', type: 'event', isCustomDates: false, customDates: [] });
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    if (schoolId) {
      fetchEvents();
    }
  }, [schoolId]);

  const fetchEvents = async () => {
    try {
      const data = await getSubCollection(schoolId, 'calendar');
      const formattedEvents = [];
      data.forEach(ev => {
        if (ev.isCustomDates && ev.customDates && ev.customDates.length > 0) {
          ev.customDates.forEach(dateStr => {
            formattedEvents.push({
              ...ev,
              start: new Date(dateStr),
              end: new Date(dateStr)
            });
          });
        } else {
          formattedEvents.push({
            ...ev,
            start: new Date(ev.start),
            end: new Date(ev.end)
          });
        }
      });

      // Inject Virtual Sundays for +/- 1 Year
      const eventDates = new Set(formattedEvents.map(e => e.start.toDateString()));
      const currentYear = new Date().getFullYear();
      for (let y = currentYear - 1; y <= currentYear + 2; y++) {
        for (let m = 0; m < 12; m++) {
          const daysInMonth = new Date(y, m + 1, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(y, m, d);
            if (date.getDay() === 0 && !eventDates.has(date.toDateString())) {
              formattedEvents.push({
                id: `virtual-sunday-${y}-${m}-${d}`,
                title: 'Sunday (Holiday)',
                start: date,
                end: date,
                type: 'holiday',
                isVirtual: true,
                isCustomDates: false,
                customDates: []
              });
            }
          }
        }
      }

      setEvents(formattedEvents);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
    }
  };

  const handleAddEvent = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    
    try {
      let eventData;
      if (newEvent.isCustomDates) {
        if (newEvent.customDates.length === 0) {
          toast.error("Please add at least one custom date");
          return;
        }
        eventData = {
          title: newEvent.title,
          type: newEvent.type,
          isCustomDates: true,
          customDates: newEvent.customDates,
          start: new Date(newEvent.customDates[0]).toISOString(),
          end: new Date(newEvent.customDates[newEvent.customDates.length - 1]).toISOString()
        };
      } else {
        eventData = {
          title: newEvent.title,
          start: new Date(newEvent.start).toISOString(),
          end: new Date(newEvent.end).toISOString(),
          type: newEvent.type,
          isCustomDates: false,
          customDates: []
        };
      }
      
      if (selectedEvent && !selectedEvent.isVirtual) {
        if (!hasEditPermission) {
          toast.error("You do not have permission to edit events.");
          return;
        }
        await updateSubDocument(schoolId, 'calendar', selectedEvent.id, eventData);
        toast.success("Event updated successfully!");
      } else {
        if (!hasCreatePermission) {
          toast.error("You do not have permission to create events.");
          return;
        }
        await addSubDocument(schoolId, 'calendar', eventData);
        toast.success("Event added to calendar!");
      }
      
      setShowModal(false);
      setSelectedEvent(null);
      setNewEvent({ title: '', start: '', end: '', type: 'event', isCustomDates: false, customDates: [] });
      fetchEvents();
    } catch (error) {
      console.error("Error saving event:", error);
      toast.error("Failed to save event.");
    }
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent || !isAdmin) return;
    if (selectedEvent.isVirtual) {
      toast.error("Cannot delete a default Sunday holiday. You can edit it instead.");
      return;
    }
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete events.");
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: "Delete Event",
      message: "Are you sure you want to delete this event?",
      onConfirm: async () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        try {
          await deleteSubDocument(schoolId, 'calendar', selectedEvent.id);
          toast.success("Event deleted!");
          setShowModal(false);
          setSelectedEvent(null);
          setNewEvent({ title: '', start: '', end: '', type: 'event', isCustomDates: false, customDates: [] });
          fetchEvents();
        } catch (error) {
          console.error("Error deleting event:", error);
          toast.error("Failed to delete event.");
        }
      }
    });
  };

  const handleSelectEvent = (event) => {
    if (!isAdmin) return;
    if (!hasEditPermission && !hasDeletePermission) return;
    setSelectedEvent(event);
    setNewEvent({
      title: event.title,
      start: event.start ? format(new Date(event.start), "yyyy-MM-dd") : '',
      end: event.end ? format(new Date(event.end), "yyyy-MM-dd") : '',
      type: event.type,
      isCustomDates: event.isCustomDates || false,
      customDates: event.customDates || []
    });
    setShowModal(true);
  };

  const openNewEventModal = () => {
    if (!hasCreatePermission) {
      toast.error("You do not have permission to create events.");
      return;
    }
    setSelectedEvent(null);
    setNewEvent({ title: '', start: '', end: '', type: 'event', isCustomDates: false, customDates: [] });
    setShowModal(true);
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden flex flex-col h-[700px]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <CalendarIcon className="text-primary-600" />
          Academic Calendar
        </h2>
        {isAdmin && hasCreatePermission && (
          <button 
            onClick={openNewEventModal}
            className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700 transition-colors flex items-center gap-2 text-sm"
          >
            <Plus size={16} /> Add Event
          </button>
        )}
      </div>

      <div className="flex-1">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={(newDate) => setCurrentDate(newDate)}
          onSelectEvent={handleSelectEvent}
          style={{ height: '100%' }}
          components={{
            toolbar: (toolbar) => {
              const goToBack = () => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() - 1);
                setCurrentDate(newDate);
              };
              const goToNext = () => {
                const newDate = new Date(currentDate);
                newDate.setMonth(newDate.getMonth() + 1);
                setCurrentDate(newDate);
              };
              const goToCurrent = () => {
                setCurrentDate(new Date());
              };

              return (
                <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <button onClick={goToBack} className="w-10 h-10 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"><LuChevronLeft size={20} /></button>
                    <span className="text-2xl font-black text-slate-900 dark:text-white min-w-[180px] text-center">{toolbar.label}</span>
                    <button onClick={goToNext} className="w-10 h-10 flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors shadow-sm"><LuChevronRight size={20} /></button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2 mr-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary-500"></div> Event</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500"></div> Holiday</span>
                      <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500"></div> Exam</span>
                    </div>
                    <button onClick={goToCurrent} className="px-5 py-2.5 bg-primary-50 text-primary-700 font-bold rounded-xl hover:bg-primary-100 dark:hover:bg-slate-700 transition-colors">Today</button>
                  </div>
                </div>
              );
            }
          }}
          eventPropGetter={(event) => {
            let backgroundColor = '#c99bc1'; // primary
            if (event.type === 'holiday') backgroundColor = '#ef4444'; // red
            if (event.type === 'exam') backgroundColor = '#f59e0b'; // amber
            return { style: { backgroundColor, borderRadius: '8px', border: 'none', color: '#fff' } };
          }}
        />
      </div>

      {showModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">{selectedEvent ? 'Edit Event' : 'Add New Event'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Event Title</label>
                <input 
                  type="text" required
                  value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                />
              </div>
              
              <div className="flex items-center gap-2 mt-4 mb-2">
                <input 
                  type="checkbox" 
                  id="customDatesToggle"
                  checked={newEvent.isCustomDates}
                  onChange={e => setNewEvent({...newEvent, isCustomDates: e.target.checked})}
                  className="w-4 h-4 text-primary-600 rounded border-slate-300 dark:border-slate-600 focus:ring-primary-500"
                />
                <label htmlFor="customDatesToggle" className="text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer">Add multiple custom dates</label>
              </div>

              {!newEvent.isCustomDates ? (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Start Date</label>
                    <input 
                      type="date" required={!newEvent.isCustomDates}
                      value={newEvent.start} onChange={e => setNewEvent({...newEvent, start: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">End Date</label>
                    <input 
                      type="date" required={!newEvent.isCustomDates}
                      value={newEvent.end} onChange={e => setNewEvent({...newEvent, end: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Select Dates</label>
                  <div className="flex gap-2">
                    <input 
                      type="date" 
                      id="customDateInput"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                    />
                    <button 
                      type="button"
                      onClick={() => {
                        const dateVal = document.getElementById('customDateInput').value;
                        if (dateVal && !newEvent.customDates.includes(dateVal)) {
                          setNewEvent({...newEvent, customDates: [...newEvent.customDates, dateVal].sort()});
                          document.getElementById('customDateInput').value = '';
                        }
                      }}
                      className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm border border-slate-200 dark:border-slate-700"
                    >
                      Add
                    </button>
                  </div>
                  {newEvent.customDates.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto custom-scrollbar p-1">
                      {newEvent.customDates.map((date, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-sm font-semibold rounded-lg shadow-sm">
                          {new Date(date).toLocaleDateString('en-GB')}
                          <button 
                            type="button"
                            onClick={() => setNewEvent({...newEvent, customDates: newEvent.customDates.filter(d => d !== date)})}
                            className="p-0.5 hover:bg-indigo-200 rounded-full transition-colors text-indigo-500 hover:text-indigo-800"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Event Type</label>
                <select 
                  value={newEvent.type} onChange={e => setNewEvent({...newEvent, type: e.target.value})}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="event">General Event</option>
                  <option value="holiday">Holiday</option>
                  <option value="exam">Examination</option>
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-100 dark:border-slate-800">
                {selectedEvent && (
                  <button 
                    type="button" onClick={handleDeleteEvent}
                    className="px-5 py-2.5 text-red-600 font-medium hover:bg-red-50 dark:hover:bg-slate-800 flex items-center gap-2 rounded-xl transition-colors mr-auto"
                  >
                    <Trash2 size={18} /> Delete
                  </button>
                )}
                <button 
                  type="button" onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 text-white font-bold hover:bg-primary-700 rounded-xl shadow-sm transition-colors"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        message={confirmModal.message}
        title={confirmModal.title}
      />
    </div>
  );
}
