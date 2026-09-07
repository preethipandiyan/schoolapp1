import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/config';
import { LuCircleCheck } from 'react-icons/lu';

export default function PublicLeadForm() {
  const { schoolId, formId } = useParams();
  const [formSchema, setFormSchema] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    const fetchFormSchema = async () => {
      try {
        if (!schoolId || !formId) {
          setError('Invalid form link parameters.');
          setLoading(false);
          return;
        }

        const docRef = doc(db, `schools/${schoolId}/leadForms`, formId);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          setFormSchema(snap.data());
          // Set initial form states
          const initial = {};
          (snap.data().fields || []).forEach(f => {
            initial[f.id] = f.type === 'checkbox' ? [] : '';
          });
          setFormData(initial);
        } else {
          setError('Form not found or has been disabled.');
        }
      } catch (err) {
        console.error(err);
        setError('Failed to load form schema.');
      } finally {
        setLoading(false);
      }
    };

    fetchFormSchema();
  }, [schoolId, formId]);

  const handleInputChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleCheckboxChange = (fieldId, option, checked) => {
    setFormData(prev => {
      const current = prev[fieldId] || [];
      if (checked) {
        return { ...prev, [fieldId]: [...current, option] };
      } else {
        return { ...prev, [fieldId]: current.filter(o => o !== option) };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    if (!schoolId || !formId || !formSchema) return;

    setSubmitting(true);
    try {
      // Validate required fields
      const missing = [];
      (formSchema.fields || []).forEach(f => {
        if (f.required) {
          const val = formData[f.id];
          if (f.type === 'checkbox') {
            if (!val || val.length === 0) missing.push(f.label);
          } else {
            if (!val || val.toString().trim() === '') missing.push(f.label);
          }
        }
      });

      if (missing.length > 0) {
        setSubmitError(`Please fill in required fields: ${missing.join(', ')}`);
        setSubmitting(false);
        return;
      }

      // Add document to Firestore leads
      const leadsRef = collection(db, `schools/${schoolId}/leads`);
      await addDoc(leadsRef, {
        formId,
        formTitle: formSchema.title || 'Untitled Form',
        data: formData,
        status: 'Cold', // Default lead status
        submittedAt: new Date().toISOString()
      });

      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitError('Error submitting form: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex justify-center items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex justify-center items-center p-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-800">
          <div className="text-red-500 font-bold text-lg mb-2">Error</div>
          <p className="text-slate-600 dark:text-slate-300 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex justify-center items-center p-4 font-sans">
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 max-w-md w-full text-center border border-slate-100 dark:border-slate-800 animate-scale-in">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500">
              <LuCircleCheck size={40} />
            </div>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Thank You!</h2>
          <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed mb-6">
            {formSchema.successMessage || 'Your enquiry has been successfully submitted. We will get back to you shortly.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 py-12 px-4 font-sans">
      <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800">
        <div className="bg-gradient-to-br from-primary-600 to-indigo-700 p-8 text-white">
          <h1 className="text-3xl font-black">{formSchema.title || 'Enquiry Form'}</h1>
          {formSchema.description && (
            <p className="text-white/80 text-sm mt-2 leading-relaxed">{formSchema.description}</p>
          )}
        </div>
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-sm font-semibold text-red-600 animate-fade-in-up">
              {submitError}
            </div>
          )}
          {(formSchema.fields || []).map(f => {
            const isReq = f.required;
            return (
              <div key={f.id} className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-200">
                  {f.label} {isReq && <span className="text-red-500">*</span>}
                </label>

                {f.type === 'text' && (
                  <input
                    type="text"
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'number' && (
                  <input
                    type="number"
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'email' && (
                  <input
                    type="email"
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'phone' && (
                  <input
                    type="tel"
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'date' && (
                  <input
                    type="date"
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'textarea' && (
                  <textarea
                    required={isReq}
                    rows={4}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  />
                )}

                {f.type === 'dropdown' && (
                  <select
                    required={isReq}
                    value={formData[f.id] || ''}
                    onChange={(e) => handleInputChange(f.id, e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow text-sm"
                  >
                    <option value="">Select option</option>
                    {(f.options || []).map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                )}

                {f.type === 'radio' && (
                  <div className="flex flex-col gap-2 mt-1">
                    {(f.options || []).map(opt => (
                      <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name={f.id}
                          required={isReq && !formData[f.id]}
                          checked={formData[f.id] === opt}
                          onChange={() => handleInputChange(f.id, opt)}
                          className="text-primary-600 focus:ring-primary-500"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {f.type === 'checkbox' && (
                  <div className="flex flex-col gap-2 mt-1">
                    {(f.options || []).map(opt => {
                      const checked = (formData[f.id] || []).includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => handleCheckboxChange(f.id, opt, e.target.checked)}
                            className="text-primary-600 focus:ring-primary-500 rounded"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 disabled:opacity-50 transition-colors shadow-md shadow-primary-600/10 cursor-pointer text-sm"
            >
              {submitting ? 'Submitting...' : 'Submit Form'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
