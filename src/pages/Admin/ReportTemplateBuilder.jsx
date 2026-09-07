import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { saveTemplate, getTemplate } from '../../firebase/firestore';
import { LuSave, LuPalette, LuLayoutTemplate, LuType, LuEye, LuArrowLeft, LuSettings, LuCircleCheck } from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function ReportTemplateBuilder({ onBack }) {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Template State
  const [template, setTemplate] = useState({
    themeColor: '#c99bc1', // primary by default
    header: {
      showLogo: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      title: 'PROGRESS REPORT',
      subtitle: 'Academic Session 2024-2025'
    },
    studentFields: {
      admissionNo: true,
      dob: true,
      fatherName: true,
      motherName: true,
      attendance: true
    },
    grading: {
      style: 'marks_and_grades', // 'marks', 'grades', 'marks_and_grades'
      showTotal: true,
      showPercentage: true,
      showRank: false,
    },
    footer: {
      signatures: ['Class Teacher', 'Principal', 'Parent'],
      gradingScaleText: 'A1: 91-100 | A2: 81-90 | B1: 71-80 | B2: 61-70 | C1: 51-60 | C2: 41-50 | D: 33-40 | E: Below 33',
      remarks: true
    }
  });

  useEffect(() => {
    if (schoolId) {
      loadTemplate();
    }
  }, [schoolId]);

  const loadTemplate = async () => {
    try {
      const data = await getTemplate(schoolId, 'report_card');
      if (data) {
        setTemplate(data);
      }
    } catch (error) {
      console.error("Error loading template", error);
      toast.error("Failed to load existing template");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveTemplate(schoolId, 'report_card', template);
      toast.success("Report Card Template saved successfully!");
    } catch (error) {
      toast.error("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const updateHeader = (field, value) => setTemplate({...template, header: {...template.header, [field]: value}});
  const updateStudentFields = (field, value) => setTemplate({...template, studentFields: {...template.studentFields, [field]: value}});
  const updateGrading = (field, value) => setTemplate({...template, grading: {...template.grading, [field]: value}});
  const updateFooter = (field, value) => setTemplate({...template, footer: {...template.footer, [field]: value}});

  if (loading) {
    return <div className="p-8 flex justify-center items-center h-64"><div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto h-[calc(100vh-80px)] flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl transition-colors shadow-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <LuArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white">Template Builder</h1>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Design your school's official report card</p>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl shadow-md hover:bg-slate-800 transition-colors flex items-center gap-2"
        >
          {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <LuSave size={18} />}
          {saving ? 'Saving...' : 'Publish Template'}
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Left: Controls Panel */}
        <div className="w-1/3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-3xl shadow-sm overflow-y-auto custom-scrollbar flex flex-col">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <LuSettings className="text-primary-600" /> Configuration
            </h2>
          </div>
          
          <div className="p-6 space-y-8">
            
            {/* Global Settings */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LuPalette /> Global Theme
              </h3>
              <div className="flex items-center gap-3">
                <input 
                  type="color" 
                  value={template.themeColor} 
                  onChange={(e) => setTemplate({...template, themeColor: e.target.value})}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Primary Color ({template.themeColor})</span>
              </div>
            </div>

            {/* Header Configuration */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LuLayoutTemplate /> Header Settings
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-1">Report Title</label>
                  <input type="text" value={template.header.title} onChange={e => updateHeader('title', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-1">Subtitle / Session</label>
                  <input type="text" value={template.header.subtitle} onChange={e => updateHeader('subtitle', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500" />
                </div>
                <div className="pt-2 grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.header.showLogo} onChange={e => updateHeader('showLogo', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    School Logo
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.header.showAddress} onChange={e => updateHeader('showAddress', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    Address
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.header.showPhone} onChange={e => updateHeader('showPhone', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    Phone No.
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.header.showEmail} onChange={e => updateHeader('showEmail', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    Email
                  </label>
                </div>
              </div>
            </div>

            {/* Student Fields */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LuType /> Student Information
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {Object.keys(template.studentFields).map(key => (
                  <label key={key} className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.studentFields[key]} onChange={e => updateStudentFields(key, e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                ))}
              </div>
            </div>

            {/* Grading Display */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LuCircleCheck /> Academic Display
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-2">Grading Style</label>
                  <select value={template.grading.style} onChange={e => updateGrading('style', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500">
                    <option value="marks">Marks Only</option>
                    <option value="grades">Grades Only</option>
                    <option value="marks_and_grades">Marks & Grades</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.grading.showTotal} onChange={e => updateGrading('showTotal', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    Show Total
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                    <input type="checkbox" checked={template.grading.showPercentage} onChange={e => updateGrading('showPercentage', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                    Show Percentage
                  </label>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div>
              <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <LuLayoutTemplate /> Footer & Signatures
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-semibold text-slate-700 dark:text-slate-200 block mb-1">Grading Scale Text (Optional)</label>
                  <textarea 
                    value={template.footer.gradingScaleText} 
                    onChange={e => updateFooter('gradingScaleText', e.target.value)} 
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-primary-500 h-20"
                    placeholder="E.g., A1: 91-100 | A2: 81-90..."
                  />
                </div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer">
                  <input type="checkbox" checked={template.footer.remarks} onChange={e => updateFooter('remarks', e.target.checked)} className="rounded text-primary-600 focus:ring-primary-500 w-4 h-4" />
                  Show Teacher Remarks Area
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Right: Live Preview Pane */}
        <div className="w-2/3 bg-slate-200/50 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
          <div className="p-4 bg-slate-800 text-white flex items-center justify-between">
            <h2 className="font-bold flex items-center gap-2 text-sm"><LuEye /> Live PDF Preview</h2>
            <span className="text-xs font-medium text-slate-400 dark:text-slate-300 bg-slate-700 px-2 py-1 rounded">A4 Portrait</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 flex justify-center custom-scrollbar">
            {/* The A4 Paper representation */}
            <div className="bg-white dark:bg-slate-900 shadow-2xl w-full max-w-[794px] min-h-[1123px] flex flex-col" style={{ fontFamily: "'Times New Roman', serif" }}>
              
              {/* Report Card Header */}
              <div className="p-8 pb-4 flex items-center border-b-[3px]" style={{ borderColor: template.themeColor }}>
                {template.header.showLogo && (
                  <div className="w-24 h-24 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center border-2 shrink-0" style={{ borderColor: template.themeColor }}>
                    <span className="text-xs text-slate-400 dark:text-slate-300 font-sans font-bold">LOGO</span>
                  </div>
                )}
                <div className={`flex-1 ${template.header.showLogo ? 'text-center' : 'text-left'}`}>
                  <h1 className="text-3xl font-black uppercase text-slate-900 dark:text-white" style={{ color: template.themeColor }}>{userProfile?.schoolName || 'YOUR SCHOOL NAME'}</h1>
                  
                  <div className="text-sm mt-2 text-slate-700 dark:text-slate-200">
                    {template.header.showAddress && <span>123 Education Street, Learning City, 10001<br/></span>}
                    <span className="font-medium">
                      {template.header.showPhone && <span>Tel: +1 234 567 8900 </span>}
                      {template.header.showPhone && template.header.showEmail && <span> | </span>}
                      {template.header.showEmail && <span>Email: info@yourschool.edu</span>}
                    </span>
                  </div>
                </div>
              </div>

              {/* Title Section */}
              <div className="py-6 text-center">
                <h2 className="text-2xl font-bold uppercase underline decoration-2 underline-offset-4" style={{ decorationColor: template.themeColor }}>
                  {template.header.title}
                </h2>
                <p className="text-md font-semibold text-slate-600 dark:text-slate-300 mt-2">{template.header.subtitle}</p>
              </div>

              {/* Student Details Grid */}
              <div className="px-10 pb-8">
                <div className="grid grid-cols-2 gap-x-12 gap-y-3 p-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 font-sans">
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Student Name:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">John Doe</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Class & Section:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">10 - A</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                    <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Roll No:</span>
                    <span className="font-bold text-slate-900 dark:text-white text-sm">42</span>
                  </div>

                  {template.studentFields.admissionNo && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Admission No:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">SCH/2020/012</span>
                    </div>
                  )}
                  {template.studentFields.dob && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Date of Birth:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">15-Aug-2010</span>
                    </div>
                  )}
                  {template.studentFields.fatherName && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Father's Name:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">Richard Doe</span>
                    </div>
                  )}
                  {template.studentFields.motherName && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Mother's Name:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">Jane Doe</span>
                    </div>
                  )}
                  {template.studentFields.attendance && (
                    <div className="flex justify-between border-b border-slate-200 dark:border-slate-700 pb-1">
                      <span className="font-bold text-slate-600 dark:text-slate-300 text-sm">Attendance:</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">185 / 200</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Marks Table */}
              <div className="px-10 flex-1">
                <table className="w-full border-collapse font-sans text-sm">
                  <thead>
                    <tr className="text-white" style={{ backgroundColor: template.themeColor }}>
                      <th className="border border-slate-400 p-2 text-left w-1/2">Scholastic Area : Subjects</th>
                      <th className="border border-slate-400 p-2 text-center w-24">Max Marks</th>
                      {['marks', 'marks_and_grades'].includes(template.grading.style) && <th className="border border-slate-400 p-2 text-center">Marks Obt.</th>}
                      {['grades', 'marks_and_grades'].includes(template.grading.style) && <th className="border border-slate-400 p-2 text-center">Grade</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {['English', 'Mathematics', 'Science', 'Social Studies', 'Computer Science'].map((sub, i) => (
                      <tr key={sub} className={i % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'}>
                        <td className="border border-slate-400 p-2 font-medium">{sub}</td>
                        <td className="border border-slate-400 p-2 text-center">100</td>
                        {['marks', 'marks_and_grades'].includes(template.grading.style) && <td className="border border-slate-400 p-2 text-center font-bold text-slate-800 dark:text-slate-100">{85 + i}</td>}
                        {['grades', 'marks_and_grades'].includes(template.grading.style) && <td className="border border-slate-400 p-2 text-center font-bold text-slate-800 dark:text-slate-100">A2</td>}
                      </tr>
                    ))}
                    {/* Totals */}
                    {(template.grading.showTotal || template.grading.showPercentage) && (
                      <tr className="bg-slate-100 dark:bg-slate-700 font-bold">
                        <td className="border border-slate-400 p-2 text-right">TOTAL</td>
                        <td className="border border-slate-400 p-2 text-center">500</td>
                        {['marks', 'marks_and_grades'].includes(template.grading.style) && <td className="border border-slate-400 p-2 text-center text-primary-700" style={{ color: template.themeColor }}>435</td>}
                        {['grades', 'marks_and_grades'].includes(template.grading.style) && <td className="border border-slate-400 p-2 text-center text-primary-700" style={{ color: template.themeColor }}>A1</td>}
                      </tr>
                    )}
                  </tbody>
                </table>
                
                {template.grading.showPercentage && (
                  <div className="mt-4 text-right font-sans font-bold text-lg">
                    Percentage: <span style={{ color: template.themeColor }}>87.0%</span>
                  </div>
                )}
              </div>

              {/* Remarks Area */}
              {template.footer.remarks && (
                <div className="px-10 mt-8">
                  <div className="border-2 border-slate-300 dark:border-slate-600 p-4 rounded-xl min-h-[80px]">
                    <span className="font-bold text-sm text-slate-700 dark:text-slate-200 block mb-1">Class Teacher's Remarks:</span>
                    <span className="text-sm font-medium italic text-slate-500 dark:text-slate-400">John has shown excellent progress in mathematics. Keep up the good work!</span>
                  </div>
                </div>
              )}

              {/* Footer Section */}
              <div className="px-10 pt-16 pb-8 mt-auto flex flex-col font-sans">
                
                {/* Signatures */}
                <div className="flex justify-between w-full mb-8">
                  {template.footer.signatures.map((sig, index) => (
                    <div key={index} className="flex flex-col items-center">
                      <div className="w-32 border-b-2 border-slate-900 mb-2"></div>
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase">{sig}</span>
                    </div>
                  ))}
                </div>

                {/* Grading Scale */}
                {template.footer.gradingScaleText && (
                  <div className="border-t border-slate-300 dark:border-slate-600 pt-4 text-center">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block mb-1">Grading Scale</span>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      {template.footer.gradingScaleText}
                    </p>
                  </div>
                )}

              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
