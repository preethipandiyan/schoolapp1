import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { db } from '../../firebase/config';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { LuCreditCard as CreditCard, LuReceipt as Receipt, LuCircleCheck as CheckCircle2, LuTrendingUp as TrendingUp, LuTriangleAlert as AlertTriangle, LuInfo as Info } from 'react-icons/lu';
import toast from 'react-hot-toast';

export default function ParentFees() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const studentId = userProfile?.linkedStudentId;

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalInvoiced: 0, paid: 0, outstanding: 0 });
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!schoolId || !studentId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Subscribe to invoices for the linked student
    const q = query(
      collection(db, `schools/${schoolId}/invoices`),
      where("studentId", "==", studentId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const invoicesData = [];
      let totalInvoiced = 0;
      let paid = 0;
      let outstanding = 0;
      let overdueCount = 0;
      let overdueAmount = 0;
      const today = new Date();

      snapshot.forEach((doc) => {
        const inv = { id: doc.id, ...doc.data() };
        invoicesData.push(inv);

        const amt = Number(inv.amount) || 0;
        totalInvoiced += amt;
        if (inv.status === 'Paid') {
          paid += amt;
        } else {
          outstanding += amt;
          const isOverdue = inv.dueDate && new Date(inv.dueDate + 'T23:59:59') < today;
          if (isOverdue) {
            overdueCount++;
            overdueAmount += amt;
          }
        }
      });

      // Sort invoices by due date desc
      invoicesData.sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

      setInvoices(invoicesData);
      setStats({ totalInvoiced, paid, outstanding, overdueCount, overdueAmount });
      setLoading(false);
    }, (error) => {
      console.error("Error subscribing to invoices:", error);
      toast.error("Failed to load fee details.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [schoolId, studentId]);

  const handleSimulatePayment = async (invoice) => {
    setSelectedInvoice(invoice);
  };

  const executePayment = async () => {
    if (!selectedInvoice) return;
    setPaying(true);

    try {
      // Import functions locally to execute payment mark
      const { markInvoicePaid } = await import('../../firebase/firestore');
      await markInvoicePaid(schoolId, selectedInvoice.id);
      
      toast.success(`Payment of ₹${selectedInvoice.amount} for "${selectedInvoice.name}" successfully processed!`);
      setSelectedInvoice(null);
    } catch (e) {
      console.error(e);
      toast.error("Failed to process payment. Please try again.");
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto min-w-0 w-full">
      {/* Header */}
      <div className="flex justify-between items-center min-w-0 w-full">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight truncate">Fees & Payments</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Monitor fee invoices, receipts, and outstanding dues for your linked student.</p>
        </div>
      </div>

      {/* Stats Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Invoiced */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-slate-400"></div>
          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-2xl flex items-center justify-center">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Total Invoiced</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">₹{stats.totalInvoiced.toLocaleString()}</p>
          </div>
        </div>

        {/* Paid */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-2 h-full bg-emerald-500"></div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">Paid Amount</p>
            <p className="text-2xl font-black text-slate-950 mt-1">₹{stats.paid.toLocaleString()}</p>
          </div>
        </div>

        {/* Outstanding */}
        <div className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border shadow-sm flex items-center gap-4 relative overflow-hidden ${
          stats.overdueCount > 0 ? 'border-red-200' : 'border-slate-100 dark:border-slate-800'
        }`}>
          <div className={`absolute top-0 left-0 w-2 h-full ${stats.overdueCount > 0 ? 'bg-red-500' : 'bg-amber-500'}`}></div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
            stats.overdueCount > 0 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
          }`}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider">
              {stats.overdueCount > 0 ? 'Overdue Balance' : 'Outstanding Balance'}
            </p>
            <p className={`text-2xl font-black mt-1 ${stats.overdueCount > 0 ? 'text-red-600' : 'text-amber-600'}`}>
              ₹{stats.outstanding.toLocaleString()}
            </p>
            {stats.overdueCount > 0 && (
              <p className="text-[11px] font-bold text-red-600 mt-0.5">
                {stats.overdueCount} Invoice(s) Past Due
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Dues Alert Banner */}
      {stats.outstanding > 0 && (
        <div className={`rounded-3xl p-5 border shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in ${
          stats.overdueCount > 0
            ? 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200 text-red-900'
            : 'bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200 text-amber-900'
        }`}>
          <div className="flex items-start gap-4 min-w-0 w-full">
            <div className={`p-3 rounded-2xl shrink-0 mt-0.5 ${
              stats.overdueCount > 0 ? 'bg-red-500 text-white shadow-md shadow-red-500/20 animate-pulse' : 'bg-amber-500 text-white shadow-md shadow-amber-500/20'
            }`}>
              <AlertTriangle size={24} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                  stats.overdueCount > 0 ? 'bg-red-200 text-red-950 font-black' : 'bg-amber-200 text-amber-950 font-bold'
                }`}>
                  {stats.overdueCount > 0 ? '⚠️ Immediate Action Required' : '💳 Pending Payment Alert'}
                </span>
                {stats.overdueCount > 0 && (
                  <span className="text-xs font-bold text-red-700 bg-white/80 px-2 py-0.5 rounded-full border border-red-200">
                    {stats.overdueCount} Overdue
                  </span>
                )}
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white mt-1">
                {stats.overdueCount > 0
                  ? `You have ₹${stats.outstanding.toLocaleString()} in overdue fees requiring immediate settlement.`
                  : `You have an outstanding balance of ₹${stats.outstanding.toLocaleString()} pending payment.`
                }
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                {stats.overdueCount > 0
                  ? 'Please click "Pay Immediately" below on overdue items to clear your account.'
                  : 'Please settle pending invoices before their due date to keep your child’s account active.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List */}
      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-950">Invoice Log</h2>
        </div>

        {invoices.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-300">
            <Receipt className="mx-auto mb-3 opacity-40" size={48} />
            <p className="font-medium text-sm">No fee invoices generated yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0 w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-400 dark:text-slate-300 uppercase tracking-wider bg-slate-50/30">
                  <th className="py-4 px-6">Fee Details</th>
                  <th className="py-4 px-6">Due Date</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invoices.map((inv) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate + 'T23:59:59') < new Date() && inv.status !== 'Paid';
                  return (
                    <tr 
                      key={inv.id} 
                      className={`transition-colors ${
                        isOverdue ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/50'
                      }`}
                    >
                      <td className="py-4 px-6">
                        <p className="font-semibold text-slate-900 dark:text-white">{inv.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-300 mt-0.5">
                          {inv.createdAt ? `Invoiced on ${new Date(inv.createdAt).toLocaleDateString('en-GB')}` : 'Standard Fee'}
                        </p>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                          {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-GB') : 'N/A'}
                          {isOverdue && (
                            <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wide border border-red-200">
                              <AlertTriangle size={10} /> Overdue
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-bold text-slate-900 dark:text-white">₹{Number(inv.amount || 0).toLocaleString()}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {inv.status === 'Paid' ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                            <CheckCircle2 size={12} /> Paid
                          </span>
                        ) : isOverdue ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 animate-pulse">
                            <AlertTriangle size={12} /> Overdue
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/50">
                            Pending
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        {inv.status !== 'Paid' ? (
                          <button
                            onClick={() => handleSimulatePayment(inv)}
                            className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-sm transition-all hover:scale-105 active:scale-95 ${
                              isOverdue ? 'bg-red-600 hover:bg-red-700 shadow-red-600/30' : 'bg-primary-600 hover:bg-primary-700 shadow-primary-600/30'
                            }`}
                          >
                            {isOverdue ? 'Pay Immediately' : 'Pay Dues'}
                          </button>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-300 text-xs font-medium italic">Fully Settled</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulated Payment Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar border border-slate-100 dark:border-slate-800 shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-slate-950 mb-2">Simulate Fee Payment</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
              You are simulating a secure online payment of <span className="font-bold text-slate-900 dark:text-white">₹{selectedInvoice.amount}</span> for <strong>{selectedInvoice.name}</strong>.
            </p>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-4 mb-6 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-400 dark:text-slate-300">
                <span>INVOICE</span>
                <span className="text-slate-800 dark:text-slate-100 font-mono">#{selectedInvoice.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between text-xs font-medium text-slate-400 dark:text-slate-300">
                <span>DUE DATE</span>
                <span className="text-slate-800 dark:text-slate-100">{new Date(selectedInvoice.dueDate).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="border-t border-slate-200 dark:border-slate-700 my-2 pt-2 flex justify-between text-sm font-bold text-slate-900 dark:text-white">
                <span>Total Amount Due</span>
                <span>₹{selectedInvoice.amount}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                disabled={paying}
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={paying}
                onClick={executePayment}
                className="w-full sm:w-auto px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-sm font-semibold transition-all flex justify-center items-center gap-2 shadow-sm"
              >
                {paying ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Simulate Payment</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
