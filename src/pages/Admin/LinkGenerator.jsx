import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { LuLink as LinkIcon, LuCopy as Copy, LuCircleCheck as CheckCircle2, LuMail as Mail, LuUsers as Users, LuGraduationCap as GraduationCap, LuSave as Save, LuSettings2 as Settings2, LuUserPlus as UserPlus, LuExternalLink as ExternalLink } from 'react-icons/lu';

export default function LinkGenerator() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [copiedLink, setCopiedLink] = useState(null);
  const [enabledFields, setEnabledFields] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const availableFields = [
    { name: 'employeeId', label: 'Employee ID', required: true },
    { name: 'phone', label: 'Phone Number', required: true },
    { name: 'department', label: 'Department', required: true }
  ];

  React.useEffect(() => {
    if (schoolId) {
      const fetchConfig = async () => {
        const docSnap = await getDoc(doc(db, 'schools', schoolId));
        if (docSnap.exists()) {
          const config = docSnap.data().staffFormConfig || [];
          setEnabledFields(config.map(c => c.name));
        }
      };
      fetchConfig();
    }
  }, [schoolId]);

  const toggleField = (fieldName) => {
    setEnabledFields(prev => 
      prev.includes(fieldName) ? prev.filter(f => f !== fieldName) : [...prev, fieldName]
    );
  };

  const saveFormConfig = async () => {
    setIsSaving(true);
    try {
      const configToSave = availableFields.filter(f => enabledFields.includes(f.name));
      await updateDoc(doc(db, 'schools', schoolId), {
        staffFormConfig: configToSave
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Error saving config", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getBaseUrl = () => {
    return window.location.origin;
  };

  const links = [
    {
      id: 'admission',
      title: 'Online Admission Application Form Link',
      description: 'Share this public link with prospective students and parents. Submitted applications arrive in your Student Directory under "Admission Applications" for approval and admission.',
      url: `${getBaseUrl()}/admission/${schoolId}`,
      icon: UserPlus,
      color: 'emerald'
    },
    {
      id: 'teacher',
      title: 'Teacher Registration Link',
      description: 'Send this link to your faculty. They will be able to create an account and join your school workspace as a teacher.',
      url: `${getBaseUrl()}/register/teacher/${schoolId}`,
      icon: Users,
      color: 'blue'
    },
    {
      id: 'parent',
      title: 'Parent Portal Link',
      description: 'Send this link to parents. They will need their child\'s Admission Number to successfully link their account.',
      url: `${getBaseUrl()}/register/parent/${schoolId}`,
      icon: GraduationCap,
      color: 'amber'
    }
  ];

  const handleCopy = (id, url) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 3000);
  };

  const handleEmailShare = (url, title) => {
    const subject = encodeURIComponent(`Invitation to join School - ${title}`);
    const body = encodeURIComponent(`Please use the following link to register your account:\n\n${url}`);
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (!schoolId) {
    return (
      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
        School context not found.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto w-full overflow-hidden">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Generate Access Links</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-lg">Easily onboard your teachers and parents by sharing these unique registration links.</p>
      </div>

      <div className="space-y-6">
        {links.map((link) => (
          <div key={link.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-5 md:p-8 flex flex-col md:flex-row gap-5 md:gap-8 items-start w-full overflow-hidden">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
              link.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : link.color === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <link.icon size={32} />
            </div>

            <div className="flex-1 min-w-0 w-full">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 break-words">{link.title}</h2>
              <p className="text-slate-600 dark:text-slate-300 mb-6">{link.description}</p>
              
              <div className="flex flex-col lg:flex-row gap-3 w-full">
                <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 font-mono text-sm text-slate-700 dark:text-slate-200 overflow-hidden relative min-w-0">
                  <LinkIcon size={16} className="text-slate-400 dark:text-slate-300 shrink-0 mr-3" />
                  <span className="truncate block flex-1 min-w-0">{link.url}</span>
                </div>
                
                <div className="flex gap-2 shrink-0 w-full lg:w-auto">
                  <button 
                    onClick={() => handleCopy(link.id, link.url)}
                    className={`flex-1 lg:flex-none justify-center px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all ${
                      copiedLink === link.id 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-primary-600 text-white hover:bg-primary-700 shadow-sm'
                    }`}
                  >
                    {copiedLink === link.id ? (
                      <><CheckCircle2 size={18} /> Copied!</>
                    ) : (
                      <><Copy size={18} /> Copy Link</>
                    )}
                  </button>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors flex items-center justify-center"
                    title="Open Link in New Tab"
                  >
                    <ExternalLink size={20} />
                  </a>
                  <button 
                    onClick={() => handleEmailShare(link.url, link.title)}
                    className="p-3 text-slate-500 dark:text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl transition-colors"
                    title="Share via Email"
                  >
                    <Mail size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 md:p-8 shadow-sm w-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
          <div className="w-12 h-12 shrink-0 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
            <Settings2 size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white break-words">Customize Staff Registration Form</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Select which additional fields should appear on the teacher registration form.</p>
          </div>
        </div>

        <div className="space-y-4 mb-8 w-full">
          {availableFields.map(field => (
            <div key={field.name} className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-700 dark:text-slate-200 truncate">{field.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug">Require teachers to provide their {field.label.toLowerCase()} during registration.</p>
              </div>
              <button 
                onClick={() => toggleField(field.name)}
                className={`w-12 h-6 rounded-full transition-colors relative ${enabledFields.includes(field.name) ? 'bg-primary-500' : 'bg-slate-200 dark:bg-slate-700'}`}
              >
                <div className={`w-4 h-4 bg-white dark:bg-slate-900 rounded-full absolute top-1 transition-transform ${enabledFields.includes(field.name) ? 'translate-x-7' : 'translate-x-1'}`}></div>
              </button>
            </div>
          ))}
        </div>

        <div className="flex justify-end w-full">
          <button
            onClick={saveFormConfig}
            disabled={isSaving}
            className="w-full sm:w-auto justify-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold flex items-center gap-2 transition-colors disabled:opacity-70"
          >
            {isSaving ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : saveSuccess ? (
              <><CheckCircle2 size={18} /> Saved successfully!</>
            ) : (
              <><Save size={18} /> Save Form Configuration</>
            )}
          </button>
        </div>
      </div>

      <div className="mt-8 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-sm text-slate-600 dark:text-slate-300">
        <h4 className="font-bold text-slate-900 dark:text-white mb-2">Security Notice</h4>
        <p>These links are specific to your school environment. Anyone with these links can attempt to register. Teacher accounts will automatically be added to your Staff Directory, while Parent accounts require a valid Admission Number to link to student records. All forms are protected by Captcha verification.</p>
      </div>
    </div>
  );
}
