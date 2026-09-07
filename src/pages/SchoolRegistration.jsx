import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { LuCheck as Check, LuShieldCheck as ShieldCheck, LuArrowRight as ArrowRight, LuArrowLeft as ArrowLeft, LuBuilding2, LuUser, LuCreditCard, LuFileText, LuCalculator, LuEye, LuEyeOff } from 'react-icons/lu';
import { FiLoader as Loader } from 'react-icons/fi';
import { createSchool, getPlans, generateSchoolId } from '../firebase/firestore';
import { registerUser } from '../firebase/auth';
import { doc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function SchoolRegistration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reducedMotion = useReducedMotion();
  const selectedPlanId = searchParams.get('plan') || 'free';

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [calculatorError, setCalculatorError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Plans data
  const [plans, setPlans] = useState([]);
  const [selectedPlanDetails, setSelectedPlanDetails] = useState(null);

  // Form Data
  const [formData, setFormData] = useState({
    schoolName: '',
    schoolType: 'School',
    location: '',
    studentCount: '0-500',
    userCount: 100,
    billingCycle: 'monthly',
    adminName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    termsAccepted: false,
    udise: '',
    boardAffiliation: ''
  });

  const [files, setFiles] = useState({
    regCertFile: null,
    panFile: null
  });

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const fetchedPlans = await getPlans();
        setPlans(fetchedPlans);
        const plan = fetchedPlans.find(p => p.id === selectedPlanId) || fetchedPlans[0];
        setSelectedPlanDetails(plan);
      } catch (err) {
        console.error("Error fetching plans", err);
      }
    };
    fetchPlans();
  }, [selectedPlanId]);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
    if (error) setError(null);
  };

  const handleFileChange = (e, name) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 3145728 && !file.type.startsWith('audio/')) {
        toast.error(`File "${file.name}" exceeds the 3MB size limit.`);
        e.target.value = '';
        return;
      }
      setFiles({ ...files, [name]: file });
    }
  };

  const validateStep1 = () => {
    if (!formData.schoolName || !formData.location || !formData.studentCount) {
      setError("Please fill in all required fields.");
      return false;
    }
    if (!files.regCertFile || !files.panFile) {
      setError("Please upload both Registration Certificate and PAN Card.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!formData.adminName || !formData.email || !formData.phone || !formData.password) {
      setError("Please fill in all required fields.");
      return false;
    }

    // Indian Phone Number Validation (10 digits starting with 6-9, optional +91 or 0)
    const cleanPhone = formData.phone.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^(?:\+?91|0)?[1-9]\d{9}$/;
    if (!phoneRegex.test(cleanPhone)) {
      setError("Please enter a valid Indian phone number.");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      return false;
    }
    
    // Strong Password Validation: Min 8 chars, mixed case, numbers, special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(formData.password)) {
      setError("Password must be at least 8 characters and include uppercase, lowercase, number, and special character.");
      return false;
    }
    
    return true;
  };

  const validateStep3 = () => {
    if (!formData.termsAccepted) {
      setError("You must accept the terms and conditions.");
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && isCalculatorInvalid) return;
    if (step === 2 && !validateStep1()) return;
    if (step === 3 && !validateStep2()) return;
    setError(null);
    setStep(prev => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setError(null);
    setStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep3()) return;

    setLoading(true);
    setError(null);

    try {
      // Mock File Uploads for now to avoid CORS storage issues
      let regCertUrl = 'https://via.placeholder.com/150?text=RegCert';
      let panUrl = 'https://via.placeholder.com/150?text=PAN';

      // 1. Create Auth User first so we are authenticated
      const user = await registerUser(formData.email, formData.password, 'admin', { 
        name: formData.adminName,
        schoolId: '' 
      });
      
      // 2. Now generate the school ID (authenticated)
      const newSchoolId = await generateSchoolId();
      
      // 3. Update the user profile with the generated school ID
      await updateDoc(doc(db, "users", user.uid), {
        schoolId: newSchoolId
      });

      // 4. Create School Document with status 'pending'
      await createSchool({
        name: formData.schoolName,
        schoolName: formData.schoolName,
        schoolType: formData.schoolType,
        studentCount: formData.studentCount,
        adminId: user.uid,
        ownerId: user.uid, 
        adminEmail: formData.email,
        contactEmail: formData.email,
        contactPhone: formData.phone,
        phone: formData.phone,
        location: formData.location,
        plan: selectedPlanDetails?.id || 'free',
        billingCycle: formData.billingCycle,
        calculatedUserCount: numUsers,
        calculatedTotalAmount: totalAmount,
        verificationDetails: {
          udise: formData.udise,
          boardAffiliation: formData.boardAffiliation,
          regCertUrl,
          panUrl
        }
      }, newSchoolId);

      // 3. Redirect to pending/success
      navigate('/admin/pending');
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError("This email is already in use.");
      } else {
        setError("Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Password Strength Simple Indicator
  const getPasswordStrength = (pass) => {
    if (!pass) return 0;
    let score = 0;
    if (pass.length > 6) score += 33;
    if (/[A-Z]/.test(pass)) score += 33;
    if (/[0-9!@#$]/.test(pass)) score += 34;
    return score;
  };

  const strength = getPasswordStrength(formData.password);

  const steps = [
    { num: 1, title: 'Calculator', icon: LuCalculator },
    { num: 2, title: 'School Info', icon: LuBuilding2 },
    { num: 3, title: 'Admin Account', icon: LuUser },
    { num: 4, title: 'Confirmation', icon: LuCreditCard }
  ];

  // Pricing calculations
  const pricePerUserPerMonth = 26;
  const yearlyDiscountRate = 0.10; // 10%
  const numUsers = parseInt(formData.userCount, 10) || 0;
  const isCalculatorInvalid = numUsers <= 0 || calculatorError !== '';

  const monthlyPrice = numUsers * pricePerUserPerMonth;
  const yearlyPriceWithoutDiscount = numUsers * pricePerUserPerMonth * 12;
  const yearlyDiscount = yearlyPriceWithoutDiscount * yearlyDiscountRate;
  const yearlyPrice = yearlyPriceWithoutDiscount - yearlyDiscount;

  const totalAmount = formData.billingCycle === 'monthly' ? monthlyPrice : yearlyPrice;
  const pricePeriod = formData.billingCycle === 'monthly' ? 'month' : 'year';

  const formatIndianCurrency = (amount) => {
    return '₹' + Math.round(amount).toLocaleString('en-IN');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-sans selection:bg-primary-500 selection:text-white flex flex-col items-center justify-center relative overflow-x-hidden px-4 py-12">
      
      {/* Decorative background blobs */}
      <div className="absolute top-0 right-0 w-96 h-96 lg:w-[500px] lg:h-[500px] bg-primary-200 rounded-full blur-[150px] opacity-40 pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 lg:w-[500px] lg:h-[500px] bg-primary-300 rounded-full blur-[150px] opacity-30 pointer-events-none"></div>

      <div className="w-full max-w-2xl relative z-10">
        
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Link to="/" className="inline-flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-primary-500 rounded-lg p-1">
            <img src="/logo.png" alt="School Logo" className="w-auto h-12 object-contain group-hover:scale-105 transition-transform drop-shadow-sm filter invert" />
          </Link>
        </div>

        {/* Stepper */}
        <div className="mb-10 px-4">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-full -z-10"></div>
            <motion.div 
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-gradient-to-r from-primary-600 to-primary-500 rounded-full -z-10"
              initial={{ width: '0%' }}
              animate={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
              transition={{ duration: 0.4, ease: "easeInOut" }}
            />
            {steps.map((s) => (
              <div key={s.num} className="flex flex-col items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors duration-300 ${
                  step >= s.num ? 'bg-primary-500 text-white shadow-[0_4px_14px_rgba(229,189,223,0.4)]' : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}>
                  {step > s.num ? <Check size={20} /> : <s.icon size={20} />}
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${step >= s.num ? 'text-primary-600' : 'text-slate-500 dark:text-slate-400'}`}>
                  {s.title}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <motion.div 
          initial={{ opacity: 0, y: reducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="bg-white/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-[40px] p-8 sm:p-12 overflow-hidden relative"
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: reducedMotion ? 0 : 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: reducedMotion ? 0 : -20 }}
              transition={{ duration: 0.3 }}
            >
              <h2 className="text-3xl font-black mb-2 text-slate-900 dark:text-white">{steps[step-1].title}</h2>
              <p className="text-slate-500 dark:text-slate-400 mb-8">
                {step === 1 && "Calculate your pricing based on the expected number of users."}
                {step === 2 && "Tell us about your institution to get started."}
                {step === 3 && "Create the primary owner account for this workspace."}
                {step === 4 && "Review your selected plan and accept our terms."}
              </p>

              <div className="space-y-6">
                {/* --- STEP 1: Pricing Calculator --- */}
                {step === 1 && (
                  <>
                    {/* Billing Cycle Toggle */}
                    <div className="flex justify-center mb-6">
                      <div className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-700 p-1.5 rounded-full flex gap-1 relative">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, billingCycle: 'monthly' })}
                          className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 ${
                            formData.billingCycle === 'monthly'
                              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                          }`}
                        >
                          Monthly
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, billingCycle: 'yearly' })}
                          className={`px-6 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 transition-all duration-300 ${
                            formData.billingCycle === 'yearly'
                              ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100'
                          }`}
                        >
                          Yearly
                          <span className="text-[10px] bg-primary-500 text-white px-2 py-0.5 rounded-full font-extrabold uppercase">
                            Save 10%
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Input Section */}
                    <div className="mb-6">
                      <label htmlFor="user-count-input" className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                        Number of Users (Students + Staff) *
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-4 text-slate-400 dark:text-slate-300 pointer-events-none">
                          <LuCalculator size={20} />
                        </div>
                        <input
                          id="user-count-input"
                          type="number"
                          min="1"
                          step="1"
                          value={formData.userCount}
                          onKeyDown={(e) => {
                            if (e.key === '.' || e.key === '-' || e.key === '+' || e.key === 'e') {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              setFormData({ ...formData, userCount: '' });
                              setCalculatorError('Please enter the number of users.');
                              return;
                            }
                            const num = parseInt(val, 10);
                            if (isNaN(num)) {
                              setCalculatorError('Please enter a valid number.');
                              setFormData({ ...formData, userCount: val });
                              return;
                            }
                            if (num <= 0) {
                              setCalculatorError('Number of users must be at least 1.');
                              setFormData({ ...formData, userCount: num });
                              return;
                            }
                            setCalculatorError('');
                            
                            // Automatically map userCount to studentCount range
                            let range = '';
                            if (num <= 500) range = '0-500';
                            else if (num <= 1000) range = '501-1000';
                            else if (num <= 5000) range = '1001-5000';
                            else range = '5000+';

                            setFormData({ ...formData, userCount: num, studentCount: range });
                          }}
                          placeholder="e.g. 500"
                          className={`w-full pl-12 pr-4 py-4 rounded-xl bg-white dark:bg-slate-900 border ${
                            calculatorError ? 'border-red-400 focus:ring-red-400' : 'border-slate-200 dark:border-slate-700 focus:ring-primary-500'
                          } focus:ring-2 focus:border-transparent transition-all outline-none text-xl font-bold text-slate-900 dark:text-white placeholder-slate-300`}
                        />
                      </div>
                      {calculatorError && (
                        <p className="text-red-500 text-xs font-semibold mt-2 flex items-center gap-1">
                          <span>●</span> {calculatorError}
                        </p>
                      )}
                    </div>

                    {/* Output Display Area */}
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 relative overflow-hidden mb-2">
                      <div className="space-y-3.5 mb-5 text-sm text-slate-500 dark:text-slate-400">
                        <div className="flex justify-between items-center">
                          <span>Number of Users:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">
                            {isCalculatorInvalid ? '-' : numUsers.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Base Rate:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-100">₹26 / user / month</span>
                        </div>
                        {formData.billingCycle === 'yearly' && !isCalculatorInvalid && (
                          <div className="flex justify-between items-center text-primary-600">
                            <span>Yearly Discount (10%):</span>
                            <span>- {formatIndianCurrency(yearlyDiscount)} / year</span>
                          </div>
                        )}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3.5 flex justify-between items-end">
                          <span className="font-bold text-slate-800 dark:text-slate-100">Total Amount:</span>
                          <div className="text-right">
                            <span className="block text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-primary-500">
                              {isCalculatorInvalid ? '₹0' : formatIndianCurrency(totalAmount)}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                              / {pricePeriod}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Discount Callout Banner */}
                      {!isCalculatorInvalid && (
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <div className="mt-0.5 text-primary-500 flex-shrink-0"><Check size={14} strokeWidth={3} /></div>
                          <div>
                            {formData.billingCycle === 'monthly' ? (
                              <p>
                                Switch to <button type="button" onClick={() => setFormData({ ...formData, billingCycle: 'yearly' })} className="text-primary-600 hover:underline font-bold focus:outline-none">Yearly Billing</button> to save {formatIndianCurrency(yearlyDiscount)} annually!
                              </p>
                            ) : (
                              <p>
                                Equivalent to <strong className="text-primary-600">{formatIndianCurrency(yearlyPrice / 12)}</strong> per month. You are saving <strong className="text-primary-600">{formatIndianCurrency(yearlyDiscount)}</strong> per year!
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* --- STEP 2: School Info --- */}
                {step === 2 && (
                  <>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="relative group">
                        <input type="text" id="schoolName" name="schoolName" value={formData.schoolName} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="School Name" />
                        <label htmlFor="schoolName" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Institution Name *</label>
                      </div>
                      
                      <div className="relative group">
                        <select id="schoolType" name="schoolType" value={formData.schoolType} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white appearance-none">
                          <option value="School">K-12 School</option>
                          <option value="College">College / University</option>
                          <option value="Coaching">Coaching Institute</option>
                          <option value="Other">Other</option>
                        </select>
                        <label htmlFor="schoolType" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-primary-600">Institution Type *</label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="relative group">
                        <input type="text" id="location" name="location" value={formData.location} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="City, State" />
                        <label htmlFor="location" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">City / State *</label>
                      </div>

                      <div className="relative group">
                        <select id="studentCount" name="studentCount" value={formData.studentCount} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none text-slate-900 dark:text-white appearance-none">
                          <option value="" disabled>Select range</option>
                          <option value="0-500">0 - 500</option>
                          <option value="501-1000">501 - 1000</option>
                          <option value="1001-5000">1001 - 5000</option>
                          <option value="5000+">5000+</option>
                        </select>
                        <label htmlFor="studentCount" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-primary-600">Expected Students *</label>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                      <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wider">Required Documents</h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 relative">
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 block">Registration Cert *</label>
                          <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, 'regCertFile')} className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 transition-colors w-full" />
                        </div>
                        <div className="p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 relative">
                          <label className="text-sm font-bold text-slate-500 dark:text-slate-400 mb-2 block">Institution PAN Card *</label>
                          <input type="file" accept=".pdf,.jpg,.png" onChange={(e) => handleFileChange(e, 'panFile')} className="text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-primary-50 file:text-primary-600 hover:file:bg-primary-100 transition-colors w-full" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* --- STEP 3: Admin Info --- */}
                {step === 3 && (
                  <>
                    <div className="relative group">
                      <input type="text" id="adminName" name="adminName" value={formData.adminName} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="Admin Name" />
                      <label htmlFor="adminName" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Full Name *</label>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="relative group">
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="Email Address" />
                        <label htmlFor="email" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Work Email *</label>
                      </div>
                      <div className="relative group">
                        <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} className="w-full px-5 py-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="Phone Number" />
                        <label htmlFor="phone" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Phone Number *</label>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <div className="relative group">
                          <input type={showPassword ? "text" : "password"} id="password" name="password" value={formData.password} onChange={handleChange} className="w-full px-5 py-4 pr-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="Password" />
                          <label htmlFor="password" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Password *</label>
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none">
                            {showPassword ? <LuEyeOff size={20} /> : <LuEye size={20} />}
                          </button>
                        </div>
                        {formData.password && (
                          <div className="flex gap-1 h-1.5 px-1">
                            <div className={`h-full flex-1 rounded-full ${strength > 0 ? 'bg-red-400' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            <div className={`h-full flex-1 rounded-full ${strength > 33 ? 'bg-amber-400' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                            <div className={`h-full flex-1 rounded-full ${strength > 66 ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`}></div>
                          </div>
                        )}
                      </div>

                      <div className="relative group">
                        <input type={showPassword ? "text" : "password"} id="confirmPassword" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full px-5 py-4 pr-12 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all outline-none peer text-slate-900 dark:text-white placeholder-transparent" placeholder="Confirm Password" />
                        <label htmlFor="confirmPassword" className="absolute left-5 -top-2.5 bg-white dark:bg-slate-900 px-1 text-sm font-bold text-slate-500 dark:text-slate-400 transition-all peer-placeholder-shown:text-base peer-placeholder-shown:top-4 peer-focus:-top-2.5 peer-focus:text-sm peer-focus:text-primary-600">Confirm Password *</label>
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300 hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none">
                          {showPassword ? <LuEyeOff size={20} /> : <LuEye size={20} />}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* --- STEP 4: Plan & Confirmation --- */}
                {step === 4 && (
                  <div className="space-y-8">
                    <div className="bg-gradient-to-tr from-primary-50 to-white border border-primary-200 rounded-2xl p-6 relative overflow-hidden">
                      <div className="absolute -right-4 -top-4 text-primary-200/50">
                        <LuCreditCard size={120} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-primary-600 font-bold uppercase tracking-wider text-sm mb-1">Subscription Details</h4>
                        <div className="flex items-end gap-4 mb-4">
                          <h3 className="text-3xl font-black text-slate-900 dark:text-white">{numUsers} Users</h3>
                          <div className="text-slate-500 dark:text-slate-400 font-medium pb-1">
                            <span className="text-xl text-slate-900 dark:text-white">{formatIndianCurrency(totalAmount)}</span> / {pricePeriod}
                          </div>
                        </div>
                        <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <li className="flex items-center gap-2"><Check size={16} className="text-primary-500"/> Calculated price based on ₹26 / user / month</li>
                          <li className="flex items-center gap-2"><Check size={16} className="text-primary-500"/> Billing Cycle: {formData.billingCycle === 'monthly' ? 'Monthly' : 'Yearly (10% Discount applied)'}</li>
                          {selectedPlanDetails && (
                            <li className="flex items-center gap-2"><Check size={16} className="text-primary-500"/> Base Tier: {selectedPlanDetails.name}</li>
                          )}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
                      <label className="flex items-start gap-4 cursor-pointer group">
                        <div className="mt-1">
                          <input type="checkbox" name="termsAccepted" checked={formData.termsAccepted} onChange={handleChange} className="w-5 h-5 rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-primary-500 focus:ring-primary-500 focus:ring-offset-white cursor-pointer" />
                        </div>
                        <span className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed group-hover:text-slate-700 transition-colors">
                          I agree to the School <a href="#" className="text-primary-600 hover:underline">Terms of Service</a> and <a href="#" className="text-primary-600 hover:underline">Privacy Policy</a>. I understand my account will be manually verified before activation.
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Error Message */}
          <motion.div 
            initial={false}
            animate={{ height: error ? 'auto' : 0, opacity: error ? 1 : 0 }}
            className="overflow-hidden mt-6"
          >
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm font-medium flex items-center gap-2">
              <ShieldCheck size={18} /> {error}
            </div>
          </motion.div>

          {/* Action Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
            {step > 1 ? (
              <button 
                onClick={handleBack}
                disabled={loading}
                className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2 focus:outline-none"
              >
                <ArrowLeft size={18} /> Back
              </button>
            ) : (
              <div></div> // Spacer
            )}

            {step < 4 ? (
              <button 
                disabled={step === 1 && isCalculatorInvalid}
                onClick={handleNext}
                className="px-8 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-primary-600 font-bold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next Step <ArrowRight size={18} />
              </button>
            ) : (
              <button 
                onClick={handleSubmit}
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-primary-600 to-primary-500 text-white font-bold rounded-xl hover:opacity-90 transition-opacity shadow-[0_4px_14px_rgba(229,189,223,0.4)] flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <><Loader className="animate-spin" size={18} /> Creating...</> : <><ShieldCheck size={18} /> Complete Registration</>}
              </button>
            )}
          </div>

        </motion.div>
      </div>
    </div>
  );
}
