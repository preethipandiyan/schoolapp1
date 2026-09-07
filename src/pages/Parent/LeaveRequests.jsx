import React, { useState, useEffect } from 'react';
import { LuPlus, LuCalendar, LuFileText, LuClock, LuCircleCheck, LuCircleX, LuFolderDown, LuX, LuDownload } from 'react-icons/lu';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection, addSubDocument } from '../../firebase/firestore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { uploadFileToCloudinaryOrFirebase } from '../../utils/cloudinary';
import toast from 'react-hot-toast';

export default function LeaveRequests() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const linkedStudentId = userProfile?.linkedStudentId;

  const [studentName, setStudentName] = useState('Student');
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    leaveType: 'sick',
    customType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });

  // Fetch Linked Student Name
  useEffect(() => {
    if (!schoolId || !linkedStudentId) return;

    getDoc(doc(db, `schools/${schoolId}/students`, linkedStudentId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setStudentName(`${data.firstName} ${data.lastName}`);
      }
    });
  }, [schoolId, linkedStudentId]);

  // Subscribe to student's leave requests
  useEffect(() => {
    if (!schoolId || !linkedStudentId) return;

    setLoading(true);
    const unsub = subscribeToSubCollection(schoolId, 'leaves', (data) => {
      // Filter for this student's requests and sort by submittedAt descending
      const myStudentLeaves = data
        .filter(l => l.applicantId === linkedStudentId)
        .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
      setLeaves(myStudentLeaves);
      setLoading(false);
    });

    return () => {
      if (unsub) unsub();
    };
  }, [schoolId, linkedStudentId]);

  const handleOpenModal = () => {
    setFormData({
      leaveType: 'sick',
      customType: '',
      startDate: '',
      endDate: '',
      reason: ''
    });
    setSelectedFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.startDate || !formData.endDate || !formData.reason) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (formData.leaveType === 'others' && !formData.customType) {
      toast.error("Please specify custom leave type.");
      return;
    }

    setSubmitting(true);
    try {
      let finalLeaveType = formData.leaveType;
      if (formData.leaveType === 'others') {
        finalLeaveType = formData.customType;
      } else {
        finalLeaveType = 'Sick Leave';
      }

      let docInfo = null;
      if (selectedFile) {
        const storagePath = `schools/${schoolId}/leaves/${linkedStudentId}_${Date.now()}_${selectedFile.name}`;
        const uploadUrl = await uploadFileToCloudinaryOrFirebase(selectedFile, schoolId, storagePath);
        docInfo = {
          name: selectedFile.name,
          size: selectedFile.size > 1024 * 1024 ? (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB' : (selectedFile.size / 1024).toFixed(0) + ' KB',
          url: uploadUrl
        };
      }

      const leaveData = {
        applicantId: linkedStudentId,
        applicantName: studentName,
        applicantRole: 'student',
        leaveType: finalLeaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason,
        status: 'Pending',
        submittedAt: new Date().toISOString(),
        supportingDoc: docInfo
      };

      await addSubDocument(schoolId, 'leaves', leaveData);
      toast.success("Leave request submitted successfully!");
      setShowModal(false);
    } catch (error) {
      console.error(error);
      toast.error("Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Approved': return <span className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold"><LuCircleCheck size={14} /> Approved</span>;
      case 'Rejected': return <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 rounded-full text-xs font-bold"><LuCircleX size={14} /> Rejected</span>;
      default: return <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-bold animate-pulse"><LuClock size={14} /> Pending</span>;
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto h-full flex flex-col animate-fade-in-up min-w-0 w-full">
      {/* Header */}
      <div className="mb-8 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 min-w-0 w-full">
        <div className="min-w-0 w-full">
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate">Student Leave Requests</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Submit leaves on behalf of {studentName} and track approval status.</p>
        </div>
        <button 
          onClick={handleOpenModal}
          className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <LuPlus size={18} /> Submit Student Leave
        </button>
      </div>

      {/* Main Request History Box */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden min-w-0 w-full">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between shrink-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-lg">Leave History</h3>
          <span className="text-xs text-slate-400 dark:text-slate-300 font-semibold">{leaves.length} Applications</span>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {leaves.map(leave => (
                <div key={leave.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 hover:border-primary-350 hover:shadow-md transition-all flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-start mb-4 gap-2">
                      <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-extrabold uppercase tracking-wide">
                        {leave.leaveType}
                      </span>
                      {getStatusBadge(leave.status)}
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-bold text-slate-400 dark:text-slate-300 flex items-center gap-2">
                        <LuCalendar size={14} className="text-slate-400 dark:text-slate-300" />
                        {new Date(leave.startDate).toLocaleDateString('en-GB')} — {new Date(leave.endDate).toLocaleDateString('en-GB')}
                      </p>
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-relaxed line-clamp-3">
                        "{leave.reason}"
                      </h4>
                    </div>
                  </div>

                  {leave.supportingDoc && (
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 overflow-hidden mr-2">
                        <span className="truncate max-w-[120px]">{leave.supportingDoc.name}</span>
                        <span className="text-slate-400 dark:text-slate-300 shrink-0">({leave.supportingDoc.size})</span>
                      </div>
                      <a
                        href={leave.supportingDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                          if (!leave.supportingDoc.url || leave.supportingDoc.url === '#') {
                            e.preventDefault();
                            toast.error("Document URL is invalid or not available.");
                          }
                        }}
                        className="text-primary-600 hover:text-primary-800 font-bold hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        <LuDownload size={12} />
                        Download
                      </a>
                    </div>
                  )}
                </div>
              ))}

              {leaves.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 dark:text-slate-400">
                  <LuCalendar size={48} className="mx-auto mb-4 text-slate-300" />
                  <p className="text-lg font-medium text-slate-700 dark:text-slate-200">No leave requests submitted yet.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <form 
            onSubmit={handleSubmit}
            className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden transform transition-all flex flex-col max-h-[90vh]"
          >
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Request Leave on Behalf of Student</h3>
              <button 
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 rounded-xl transition-colors"
              >
                <LuX size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Leave Type</label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="others">Others</option>
                </select>
              </div>

              {formData.leaveType === 'others' && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Specify Leave Type</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Travel / Family Function"
                    value={formData.customType}
                    onChange={(e) => setFormData({ ...formData, customType: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Start Date</label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">End Date</label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Reason for Leave</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Explain why the student requires leave..."
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm font-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Supporting Document (Optional)</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 dark:border-slate-700 border-dashed rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer relative group">
                  <div className="space-y-1 text-center">
                    <LuFolderDown className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-300 group-hover:text-primary-500 transition-colors" />
                    <div className="flex text-sm text-slate-600 dark:text-slate-300 justify-center">
                      <label className="relative cursor-pointer bg-white dark:bg-slate-900 rounded-md font-bold text-primary-600 hover:text-primary-700 focus-within:outline-none">
                        <span>{selectedFile ? 'Change file' : 'Select a file'}</span>
                        <input 
                          type="file" 
                          className="sr-only" 
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              if (file.size > 3145728 && !file.type.startsWith('audio/')) {
                                toast.error(`File "${file.name}" exceeds the 3MB size limit.`);
                                e.target.value = '';
                                return;
                              }
                              setSelectedFile(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">PDF, PNG, JPG up to 3MB</p>
                    {selectedFile && (
                      <div className="mt-2 p-2 bg-slate-100/80 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between gap-3">
                        <span className="truncate max-w-[200px]">{selectedFile.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 shrink-0">({selectedFile.size > 1024 * 1024 ? (selectedFile.size / (1024 * 1024)).toFixed(1) + ' MB' : (selectedFile.size / 1024).toFixed(0) + ' KB'})</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
