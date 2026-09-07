import React, { useState, useEffect } from 'react';
import { subscribeToAllSchools, subscribeToPlans } from '../../firebase/firestore';
import { Link } from 'react-router-dom';
import { LuCreditCard as CreditCard, LuArrowUpRight as ArrowUpRight, LuTrendingUp as TrendingUp, LuCircleAlert as AlertCircle, LuCircleCheck as CheckCircle2 } from 'react-icons/lu';

export default function SubscriptionsList() {
  const [schools, setSchools] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setLoading(true);
    let schoolsUnsub, plansUnsub;

    schoolsUnsub = subscribeToAllSchools((schoolsData) => {
      setSchools(schoolsData);
      setLoading(false);
    });

    plansUnsub = subscribeToPlans((plansData) => {
      setPlans(plansData);
    });

    return () => {
      if (schoolsUnsub) schoolsUnsub();
      if (plansUnsub) plansUnsub();
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [schools]);

  // Calculate MRR (Monthly Recurring Revenue)
  const calculateMRR = () => {
    let mrr = 0;
    schools.forEach(school => {
      if (school.status === 'approved' && school.planId) {
        const plan = plans.find(p => p.id === school.planId);
        if (plan) {
          // Simplification: assume all are on monthly billing for MRR
          mrr += plan.priceMonthly;
        }
      }
    });
    return mrr;
  };

  const approvedSchools = schools.filter(s => s.status === 'approved');
  const totalPages = Math.ceil(approvedSchools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedApprovedSchools = approvedSchools.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto min-w-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Subscriptions Overview</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">Monitor active tenant subscriptions and revenue.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-600 border-t-transparent"></div>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-100 text-green-700 rounded-lg">
                  <TrendingUp size={20} />
                </div>
                <h3 className="font-semibold text-slate-600 dark:text-slate-300">Total MRR</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">₹{calculateMRR().toLocaleString()}</p>
            </div>
            
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                  <CreditCard size={20} />
                </div>
                <h3 className="font-semibold text-slate-600 dark:text-slate-300">Active Subscriptions</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {schools.filter(s => s.status === 'approved' && s.planId).length}
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg">
                  <AlertCircle size={20} />
                </div>
                <h3 className="font-semibold text-slate-600 dark:text-slate-300">Free Tier / Pending</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900 dark:text-white">
                {schools.filter(s => !s.planId).length}
              </p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Tenant Subscriptions</h2>
            </div>
            <div className="w-full min-w-0 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-max">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <th className="p-4 pl-6">School Name</th>
                    <th className="p-4">Current Plan</th>
                    <th className="p-4">Billing Cycle</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 pr-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedApprovedSchools.map(school => {
                    const plan = plans.find(p => p.id === school.planId);
                    return (
                      <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 pl-6 font-semibold text-slate-900 dark:text-white">{school.name}</td>
                        <td className="p-4">
                          {plan ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-primary-100 text-primary-800">
                              {plan.name}
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400 italic">No Plan (Free/Trial)</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 dark:text-slate-300">
                          {plan ? (school.billingCycle || 'Monthly') : '-'}
                        </td>
                        <td className="p-4">
                          {plan ? (
                            <span className="inline-flex items-center gap-1.5 text-green-700 font-medium">
                              <CheckCircle2 size={16} /> Active
                            </span>
                          ) : (
                            <span className="text-slate-500 dark:text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <Link 
                            to={`/superadmin/tenants/${school.id}`}
                            className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 font-medium"
                          >
                            View Details <ArrowUpRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                  {approvedSchools.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-500 dark:text-slate-400">
                        No active subscriptions found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                  Showing <span className="font-semibold text-slate-900 dark:text-white">{startIndex + 1}</span> to{' '}
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {Math.min(startIndex + itemsPerPage, approvedSchools.length)}
                  </span>{' '}
                  of <span className="font-semibold text-slate-900 dark:text-white">{approvedSchools.length}</span> subscriptions
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3.5 py-2 rounded-xl text-sm font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  {Array.from({ length: totalPages }).map((_, idx) => {
                    const pageNum = idx + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`h-9 w-9 flex items-center justify-center rounded-xl text-sm font-bold transition-all ${
                          currentPage === pageNum
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
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
        </>
      )}
    </div>
  );
}
