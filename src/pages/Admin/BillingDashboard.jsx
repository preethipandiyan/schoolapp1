import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeToPlans } from '../../firebase/firestore';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { LuCreditCard as CreditCard, LuZap as Zap, LuCircleCheck as CheckCircle2, LuCircleAlert as AlertCircle, LuFileText as FileText, LuDownload as Download } from 'react-icons/lu';
import { TableSkeleton } from '../../components/Skeleton';

export default function BillingDashboard() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const navigate = useNavigate();

  const [school, setSchool] = useState(null);
  const [currentPlan, setCurrentPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  // Mocked invoices
  const invoices = [];

  const getPlanDisplayName = (planStr) => {
    if (!planStr) return 'Enterprise Plan';
    const clean = planStr.trim().toLowerCase();
    if (clean === 'free') return 'Enterprise Plan';
    if (clean === 'starter' || clean === 'starter_monthly' || clean === 'starter_yearly') return 'Starter Plan';
    if (clean === 'professional' || clean === 'professional_monthly' || clean === 'professional_yearly') return 'Professional Plan';
    if (clean === 'enterprise' || clean === 'enterprise_monthly' || clean === 'enterprise_yearly') return 'Enterprise Plan';
    
    // Capitalize each word from snake_case or standard words
    return clean
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Plan';
  };

  useEffect(() => {
    if (!schoolId) return;

    setLoading(true);
    let plansUnsub, schoolUnsub;

    let allPlans = [];

    plansUnsub = subscribeToPlans((data) => {
      allPlans = data;
      updateCurrentPlan();
    });

    schoolUnsub = onSnapshot(doc(db, 'schools', schoolId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSchool(data);
        updateCurrentPlan(data.plan || data.planId);
      }
      setLoading(false);
    });

    const updateCurrentPlan = (planId = school?.plan || school?.planId) => {
      if (planId && allPlans.length > 0) {
        const p = allPlans.find(plan => plan.id.toLowerCase() === planId.toLowerCase() || plan.name.toLowerCase() === planId.toLowerCase());
        setCurrentPlan(p);
      }
    };

    return () => {
      if (plansUnsub) plansUnsub();
      if (schoolUnsub) schoolUnsub();
    };
  }, [schoolId]);

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto animate-fade-in-up">
        <TableSkeleton rows={5} columns={4} />
      </div>
    );
  }

  // Mock usage data
  const mockUsage = {
    students: 320,
    staff: 24,
    storageGB: 12.5
  };

  const getPercentage = (used, max) => {
    if (max > 9000) return 10; // Unlimited basically
    return Math.min(Math.round((used / max) * 100), 100);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Billing & Subscriptions</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your plan, limits, and billing history.</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Col: Current Plan & Usage */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-8 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-50 rounded-full mix-blend-multiply opacity-50"></div>
            
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div>
                <p className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-1">Current Plan</p>
                <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  Enterprise Plan
                </h2>
                {(currentPlan || school?.plan) && (
                  <p className="text-slate-500 dark:text-slate-400 mt-2">
                    Billing cycle: <span className="font-semibold text-slate-700 dark:text-slate-200 capitalize">{school?.billingCycle || 'monthly'}</span> &middot; Next charge: <span className="font-semibold text-slate-700 dark:text-slate-200">Next cycle</span>
                  </p>
                )}
              </div>
              <div className="text-right">
                <div className="text-4xl font-extrabold text-slate-900 dark:text-white mb-2">
                  ₹{school?.calculatedTotalAmount || 0}<span className="text-lg text-slate-500 dark:text-slate-400 font-medium">/{school?.billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                <button 
                  onClick={() => navigate('/admin/upgrade')}
                  className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition-colors flex items-center gap-2 shadow-sm"
                >
                  <Zap size={16} /> Upgrade Plan
                </button>
              </div>
            </div>

            <div className="space-y-6 pt-6 border-t border-slate-100 dark:border-slate-800 relative z-10">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Current Usage</h3>
              
              {currentPlan ? (
                <>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-slate-700 dark:text-slate-200">Students</span>
                      <span className="text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-900 dark:text-white">{mockUsage.students}</span> / {currentPlan.userLimit > 0 ? currentPlan.userLimit : 'Unlimited'}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getPercentage(mockUsage.students, currentPlan.userLimit || 1) > 90 ? 'bg-red-500' : 'bg-primary-500'}`} 
                        style={{ width: `${getPercentage(mockUsage.students, currentPlan.userLimit || 10000)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="font-medium text-slate-700 dark:text-slate-200">Staff Accounts</span>
                      <span className="text-slate-500 dark:text-slate-400"><span className="font-bold text-slate-900 dark:text-white">{mockUsage.staff}</span> / {currentPlan.userLimit > 0 ? Math.floor(currentPlan.userLimit * 0.1) : 'Unlimited'}</span>
                    </div>
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${getPercentage(mockUsage.staff, (currentPlan.userLimit * 0.1) || 1) > 90 ? 'bg-red-500' : 'bg-primary-500'}`} 
                        style={{ width: `${getPercentage(mockUsage.staff, (currentPlan.userLimit * 0.1) || 1000)}%` }}
                      ></div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-sm">
                  You are currently on a free trial with limited capacity. Upgrade to a paid plan to unlock features.
                </div>
              )}
            </div>
          </div>

          {/* Invoices */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Billing History</h3>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4 pl-6">Invoice</th>
                  <th className="p-4">Date</th>
                  <th className="p-4">Amount</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 pr-6 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 dark:text-slate-300 font-medium">
                      No invoices available.
                    </td>
                  </tr>
                ) : (
                  invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="p-4 pl-6 font-medium text-slate-900 dark:text-white flex items-center gap-2">
                        <FileText size={16} className="text-slate-400 dark:text-slate-300" /> {inv.id}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-300">{new Date(inv.date).toLocaleDateString('en-GB')}</td>
                      <td className="p-4 font-semibold text-slate-900 dark:text-white">₹{inv.amount}</td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700">
                          <CheckCircle2 size={12} /> Paid
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right">
                        <button className="p-2 text-slate-400 dark:text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-800 rounded-lg transition-colors">
                          <Download size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: Payment Method */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Payment Method</h3>
              <button className="text-primary-600 hover:text-primary-700 text-sm font-medium">Edit</button>
            </div>
            
            <div className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800">
              <div className="w-12 h-8 bg-slate-200 dark:bg-slate-700 rounded flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 text-xs tracking-wider">
                VISA
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">•••• •••• •••• 4242</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Expires 12/28</p>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-4 leading-relaxed">
              This card will be automatically charged ₹{school?.calculatedTotalAmount || 0} on the 1st of every {school?.billingCycle === 'yearly' ? 'year' : 'month'}.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex gap-3 text-slate-700 dark:text-slate-200 mb-2">
              <AlertCircle size={20} className="text-amber-500 shrink-0" />
              <h3 className="font-bold text-slate-900 dark:text-white">Need Help?</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-4 pl-8">
              If you have questions about your billing or need a custom enterprise plan, please contact our support team.
            </p>
            <button className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm">
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
