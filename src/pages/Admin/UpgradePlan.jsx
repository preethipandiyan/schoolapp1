import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getSubscriptionPlans, getSchool, updateSchoolStatus } from '../../firebase/firestore'; // Using updateSchoolStatus or create a specific update wrapper
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useNavigate } from 'react-router-dom';
import { LuCircleCheck as CheckCircle2, LuArrowRight as ArrowRight, LuZap as Zap, LuShield as Shield, LuCircleHelp as HelpCircle } from 'react-icons/lu';

export default function UpgradePlan() {
  const { userProfile } = useAuth();
  const schoolId = userProfile?.schoolId;
  const navigate = useNavigate();

  const [plans, setPlans] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allPlans, schoolData] = await Promise.all([
        getSubscriptionPlans(),
        getSchool(schoolId)
      ]);
      // Filter out inactive plans and sort plans by price
      const activePlans = allPlans.filter(plan => plan.active !== false);
      setPlans(activePlans.sort((a, b) => (a.pricePerUserPerYear || 0) - (b.pricePerUserPerYear || 0)));
      setCurrentPlanId(schoolData?.planId);
    } catch (error) {
      console.error("Error fetching upgrade data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId) => {
    // MOCK UPGRADE FLOW
    setUpgrading(true);
    try {
      const schoolRef = doc(db, "schools", schoolId);
      await updateDoc(schoolRef, {
        planId: planId,
        billingCycle: billingCycle,
        subscriptionStatus: 'active'
      });
      // Delay for UX
      setTimeout(() => {
        navigate('/admin/billing');
      }, 1500);
    } catch (error) {
      console.error("Error upgrading:", error);
      setUpgrading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[80vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto pb-24">
      <div className="text-center max-w-2xl mx-auto mb-16 mt-8">
        <h1 className="text-4xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">Upgrade your Workspace</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Unlock more students, advanced features, and premium support by selecting a plan that fits your institution.
        </p>
        
        {/* Billing Toggle */}
        <div className="flex items-center justify-center mt-8">
          <div className="bg-slate-100 dark:bg-slate-700 p-1 rounded-xl inline-flex relative">
            <button 
              onClick={() => setBillingCycle('monthly')}
              className={`relative px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white shadow-sm bg-white dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Monthly billing
            </button>
            <button 
              onClick={() => setBillingCycle('yearly')}
              className={`relative px-6 py-2.5 rounded-lg text-sm font-semibold transition-all ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white shadow-sm bg-white dark:bg-slate-900' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            >
              Yearly billing
              <span className="absolute -top-3 -right-3 bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded-full border border-green-200">Save 20%</span>
            </button>
          </div>
        </div>
      </div>

      {upgrading ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xl p-16 text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6 relative">
            <Zap size={32} className="text-primary-600 animate-pulse" />
            <div className="absolute inset-0 border-4 border-primary-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Processing Payment...</h3>
          <p className="text-slate-500 dark:text-slate-400">Please do not close this window.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {plans.map((plan, idx) => {
            const isCurrent = currentPlanId === plan.id;
            const priceYearly = plan.pricePerUserPerYear || 0;
            const priceMonthly = Math.round(priceYearly / 12);
            const price = billingCycle === 'monthly' ? priceMonthly : priceYearly;
            const isPopular = idx === 1; // Highlight middle plan

            return (
              <div 
                key={plan.id} 
                className={`rounded-3xl border relative flex flex-col transition-transform hover:-translate-y-1 duration-300 ${
                  isPopular 
                    ? 'bg-gradient-to-b from-primary-600 to-primary-800 border-primary-500 shadow-xl shadow-primary-600/20 text-white' 
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 shadow-lg text-slate-900 dark:text-white'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-950 px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm">
                    Most Popular
                  </div>
                )}
                
                <div className="p-8 pb-0">
                  <h3 className={`text-xl font-bold mb-2 ${isPopular ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-extrabold">₹{price}</span>
                    <span className={`text-sm font-medium ${isPopular ? 'text-primary-200' : 'text-slate-500 dark:text-slate-400'}`}>/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                  </div>
                  <p className={`text-sm ${isPopular ? 'text-primary-100' : 'text-slate-500 dark:text-slate-400'}`}>
                    {plan.userLimit > 0 ? `Up to ${plan.userLimit}` : 'Unlimited'} Users
                  </p>
                </div>

                <div className="p-8 flex flex-col flex-1">
                  <ul className="space-y-4 mb-8 flex-1">
                    {plan.cloudStorageGB > 0 && (
                      <li className="flex items-start gap-3">
                        <CheckCircle2 size={18} className={`shrink-0 ${isPopular ? 'text-amber-400' : 'text-primary-500'}`} />
                        <span className={`text-sm ${isPopular ? 'text-primary-50' : 'text-slate-600 dark:text-slate-300'}`}>{plan.cloudStorageGB}GB Cloud Storage</span>
                      </li>
                    )}
                    {plan.modules && Object.entries(plan.modules).filter(([_, v]) => v).map(([key, _]) => (
                      <li key={key} className="flex items-start gap-3">
                        <CheckCircle2 size={18} className={`shrink-0 ${isPopular ? 'text-amber-400' : 'text-primary-500'}`} />
                        <span className={`text-sm ${isPopular ? 'text-primary-50' : 'text-slate-600 dark:text-slate-300'} capitalize`}>
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <button 
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={isCurrent}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all flex justify-center items-center gap-2 ${
                      isCurrent
                        ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-300 cursor-not-allowed border border-slate-200 dark:border-slate-700'
                        : isPopular
                          ? 'bg-amber-400 hover:bg-amber-500 text-amber-950 shadow-lg shadow-amber-400/30'
                          : 'bg-primary-50 hover:bg-primary-100 dark:hover:bg-slate-700 text-primary-700 border border-primary-200'
                    }`}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                    {!isCurrent && <ArrowRight size={18} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Trust Badges */}
      {!upgrading && (
        <div className="mt-20 flex justify-center gap-12 border-t border-slate-200 dark:border-slate-700 pt-12 text-slate-400 dark:text-slate-300">
          <div className="flex items-center gap-2">
            <Shield size={24} />
            <span className="text-sm font-medium">Bank-level Security</span>
          </div>
          <div className="flex items-center gap-2">
            <HelpCircle size={24} />
            <span className="text-sm font-medium">24/7 Support</span>
          </div>
        </div>
      )}
    </div>
  );
}
