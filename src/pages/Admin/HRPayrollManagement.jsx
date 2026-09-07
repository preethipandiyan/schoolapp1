import React, { useState, useEffect, useRef } from 'react';
import { Plus, X, Search, Filter, Edit, Trash2, Download, Settings, UploadCloud, Printer, FileText } from 'lucide-react';
import { LuBriefcase, LuIndianRupee, LuCircleDollarSign, LuFileDown as FileDown } from 'react-icons/lu';
import ConfirmModal from '../../components/ConfirmModal';
import ExportModal from '../../components/ExportModal';
import { useAuth } from '../../context/AuthContext';
import { subscribeToSubCollection, addSubDocument, updateSubDocument, deleteSubDocument } from '../../firebase/firestore';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { uploadFileToCloudinaryOrFirebase, uploadCustomDataFiles } from '../../utils/cloudinary';
import { db, storage } from '../../firebase/config';
import CustomFieldsRenderer from '../../components/CustomFieldsRenderer';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import usePermissions from '../../hooks/usePermissions';

export default function HRPayrollManagement() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const { canCreate, canEdit, canDelete } = usePermissions();
  const hasCreatePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canCreate('hr-payroll');
  const hasEditPermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canEdit('hr-payroll');
  const hasDeletePermission = userProfile?.role?.toLowerCase() === 'admin' || userProfile?.role?.toLowerCase() === 'superadmin' || canDelete('hr-payroll');

  const [payrolls, setPayrolls] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [schoolDetails, setSchoolDetails] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(null); // stores payroll object
  const [confirmModalState, setConfirmModalState] = useState({ isOpen: false, idToDelete: null });
  const [formData, setFormData] = useState({ teacherId: '', name: '', role: '', baseSalary: 0, deductions: 0, status: 'Pending', pfCalculated: 0, esiCalculated: 0, customData: {} });
  const [searchTerm, setSearchTerm] = useState('');

  // Export states
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportFileName, setExportFileName] = useState('');
  const [selectedFields, setSelectedFields] = useState({
    name: true,
    role: true,
    month: true,
    baseSalary: true,
    pfCalculated: true,
    esiCalculated: true,
    deductions: true,
    netPay: true,
    status: true,
    staffId: true,
    bankAccountNumber: true,
    bankName: true,
    ifscCode: true,
    panNumber: true,
    aadharNumber: true
  });

  const availableFieldsList = [
    { key: 'name', label: 'Staff Name' },
    { key: 'role', label: 'Role / Designation' },
    { key: 'month', label: 'Payroll Month' },
    { key: 'baseSalary', label: 'Base Salary (₹)' },
    { key: 'pfCalculated', label: 'PF Deduction (₹)' },
    { key: 'esiCalculated', label: 'ESI Deduction (₹)' },
    { key: 'deductions', label: 'Total Deductions (₹)' },
    { key: 'netPay', label: 'Net Pay (₹)' },
    { key: 'status', label: 'Payment Status' },
    { key: 'staffId', label: 'Staff ID' },
    { key: 'bankAccountNumber', label: 'Bank Account No.' },
    { key: 'bankName', label: 'Bank Name & Branch' },
    { key: 'ifscCode', label: 'IFSC Code' },
    { key: 'panNumber', label: 'PAN Number' },
    { key: 'aadharNumber', label: 'Aadhaar Number' },
    { key: 'createdAt', label: 'Record Created Date' }
  ];

  const handleFieldToggle = (fieldKey) => {
    setSelectedFields(prev => ({ ...prev, [fieldKey]: !prev[fieldKey] }));
  };

  const handleSelectAll = (selectVal) => {
    const updated = {};
    availableFieldsList.forEach(field => {
      updated[field.key] = selectVal;
    });
    setSelectedFields(updated);
  };

  const handleExport = (customFileName) => {
    if (payrolls.length === 0) {
      toast.error("No payroll data available to export.");
      return;
    }

    const activeFields = Object.keys(selectedFields).filter(k => selectedFields[k]);
    if (activeFields.length === 0) {
      toast.error("Please select at least one column to export.");
      return;
    }

    const exportData = payrolls.map((payroll, index) => {
      const teacher = teachers.find(t => t.id === payroll.teacherId) || {};
      const netPay = (payroll.baseSalary || 0) - (payroll.deductions || 0);
      const row = { "S.No": index + 1 };
      
      if (selectedFields.name) row["Staff Name"] = payroll.name || teacher.name || '';
      if (selectedFields.role) row["Role / Designation"] = payroll.role || teacher.role || '';
      if (selectedFields.month) row["Payroll Month"] = payroll.month || '';
      if (selectedFields.baseSalary) row["Base Salary (₹)"] = payroll.baseSalary || 0;
      if (selectedFields.pfCalculated) row["PF Deduction (₹)"] = payroll.pfCalculated || 0;
      if (selectedFields.esiCalculated) row["ESI Deduction (₹)"] = payroll.esiCalculated || 0;
      if (selectedFields.deductions) row["Total Deductions (₹)"] = payroll.deductions || 0;
      if (selectedFields.netPay) row["Net Pay (₹)"] = netPay;
      if (selectedFields.status) row["Payment Status"] = payroll.status || 'Pending';
      if (selectedFields.staffId) row["Staff ID"] = teacher.staffId || '';
      if (selectedFields.bankAccountNumber) row["Bank Account No."] = teacher.bankAccountNumber || teacher.accountNumber || '';
      if (selectedFields.bankName) row["Bank Name & Branch"] = teacher.bankName ? `${teacher.bankName} ${teacher.branchName || ''}`.trim() : '';
      if (selectedFields.ifscCode) row["IFSC Code"] = teacher.ifscCode || '';
      if (selectedFields.panNumber) row["PAN Number"] = teacher.panNumber || '';
      if (selectedFields.aadharNumber) row["Aadhaar Number"] = teacher.aadharNumber || '';
      if (selectedFields.createdAt) row["Record Created Date"] = payroll.createdAt ? new Date(payroll.createdAt).toLocaleDateString('en-GB') : '';
      
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Report");
    
    const rawName = (customFileName || exportFileName || "HR_Payroll_Report").trim();
    const finalFileName = rawName.toLowerCase().endsWith('.xlsx') ? rawName : `${rawName}.xlsx`;
    
    XLSX.writeFile(workbook, finalFileName);
    setShowExportModal(false);
    toast.success("Payroll report exported successfully!");
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const [signatureFile, setSignatureFile] = useState(null);
  const [uploadingSig, setUploadingSig] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    
    const fetchSchoolDetails = async () => {
      try {
        const snap = await getDoc(doc(db, 'schools', schoolId));
        if (snap.exists()) {
          setSchoolDetails(snap.data());
        }
      } catch (err) {
        console.error("Failed to fetch school details", err);
      }
    };
    fetchSchoolDetails();

    const unsubTeachers = subscribeToSubCollection(schoolId, 'teachers', (data) => {
      setTeachers(data);
    });

    const unsubPayroll = subscribeToSubCollection(schoolId, 'payroll', (data) => {
      setPayrolls(data);
      setLoading(false);
    });

    return () => {
      unsubTeachers();
      unsubPayroll();
    };
  }, [schoolId]);

  const calculateDeductions = (salary) => {
    const pfCeiling = 15000;
    const pfApplicable = Math.min(salary, pfCeiling);
    const pf = Math.round(pfApplicable * 0.12);

    const esiCeiling = 21000;
    const esi = salary <= esiCeiling ? Math.round(salary * 0.0075) : 0;

    return { pf, esi, total: pf + esi };
  };

  const handleTeacherSelect = (teacherId) => {
    const selected = teachers.find(t => t.id === teacherId);
    if (selected) {
      const name = selected.name || `${selected.firstName || ''} ${selected.lastName || ''}`.trim();
      const role = selected.role || 'Staff'; 
      
      const previousPayroll = payrolls.filter(p => p.teacherId === teacherId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
      const defaultSalary = previousPayroll ? previousPayroll.baseSalary : (selected.baseSalary || 0);
      const { pf, esi, total } = calculateDeductions(defaultSalary);

      setFormData(prev => ({ 
        ...prev, 
        teacherId, 
        name, 
        role,
        baseSalary: defaultSalary,
        deductions: total,
        pfCalculated: pf,
        esiCalculated: esi
      }));
    } else {
      setFormData(prev => ({ ...prev, teacherId: '', name: '', role: '', baseSalary: 0, deductions: 0, pfCalculated: 0, esiCalculated: 0, customData: {} }));
    }
  };

  const handleSalaryChange = (val) => {
    const salary = parseFloat(val) || 0;
    const { pf, esi, total } = calculateDeductions(salary);
    setFormData(prev => ({ 
      ...prev, 
      baseSalary: salary, 
      deductions: total,
      pfCalculated: pf,
      esiCalculated: esi
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (formData.id && !hasEditPermission) {
      toast.error("You do not have permission to edit payroll records.");
      return;
    }
    if (!formData.id && !hasCreatePermission) {
      toast.error("You do not have permission to create payroll records.");
      return;
    }
    if (!formData.teacherId) {
      toast.error("Please select a staff member");
      return;
    }

    const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
    if (!formData.id) {
      const isDuplicate = payrolls.some(p => p.teacherId === formData.teacherId && p.month === currentMonth);
      if (isDuplicate) {
        toast.error(`Payroll for this staff member already exists for ${currentMonth}.`);
        return;
      }
    }

    try {
      const uploadedCustomData = await uploadCustomDataFiles(formData.customData || {}, schoolId, 'hr-payroll');
      const finalFormData = { ...formData, customData: uploadedCustomData || {} };

      if (formData.id) {
        await updateSubDocument(schoolId, 'payroll', formData.id, finalFormData);
        toast.success("Payroll updated successfully");
      } else {
        await addSubDocument(schoolId, 'payroll', {
          ...finalFormData,
          month: currentMonth,
          createdAt: new Date().toISOString()
        });
        toast.success("Payroll record added");
      }
      setShowModal(false);
      setFormData({ teacherId: '', name: '', role: '', baseSalary: 0, deductions: 0, status: 'Pending', pfCalculated: 0, esiCalculated: 0, customData: {} });
    } catch (err) {
      console.error(err);
      toast.error("Failed to save payroll record");
    }
  };

  const handleDeleteClick = (id) => {
    if (!hasDeletePermission) return;
    setConfirmModalState({ isOpen: true, idToDelete: id });
  };

  const executeDelete = async () => {
    if (!hasDeletePermission) {
      toast.error("You do not have permission to delete payroll records.");
      return;
    }
    const id = confirmModalState.idToDelete;
    if (!id) return;
    try {
      await deleteSubDocument(schoolId, 'payroll', id);
      toast.success("Record deleted");
    } catch (err) {
      toast.error("Failed to delete record");
    }
    setConfirmModalState({ isOpen: false, idToDelete: null });
  };

  const handleUploadSignature = async () => {
    if (!signatureFile) return;
    setUploadingSig(true);
    try {
      const downloadURL = await uploadFileToCloudinaryOrFirebase(
        signatureFile, 
        schoolId, 
        `schools/${schoolId}/hr/signature_${Date.now()}`
      );
      
      const schoolRef = doc(db, 'schools', schoolId);
      await updateDoc(schoolRef, {
        'hrConfig.authorizedSignature': downloadURL
      });
      
      setSchoolDetails(prev => ({
        ...prev,
        hrConfig: { ...(prev?.hrConfig || {}), authorizedSignature: downloadURL }
      }));
      
      toast.success("Signature uploaded successfully!");
      setSignatureFile(null);
      setUploadingSig(false);
    } catch (err) {
      console.error("Signature upload failed", err);
      toast.error("Failed to upload signature.");
      setUploadingSig(false);
    }
  };

  const handleRemoveSignature = async () => {
    try {
      const schoolRef = doc(db, 'schools', schoolId);
      await updateDoc(schoolRef, {
        'hrConfig.authorizedSignature': null
      });
      setSchoolDetails(prev => ({
        ...prev,
        hrConfig: { ...(prev?.hrConfig || {}), authorizedSignature: null }
      }));
      toast.success("Signature removed successfully!");
    } catch (err) {
      toast.error("Failed to remove signature.");
    }
  };

  const filteredPayrolls = payrolls.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.role.toLowerCase().includes(searchTerm.toLowerCase()));

  const totalPages = Math.ceil(filteredPayrolls.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentPayrolls = filteredPayrolls.slice(indexOfFirstItem, indexOfLastItem);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    if (!showPayslipModal) return;
    const payroll = showPayslipModal;
    const docPDF = new jsPDF();
    const netPay = (payroll.baseSalary || 0) - (payroll.deductions || 0);

    docPDF.setFontSize(22);
    docPDF.setTextColor(30, 58, 138); 
    docPDF.text("Payslip", 105, 20, { align: 'center' });
    
    docPDF.setFontSize(12);
    docPDF.setTextColor(100, 116, 139); 
    docPDF.text(`Month: ${payroll.month || 'N/A'}`, 105, 30, { align: 'center' });

    docPDF.setFontSize(11);
    docPDF.setTextColor(15, 23, 42); 
    docPDF.text(`Employee Name: ${payroll.name}`, 20, 50);
    docPDF.text(`Role/Position: ${payroll.role}`, 20, 60);
    docPDF.text(`Status: ${payroll.status}`, 20, 70);

    autoTable(docPDF, {
      startY: 85,
      head: [['Description', 'Amount (INR)']],
      body: [
        ['Base Salary', `Rs. ${(payroll.baseSalary || 0).toLocaleString()}`],
        ['PF Deduction', `- Rs. ${(payroll.pfCalculated || 0).toLocaleString()}`],
        ['ESI Deduction', `- Rs. ${(payroll.esiCalculated || 0).toLocaleString()}`],
        ['Other Deductions', `- Rs. ${((payroll.deductions || 0) - (payroll.pfCalculated || 0) - (payroll.esiCalculated || 0)).toLocaleString()}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      styles: { fontSize: 10, cellPadding: 6 },
    });

    const finalY = docPDF.lastAutoTable.finalY || 130;
    docPDF.setFontSize(14);
    docPDF.setTextColor(16, 185, 129); 
    docPDF.text(`Net Payable: Rs. ${netPay.toLocaleString()}`, 190, finalY + 15, { align: 'right' });

    if (schoolDetails?.hrConfig?.authorizedSignature) {
      try {
        docPDF.addImage(schoolDetails.hrConfig.authorizedSignature, 'PNG', 140, finalY + 25, 40, 15);
        docPDF.setFontSize(10);
        docPDF.setTextColor(100, 116, 139);
        docPDF.text("Authorized Signatory", 160, finalY + 45, { align: 'center' });
      } catch (e) {
        console.error("Could not add signature to PDF", e);
      }
    }

    docPDF.save(`Payslip_${payroll.month || 'Current'}_${payroll.name}.pdf`);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto h-[calc(100vh-2rem)] flex flex-col min-w-0 print:p-0 print:h-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4 shrink-0 print:hidden w-full">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">HR & Payroll</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage staff salaries, deductions, and payslips.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0">
          {hasEditPermission && (
            <button 
              onClick={() => setShowSettingsModal(true)}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all font-medium shadow-sm"
            >
              <Settings size={20} /> Settings
            </button>
          )}
          <button 
            onClick={() => {
              if (payrolls.length === 0) {
                toast.error("No payroll data available to export.");
                return;
              }
              setExportFileName('HR_Payroll_Report'); 
              setShowExportModal(true); 
            }}
            className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-4 py-2.5 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-all font-semibold shadow-sm cursor-pointer text-sm"
          >
            <FileDown size={18} /> Bulk Export
          </button>
          {hasCreatePermission && (
            <button 
              onClick={() => { setFormData({ teacherId: '', name: '', role: '', baseSalary: 0, deductions: 0, status: 'Pending', pfCalculated: 0, esiCalculated: 0, customData: {} }); setShowModal(true); }}
              className="flex items-center gap-2 bg-primary-600 text-white px-5 py-2.5 rounded-xl hover:bg-primary-700 transition-all font-medium shadow-sm"
            >
              <Plus size={20} /> Add Record
            </button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 shrink-0 print:hidden">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
            <LuCircleDollarSign size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Payroll</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              ₹{payrolls.reduce((acc, curr) => acc + (curr.baseSalary - curr.deductions), 0).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <LuBriefcase size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Staff Count</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{payrolls.length}</p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden print:hidden">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between gap-4 shrink-0">
          <div className="relative max-w-md w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-300" size={20} />
            <input 
              type="text"
              placeholder="Search by name or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-slate-50 dark:bg-slate-800 focus:bg-white transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 w-full min-w-0 overflow-x-auto overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-max">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="w-[22%] min-w-[150px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Staff Name</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Role</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Month</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Base Salary</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Deductions</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Net Pay</th>
                <th className="w-[13%] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">Status</th>
                <th className="w-[100px] min-w-[100px] p-4 font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentPayrolls.map((payroll) => {
                const netPay = payroll.baseSalary - payroll.deductions;
                return (
                  <tr key={payroll.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-4 font-bold text-slate-900 dark:text-white truncate" title={payroll.name}>{payroll.name}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-medium truncate" title={payroll.role}>{payroll.role}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-medium truncate" title={payroll.month}>{payroll.month}</td>
                    <td className="p-4 text-slate-700 dark:text-slate-200 truncate">₹{payroll.baseSalary.toLocaleString()}</td>
                    <td className="p-4 text-red-600 truncate">-₹{payroll.deductions.toLocaleString()}</td>
                    <td className="p-4 font-bold text-emerald-600 truncate">₹{netPay.toLocaleString()}</td>
                    <td className="p-4 truncate">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                        payroll.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : 
                        payroll.status === 'Payslip Released' ? 'bg-purple-100 text-purple-700' : 
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {payroll.status}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {payroll.status === 'Payslip Released' && (
                          <button 
                            onClick={() => setShowPayslipModal(payroll)}
                            className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Download Payslip"
                          >
                            <FileText size={16} />
                          </button>
                        )}
                        {hasEditPermission && (
                          <button onClick={() => { setFormData(payroll); setShowModal(true); }} className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Edit">
                            <Edit size={16} />
                          </button>
                        )}
                        {hasDeletePermission && (
                          <button onClick={() => handleDeleteClick(payroll.id)} className="p-1.5 text-slate-400 dark:text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredPayrolls.length === 0 && (
                <tr>
                  <td colSpan="8" className="p-12 text-center text-slate-500 dark:text-slate-400">
                    No payroll records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/30 flex flex-col sm:flex-row gap-4 items-center justify-between shrink-0">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredPayrolls.length)} of {filteredPayrolls.length} records
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                  const isCurrent = page === currentPage;
                  return (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                        isCurrent
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-600/10'
                          : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Payroll Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800 shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">{formData.id ? 'Edit' : 'Add'} Payroll Record</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Staff Member</label>
                    <select
                      required
                      value={formData.teacherId}
                      onChange={e => handleTeacherSelect(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                      disabled={!!formData.id}
                    >
                      <option value="">Select Staff...</option>
                      {teachers.map(t => {
                        const displayName = t.name || `${t.firstName || ''} ${t.lastName || ''}`.trim();
                        return (
                          <option key={t.id} value={t.id}>{displayName || 'Unnamed Staff'}</option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Role / Position</label>
                    <input 
                      type="text" required
                      value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Base Salary (₹)</label>
                    <input 
                      type="number" required min="0"
                      value={formData.baseSalary} onChange={e => handleSalaryChange(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Total Deductions (₹)</label>
                    <input 
                      type="number" required min="0"
                      value={formData.deductions} onChange={e => setFormData({...formData, deductions: parseFloat(e.target.value) || 0})}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Includes 12% PF (₹{formData.pfCalculated || 0}) and 0.75% ESI (₹{formData.esiCalculated || 0}). Edit if needed.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">Status</label>
                  <select 
                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900"
                  >
                    <option>Paid</option>
                    <option>Pending</option>
                    <option>Payslip Released</option>
                  </select>
                </div>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 mt-6">
                  <CustomFieldsRenderer
                    moduleKey="hr-payroll"
                    customData={formData.customData}
                    onChange={(k, v) => setFormData(prev => ({...prev, customData: {...(prev.customData || {}), [k]: v}}))}
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 mt-6 shadow-sm">
                  <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-3 uppercase tracking-wider">Payroll Summary</h4>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-slate-600 dark:text-slate-300 font-medium text-sm">Base Salary</span>
                    <span className="text-slate-900 dark:text-white font-bold">₹{(formData.baseSalary || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-red-600 font-medium text-sm">Total Deductions</span>
                    <span className="text-red-600 font-bold">-₹{(formData.deductions || 0).toLocaleString()}</span>
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="text-emerald-700 font-bold text-sm">Net Balance (Payable)</span>
                    <span className="text-emerald-700 font-black text-xl">₹{((formData.baseSalary || 0) - (formData.deductions || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-slate-600 dark:text-slate-300 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors">Cancel</button>
                <button type="submit" className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 rounded-xl shadow-sm transition-colors">Save Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HR Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">HR Settings</h2>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-full p-2 transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Authorized Signature</label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">This signature will appear on all generated payslips.</p>
              
              {schoolDetails?.hrConfig?.authorizedSignature && (
                <div className="mb-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Current Signature</p>
                    <img src={schoolDetails.hrConfig.authorizedSignature} alt="Authorized Signature" className="max-h-16 object-contain mix-blend-multiply" />
                  </div>
                  <button 
                    onClick={handleRemoveSignature}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Remove Signature"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-3">
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={e => setSignatureFile(e.target.files[0])}
                  className="flex-1 text-sm text-slate-500 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl p-1.5"
                />
                <button 
                  onClick={handleUploadSignature}
                  disabled={!signatureFile || uploadingSig}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {uploadingSig ? 'Uploading...' : <><UploadCloud size={18}/> Upload</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip Modal (Printable) */}
      {showPayslipModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 sm:p-8 print:p-0 print:bg-white print:static print:z-0">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[95vh] print:max-h-none print:shadow-none print:w-full">
            
            {/* Modal Controls - Hidden during print */}
            <div className="p-4 bg-slate-800 text-white flex justify-between items-center shrink-0 print:hidden rounded-t-xl">
              <h3 className="font-bold">Payslip Preview</h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={handleDownloadPDF}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors"
                >
                  <Download size={18} /> Download
                </button>
                <button 
                  onClick={handlePrint}
                  className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold flex justify-center items-center gap-2 transition-colors"
                >
                  <Printer size={18} /> Print
                </button>
                <button onClick={() => setShowPayslipModal(null)} className="p-2 hover:bg-slate-700 rounded-lg transition-colors ml-2">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Printable Area */}
            <div className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-700 p-8 print:p-0 print:bg-white custom-scrollbar">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-10 print:border-none print:p-0 mx-auto max-w-3xl">
                
                {/* Header */}
                <div className="flex justify-between items-center border-b-2 border-slate-200 dark:border-slate-700 pb-6 mb-8">
                  <div className="flex items-center gap-4">
                    {schoolDetails?.logoUrl ? (
                      <img src={schoolDetails.logoUrl} alt="School Logo" className="h-16 w-16 object-contain" />
                    ) : (
                      <div className="h-16 w-16 bg-slate-100 dark:bg-slate-700 rounded flex items-center justify-center font-bold text-slate-400 dark:text-slate-300">LOGO</div>
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{schoolDetails?.schoolName || 'School Name'}</h1>
                      <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{schoolDetails?.address || 'School Address Not Configured'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-3xl font-black text-slate-300 uppercase tracking-widest">Payslip</h2>
                    <p className="text-slate-600 dark:text-slate-300 font-semibold mt-1">{showPayslipModal.month}</p>
                  </div>
                </div>

                {/* Employee Details */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-3">Employee Details</h3>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Name: <span className="text-slate-900 dark:text-white font-bold ml-1">{showPayslipModal.name}</span></p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Role/Designation: <span className="text-slate-900 dark:text-white font-semibold ml-1">{showPayslipModal.role}</span></p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-3">Payment Details</h3>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                      <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Status: <span className="text-emerald-600 font-bold ml-1">{showPayslipModal.status}</span></p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Date: <span className="text-slate-900 dark:text-white font-semibold ml-1">{new Date().toLocaleDateString('en-GB')}</span></p>
                    </div>
                  </div>
                </div>

                {/* Salary Breakdown Table */}
                <h3 className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider mb-3">Salary Breakdown</h3>
                <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden mb-8">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-3 px-4 text-slate-600 dark:text-slate-300 font-bold w-1/2">Earnings</th>
                        <th className="py-3 px-4 text-slate-600 dark:text-slate-300 font-bold w-1/2 border-l border-slate-200 dark:border-slate-700">Deductions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="py-3 px-4 align-top">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-700 dark:text-slate-200">Basic Salary</span>
                            <span className="font-semibold">₹{showPayslipModal.baseSalary.toLocaleString()}</span>
                          </div>
                          {/* Add other allowances here if needed */}
                        </td>
                        <td className="py-3 px-4 align-top border-l border-slate-200 dark:border-slate-700">
                          {showPayslipModal.pfCalculated > 0 && (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-slate-700 dark:text-slate-200">Provident Fund (PF)</span>
                              <span className="font-semibold text-red-600">₹{showPayslipModal.pfCalculated.toLocaleString()}</span>
                            </div>
                          )}
                          {showPayslipModal.esiCalculated > 0 && (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-slate-700 dark:text-slate-200">ESI</span>
                              <span className="font-semibold text-red-600">₹{showPayslipModal.esiCalculated.toLocaleString()}</span>
                            </div>
                          )}
                          {(showPayslipModal.deductions - (showPayslipModal.pfCalculated || 0) - (showPayslipModal.esiCalculated || 0)) > 0 && (
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-slate-700 dark:text-slate-200">Other Deductions</span>
                              <span className="font-semibold text-red-600">₹{(showPayslipModal.deductions - (showPayslipModal.pfCalculated || 0) - (showPayslipModal.esiCalculated || 0)).toLocaleString()}</span>
                            </div>
                          )}
                          {showPayslipModal.deductions === 0 && (
                            <div className="text-slate-400 dark:text-slate-300 text-sm italic">No deductions</div>
                          )}
                        </td>
                      </tr>
                      <tr className="bg-slate-50 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-700">
                        <td className="py-3 px-4">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 dark:text-white">Gross Earnings</span>
                            <span className="font-bold text-slate-900 dark:text-white">₹{showPayslipModal.baseSalary.toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-l border-slate-200 dark:border-slate-700">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-slate-900 dark:text-white">Total Deductions</span>
                            <span className="font-bold text-red-600">₹{showPayslipModal.deductions.toLocaleString()}</span>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Net Pay & Signature */}
                <div className="flex justify-between items-end mt-12 border-t-2 border-slate-900 pt-6">
                  <div>
                    <h4 className="text-slate-500 dark:text-slate-400 font-semibold mb-1 uppercase tracking-widest text-sm">Net Pay</h4>
                    <p className="text-4xl font-black text-slate-900 dark:text-white">₹{(showPayslipModal.baseSalary - showPayslipModal.deductions).toLocaleString()}</p>
                    <p className="text-slate-400 dark:text-slate-300 text-sm mt-2 italic">*This is a computer generated document.</p>
                  </div>
                  
                  <div className="text-center w-48">
                    {schoolDetails?.hrConfig?.authorizedSignature ? (
                      <div className="h-16 mb-2 flex items-end justify-center">
                        <img src={schoolDetails.hrConfig.authorizedSignature} alt="Authorized Signature" className="max-h-full object-contain mix-blend-multiply" />
                      </div>
                    ) : (
                      <div className="h-16 mb-2 border-b-2 border-dashed border-slate-300 dark:border-slate-600"></div>
                    )}
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 border-t border-slate-200 dark:border-slate-700 pt-2">Authorized Signatory</p>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Export Modal */}
      <ExportModal 
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Bulk Export Payroll Report"
        subtitle="Select columns and customize file name to export staff payroll data to Excel"
        defaultFileName={exportFileName || "HR_Payroll_Report"}
        availableFields={availableFieldsList}
        selectedFields={selectedFields}
        onToggleField={handleFieldToggle}
        onSelectAll={handleSelectAll}
        onExport={handleExport}
        exportButtonText="Export Excel"
      />

      <ConfirmModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState({ isOpen: false, idToDelete: null })}
        onConfirm={executeDelete}
        title="Delete Payroll Record"
        message="Are you sure you want to delete this payroll record? This action cannot be undone."
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}
