import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { addSubDocument } from '../../firebase/firestore';
import toast from 'react-hot-toast';
import { LuUser, LuMapPin, LuBriefcase, LuCreditCard, LuSave, LuBookOpen, LuShieldCheck } from 'react-icons/lu';
import { normalizeGender } from '../../utils/genderUtils';

export default function ProfileSetup() {
  const { currentUser, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherDocId, setTeacherDocId] = useState(null);
  
  const [formData, setFormData] = useState({
    // Personal Info
    dob: '',
    bloodGroup: '',
    gender: 'Male',
    nationality: '',
    maritalStatus: 'Single',
    fatherGuardianName: '',
    languagesKnown: '',
    mobileNumber: '',
    residentialAddress: '',
    emergencyContact: '',
    
    // Educational Information
    highestQualification: '',
    degreeSpecialization: '',
    universityName: '',
    yearOfPassing: '',

    // Professional Information
    previousExperience: '0',
    previousOrganization: '',
    subjectSpecialization: '',
    gradesClassesHandled: '',
    professionalCertifications: '',

    // Government & Identity
    govtIdType: 'Aadhaar',
    govtIdNumber: '',
    aadharNumber: '',
    panNumber: '',
    pfNumber: '',
    esicNumber: '',
    uanNumber: '',
    taxIdDetails: '',

    // Banking Information
    bankAccountNumber: '',
    bankName: '',
    branchName: '',
    ifscCode: ''
  });

  useEffect(() => {
    const fetchTeacherProfile = async () => {
      if (!currentUser || !userProfile?.schoolId) return;
      try {
        const q = query(
          collection(db, `schools/${userProfile.schoolId}/teachers`),
          where("userId", "==", currentUser.uid)
        );
        let snapshot = await getDocs(q);
        let teacherDoc = null;

        if (!snapshot.empty) {
          teacherDoc = snapshot.docs[0];
        } else if (currentUser.email) {
          // Fallback: search by email to auto-link
          const emailQ = query(
            collection(db, `schools/${userProfile.schoolId}/teachers`),
            where("email", "==", currentUser.email.trim())
          );
          const emailSnapshot = await getDocs(emailQ);
          if (!emailSnapshot.empty) {
            teacherDoc = emailSnapshot.docs[0];
            // Auto-link the userId
            await updateDoc(doc(db, `schools/${userProfile.schoolId}/teachers`, teacherDoc.id), {
              userId: currentUser.uid
            });
          } else {
            // Auto-create document if completely missing!
            const firstName = userProfile.name ? userProfile.name.split(' ')[0] : currentUser.email.split('@')[0];
            const lastName = userProfile.name ? userProfile.name.split(' ').slice(1).join(' ') : '';
            const newTeacherDoc = {
              userId: currentUser.uid,
              email: currentUser.email,
              firstName,
              lastName,
              name: userProfile.name || currentUser.email.split('@')[0],
              role: 'Staffs',
              status: 'Active',
              staff_type: 'teaching',
              createdAt: new Date().toISOString()
            };
            await addSubDocument(userProfile.schoolId, 'teachers', newTeacherDoc);
            
            // Re-query to load the doc
            const newQ = query(
              collection(db, `schools/${userProfile.schoolId}/teachers`),
              where("userId", "==", currentUser.uid)
            );
            const newSnapshot = await getDocs(newQ);
            if (!newSnapshot.empty) {
              teacherDoc = newSnapshot.docs[0];
            }
          }
        }

        if (teacherDoc) {
          setTeacherDocId(teacherDoc.id);
          const data = teacherDoc.data();
          setFormData(prev => ({
            ...prev,
            dob: data.dob || '',
            bloodGroup: data.bloodGroup || '',
            gender: normalizeGender(data.gender, 'Male'),
            nationality: data.nationality || '',
            maritalStatus: data.maritalStatus || 'Single',
            fatherGuardianName: data.fatherGuardianName || data.fatherName || '',
            languagesKnown: data.languagesKnown || '',
            mobileNumber: data.mobileNumber || data.phone || '',
            residentialAddress: data.residentialAddress || data.address || '',
            emergencyContact: data.emergencyContact || '',
            
            highestQualification: data.highestQualification || data.qualifications || '',
            degreeSpecialization: data.degreeSpecialization || '',
            universityName: data.universityName || '',
            yearOfPassing: data.yearOfPassing || '',

            previousExperience: data.previousExperience || data.experience || '0',
            previousOrganization: data.previousOrganization || '',
            subjectSpecialization: data.subjectSpecialization || '',
            gradesClassesHandled: data.gradesClassesHandled || '',
            professionalCertifications: data.professionalCertifications || '',

            govtIdType: data.govtIdType || 'Aadhaar',
            govtIdNumber: data.govtIdNumber || '',
            aadharNumber: data.aadharNumber || '',
            panNumber: data.panNumber || '',
            pfNumber: data.pfNumber || '',
            esicNumber: data.esicNumber || '',
            uanNumber: data.uanNumber || '',
            taxIdDetails: data.taxIdDetails || '',

            bankAccountNumber: data.bankAccountNumber || data.accountNumber || '',
            bankName: data.bankName || '',
            branchName: data.branchName || '',
            ifscCode: data.ifscCode || ''
          }));
        }
      } catch (error) {
        console.error("Error fetching teacher profile", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTeacherProfile();
  }, [currentUser, userProfile]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!teacherDocId) {
      toast.error("Profile document not linked to this user account.");
      return;
    }
    setSaving(true);
    try {
      const cleanedData = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== undefined) {
          cleanedData[key] = formData[key];
        }
      });

      await updateDoc(doc(db, `schools/${userProfile.schoolId}/teachers`, teacherDocId), {
        ...cleanedData,
        // Sync older field names for backwards compatibility
        phone: cleanedData.mobileNumber || '',
        address: cleanedData.residentialAddress || '',
        qualifications: cleanedData.highestQualification || '',
        experience: cleanedData.previousExperience || '',
        accountNumber: cleanedData.bankAccountNumber || '',
        updatedAt: new Date().toISOString()
      });
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile", error);
      toast.error("Failed to update profile: " + (error.message || error));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Profile Setup</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Complete your profile to update all professional, banking, and personal details.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Personal Details */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuUser className="text-primary-500" /> Personal Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Date of Birth</label>
              <input type="date" name="dob" value={formData.dob} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Gender</label>
              <select name="gender" value={normalizeGender(formData.gender, 'Male')} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm bg-white dark:bg-slate-900">
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Blood Group</label>
              <input type="text" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} placeholder="e.g. O+" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Nationality</label>
              <input type="text" name="nationality" value={formData.nationality} onChange={handleChange} placeholder="e.g. Indian" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Marital Status</label>
              <select name="maritalStatus" value={formData.maritalStatus} onChange={handleChange} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm bg-white dark:bg-slate-900">
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Languages Known</label>
              <input type="text" name="languagesKnown" value={formData.languagesKnown} onChange={handleChange} placeholder="e.g. English, Hindi" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Mobile Number</label>
              <input type="tel" name="mobileNumber" value={formData.mobileNumber} onChange={handleChange} placeholder="9876543210" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Emergency Contact</label>
              <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} placeholder="Emergency contact no." className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Father / Guardian Name</label>
              <input type="text" name="fatherGuardianName" value={formData.fatherGuardianName} onChange={handleChange} placeholder="Father or Guardian Name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuMapPin className="text-indigo-500" /> Address Details
          </h2>
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Residential Address</label>
            <textarea name="residentialAddress" value={formData.residentialAddress} onChange={handleChange} rows="3" placeholder="Enter your full residential address" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none resize-none transition-all text-sm"></textarea>
          </div>
        </div>

        {/* Educational details */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuBookOpen className="text-emerald-500" /> Educational Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Highest Qualification</label>
              <input type="text" name="highestQualification" value={formData.highestQualification} onChange={handleChange} placeholder="e.g. M.Sc, B.Ed" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Degree & Specialization</label>
              <input type="text" name="degreeSpecialization" value={formData.degreeSpecialization} onChange={handleChange} placeholder="e.g. Physics" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">University / College Name</label>
              <input type="text" name="universityName" value={formData.universityName} onChange={handleChange} placeholder="University / College Name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Year of Passing</label>
              <input type="text" name="yearOfPassing" value={formData.yearOfPassing} onChange={handleChange} placeholder="e.g. 2018" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Professional Details */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuBriefcase className="text-amber-500" /> Professional Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Years of Previous Experience</label>
              <input type="number" name="previousExperience" value={formData.previousExperience} onChange={handleChange} placeholder="e.g. 5" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Previous School / Organization</label>
              <input type="text" name="previousOrganization" value={formData.previousOrganization} onChange={handleChange} placeholder="Previous school name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Subject Specialization</label>
              <input type="text" name="subjectSpecialization" value={formData.subjectSpecialization} onChange={handleChange} placeholder="e.g. Mathematics" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Grades/Classes Handled</label>
              <input type="text" name="gradesClassesHandled" value={formData.gradesClassesHandled} onChange={handleChange} placeholder="e.g. Class 8 - 10" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Professional Certifications</label>
              <input type="text" name="professionalCertifications" value={formData.professionalCertifications} onChange={handleChange} placeholder="e.g. TEFL, Microsoft Certified Educator" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-amber-500 outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Identity & Government IDs */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuShieldCheck className="text-rose-500" /> Government & Identity Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Government ID Type</label>
              <input type="text" name="govtIdType" value={formData.govtIdType} onChange={handleChange} placeholder="e.g. Aadhaar / Voter ID" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Government ID Number</label>
              <input type="text" name="govtIdNumber" value={formData.govtIdNumber} onChange={handleChange} placeholder="ID number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Aadhaar Number</label>
              <input type="text" name="aadharNumber" value={formData.aadharNumber} onChange={handleChange} placeholder="12-digit Aadhaar" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">PAN Number</label>
              <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} placeholder="PAN number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none uppercase transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">PF Number</label>
              <input type="text" name="pfNumber" value={formData.pfNumber} onChange={handleChange} placeholder="PF number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">ESIC Number</label>
              <input type="text" name="esicNumber" value={formData.esicNumber} onChange={handleChange} placeholder="ESIC number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">UAN Number</label>
              <input type="text" name="uanNumber" value={formData.uanNumber} onChange={handleChange} placeholder="UAN number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Tax Identification / PAN Details</label>
              <input type="text" name="taxIdDetails" value={formData.taxIdDetails} onChange={handleChange} placeholder="Tax Details" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-rose-500 outline-none transition-all text-sm" />
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-all hover:shadow-md">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
            <LuCreditCard className="text-blue-500" /> Bank Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Bank Name</label>
              <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} placeholder="e.g. HDFC Bank" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Account Number</label>
              <input type="text" name="bankAccountNumber" value={formData.bankAccountNumber} onChange={handleChange} placeholder="Account number" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Branch Name</label>
              <input type="text" name="branchName" value={formData.branchName} onChange={handleChange} placeholder="Branch name" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">IFSC Code</label>
              <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} placeholder="IFSC code" className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none uppercase transition-all text-sm" />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgb(79,70,229,0.39)] hover:shadow-[0_6px_20px_rgba(79,70,229,0.23)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0">
            {saving ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div> : <LuSave size={18} />}
            {saving ? 'Saving...' : 'Save Profile Details'}
          </button>
        </div>
      </form>
    </div>
  );
}
