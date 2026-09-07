import React, { useState, useEffect } from 'react';
import { LuSave, LuRefreshCw, LuMail, LuCode } from 'react-icons/lu';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { db } from '../../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';

const TEMPLATES = [
  {
    id: 'welcome',
    name: 'Welcome Email',
    description: 'Sent when a new user account is created.',
    variables: ['{{userName}}', '{{role}}', '{{loginUrl}}']
  },
  {
    id: 'forgotPassword',
    name: 'Forgot Password',
    description: 'Sent when a user requests a password reset.',
    variables: ['{{resetLink}}']
  },
  {
    id: 'approval',
    name: 'School Approval',
    description: 'Sent to a School Admin when their registration is approved.',
    variables: ['{{schoolName}}', '{{dashboardLink}}']
  }
];

// Default fallback templates for initialization if none exist
const DEFAULT_TEMPLATES = {
  welcomeSubject: 'Welcome to Acme School',
  welcomeHtml: `<h2>Hello {{userName}},</h2>
<p>Your account has been successfully created as a <strong>{{role}}</strong>.</p>
<p>Click the link below to access your dashboard:</p>
<p><a href="{{loginUrl}}" target="_blank">Login to Dashboard</a></p>`,

  forgotPasswordSubject: 'Password Reset Request',
  forgotPasswordHtml: `<p>We received a request to reset your password.</p>
<p>Click the link below to securely reset your password:</p>
<p><a href="{{resetLink}}" target="_blank">Reset Password</a></p>
<p>This link will expire in 24 hours.</p>`,

  approvalSubject: 'Your School Account is Approved!',
  approvalHtml: `<h2>Congratulations, {{schoolName}}!</h2>
<p>Your registration for the School Management System has been approved by the Super Admin.</p>
<p>You can now log in and start configuring your environment.</p>
<p><a href="{{dashboardLink}}" target="_blank">Go to Dashboard</a></p>`
};

export default function EmailTemplates() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_TEMPLATES);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const docRef = doc(db, 'settings', 'emailTemplates');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setFormData(docSnap.data());
      } else {
        // Initialize if doesn't exist
        await setDoc(docRef, DEFAULT_TEMPLATES);
        setFormData(DEFAULT_TEMPLATES);
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Failed to load templates.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'emailTemplates'), formData);
      toast.success("Templates saved successfully!");
    } catch (error) {
      console.error("Error saving templates:", error);
      toast.error("Failed to save templates.");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const activeTemplate = TEMPLATES.find(t => t.id === activeTab);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LuRefreshCw className="animate-spin text-primary-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Email Templates</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Customize automated emails sent from the system.</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-primary-600 text-white font-bold rounded-xl hover:bg-primary-700 shadow-md shadow-primary-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <LuRefreshCw className="animate-spin" /> : <LuSave />}
          Save Changes
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Sidebar Tabs */}
        <div className="w-full lg:w-64 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-2">
          {TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => setActiveTab(template.id)}
              className={`w-full text-left px-4 py-3 rounded-xl font-bold transition-colors flex items-center gap-3 ${
                activeTab === template.id 
                  ? 'bg-primary-50 text-primary-700 border border-primary-200' 
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-transparent'
              }`}
            >
              <LuMail size={18} className={activeTab === template.id ? 'text-primary-500' : 'text-slate-400 dark:text-slate-300'} />
              {template.name}
            </button>
          ))}
        </div>

        {/* Editor Area */}
        <div className="flex-1 p-6 flex flex-col min-h-0 overflow-y-auto">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{activeTemplate.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{activeTemplate.description}</p>
          </div>

          <div className="space-y-6 flex-1 flex flex-col min-h-0">
            <div>
              <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Email Subject Line</label>
              <input 
                type="text" 
                value={formData[`${activeTab}Subject`] || ''}
                onChange={(e) => handleChange(`${activeTab}Subject`, e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
                placeholder="e.g. Welcome to Acme School"
              />
            </div>

            <div className="flex-1 flex flex-col min-h-[300px]">
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <LuCode className="text-slate-400 dark:text-slate-300" /> HTML Content
                </label>
                <div className="flex gap-2">
                  {activeTemplate.variables.map(v => (
                    <span key={v} className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-mono rounded border border-slate-200 dark:border-slate-700 cursor-help" title="Available Variable">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl overflow-hidden [&_.ql-container]:!border-slate-200 [&_.ql-container]:!rounded-b-xl [&_.ql-container]:!font-sans [&_.ql-editor]:!min-h-[250px] [&_.ql-editor]:!text-base [&_.ql-toolbar]:!border-slate-200 [&_.ql-toolbar]:!rounded-t-xl [&_.ql-toolbar]:!bg-slate-50">
                <ReactQuill
                  theme="snow"
                  value={formData[`${activeTab}Html`] || ''}
                  onChange={(content) => handleChange(`${activeTab}Html`, content)}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      ['link', 'clean']
                    ],
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
