import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { uploadFileToCloudinaryOrFirebase } from '../utils/cloudinary';
import { 
  GraduationCap, 
  User, 
  BookOpen, 
  Users, 
  ShieldCheck, 
  CheckCircle2, 
  UploadCloud, 
  Printer,
  Sparkles,
  ArrowRight,
  FileText,
  MapPin
} from 'lucide-react';
import Captcha from '../components/Captcha';
import toast from 'react-hot-toast';
import { sortClassesAscending } from '../utils/classSorting';
import { normalizeGender } from '../utils/genderUtils';

export default function PublicAdmissionForm() {
  const { schoolId } = useParams();

  const [school, setSchool] = useState(null);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);
  const [captchaValid, setCaptchaValid] = useState(false);
  const captchaRef = useRef(null);

  // Form Fields State
  const [formData, setFormData] = useState({
    // Student Information
    firstName: '',
    lastName: '',
    dob: '',
    gender: 'Male',
    bloodGroup: '',
    nationality: 'Indian',
    religion: '',
    motherTongue: '',
    aadharNumber: '',
    studentEmail: '',
    studentPhone: '',
    
    // Academic Details
    targetClassId: '',
    previousSchool: '',
    previousMarks: '',
    subjectsChosen: '',
    busRoute: '',

    // Parent / Guardian Info
    parentName: '',
    parentRelationship: 'Father',
    parentPhone: '',
    parentEmail: '',
    parentOccupation: '',
    annualIncome: '',
    emergencyContact: '',
    siblingName: '',

    // Residential Address
    homeAddress: '',
    city: '',
    state: '',
    pincode: '',

    // Declaration
    declaration: false
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const fetchSchoolAndClasses = async () => {
      if (!schoolId) {
        setLoading(false);
        return;
      }
      try {
        // Fetch School Data
        const schoolDoc = await getDoc(doc(db, 'schools', schoolId));
        if (schoolDoc.exists()) {
          setSchool(schoolDoc.data());
        }

        // Fetch Classes for Target Grade Selection
        try {
          const classesSnap = await getDocs(collection(db, `schools/${schoolId}/classes`));
          const loadedClasses = classesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          setClasses(sortClassesAscending(loadedClasses));
        } catch (clsErr) {
          console.warn("Could not load classes list for school:", clsErr);
        }
      } catch (err) {
        console.error("Error loading admission form info:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSchoolAndClasses();
  }, [schoolId]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Photo must be less than 5MB");
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.firstName.trim()) newErrors.firstName = "First name is required";
    if (!formData.lastName.trim()) newErrors.lastName = "Last name is required";
    if (!formData.dob) newErrors.dob = "Date of birth is required";
    if (!formData.parentName.trim()) newErrors.parentName = "Parent/Guardian name is required";
    
    // Phone validation
    const phoneDigits = formData.parentPhone.replace(/\D/g, '');
    if (!formData.parentPhone.trim()) {
      newErrors.parentPhone = "Parent phone number is required";
    } else if (phoneDigits.length < 10) {
      newErrors.parentPhone = "Phone number must be at least 10 digits";
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.parentEmail.trim()) {
      newErrors.parentEmail = "Parent email address is required";
    } else if (!emailRegex.test(formData.parentEmail.trim())) {
      newErrors.parentEmail = "Please enter a valid email address";
    }

    if (!formData.homeAddress.trim()) newErrors.homeAddress = "Residential address is required";
    if (!formData.declaration) newErrors.declaration = "Please confirm the declaration before submitting";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fill in all required fields accurately.");
      return;
    }

    if (!captchaValid) {
      toast.error("Please enter the security verification code correctly.");
      return;
    }

    setSubmitting(true);
    try {
      // Calculate age if DOB provided
      let calculatedAge = '';
      if (formData.dob) {
        const birthDate = new Date(formData.dob);
        const today = new Date();
        let ageNum = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
          ageNum--;
        }
        calculatedAge = ageNum > 0 ? ageNum.toString() : '';
      }

      // Upload Student Photo if provided
      let photoUrl = '';
      if (photoFile) {
        try {
          const safeName = `${formData.firstName}_${formData.lastName}`.replace(/[^a-z0-9]/gi, '_');
          const storagePath = `Schools/${schoolId}/AdmissionApplications/${safeName}_${Date.now()}`;
          photoUrl = await uploadFileToCloudinaryOrFirebase(photoFile, schoolId, storagePath);
        } catch (uploadErr) {
          console.warn("Photo upload warning, proceeding without photo:", uploadErr);
        }
      }

      // Generate Reference Application Number: e.g. ADM-2026-8421
      const year = new Date().getFullYear();
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const applicationNumber = `ADM-${year}-${randomSuffix}`;

      const selectedClass = classes.find(c => c.id === formData.targetClassId);
      const targetClassName = selectedClass ? `${selectedClass.name} - ${selectedClass.section}` : '';

      const applicationPayload = {
        applicationNumber,
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        studentName: `${formData.firstName.trim()} ${formData.lastName.trim()}`,
        dob: formData.dob,
        age: calculatedAge,
        gender: formData.gender,
        bloodGroup: formData.bloodGroup || '',
        nationality: formData.nationality || '',
        religion: formData.religion || '',
        motherTongue: formData.motherTongue || '',
        aadharNumber: formData.aadharNumber || '',
        studentEmail: formData.studentEmail || '',
        studentPhone: formData.studentPhone || '',
        
        targetClassId: formData.targetClassId || '',
        targetClassName: targetClassName,
        previousSchool: formData.previousSchool || '',
        previousMarks: formData.previousMarks || '',
        subjectsChosen: formData.subjectsChosen || '',
        busRoute: formData.busRoute || '',

        parentName: formData.parentName.trim(),
        parentRelationship: formData.parentRelationship,
        parentPhone: formData.parentPhone.trim(),
        parentEmail: formData.parentEmail.trim(),
        parentOccupation: formData.parentOccupation || '',
        annualIncome: formData.annualIncome || '',
        emergencyContact: formData.emergencyContact || formData.parentPhone.trim(),
        siblingName: formData.siblingName || '',

        homeAddress: formData.homeAddress.trim(),
        city: formData.city || '',
        state: formData.state || '',
        pincode: formData.pincode || '',

        photoUrl: photoUrl || '',
        status: 'Pending', // Pending | Approved | Rejected
        submittedAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, `schools/${schoolId}/admissionApplications`), applicationPayload);

      setSubmittedData({
        id: docRef.id,
        ...applicationPayload
      });

      toast.success("Admission application submitted successfully!");
    } catch (err) {
      console.error("Error submitting admission application:", err);
      toast.error("Failed to submit application. Please check your connection and try again.");
      if (captchaRef.current) captchaRef.current.regenerate();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-800 flex flex-col justify-center items-center p-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary-600 border-t-transparent mb-4"></div>
        <p className="text-slate-600 dark:text-slate-300 font-semibold">Loading School Admission Portal...</p>
      </div>
    );
  }

  // --- Success / Submission Confirmation View ---
  if (submittedData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50/30 to-indigo-50/40 p-4 sm:p-8 flex items-center justify-center">
        <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 sm:p-12 text-center animate-fade-in">
          <div className="w-20 h-20 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20 animate-bounce">
            <CheckCircle2 size={42} />
          </div>

          <span className="px-3.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-black uppercase tracking-wider border border-green-200">
            Application Received
          </span>

          <h1 className="text-3xl font-black text-slate-900 dark:text-white mt-4 mb-2">
            Admission Application Submitted!
          </h1>
          <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto text-sm">
            Thank you for applying to <span className="font-bold text-slate-900 dark:text-white">{school?.schoolName || 'our school'}</span>. Your application has been logged into our admissions office.
          </p>

          {/* Reference Card */}
          <div className="my-8 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 text-left space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-3 gap-2">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-bold uppercase tracking-wider">Application Reference No.</p>
                <p className="text-2xl font-mono font-black text-primary-600">{submittedData.applicationNumber}</p>
              </div>
              <span className="self-start sm:self-center px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-xs font-bold border border-amber-200">
                Status: Pending Review
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold">Applicant Name</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{submittedData.studentName}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold">Applying For Class</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{submittedData.targetClassName || 'General Admission'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold">Parent / Guardian</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{submittedData.parentName} ({submittedData.parentRelationship})</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-300 font-semibold">Primary Contact</p>
                <p className="font-bold text-slate-800 dark:text-slate-100">{submittedData.parentPhone}</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8 max-w-lg mx-auto">
            Please save your Application Reference Number. Once the school administration reviews and approves your submission, you will receive an admission notification and registration credentials.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => window.print()}
              className="px-6 py-3 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-2xl transition-colors flex items-center gap-2 text-sm"
            >
              <Printer size={18} /> Print Application
            </button>
            <button
              onClick={() => {
                setSubmittedData(null);
                setFormData({
                  firstName: '', lastName: '', dob: '', gender: 'Male', bloodGroup: '',
                  nationality: 'Indian', religion: '', motherTongue: '', aadharNumber: '',
                  studentEmail: '', studentPhone: '', targetClassId: '', previousSchool: '',
                  previousMarks: '', subjectsChosen: '', busRoute: '', parentName: '',
                  parentRelationship: 'Father', parentPhone: '', parentEmail: '',
                  parentOccupation: '', annualIncome: '', emergencyContact: '', siblingName: '',
                  homeAddress: '', city: '', state: '', pincode: '', declaration: false
                });
                setPhotoFile(null);
                setPhotoPreview(null);
              }}
              className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-2xl transition-all shadow-md shadow-primary-600/20 flex items-center gap-2 text-sm"
            >
              <FileText size={18} /> Submit Another Application
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Main Admission Form View ---
  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 dark:text-white py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* School Header Banner */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8 mb-8 flex flex-col sm:flex-row items-center gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary-500/10 to-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-600 to-indigo-700 text-white flex items-center justify-center shrink-0 shadow-md shadow-primary-600/20 overflow-hidden border border-white">
            {school?.logoUrl ? (
              <img src={school.logoUrl} alt={school.schoolName} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap size={40} />
            )}
          </div>

          <div className="text-center sm:text-left flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100/80 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-2">
              <Sparkles size={14} /> Official Online Admission Portal
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
              {school?.schoolName || 'School Student Admission'}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {school?.tagline || school?.address || 'Please complete the application form below. All accurate details will be verified by the school administration.'}
            </p>
          </div>
        </div>

        {/* Application Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          
          {/* Section 1: Student Information */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <User size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Student Personal Details</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Provide personal identity details of the applicant student</p>
              </div>
            </div>

            {/* Photo Upload Box */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-emerald-50/40 rounded-2xl border border-emerald-100">
              <div className="w-28 h-28 rounded-2xl bg-white dark:bg-slate-900 border-2 border-dashed border-emerald-300 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                {photoPreview ? (
                  <img src={photoPreview} alt="Student Preview" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-2">
                    <User size={36} className="text-slate-300" />
                    <span className="text-[10px] text-slate-400 dark:text-slate-300 block mt-1">Passport Size</span>
                  </div>
                )}
              </div>
              <div className="text-center sm:text-left">
                <p className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Upload Student Photo (Optional)</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Accepted formats: JPG, PNG, WEBP (Max 5MB)</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer shadow-sm transition-all">
                  <UploadCloud size={16} /> Choose Photo
                    <input type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                  </label>
                </div>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
              {/* First Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  First Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="e.g. Aarav"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.firstName ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName}</p>}
              </div>

              {/* Last Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="e.g. Sharma"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.lastName ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.lastName && <p className="text-xs text-red-500 mt-1">{errors.lastName}</p>}
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="dob"
                  value={formData.dob}
                  onChange={handleChange}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.dob ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.dob && <p className="text-xs text-red-500 mt-1">{errors.dob}</p>}
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  name="gender"
                  value={normalizeGender(formData.gender, 'Male')}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Blood Group */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Blood Group
                </label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Blood Group</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>

              {/* Nationality */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Nationality
                </label>
                <input
                  type="text"
                  name="nationality"
                  value={formData.nationality}
                  onChange={handleChange}
                  placeholder="Indian"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Religion */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Religion
                </label>
                <input
                  type="text"
                  name="religion"
                  value={formData.religion}
                  onChange={handleChange}
                  placeholder="e.g. Hindu / Muslim / Christian"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Mother Tongue */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Mother Tongue
                </label>
                <input
                  type="text"
                  name="motherTongue"
                  value={formData.motherTongue}
                  onChange={handleChange}
                  placeholder="e.g. Hindi / English / Tamil"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Aadhaar Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Aadhaar / National ID (12 Digits)
                </label>
                <input
                  type="text"
                  name="aadharNumber"
                  value={formData.aadharNumber}
                  onChange={handleChange}
                  maxLength="12"
                  placeholder="12 digit Aadhaar"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Academic Selection */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">2. Academic & Target Class</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Select grade and past schooling details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Target Class */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Applying for Class / Section
                </label>
                <select
                  name="targetClassId"
                  value={formData.targetClassId}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="">Select Target Class</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} - {c.section} {c.academicYear ? `(${c.academicYear})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Previous School */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Previous School Name
                </label>
                <input
                  type="text"
                  name="previousSchool"
                  value={formData.previousSchool}
                  onChange={handleChange}
                  placeholder="e.g. St. Xavier's High School"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Previous Marks / Grade */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Previous Grade / Percentage
                </label>
                <input
                  type="text"
                  name="previousMarks"
                  value={formData.previousMarks}
                  onChange={handleChange}
                  placeholder="e.g. 88% or A Grade"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Subjects Chosen */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Preferred Electives / Stream
                </label>
                <input
                  type="text"
                  name="subjectsChosen"
                  value={formData.subjectsChosen}
                  onChange={handleChange}
                  placeholder="e.g. Science with Computer Science"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* School Bus Route */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Transportation / Bus Stop
                </label>
                <input
                  type="text"
                  name="busRoute"
                  value={formData.busRoute}
                  onChange={handleChange}
                  placeholder="e.g. Route 4 - Sector 12 Gate"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Parent & Guardian Details */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Users size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">3. Parent & Guardian Information</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Contact details for correspondence and emergency</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Parent Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Parent / Guardian Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="parentName"
                  value={formData.parentName}
                  onChange={handleChange}
                  placeholder="e.g. Rajesh Sharma"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.parentName ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.parentName && <p className="text-xs text-red-500 mt-1">{errors.parentName}</p>}
              </div>

              {/* Relationship */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Relationship <span className="text-red-500">*</span>
                </label>
                <select
                  name="parentRelationship"
                  value={formData.parentRelationship}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Legal Guardian</option>
                </select>
              </div>

              {/* Parent Phone */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Primary Mobile / WhatsApp <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="parentPhone"
                  value={formData.parentPhone}
                  onChange={handleChange}
                  maxLength="10"
                  placeholder="10 digit number"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono ${
                    errors.parentPhone ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.parentPhone && <p className="text-xs text-red-500 mt-1">{errors.parentPhone}</p>}
              </div>

              {/* Parent Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="parentEmail"
                  value={formData.parentEmail}
                  onChange={handleChange}
                  placeholder="e.g. parent@example.com"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.parentEmail ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.parentEmail && <p className="text-xs text-red-500 mt-1">{errors.parentEmail}</p>}
              </div>

              {/* Parent Occupation */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Occupation / Profession
                </label>
                <input
                  type="text"
                  name="parentOccupation"
                  value={formData.parentOccupation}
                  onChange={handleChange}
                  placeholder="e.g. Software Engineer / Doctor"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              {/* Emergency Contact */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Emergency Contact Phone
                </label>
                <input
                  type="tel"
                  name="emergencyContact"
                  value={formData.emergencyContact}
                  onChange={handleChange}
                  placeholder="Secondary phone number"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Residential Address */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <MapPin size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">4. Residential Address</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Current home address for correspondence</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="sm:col-span-2 lg:col-span-4">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  House No. / Building / Street Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows="2"
                  name="homeAddress"
                  value={formData.homeAddress}
                  onChange={handleChange}
                  placeholder="Complete residential address"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-all focus:ring-2 focus:ring-primary-500 focus:outline-none ${
                    errors.homeAddress ? 'border-red-400 bg-red-50/20' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                  }`}
                />
                {errors.homeAddress && <p className="text-xs text-red-500 mt-1">{errors.homeAddress}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  City / Town
                </label>
                <input
                  type="text"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="City"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  State
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="State"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                  Postal / Pincode
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  maxLength="6"
                  placeholder="6 digit PIN"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Declaration & Anti-Spam Verification */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sm:p-8">
            <div className="flex items-center gap-3 pb-4 mb-6 border-b border-slate-100 dark:border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">5. Declaration & Security Verification</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Confirm accuracy of information</p>
              </div>
            </div>

            {/* Declaration Checkbox */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="declaration"
                  checked={formData.declaration}
                  onChange={handleChange}
                  className="mt-1 w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-slate-600"
                />
                <span className="text-xs text-slate-700 dark:text-slate-200 font-medium leading-relaxed">
                  I hereby declare that all information furnished in this admission application is true, complete, and accurate to the best of my knowledge. I understand that any false statement or omission may lead to rejection of this application or subsequent cancellation of admission.
                </span>
              </label>
              {errors.declaration && <p className="text-xs text-red-500 mt-2 font-semibold">{errors.declaration}</p>}
            </div>

            {/* Captcha Verification */}
            <div className="max-w-md mx-auto mb-6">
              <Captcha ref={captchaRef} onChange={setCaptchaValid} />
            </div>

            {/* Submit CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400 dark:text-slate-300 text-center sm:text-left">
                By submitting, your application will be queued for administrative review.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto px-8 py-3.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl transition-all shadow-md hover:shadow-lg active:scale-95 flex items-center justify-center gap-2 text-base disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    Submit Admission Application <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </div>

        </form>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-slate-400 dark:text-slate-300">
          Powered by School Management System official portal.
        </div>
      </div>
    </div>
  );
}
